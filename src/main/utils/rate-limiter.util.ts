/**
 * @fileoverview Rate limiter utility using the Token Bucket algorithm.
 * 
 * Provides rate limiting functionality to control the frequency of operations,
 * primarily API requests. Supports provider-specific limits, automatic
 * refilling of tokens, and queuing mechanisms for waiting until tokens
 * become available.
 * 
 * @module utils/rate-limiter
 * @author Orbit Team
 * @license MIT
 */

/**
 * Configuration for a rate limiter instance.
 * 
 * @interface RateLimiterOptions
 * @property {number} maxTokens - Maximum capacity of the bucket (burst limit)
 * @property {number} refillRate - Number of tokens added per interval
 * @property {number} refillIntervalMs - Time interval in milliseconds for adding tokens
 * 
 * @example
 * ```typescript
 * // Allow 10 requests per minute, with a burst of 10
 * const options = {
 *   maxTokens: 10,
 *   refillRate: 10,
 *   refillIntervalMs: 60000
 * };
 * ```
 */
export interface RateLimiterOptions {
    maxTokens: number          // Maximum tokens in bucket
    refillRate: number         // Tokens added per interval
    refillIntervalMs: number   // Interval for refill
}

/**
 * Implementation of the Token Bucket algorithm for rate limiting.
 * 
 * Tokens are added to the bucket at a fixed rate up to a maximum capacity.
 * Operations must consume a token to proceed. If no tokens are available,
 * the operation can either fail immediately or wait until a token is refilled.
 */
export class RateLimiter {
    private tokens: number
    private lastRefill: number
    private readonly maxTokens: number
    private readonly refillRate: number
    private readonly refillIntervalMs: number
    private waitQueue: Array<{ resolve: () => void }> = []

    /**
     * Creates a new RateLimiter instance.
     * 
     * @param options - Configuration options
     */
    constructor(options: RateLimiterOptions) {
        this.maxTokens = options.maxTokens
        this.refillRate = options.refillRate
        this.refillIntervalMs = options.refillIntervalMs
        this.tokens = options.maxTokens
        this.lastRefill = Date.now()
    }

    /**
     * Updates token count based on elapsed time since last refill.
     * 
     * @private
     */
    private refill() {
        const now = Date.now()
        const elapsed = now - this.lastRefill
        const intervalsElapsed = Math.floor(elapsed / this.refillIntervalMs)

        if (intervalsElapsed > 0) {
            this.tokens = Math.min(this.maxTokens, this.tokens + intervalsElapsed * this.refillRate)
            this.lastRefill = now
        }
    }

    /**
     * Attempts to acquire a token immediately without waiting.
     * 
     * @returns {boolean} True if a token was acquired, false otherwise
     * 
     * @example
     * ```typescript
     * if (limiter.tryAcquire()) {
     *   // Proceed with operation
     * } else {
     *   // Rate limit exceeded
     * }
     * ```
     */
    tryAcquire(): boolean {
        this.refill()
        if (this.tokens >= 1) {
            this.tokens -= 1
            return true
        }
        return false
    }

    /**
     * Acquires a token, asynchronously waiting if necessary.
     * 
     * If tokens are available, resolves immediately.
     * If not, queues the request and resolves once a token becomes available via refill.
     * 
     * @returns {Promise<void>} Resolves when a token is acquired
     */
    async acquire(): Promise<void> {
        if (this.tryAcquire()) {
            return
        }

        // Wait for next refill cycle
        const waitTime = this.refillIntervalMs - (Date.now() - this.lastRefill)

        return new Promise(resolve => {
            this.waitQueue.push({ resolve })

            setTimeout(() => {
                this.refill()

                // Process waiting requests
                while (this.waitQueue.length > 0 && this.tokens >= 1) {
                    const waiter = this.waitQueue.shift()
                    if (waiter) {
                        this.tokens -= 1
                        waiter.resolve()
                    }
                }
            }, Math.max(0, waitTime))
        })
    }

    /**
     * Returns the current number of available tokens.
     * 
     * @returns {number} Count of available tokens
     */
    getAvailableTokens(): number {
        this.refill()
        return this.tokens
    }

    /**
     * Calculates the time in milliseconds until the next token refill.
     * 
     * @returns {number} Milliseconds until next refill, or 0 if tokens are available
     */
    getTimeUntilNextToken(): number {
        if (this.tokens >= 1) return 0
        const elapsed = Date.now() - this.lastRefill
        return Math.max(0, this.refillIntervalMs - elapsed)
    }
}

/**
 * Registry of active rate limiters keyed by provider name.
 */
const limiters: Map<string, RateLimiter> = new Map()

/**
 * Default rate limit configurations for supported LLM providers.
 */
const DEFAULT_LIMITS: Record<string, RateLimiterOptions> = {
    openai: { maxTokens: 60, refillRate: 60, refillIntervalMs: 60000 },      // 60 RPM
    anthropic: { maxTokens: 50, refillRate: 50, refillIntervalMs: 60000 },   // 50 RPM
    gemini: { maxTokens: 60, refillRate: 60, refillIntervalMs: 60000 },      // 60 RPM
    groq: { maxTokens: 30, refillRate: 30, refillIntervalMs: 60000 },        // 30 RPM
    ollama: { maxTokens: 100, refillRate: 100, refillIntervalMs: 60000 },    // Local, generous
    copilot: { maxTokens: 30, refillRate: 30, refillIntervalMs: 60000 },     // Conservative
    antigravity: { maxTokens: 20, refillRate: 20, refillIntervalMs: 60000 }, // Conservative
    default: { maxTokens: 30, refillRate: 30, refillIntervalMs: 60000 }
}

/**
 * Get or create a rate limiter for a provider
 */
export function getRateLimiter(provider: string): RateLimiter {
    const key = provider.toLowerCase()

    if (!limiters.has(key)) {
        const options = DEFAULT_LIMITS[key] || DEFAULT_LIMITS.default
        limiters.set(key, new RateLimiter(options))
    }

    return limiters.get(key)!
}

/**
 * Decorator to rate-limit a function
 */
export function rateLimited(provider: string) {
    return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
        const original = descriptor.value

        descriptor.value = async function (...args: any[]) {
            const limiter = getRateLimiter(provider)
            await limiter.acquire()
            return original.apply(this, args)
        }

        return descriptor
    }
}

/**
 * Wrapper function to rate-limit any async operation
 */
export async function withRateLimit<T>(provider: string, fn: () => Promise<T>): Promise<T> {
    const limiter = getRateLimiter(provider)
    await limiter.acquire()
    return fn()
}
