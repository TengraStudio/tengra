import { spawn } from 'child_process';
import vm from 'vm';

import { appLogger } from '@main/logging/logger';
import { withRetry } from '@main/utils/ipc-retry.util';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { getErrorMessage } from '@shared/utils/error.util';
import { ipcMain } from 'electron';
import { z } from 'zod';

const SupportedLanguageSchema = z.enum(['javascript', 'typescript', 'python', 'shell']);
const CodeSandboxUiStateSchema = z.enum(['ready', 'empty', 'failure']);

const CODE_SANDBOX_ERROR_CODE = {
    VALIDATION: 'CODE_SANDBOX_VALIDATION_ERROR',
    EXECUTION_FAILED: 'CODE_SANDBOX_EXECUTION_FAILED',
    POLICY_BLOCKED: 'CODE_SANDBOX_POLICY_BLOCKED',
    TRANSIENT: 'CODE_SANDBOX_TRANSIENT_ERROR',
    TIMEOUT: 'CODE_SANDBOX_TIMEOUT'
} as const;

const CODE_SANDBOX_MESSAGE_KEY = {
    VALIDATION_FAILED: 'errors.unexpected',
    EXECUTION_FAILED: 'errors.unexpected',
    SECURITY_BLOCKED: 'errors.unexpected',
    TIMEOUT: 'errors.unexpected'
} as const;

const CODE_SANDBOX_PERFORMANCE_BUDGET_MS = {
    FAST: 30,
    EXECUTE: 260
} as const;

const MAX_CODE_SANDBOX_TELEMETRY_EVENTS = 200;

interface CodeSandboxChannelMetrics {
    calls: number;
    failures: number;
    retries: number;
    validationFailures: number;
    budgetExceededCount: number;
    lastDurationMs: number;
    lastErrorCode: string | null;
}

interface CodeSandboxTelemetryEvent {
    channel: string;
    event: 'success' | 'failure' | 'retry' | 'validation-failure';
    timestamp: number;
    durationMs?: number;
    code?: string;
}

const codeSandboxTelemetry = {
    totalCalls: 0,
    totalFailures: 0,
    totalRetries: 0,
    validationFailures: 0,
    budgetExceededCount: 0,
    lastErrorCode: null as string | null,
    channels: {} as Record<string, CodeSandboxChannelMetrics>,
    events: [] as CodeSandboxTelemetryEvent[]
};

const getCodeSandboxChannelMetric = (channel: string): CodeSandboxChannelMetrics => {
    if (!codeSandboxTelemetry.channels[channel]) {
        codeSandboxTelemetry.channels[channel] = {
            calls: 0,
            failures: 0,
            retries: 0,
            validationFailures: 0,
            budgetExceededCount: 0,
            lastDurationMs: 0,
            lastErrorCode: null
        };
    }
    return codeSandboxTelemetry.channels[channel];
};

const trackCodeSandboxEvent = (
    channel: string,
    event: CodeSandboxTelemetryEvent['event'],
    details: { durationMs?: number; code?: string } = {}
): void => {
    codeSandboxTelemetry.events = [...codeSandboxTelemetry.events, {
        channel,
        event,
        timestamp: Date.now(),
        durationMs: details.durationMs,
        code: details.code
    }].slice(-MAX_CODE_SANDBOX_TELEMETRY_EVENTS);
};

const getCodeSandboxBudgetForChannel = (channel: string): number => {
    if (channel === 'code-sandbox:languages' || channel === 'code-sandbox:health') {
        return CODE_SANDBOX_PERFORMANCE_BUDGET_MS.FAST;
    }
    return CODE_SANDBOX_PERFORMANCE_BUDGET_MS.EXECUTE;
};

const trackCodeSandboxSuccess = (channel: string, durationMs: number): void => {
    const channelMetric = getCodeSandboxChannelMetric(channel);
    codeSandboxTelemetry.totalCalls += 1;
    channelMetric.calls += 1;
    channelMetric.lastDurationMs = durationMs;

    const budgetMs = getCodeSandboxBudgetForChannel(channel);
    if (durationMs > budgetMs) {
        codeSandboxTelemetry.budgetExceededCount += 1;
        channelMetric.budgetExceededCount += 1;
        appLogger.warn('CodeSandboxIPC', `[${channel}] performance budget exceeded: ${durationMs}ms > ${budgetMs}ms`);
    }

    trackCodeSandboxEvent(channel, 'success', { durationMs });
};

