/**
 * @fileoverview Rate limiter utility using the Token Bucket algorithm.
 */

import { JsonValue } from '@shared/types/common'
/**
 * Configuration for a rate limiter instance.
 */
export interface RateLimiterOptions {
    maxTokens: number          // Maximum tokens in bucket
    refillRate: number         // Tokens added per interval
    refillIntervalMs: number   // Interval for refill
}

/**
 * Implementation of the Token Bucket algorithm for rate limiting.
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
     */
    getAvailableTokens(): number {
        this.refill()
        return this.tokens
    }

    /**
     * Calculates the time in milliseconds until the next token refill.
     */
    getTimeUntilNextToken(): number {
        if (this.tokens >= 1) {return 0}
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

    const limiter = limiters.get(key)
    if (!limiter) {
        throw new Error(`Failed to get rate limiter for provider: ${key}`)
    }
    return limiter
}

/**
 * Decorator to rate-limit a function
 */
export function rateLimited(provider: string) {
    return function (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) {
        const original = descriptor.value

        descriptor.value = async function (this: object, ...args: Array<JsonValue | object | null | undefined>) {
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
