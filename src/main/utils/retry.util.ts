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
 * @fileoverview Retry utility with exponential backoff and jitter.
 */

import { CatchError, JsonValue } from '@shared/types/common';
import { getErrorMessage as getSharedErrorMessage } from '@shared/utils/error.util';
export { getSharedErrorMessage as getErrorMessage };

/**
 * Configuration options for retry behavior.
 */
/**
 * Configuration options for retry behavior.
 */
export interface RetryOptions {
    maxRetries?: number
    baseDelayMs?: number
    maxDelayMs?: number
    jitterFactor?: number
    shouldRetry?: (error: CatchError, attempt: number) => boolean
    onRetry?: (error: CatchError, attempt: number, delayMs: number) => void
}

/**
 * Default retry configuration values.
 */
const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    jitterFactor: 0.2,
    shouldRetry: defaultShouldRetry,
    onRetry: () => { }
};

/**
 * Default retry condition that checks for retryable error types.
 */
function defaultShouldRetry(error: CatchError, _attempt: number): boolean {
    if (!error || typeof error !== 'object') { return false; }
    const err = error as Record<string, JsonValue | undefined>;

    if (isNetworkError(err)) { return true; }
    if (isRateLimitError(err)) { return true; }
    if (isServerError(err)) { return true; }
    if (isGenericNetworkError(err)) { return true; }

    return false;
}

function isNetworkError(err: Record<string, JsonValue | undefined>): boolean {
    return err.code === 'ECONNRESET' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT';
}

function isRateLimitError(err: Record<string, JsonValue | undefined>): boolean {
    if (err.status === 429) { return true; }
    const response = getErrorResponse(err);
    return response?.status === 429;
}

function isServerError(err: Record<string, JsonValue | undefined>): boolean {
    const response = getErrorResponse(err);
    const status = (typeof err.status === 'number' ? err.status : undefined) ??
        (typeof response?.status === 'number' ? response.status : undefined);
    return !!status && status >= 500 && status < 600;
}

function isGenericNetworkError(err: Record<string, JsonValue | undefined>): boolean {
    const message = typeof err.message === 'string' ? err.message : undefined;
    return !!message && (message.toLowerCase().includes('network') || message.toLowerCase().includes('timeout'));
}

function getErrorResponse(err: Record<string, JsonValue | undefined>): Record<string, JsonValue | undefined> | undefined {
    return (err.response && typeof err.response === 'object')
        ? (err.response as Record<string, JsonValue | undefined>)
        : undefined;
}

/**
 * Calculates retry delay using exponential backoff with jitter.
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
    const exponentialDelay = options.baseDelayMs * Math.pow(2, attempt);
    const jitter = exponentialDelay * options.jitterFactor * (Math.random() * 2 - 1);
    const delay = Math.min(exponentialDelay + jitter, options.maxDelayMs);
    return Math.max(0, delay);
}

/**
 * Suspends execution for the specified duration.
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes an async function with automatic retry on failure.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
): Promise<T> {
    const opts: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...options };
    let lastError: CatchError = undefined;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            if (attempt >= opts.maxRetries) {
                break;
            }

            if (!opts.shouldRetry(error as Error, attempt)) {
                break;
            }

            const delay = calculateDelay(attempt, opts);
            opts.onRetry(error as Error, attempt, delay);
            await sleep(delay);
        }
    }

    throw lastError;
}

/**
 * Decorator-style retry wrapper for class methods
 */
export function retryable(options?: RetryOptions) {
    return function (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) {
        const original = descriptor.value;

        descriptor.value = async function (this: object, ...args: Array<JsonValue | object | null | undefined>) {
            return withRetry(() => original.apply(this, args), options);
        };

        return descriptor;
    };
}

/**
 * Check if an error indicates the request should not be retried
 */
export function isNonRetryableError(error: CatchError): boolean {
    if (!error || typeof error !== 'object') { return false; }
    const err = error as Record<string, JsonValue | undefined>;

    if (isClientError(err)) { return true; }
    if (isAuthOrConfigError(error)) { return true; }

    return false;
}

function isClientError(err: Record<string, JsonValue | undefined>): boolean {
    const response = getErrorResponse(err);
    const status = (typeof err.status === 'number' ? err.status : undefined) ??
        (typeof response?.status === 'number' ? response.status : undefined);

    // Client errors that won't succeed on retry
    return status === 400 || status === 401 || status === 403 || status === 404;
}

function isAuthOrConfigError(error: CatchError): boolean {
    const message = getSharedErrorMessage(error).toLowerCase();
    return (
        message.includes('invalid api key') ||
        message.includes('authentication') ||
        message.includes('unauthorized') ||
        message.includes('invalid model') ||
        message.includes('model not found')
    );
}