const trackCodeSandboxFailure = (
    channel: string,
    durationMs: number,
    errorCode: string,
    isValidationFailure: boolean
): void => {
    const channelMetric = getCodeSandboxChannelMetric(channel);
    codeSandboxTelemetry.totalCalls += 1;
    codeSandboxTelemetry.totalFailures += 1;
    codeSandboxTelemetry.lastErrorCode = errorCode;
    channelMetric.calls += 1;
    channelMetric.failures += 1;
    channelMetric.lastDurationMs = durationMs;
    channelMetric.lastErrorCode = errorCode;

    if (isValidationFailure) {
        codeSandboxTelemetry.validationFailures += 1;
        channelMetric.validationFailures += 1;
        trackCodeSandboxEvent(channel, 'validation-failure', { durationMs, code: errorCode });
        return;
    }

    trackCodeSandboxEvent(channel, 'failure', { durationMs, code: errorCode });
};

const trackCodeSandboxRetries = (channel: string, count: number): void => {
    if (count <= 0) {
        return;
    }
    const channelMetric = getCodeSandboxChannelMetric(channel);
    codeSandboxTelemetry.totalRetries += count;
    channelMetric.retries += count;
    for (let index = 0; index < count; index += 1) {
        trackCodeSandboxEvent(channel, 'retry', { code: CODE_SANDBOX_ERROR_CODE.TRANSIENT });
    }
};

const isValidationFailureMessage = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('invalid')
        || normalized.includes('required')
        || normalized.includes('must be')
        || normalized.includes('expected');
};

const isTransientFailureMessage = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('timeout')
        || normalized.includes('timed out')
        || normalized.includes('temporary')
        || normalized.includes('econnreset')
        || normalized.includes('econnrefused')
        || normalized.includes('busy');
};

const buildCodeSandboxErrorMetadata = (
    error: Error
): { errorCode: string; messageKey: string; retryable: boolean } => {
    const message = getErrorMessage(error);
    if (isValidationFailureMessage(message)) {
        return {
            errorCode: CODE_SANDBOX_ERROR_CODE.VALIDATION,
            messageKey: CODE_SANDBOX_MESSAGE_KEY.VALIDATION_FAILED,
            retryable: false
        };
    }
    if (isTransientFailureMessage(message)) {
        return {
            errorCode: CODE_SANDBOX_ERROR_CODE.TRANSIENT,
            messageKey: CODE_SANDBOX_MESSAGE_KEY.EXECUTION_FAILED,
            retryable: true
        };
    }
    return {
        errorCode: CODE_SANDBOX_ERROR_CODE.EXECUTION_FAILED,
        messageKey: CODE_SANDBOX_MESSAGE_KEY.EXECUTION_FAILED,
        retryable: false
    };
};

const createCodeSandboxHealthPayload = () => {
    const errorRate = codeSandboxTelemetry.totalCalls === 0
        ? 0
        : codeSandboxTelemetry.totalFailures / codeSandboxTelemetry.totalCalls;
    const status = errorRate > 0.05 || codeSandboxTelemetry.budgetExceededCount > 0
        ? 'degraded'
        : 'healthy';

    return {
        status,
        uiState: status === 'healthy' ? 'ready' : 'failure',
        budgets: {
            fastMs: CODE_SANDBOX_PERFORMANCE_BUDGET_MS.FAST,
            executeMs: CODE_SANDBOX_PERFORMANCE_BUDGET_MS.EXECUTE
        },
        metrics: {
            ...codeSandboxTelemetry,
            errorRate
        }
    };
};

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
    language: SupportedLanguageSchema,
    errorCode: z.string().optional(),
    messageKey: z.string().optional(),
    retryable: z.boolean().optional(),
    uiState: CodeSandboxUiStateSchema,
    fallbackUsed: z.boolean().optional()
});

const LanguagesResponseSchema = z.object({
    languages: z.array(SupportedLanguageSchema),
    errorCode: z.string().optional(),
    messageKey: z.string().optional(),
    retryable: z.boolean().optional(),
    uiState: CodeSandboxUiStateSchema,
    fallbackUsed: z.boolean().optional()
});

const CodeSandboxHealthResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        status: z.enum(['healthy', 'degraded']),
        uiState: CodeSandboxUiStateSchema,
        budgets: z.object({
            fastMs: z.literal(30),
            executeMs: z.literal(260)
        }),
        metrics: z.object({
            totalCalls: z.number().int().nonnegative(),
            totalFailures: z.number().int().nonnegative(),
            totalRetries: z.number().int().nonnegative(),
            validationFailures: z.number().int().nonnegative(),
            budgetExceededCount: z.number().int().nonnegative(),
            lastErrorCode: z.string().nullable(),
            channels: z.record(z.string(), z.object({
                calls: z.number().int().nonnegative(),
                failures: z.number().int().nonnegative(),
                retries: z.number().int().nonnegative(),
                validationFailures: z.number().int().nonnegative(),
                budgetExceededCount: z.number().int().nonnegative(),
                lastDurationMs: z.number().int().nonnegative(),
                lastErrorCode: z.string().nullable()
            })),
            events: z.array(z.object({
                channel: z.string(),
                event: z.enum(['success', 'failure', 'retry', 'validation-failure']),
                timestamp: z.number().int().nonnegative(),
                durationMs: z.number().int().nonnegative().optional(),
                code: z.string().optional()
            })),
            errorRate: z.number()
        })
    }),
    error: z.string().optional(),
    errorCode: z.string().optional(),
    messageKey: z.string().optional(),
    retryable: z.boolean().optional(),
    uiState: CodeSandboxUiStateSchema.optional(),
    fallbackUsed: z.boolean().optional()
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
            language,
            errorCode: CODE_SANDBOX_ERROR_CODE.POLICY_BLOCKED,
            messageKey: CODE_SANDBOX_MESSAGE_KEY.SECURITY_BLOCKED,
            retryable: false,
            uiState: 'failure'
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
            language,
            uiState: 'ready'
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isTimedOut = message.toLowerCase().includes('script execution timed out');
        return {
            success: false,
            stdout: stdoutParts.join('\n'),
            stderr: message,
            durationMs: Date.now() - startTime,
            language,
            errorCode: isTimedOut ? CODE_SANDBOX_ERROR_CODE.TIMEOUT : CODE_SANDBOX_ERROR_CODE.EXECUTION_FAILED,
            messageKey: isTimedOut ? CODE_SANDBOX_MESSAGE_KEY.TIMEOUT : CODE_SANDBOX_MESSAGE_KEY.EXECUTION_FAILED,
            retryable: isTimedOut,
            uiState: 'failure'
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
            language,
            errorCode: CODE_SANDBOX_ERROR_CODE.POLICY_BLOCKED,
            messageKey: CODE_SANDBOX_MESSAGE_KEY.SECURITY_BLOCKED,
            retryable: false,
            uiState: 'failure'
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
                language,
                errorCode: CODE_SANDBOX_ERROR_CODE.TIMEOUT,
                messageKey: CODE_SANDBOX_MESSAGE_KEY.TIMEOUT,
                retryable: true,
                uiState: 'failure'
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
                language,
                errorCode: CODE_SANDBOX_ERROR_CODE.TRANSIENT,
                messageKey: CODE_SANDBOX_MESSAGE_KEY.EXECUTION_FAILED,
                retryable: true,
                uiState: 'failure'
            });
        });

        child.on('close', codeValue => {
            clearTimeout(timeoutHandle);
            finalize({
                success: codeValue === 0,
                stdout: stdout.trimEnd(),
                stderr: stderr.trimEnd(),
                durationMs: Date.now() - startTime,
                language,
                errorCode: codeValue === 0 ? undefined : CODE_SANDBOX_ERROR_CODE.EXECUTION_FAILED,
                messageKey: codeValue === 0 ? undefined : CODE_SANDBOX_MESSAGE_KEY.EXECUTION_FAILED,
                retryable: codeValue === 0 ? undefined : false,
                uiState: codeValue === 0 ? 'ready' : 'failure'
            });
        });

        if (stdin) {
            child.stdin.write(stdin);
        }
        child.stdin.end();
    });
};

const executeWithRetryPolicy = async (
    payload: z.infer<typeof ExecuteRequestSchema>
): Promise<z.infer<typeof ExecuteResponseSchema>> => {
    const timeoutMs = payload.timeoutMs ?? 5000;
    const runExecution = async (): Promise<z.infer<typeof ExecuteResponseSchema>> => {
        if (payload.language === 'javascript' || payload.language === 'typescript') {
            return await executeJavascriptSandbox(payload.language, payload.code, timeoutMs);
        }
        return await executeSubprocessSandbox(payload.language, payload.code, timeoutMs, payload.stdin);
    };

    const retryResult = await withRetry(
        async () => {
            const result = await runExecution();
            if (!result.success && result.retryable) {
                throw new Error(result.stderr || 'Transient sandbox execution failure');
            }
            return result;
        },
        {
            maxRetries: 1,
            initialDelayMs: 45,
            maxDelayMs: 200,
            backoffMultiplier: 2,
            jitter: false,
            operationName: 'code-sandbox:execute',
            isRetryable: error => isTransientFailureMessage(getErrorMessage(error))
        }
    );

    trackCodeSandboxRetries('code-sandbox:execute', Math.max(0, retryResult.attempts - 1));

    if (retryResult.success && retryResult.result) {
        return retryResult.result;
    }

    const failure = retryResult.error ?? new Error('Code sandbox execution failed');
    const metadata = buildCodeSandboxErrorMetadata(failure);
    return {
        success: false,
        stdout: '',
        stderr: getErrorMessage(failure),
        durationMs: retryResult.totalDurationMs,
        language: payload.language,
        ...metadata,
        uiState: 'failure',
        fallbackUsed: true
    };
};

