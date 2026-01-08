/**
 * Retry utility with exponential backoff
 */

export interface RetryOptions {
    maxRetries?: number
    baseDelayMs?: number
    maxDelayMs?: number
    jitterFactor?: number
    shouldRetry?: (error: any, attempt: number) => boolean
    onRetry?: (error: any, attempt: number, delayMs: number) => void
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    jitterFactor: 0.2,
    shouldRetry: defaultShouldRetry,
    onRetry: () => { }
}

/**
 * Default retry condition: retry on network errors, 429, and 5xx
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
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
    const exponentialDelay = options.baseDelayMs * Math.pow(2, attempt)
    const jitter = exponentialDelay * options.jitterFactor * (Math.random() * 2 - 1)
    const delay = Math.min(exponentialDelay + jitter, options.maxDelayMs)
    return Math.max(0, delay)
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute a function with retry logic
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
