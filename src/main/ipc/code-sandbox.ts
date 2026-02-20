import { spawn } from 'child_process';
import vm from 'vm';

import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';
import { z } from 'zod';

const SupportedLanguageSchema = z.enum(['javascript', 'typescript', 'python', 'shell']);

const ExecuteRequestSchema = z.object({
    language: SupportedLanguageSchema,
    code: z.string().min(1).max(20000),
    timeoutMs: z.number().int().min(100).max(30000).optional(),
    stdin: z.string().max(10000).optional()
});

const ExecuteResponseSchema = z.object({
    success: z.boolean(),
    stdout: z.string(),
    stderr: z.string(),
    result: z.string().optional(),
    durationMs: z.number().int().nonnegative(),
    language: SupportedLanguageSchema
});

const LanguagesResponseSchema = z.object({
    languages: z.array(SupportedLanguageSchema)
});

const JS_BLOCKED_PATTERNS = [
    /\bprocess\b/i,
    /\brequire\s*\(/i,
    /\bimport\s+/i,
    /\bchild_process\b/i,
    /\bfs\b/i,
    /\bnet\b/i,
    /\bhttp\b/i,
    /\bhttps\b/i
];

const PYTHON_BLOCKED_PATTERNS = [
    /\bimport\s+os\b/i,
    /\bimport\s+subprocess\b/i,
    /\bimport\s+socket\b/i,
    /__import__/i,
    /\bopen\s*\(/i
];

const SHELL_BLOCKED_PATTERNS = [
    /\brm\s+-rf\b/i,
    /\bformat\b/i,
    /\bshutdown\b/i,
    /\breg\s+delete\b/i,
    /\bdel\s+\/f\s+\/s\s+\/q\b/i
];

const containsBlockedPattern = (code: string, patterns: RegExp[]): boolean => {
    return patterns.some(pattern => pattern.test(code));
};

const executeJavascriptSandbox = async (
    language: 'javascript' | 'typescript',
    code: string,
    timeoutMs: number
): Promise<z.infer<typeof ExecuteResponseSchema>> => {
    const startTime = Date.now();
    if (containsBlockedPattern(code, JS_BLOCKED_PATTERNS)) {
        return {
            success: false,
            stdout: '',
            stderr: 'Blocked by sandbox security policy',
            durationMs: Date.now() - startTime,
            language
        };
    }

    const stdoutParts: string[] = [];
    const stderrParts: string[] = [];
    const context = vm.createContext({
        console: {
            log: (...args: unknown[]) => stdoutParts.push(args.map(value => String(value)).join(' ')),
            error: (...args: unknown[]) => stderrParts.push(args.map(value => String(value)).join(' '))
        },
        Math,
        Date,
        JSON,
        setTimeout: undefined,
        setInterval: undefined
    });

    try {
        const script = new vm.Script(code, { filename: `sandbox.${language === 'typescript' ? 'ts' : 'js'}` });
        const executionResult = script.runInContext(context, { timeout: timeoutMs });
        const resultText = executionResult === undefined ? undefined : String(executionResult);
        return {
            success: true,
            stdout: stdoutParts.join('\n'),
            stderr: stderrParts.join('\n'),
            result: resultText,
            durationMs: Date.now() - startTime,
            language
        };
    } catch (error) {
        return {
            success: false,
            stdout: stdoutParts.join('\n'),
            stderr: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - startTime,
            language
        };
    }
};

const resolveShellProgram = (language: 'python' | 'shell'): { command: string; args: string[] } => {
    if (language === 'python') {
        return { command: process.platform === 'win32' ? 'python' : 'python3', args: ['-I', '-c'] };
    }
    if (process.platform === 'win32') {
        return { command: 'powershell.exe', args: ['-NoProfile', '-Command'] };
    }
    return { command: 'bash', args: ['-lc'] };
};

const executeSubprocessSandbox = async (
    language: 'python' | 'shell',
    code: string,
    timeoutMs: number,
    stdin?: string
): Promise<z.infer<typeof ExecuteResponseSchema>> => {
    const startTime = Date.now();
    const blockedPatterns = language === 'python' ? PYTHON_BLOCKED_PATTERNS : SHELL_BLOCKED_PATTERNS;
    if (containsBlockedPattern(code, blockedPatterns)) {
        return {
            success: false,
            stdout: '',
            stderr: 'Blocked by sandbox security policy',
            durationMs: Date.now() - startTime,
            language
        };
    }

    const { command, args } = resolveShellProgram(language);
    return await new Promise<z.infer<typeof ExecuteResponseSchema>>(resolve => {
        const child = spawn(command, [...args, code], {
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true
        });

        let stdout = '';
        let stderr = '';
        let resolved = false;
        const finalize = (response: z.infer<typeof ExecuteResponseSchema>): void => {
            if (resolved) {
                return;
            }
            resolved = true;
            resolve(response);
        };

        const timeoutHandle = setTimeout(() => {
            child.kill();
            finalize({
                success: false,
                stdout,
                stderr: stderr ? `${stderr}\nTimed out` : 'Timed out',
                durationMs: Date.now() - startTime,
                language
            });
        }, timeoutMs);

        child.stdout.on('data', chunk => {
            stdout += chunk.toString();
        });

        child.stderr.on('data', chunk => {
            stderr += chunk.toString();
        });

        child.on('error', error => {
            clearTimeout(timeoutHandle);
            finalize({
                success: false,
                stdout,
                stderr: error.message,
                durationMs: Date.now() - startTime,
                language
            });
        });

        child.on('close', codeValue => {
            clearTimeout(timeoutHandle);
            finalize({
                success: codeValue === 0,
                stdout: stdout.trimEnd(),
                stderr: stderr.trimEnd(),
                durationMs: Date.now() - startTime,
                language
            });
        });

        if (stdin) {
            child.stdin.write(stdin);
        }
        child.stdin.end();
    });
};

export function registerCodeSandboxIpc(): void {
    ipcMain.handle(
        'code-sandbox:languages',
        createValidatedIpcHandler(
            'code-sandbox:languages',
            async () => {
                return {
                    languages: ['javascript', 'typescript', 'python', 'shell']
                };
            },
            {
                argsSchema: z.tuple([]),
                responseSchema: LanguagesResponseSchema
            }
        )
    );

    ipcMain.handle(
        'code-sandbox:execute',
        createValidatedIpcHandler(
            'code-sandbox:execute',
            async (_event, payload: z.infer<typeof ExecuteRequestSchema>) => {
                const timeoutMs = payload.timeoutMs ?? 5000;
                if (payload.language === 'javascript' || payload.language === 'typescript') {
                    return await executeJavascriptSandbox(payload.language, payload.code, timeoutMs);
                }
                return await executeSubprocessSandbox(payload.language, payload.code, timeoutMs, payload.stdin);
            },
            {
                argsSchema: z.tuple([ExecuteRequestSchema]),
                responseSchema: ExecuteResponseSchema
            }
        )
    );
}
