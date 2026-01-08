/**
 * @fileoverview Retry utility with exponential backoff and jitter.
 * 
 * Provides robust retry mechanisms for network requests and other
 * potentially failing operations. Supports customizable retry conditions,
 * exponential backoff with jitter to prevent thundering herd, and
 * callback hooks for monitoring.
 * 
 * @module utils/retry
 * @author Orbit Team
 * @license MIT
 */

/**
 * Configuration options for retry behavior.
 * 
 * @interface RetryOptions
 * @property {number} [maxRetries=3] - Maximum number of retry attempts after initial failure
 * @property {number} [baseDelayMs=1000] - Initial delay in milliseconds before first retry
 * @property {number} [maxDelayMs=30000] - Maximum delay cap to prevent excessive waiting
 * @property {number} [jitterFactor=0.2] - Random variance factor (0-1) to prevent synchronized retries
 * @property {Function} [shouldRetry] - Custom function to determine if error is retryable
 * @property {Function} [onRetry] - Callback invoked before each retry attempt
 */
export interface RetryOptions {
    maxRetries?: number
    baseDelayMs?: number
    maxDelayMs?: number
    jitterFactor?: number
    shouldRetry?: (error: any, attempt: number) => boolean
    onRetry?: (error: any, attempt: number, delayMs: number) => void
}

/**
 * Default retry configuration values.
 * @internal
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
 * 
 * Retries on:
 * - Network errors (ECONNRESET, ENOTFOUND, ETIMEDOUT)
 * - Rate limiting (HTTP 429)
 * - Server errors (HTTP 5xx)
 * - Network/timeout messages in error text
 * 
 * @param error - The error to evaluate
 * @param _attempt - Current attempt number (unused in default implementation)
 * @returns True if the error is retryable, false otherwise
 * 
 * @example
 * ```typescript
 * if (defaultShouldRetry(error, 0)) {
 *   console.log('Will retry this error');
 * }
 * ```
 */
function defaultShouldRetry(error: any, _attempt: number): boolean {
    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        return true
    }

    // Rate limiting
    if (error.status === 429 || error.response?.status === 429) {
        return true
    }

    // Server errors (5xx)
    const status = error.status || error.response?.status
    if (status && status >= 500 && status < 600) {
        return true
    }

    // Axios/fetch specific network indicators
    if (error.message?.includes('network') || error.message?.includes('timeout')) {
        return true
    }

    return false
}

/**
 * Calculates retry delay using exponential backoff with jitter.
 * 
 * Formula: `min(baseDelay * 2^attempt + jitter, maxDelay)`
 * 
 * @param attempt - Current attempt number (0-indexed)
 * @param options - Retry configuration
 * @returns Delay in milliseconds before next retry
 * @internal
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
    const exponentialDelay = options.baseDelayMs * Math.pow(2, attempt)
    const jitter = exponentialDelay * options.jitterFactor * (Math.random() * 2 - 1)
    const delay = Math.min(exponentialDelay + jitter, options.maxDelayMs)
    return Math.max(0, delay)
}

/**
 * Suspends execution for the specified duration.
 * 
 * @param ms - Duration to sleep in milliseconds
 * @returns Promise that resolves after the specified duration
 * @internal
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Executes an async function with automatic retry on failure.
 * 
 * Uses exponential backoff with jitter to space out retry attempts.
 * Retries only on errors deemed retryable (network errors, rate limits, server errors).
 * 
 * @template T - The return type of the function being retried
 * @param fn - Async function to execute with retry logic
 * @param options - Optional retry configuration
 * @returns Promise resolving to the function's result
 * @throws The last error encountered if all retries are exhausted
 * 
 * @example Basic usage
 * ```typescript
 * const data = await withRetry(() => fetch('https://api.example.com/data'));
 * ```
 * 
 * @example With custom options
 * ```typescript
 * const response = await withRetry(
 *   () => apiClient.sendRequest(payload),
 *   {
 *     maxRetries: 5,
 *     baseDelayMs: 500,
 *     onRetry: (err, attempt, delay) => {
 *       console.log(`Retry ${attempt + 1} after ${delay}ms: ${err.message}`);
 *     }
 *   }
 * );
 * ```
 * 
 * @example Custom retry condition
 * ```typescript
 * const result = await withRetry(fetchData, {
 *   shouldRetry: (error) => error.code === 'TIMEOUT'
 * });
 * ```
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
): Promise<T> {
    const opts: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...options }
    let lastError: any

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error: any) {
            lastError = error

            if (attempt >= opts.maxRetries) {
                break
            }

            if (!opts.shouldRetry(error, attempt)) {
                break
            }

            const delay = calculateDelay(attempt, opts)
            opts.onRetry(error, attempt, delay)
            await sleep(delay)
        }
    }

    throw lastError
}

/**
 * Decorator-style retry wrapper for class methods
 */
export function retryable(options?: RetryOptions) {
    return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
        const original = descriptor.value

        descriptor.value = async function (...args: any[]) {
            return withRetry(() => original.apply(this, args), options)
        }

        return descriptor
    }
}

/**
 * Extract a user-friendly error message from various error types
 */
export function getErrorMessage(error: any): string {
    if (typeof error === 'string') return error
    if (error.message) return error.message
    if (error.error?.message) return error.error.message
    if (error.response?.data?.error?.message) return error.response.data.error.message
    if (error.response?.data?.message) return error.response.data.message
    if (error.response?.statusText) return error.response.statusText
    return 'Unknown error'
}

/**
 * Check if an error indicates the request should not be retried
 */
export function isNonRetryableError(error: any): boolean {
    const status = error.status || error.response?.status

    // Client errors that won't succeed on retry
    if (status === 400 || status === 401 || status === 403 || status === 404) {
        return true
    }

    // API-specific non-retryable errors
    const message = getErrorMessage(error).toLowerCase()
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
