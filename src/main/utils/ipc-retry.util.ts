/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * IPC Retry Policy Utility (BACKLOG-0054, 0064, 0074)
 * 
 * Provides standardized retry policies for IPC handlers including:
 * - Exponential backoff with jitter
 * - Configurable max retries
 * - Retryable error detection
 * - Fallback behavior
 * 
 * @module @main/utils/ipc-retry.util
 */

import { appLogger } from '@main/logging/logger';
import { AppErrorCode, getErrorMessage, getErrorRecoveryStrategy } from '@shared/utils/error.util';

/**
 * Retry configuration options
 */
export interface RetryOptions {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries: number;
    /** Initial delay in milliseconds (default: 1000) */
    initialDelayMs: number;
    /** Maximum delay in milliseconds (default: 30000) */
    maxDelayMs: number;
    /** Backoff multiplier (default: 2) */
    backoffMultiplier: number;
    /** Whether to add jitter to delays (default: true) */
    jitter: boolean;
    /** Custom function to determine if an error is retryable */
    isRetryable?: <T>(error: T) => boolean;
    /** Operation name for logging */
    operationName?: string;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitter: true
};

/**
 * Predefined retry policies for different IPC operation categories
 */
export const IPC_RETRY_POLICIES = {
    /**
     * SSH operations - moderate retries for network operations
     */
    ssh: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 15000,
        backoffMultiplier: 2,
        jitter: true
    } satisfies RetryOptions,

    /**
     * Terminal operations - quick retries for process operations
     */
    terminal: {
        maxRetries: 2,
        initialDelayMs: 100,
        maxDelayMs: 2000,
        backoffMultiplier: 2,
        jitter: true
    } satisfies RetryOptions,

    /**
     * Git operations - moderate retries for VCS operations
     */
    git: {
        maxRetries: 3,
        initialDelayMs: 500,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        jitter: true
    } satisfies RetryOptions,

    /**
     * Network operations - aggressive retries for transient failures
     */
    network: {
        maxRetries: 5,
        initialDelayMs: 1000,
        maxDelayMs: 60000,
        backoffMultiplier: 2,
        jitter: true
    } satisfies RetryOptions,

    /**
     * No retries - for non-idempotent operations
     */
    none: {
        maxRetries: 0,
        initialDelayMs: 0,
        maxDelayMs: 0,
        backoffMultiplier: 1,
        jitter: false
    } satisfies RetryOptions
} as const;

/**
 * Error patterns that indicate a retryable error
 */
const RETRYABLE_ERROR_PATTERNS = [
    /timeout/i,
    /etimedout/i,
    /econnreset/i,
    /econnrefused/i,
    /enotfound/i,
    /eai_again/i,
    /network/i,
    /temporary/i,
    /rate limit/i,
    /too many requests/i,
    /service unavailable/i,
    /bad gateway/i,
    /gateway timeout/i
];

/**
 * Error codes that are always retryable
 */
const RETRYABLE_ERROR_CODES = new Set([
    AppErrorCode.NETWORK_ERROR,
    AppErrorCode.TIMEOUT,
    AppErrorCode.RATE_LIMIT,
    AppErrorCode.SSH_TIMEOUT,
    AppErrorCode.SSH_HOST_UNREACHABLE,
    AppErrorCode.SSH_CONNECTION_FAILED,
    AppErrorCode.TERMINAL_PROCESS_FAILED,
    AppErrorCode.TERMINAL_RATE_LIMITED,
    AppErrorCode.GIT_COMMAND_TIMEOUT,
    AppErrorCode.GIT_REMOTE_FAILED
]);

/**
 * Calculates the delay for a given retry attempt with exponential backoff and optional jitter
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
    const baseDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);
    let delay = Math.min(baseDelay, options.maxDelayMs);

    if (options.jitter) {
        // Add up to 25% jitter
        const jitterAmount = delay * 0.25 * Math.random();
        delay = delay + jitterAmount;
    }

    return Math.round(delay);
}

/**
 * Determines if an error is retryable based on its properties
 */
