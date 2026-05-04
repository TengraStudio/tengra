/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { spawn } from 'child_process';
import vm from 'vm';

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { withRetry } from '@main/utils/ipc-retry.util';
import { serializeToIpc } from '@main/utils/ipc-serializer.util';
import { RuntimeValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';

type UnsafeValue = ReturnType<typeof JSON.parse>;

const CODE_SANDBOX_ERROR_CODE = {
    VALIDATION: 'CODE_SANDBOX_VALIDATION_ERROR',
    EXECUTION_FAILED: 'CODE_SANDBOX_EXECUTION_FAILED',
    POLICY_BLOCKED: 'CODE_SANDBOX_POLICY_BLOCKED',
    TRANSIENT: 'CODE_SANDBOX_TRANSIENT_ERROR',
    TIMEOUT: 'CODE_SANDBOX_TIMEOUT'
} as const;

const CODE_SANDBOX_MESSAGE_KEY = {
    VALIDATION_FAILED: 'codeSandbox.errors.validationFailed',
    EXECUTION_FAILED: 'codeSandbox.errors.executionFailed',
    SECURITY_BLOCKED: 'codeSandbox.errors.securityBlocked',
    TIMEOUT: 'codeSandbox.errors.timeout'
} as const;

const CODE_SANDBOX_STDERR_FALLBACK = {
    VALIDATION_FAILED: 'Invalid code sandbox request.',
    EXECUTION_FAILED: 'Code execution failed. Please check your code and try again.',
    SECURITY_BLOCKED: 'Blocked by sandbox security policy',
    TIMEOUT: 'Execution timed out.',
    TRANSIENT_FAILURE: 'Temporary sandbox execution failure. Please retry.'
} as const;

const JS_BLOCKED_PATTERNS = [
    /\bprocess\b/i,
    /\brequire\s*\(/i,
    /\bimport\s+/i,
    /\bchild_process\b/i,
    /\bfs\b/i,
    /\bnet\b/i,
    /\bhttp\b/i,
    /\bhttps\b/i,
    /\.constructor\b/i,
    /\b__proto__\b/i,
    /\bprototype\b/i,
    /\bProxy\b/,
    /\bReflect\b/
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

export class CodeSandboxService {
    private telemetry = {
        totalCalls: 0,
        totalFailures: 0,
        totalRetries: 0,
        validationFailures: 0,
        budgetExceededCount: 0,
        lastErrorCode: null as string | null,
    };

    @ipc('code-sandbox:languages')
    async getSupportedLanguages(): Promise<RuntimeValue> {
        return serializeToIpc({
            languages: ['javascript', 'typescript', 'python', 'shell'],
            uiState: 'ready'
        });
    }

    @ipc('code-sandbox:execute')
    async executeCode(payload: { language: string; code: string; timeoutMs?: number; stdin?: string }): Promise<RuntimeValue> {
        const startedAt = Date.now();
        const result = await this.executeWithRetryPolicy(payload);
        const durationMs = Date.now() - startedAt;

        if (result.success) {
            this.telemetry.totalCalls++;
            return serializeToIpc(result);
        }

        this.telemetry.totalCalls++;
        this.telemetry.totalFailures++;
        this.telemetry.lastErrorCode = result.errorCode ?? CODE_SANDBOX_ERROR_CODE.EXECUTION_FAILED;
        
        return serializeToIpc(result);
    }

    @ipc('code-sandbox:health')
    async getHealth(): Promise<RuntimeValue> {
        const errorRate = this.telemetry.totalCalls === 0
            ? 0
            : this.telemetry.totalFailures / this.telemetry.totalCalls;
        const status = errorRate > 0.05 ? 'degraded' : 'healthy';

        return serializeToIpc({
            status,
            uiState: status === 'healthy' ? 'ready' : 'failure',
            metrics: {
                ...this.telemetry,
                errorRate
            }
        });
    }

    private async executeWithRetryPolicy(payload: { language: string; code: string; timeoutMs?: number; stdin?: string }): Promise<UnsafeValue> {
        const timeoutMs = payload.timeoutMs ?? 5000;
        
        const retryResult = await withRetry(
            async () => {
                const result = await this.runExecution(payload.language, payload.code, timeoutMs, payload.stdin);
                if (!result.success && this.isTransientFailure(result)) {
                    throw new Error(result.stderr || CODE_SANDBOX_STDERR_FALLBACK.TRANSIENT_FAILURE);
                }
                return result;
            },
            {
                maxRetries: 1,
                initialDelayMs: 45,
                maxDelayMs: 200,
                operationName: 'code-sandbox:execute',
            }
        );

        if (retryResult.success && retryResult.result) {
            return retryResult.result;
        }

        const failure = retryResult.error ?? new Error(CODE_SANDBOX_STDERR_FALLBACK.EXECUTION_FAILED);
        const metadata = this.buildErrorMetadata(failure);
        return {
            success: false,
            stdout: '',
            stderr: this.resolveUserFacingStderr(metadata.messageKey),
            durationMs: retryResult.totalDurationMs,
            language: payload.language,
            ...metadata,
            uiState: 'failure',
            fallbackUsed: true
        };
    }

    private async runExecution(language: string, code: string, timeoutMs: number, stdin?: string): Promise<UnsafeValue> {
        if (language === 'javascript' || language === 'typescript') {
            return await this.executeJavascriptSandbox(language as UnsafeValue, code, timeoutMs);
        }
        return await this.executeSubprocessSandbox(language as UnsafeValue, code, timeoutMs, stdin);
    }

    private async executeJavascriptSandbox(language: 'javascript' | 'typescript', code: string, timeoutMs: number): Promise<UnsafeValue> {
        const startTime = Date.now();
        if (this.containsBlockedPattern(code, JS_BLOCKED_PATTERNS)) {
            return {
                success: false,
                stdout: '',
                stderr: CODE_SANDBOX_STDERR_FALLBACK.SECURITY_BLOCKED,
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
        const sandbox = {
            console: {
                log: (...args: UnsafeValue[]) => stdoutParts.push(args.map(value => String(value)).join(' ')),
                error: (...args: UnsafeValue[]) => stderrParts.push(args.map(value => String(value)).join(' '))
            },
            Math,
            Date,
            JSON,
        };
        const context = vm.createContext(sandbox);

        try {
            const script = new vm.Script(code, { filename: `sandbox.${language === 'typescript' ? 'ts' : 'js'}` });
            const executionResult = script.runInContext(context, { timeout: timeoutMs });
            return {
                success: true,
                stdout: stdoutParts.join('\n'),
                stderr: stderrParts.join('\n'),
                result: executionResult === undefined ? undefined : String(executionResult),
                durationMs: Date.now() - startTime,
                language,
                uiState: 'ready'
            };
        } catch (error) {
            const message = getErrorMessage(error);
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
    }

    private async executeSubprocessSandbox(language: 'python' | 'shell', code: string, timeoutMs: number, stdin?: string): Promise<UnsafeValue> {
        const startTime = Date.now();
        const blockedPatterns = language === 'python' ? PYTHON_BLOCKED_PATTERNS : SHELL_BLOCKED_PATTERNS;
        if (this.containsBlockedPattern(code, blockedPatterns)) {
            return {
                success: false,
                stdout: '',
                stderr: CODE_SANDBOX_STDERR_FALLBACK.SECURITY_BLOCKED,
                durationMs: Date.now() - startTime,
                language,
                errorCode: CODE_SANDBOX_ERROR_CODE.POLICY_BLOCKED,
                messageKey: CODE_SANDBOX_MESSAGE_KEY.SECURITY_BLOCKED,
                retryable: false,
                uiState: 'failure'
            };
        }

        const { command, args } = this.resolveShellProgram(language);
        return await new Promise(resolve => {
            const child = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true
            });

            child.stdin.write(code);
            child.stdin.end();

            let stdout = '';
            let stderr = '';
            let resolved = false;

            const timeoutHandle = setTimeout(() => {
                child.kill();
                if (!resolved) {
                    resolved = true;
                    resolve({
                        success: false,
                        stdout,
                        stderr: stderr ? `${stderr}\n${CODE_SANDBOX_STDERR_FALLBACK.TIMEOUT}` : CODE_SANDBOX_STDERR_FALLBACK.TIMEOUT,
                        durationMs: Date.now() - startTime,
                        language,
                        errorCode: CODE_SANDBOX_ERROR_CODE.TIMEOUT,
                        messageKey: CODE_SANDBOX_MESSAGE_KEY.TIMEOUT,
                        retryable: true,
                        uiState: 'failure'
                    });
                }
            }, timeoutMs);

            child.stdout.on('data', chunk => { stdout += chunk.toString(); });
            child.stderr.on('data', chunk => { stderr += chunk.toString(); });

            child.on('error', error => {
                clearTimeout(timeoutHandle);
                if (!resolved) {
                    resolved = true;
                    resolve({
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
                }
            });

            child.on('close', codeValue => {
                clearTimeout(timeoutHandle);
                if (!resolved) {
                    resolved = true;
                    resolve({
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
                }
            });

            if (stdin) {
                child.stdin.write(stdin);
            }
        });
    }

    private resolveShellProgram(language: 'python' | 'shell'): { command: string; args: string[] } {
        if (language === 'python') {
            return { command: process.platform === 'win32' ? 'python' : 'python3', args: ['-I', '-'] };
        }
        if (process.platform === 'win32') {
            return { command: 'powershell.exe', args: ['-NoProfile', '-Command', '-'] };
        }
        return { command: 'bash', args: ['--restricted', '-s'] };
    }

    private containsBlockedPattern(code: string, patterns: RegExp[]): boolean {
        return patterns.some(pattern => pattern.test(code));
    }

    private isTransientFailure(result: UnsafeValue): boolean {
        const message = (result.stderr || '').toLowerCase();
        return message.includes('timeout') || message.includes('timed out') || message.includes('temporary');
    }

    private buildErrorMetadata(error: Error): { errorCode: string; messageKey: string; retryable: boolean } {
        const message = getErrorMessage(error).toLowerCase();
        if (message.includes('timeout') || message.includes('timed out')) {
            return { errorCode: CODE_SANDBOX_ERROR_CODE.TIMEOUT, messageKey: CODE_SANDBOX_MESSAGE_KEY.TIMEOUT, retryable: true };
        }
        return { errorCode: CODE_SANDBOX_ERROR_CODE.EXECUTION_FAILED, messageKey: CODE_SANDBOX_MESSAGE_KEY.EXECUTION_FAILED, retryable: false };
    }

    private resolveUserFacingStderr(messageKey: string): string {
        if (messageKey === CODE_SANDBOX_MESSAGE_KEY.SECURITY_BLOCKED) {return CODE_SANDBOX_STDERR_FALLBACK.SECURITY_BLOCKED;}
        if (messageKey === CODE_SANDBOX_MESSAGE_KEY.TIMEOUT) {return CODE_SANDBOX_STDERR_FALLBACK.TIMEOUT;}
        return CODE_SANDBOX_STDERR_FALLBACK.EXECUTION_FAILED;
    }
}
