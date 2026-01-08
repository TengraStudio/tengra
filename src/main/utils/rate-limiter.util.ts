/**
 * Rate Limiter with Token Bucket Algorithm
 */

export interface RateLimiterOptions {
    maxTokens: number          // Maximum tokens in bucket
    refillRate: number         // Tokens added per interval
    refillIntervalMs: number   // Interval for refill
}

export class RateLimiter {
    private tokens: number
    private lastRefill: number
    private readonly maxTokens: number
    private readonly refillRate: number
    private readonly refillIntervalMs: number
    private waitQueue: Array<{ resolve: () => void }> = []

    constructor(options: RateLimiterOptions) {
        this.maxTokens = options.maxTokens
        this.refillRate = options.refillRate
        this.refillIntervalMs = options.refillIntervalMs
        this.tokens = options.maxTokens
        this.lastRefill = Date.now()
    }

    /**
     * Refill tokens based on elapsed time
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
     * Try to acquire a token immediately
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
     * Acquire a token, waiting if necessary
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
     * Get current token count
     */
    getAvailableTokens(): number {
        this.refill()
        return this.tokens
    }

    /**
     * Get time until next token is available (ms)
     */
    getTimeUntilNextToken(): number {
        if (this.tokens >= 1) return 0
        const elapsed = Date.now() - this.lastRefill
        return Math.max(0, this.refillIntervalMs - elapsed)
    }
}

/**
 * Provider-specific rate limiters
 */
const limiters: Map<string, RateLimiter> = new Map()

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