export function isRetryableError<T>(error: T): boolean {
    // Check error code first
    if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as { code: string }).code;
        if (RETRYABLE_ERROR_CODES.has(code as AppErrorCode)) {
            return true;
        }
    }

    // Use recovery strategy
    const strategy = getErrorRecoveryStrategy(error);
    if (strategy.retryable) {
        return true;
    }

    // Check error message patterns
    const message = getErrorMessage(error).toLowerCase();
    for (const pattern of RETRYABLE_ERROR_PATTERNS) {
        if (pattern.test(message)) {
            return true;
        }
    }

    return false;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
    /** The result of the operation if successful */
    result?: T;
    /** The error if all attempts failed */
    error?: Error;
    /** Number of attempts made */
    attempts: number;
    /** Total time spent in milliseconds */
    totalDurationMs: number;
    /** Whether the operation succeeded */
    success: boolean;
}

/**
 * Wraps an async operation with retry logic
 * 
 * @param operation - The async operation to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to a RetryResult
 * 
 * @example
 * ```typescript
 * const result = await withRetry(
 *     async () => await sshService.connect(connection),
 *     { ...IPC_RETRY_POLICIES.ssh, operationName: 'ssh:connect' }
 * );
 * 
 * if (result.success) {
 *     console.log('Connected:', result.result);
 * } else {
 *     console.error('Failed after', result.attempts, 'attempts:', result.error);
 * }
 * ```
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
): Promise<RetryResult<T>> {
    const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
    const startTime = Date.now();
    let lastError: Error | undefined;
    let attempts = 0;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        attempts = attempt + 1;

        try {
            const result = await operation();
            return {
                result,
                attempts,
                totalDurationMs: Date.now() - startTime,
                success: true
            };
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(getErrorMessage(error));

            // Check if we should retry
            const shouldRetry = attempt < opts.maxRetries &&
                (opts.isRetryable ? opts.isRetryable(error) : isRetryableError(error));

            if (shouldRetry) {
                const delay = calculateDelay(attempt, opts);
                const opName = opts.operationName || 'operation';

                appLogger.warn(
                    'IpcRetry',
                    `[${opName}] Attempt ${attempts} failed, retrying in ${delay}ms: ${getErrorMessage(error)}`
                );

                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                // Non-retryable error or max retries reached
                break;
            }
        }
    }

    return {
        error: lastError,
        attempts,
        totalDurationMs: Date.now() - startTime,
        success: false
    };
}

/**
 * Creates a retry wrapper for a specific operation category
 * 
 * @param category - The retry policy category
 * @returns A function that wraps operations with retry logic
 * 
 * @example
 * ```typescript
 * const withSshRetry = createRetryWrapper('ssh');
 * const result = await withSshRetry(
 *     async () => await sshService.connect(connection),
 *     'ssh:connect'
 * );
 * ```
 */
export function createRetryWrapper(category: keyof typeof IPC_RETRY_POLICIES) {
    const policy = IPC_RETRY_POLICIES[category];

    return <T>(
        operation: () => Promise<T>,
        operationName?: string
    ): Promise<RetryResult<T>> => {
        return withRetry(operation, {
            ...policy,
            operationName
        });
    };
}

/**
 * Executes an operation with a fallback value on failure
 * 
 * @param operation - The async operation to execute
 * @param fallback - The fallback value to return on failure
 * @param options - Retry configuration options
 * @returns Promise resolving to the operation result or fallback
 * 
 * @example
 * ```typescript
 * const stats = await withFallback(
 *     async () => await sshService.getSystemStats(connectionId),
 *     { uptime: '-', memory: { total: 0, used: 0, percent: 0 }, cpu: 0, disk: '0%' },
 *     { maxRetries: 1, operationName: 'ssh:getSystemStats' }
 * );
 * ```
 */
export async function withFallback<T>(
    operation: () => Promise<T>,
    fallback: T,
    options: Partial<RetryOptions> = {}
): Promise<T> {
    const result = await withRetry(operation, options);
    if (result.success && result.result !== undefined) {
        return result.result;
    }
    return fallback;
}
