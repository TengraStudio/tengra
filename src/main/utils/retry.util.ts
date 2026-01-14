/**
 * @fileoverview Retry utility with exponential backoff and jitter.
 */

import { CatchError, JsonValue } from '@shared/types/common'
import { getErrorMessage as getSharedErrorMessage } from '@shared/utils/error.util'
export { getSharedErrorMessage as getErrorMessage }

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
}

/**
 * Default retry condition that checks for retryable error types.
 */
function defaultShouldRetry(error: CatchError, _attempt: number): boolean {
    if (!error || typeof error !== 'object') return false
    const err = error as Record<string, JsonValue | undefined>

    // Network errors
    if (err.code === 'ECONNRESET' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        return true
    }

    // Rate limiting
    if (err.status === 429) {
        return true
    }

    const response = (err.response && typeof err.response === 'object')
        ? (err.response as Record<string, JsonValue | undefined>)
        : undefined
    if (response?.status === 429) {
        return true
    }

    // Server errors (5xx)
    const status = (typeof err.status === 'number' ? err.status : undefined) || (typeof response?.status === 'number' ? response.status : undefined)
    if (status && status >= 500 && status < 600) {
        return true
    }

    // Axios/fetch specific network indicators
    const message = typeof err.message === 'string' ? err.message : undefined
    if (message?.toLowerCase().includes('network') || message?.toLowerCase().includes('timeout')) {
        return true
    }

    return false
}

/**
 * Calculates retry delay using exponential backoff with jitter.
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
    const exponentialDelay = options.baseDelayMs * Math.pow(2, attempt)
    const jitter = exponentialDelay * options.jitterFactor * (Math.random() * 2 - 1)
    const delay = Math.min(exponentialDelay + jitter, options.maxDelayMs)
    return Math.max(0, delay)
}

/**
 * Suspends execution for the specified duration.
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Executes an async function with automatic retry on failure.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
): Promise<T> {
    const opts: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...options }
    let lastError: CatchError = undefined

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error as Error

            if (attempt >= opts.maxRetries) {
                break
            }

            if (!opts.shouldRetry(error as Error, attempt)) {
                break
            }

            const delay = calculateDelay(attempt, opts)
            opts.onRetry(error as Error, attempt, delay)
            await sleep(delay)
        }
    }

    throw lastError
}

/**
 * Decorator-style retry wrapper for class methods
 */
export function retryable(options?: RetryOptions) {
    return function (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) {
        const original = descriptor.value

        descriptor.value = async function (this: object, ...args: Array<JsonValue | object | null | undefined>) {
            return withRetry(() => original.apply(this, args), options)
        }

        return descriptor
    }
}

/**
 * Check if an error indicates the request should not be retried
 */
export function isNonRetryableError(error: CatchError): boolean {
    if (!error || typeof error !== 'object') return false
    const err = error as Record<string, JsonValue | undefined>
    const response = (err.response && typeof err.response === 'object') ? err.response as Record<string, JsonValue | undefined> : undefined
    const status = (typeof err.status === 'number' ? err.status : undefined) || (typeof response?.status === 'number' ? response.status : undefined)

    // Client errors that won't succeed on retry
    if (status === 400 || status === 401 || status === 403 || status === 404) {
        return true
    }

    // API-specific non-retryable errors
    const message = getSharedErrorMessage(error).toLowerCase()
    if (
        message.includes('invalid api key') ||
        message.includes('authentication') ||
        message.includes('unauthorized') ||
        message.includes('invalid model') ||
        message.includes('model not found')
    ) {
        return true
    }

    return false
}