export function registerCodeSandboxIpc(): void {
    ipcMain.handle(
        'code-sandbox:languages',
        createValidatedIpcHandler(
            'code-sandbox:languages',
            async () => {
                const startedAt = Date.now();
                const payload = {
                    languages: ['javascript', 'typescript', 'python', 'shell'],
                    uiState: 'ready'
                };
                trackCodeSandboxSuccess('code-sandbox:languages', Date.now() - startedAt);
                return payload;
            },
            {
                argsSchema: z.tuple([]),
                responseSchema: LanguagesResponseSchema,
                onError: (error) => {
                    const metadata = buildCodeSandboxErrorMetadata(error);
                    trackCodeSandboxFailure('code-sandbox:languages', 0, metadata.errorCode, metadata.errorCode === CODE_SANDBOX_ERROR_CODE.VALIDATION);
                    return {
                        languages: [],
                        ...metadata,
                        uiState: 'failure',
                        fallbackUsed: true
                    };
                }
            }
        )
    );

    ipcMain.handle(
        'code-sandbox:execute',
        createValidatedIpcHandler(
            'code-sandbox:execute',
            async (_event, payload: z.infer<typeof ExecuteRequestSchema>) => {
                const startedAt = Date.now();
                const result = await executeWithRetryPolicy(payload);
                const durationMs = Date.now() - startedAt;

                if (result.success) {
                    trackCodeSandboxSuccess('code-sandbox:execute', durationMs);
                    return result;
                }

                const errorCode = result.errorCode ?? CODE_SANDBOX_ERROR_CODE.EXECUTION_FAILED;
                const isValidationFailure = errorCode === CODE_SANDBOX_ERROR_CODE.VALIDATION;
                trackCodeSandboxFailure('code-sandbox:execute', durationMs, errorCode, isValidationFailure);
                return result;
            },
            {
                argsSchema: z.tuple([ExecuteRequestSchema]),
                responseSchema: ExecuteResponseSchema,
                onError: (error) => {
                    const metadata = buildCodeSandboxErrorMetadata(error);
                    trackCodeSandboxFailure('code-sandbox:execute', 0, metadata.errorCode, metadata.errorCode === CODE_SANDBOX_ERROR_CODE.VALIDATION);
                    return {
                        success: false,
                        stdout: '',
                        stderr: getErrorMessage(error),
                        durationMs: 0,
                        language: 'javascript',
                        ...metadata,
                        uiState: 'failure',
                        fallbackUsed: true
                    };
                }
            }
        )
    );

    ipcMain.handle(
        'code-sandbox:health',
        createValidatedIpcHandler(
            'code-sandbox:health',
            async () => {
                const startedAt = Date.now();
                const healthPayload = createCodeSandboxHealthPayload();
                const durationMs = Date.now() - startedAt;
                trackCodeSandboxSuccess('code-sandbox:health', durationMs);
                return {
                    success: true,
                    data: healthPayload
                };
            },
            {
                argsSchema: z.tuple([]),
                responseSchema: CodeSandboxHealthResponseSchema,
                onError: (error) => {
                    const metadata = buildCodeSandboxErrorMetadata(error);
                    trackCodeSandboxFailure('code-sandbox:health', 0, metadata.errorCode, metadata.errorCode === CODE_SANDBOX_ERROR_CODE.VALIDATION);
                    return {
                        success: false,
                        data: {
                            status: 'degraded',
                            uiState: 'failure',
                            budgets: {
                                fastMs: CODE_SANDBOX_PERFORMANCE_BUDGET_MS.FAST,
                                executeMs: CODE_SANDBOX_PERFORMANCE_BUDGET_MS.EXECUTE
                            },
                            metrics: {
                                ...codeSandboxTelemetry,
                                errorRate: 1
                            }
                        },
                        error: getErrorMessage(error),
                        ...metadata,
                        uiState: 'failure',
                        fallbackUsed: true
                    };
                }
            }
        )
    );
}
