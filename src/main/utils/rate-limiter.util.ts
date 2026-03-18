import { appLogger } from '@main/logging/logger';


// NASA Rule 2: Fixed bounds for loops and queues
const MAX_QUEUE_SIZE = 1000;
const MAX_PROCESSING_BATCH = 50;

/**
 * Configuration for a rate limiter instance.
 */
export interface RateLimiterOptions {
    /** Maximum number of tokens in the bucket */
    maxTokens: number;
    /** Number of tokens added per interval */
    refillRate: number;
    /** Interval in milliseconds for adding tokens */
    refillIntervalMs: number;
}

/**
 * Implementation of the Token Bucket algorithm for rate limiting.
 * Ensures strict bounds on queue size and processing time.
 */
export class RateLimiter {
    private tokens: number;
    private lastRefill: number;
    private readonly maxTokens: number;
    private readonly refillRate: number;
    private readonly refillIntervalMs: number;
    private waitQueue: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];

    /**
     * Creates a new RateLimiter instance.
     *
     * @param options - Configuration options for the rate limiter.
     */
    constructor(options: RateLimiterOptions) {
        this.maxTokens = options.maxTokens;
        this.refillRate = options.refillRate;
        this.refillIntervalMs = options.refillIntervalMs;
        this.tokens = options.maxTokens;
        this.lastRefill = Date.now();
    }

    /**
     * Updates token count based on elapsed time since last refill.
     * Use simple monotonic-like check for elapsed time.
     */
    private refill(): void {
        const now = Date.now();
        const elapsed = now - this.lastRefill;

        // Guard against negative elapsed time (system clock changes)
        if (elapsed < 0) {
            this.lastRefill = now;
            return;
        }

        const intervalsElapsed = Math.floor(elapsed / this.refillIntervalMs);

        if (intervalsElapsed > 0) {
            const newTokens = intervalsElapsed * this.refillRate;
            this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
            this.lastRefill = now;
        }
    }

    /**
     * Attempts to acquire a token immediately without waiting.
     *
     * @returns True if a token was acquired, false otherwise.
     */
    tryAcquire(): boolean {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;
        }
        return false;
    }

    /**
     * Acquires a token, asynchronously waiting if necessary.
     * REFACTOR: Add queue bounds checking (NASA Rule 2).
     *
     * @returns Promise that resolves when a token is acquired.
     * @throws Error if the wait queue is full.
     */
    async acquire(): Promise<void> {
        if (this.tryAcquire()) {
            return;
        }

        // NASA Rule 2: Upper bound check on queue size
        if (this.waitQueue.length >= MAX_QUEUE_SIZE) {
            throw new Error(`RateLimiter queue full (max ${MAX_QUEUE_SIZE}). Request rejected.`);
        }

        // Wait for next refill cycle
        const elapsed = Date.now() - this.lastRefill;
        const waitTime = Math.max(0, this.refillIntervalMs - elapsed);

        return new Promise((resolve, reject) => {
            this.waitQueue.push({ resolve, reject });

            // Schedule check if this is the first waiter? 
            // Simplified logic: Always schedule a check after waitTime if not already scheduled could be better,
            // but sticking to existing logic pattern with added safety.
            setTimeout(() => {
                this.processQueue();
            }, waitTime);
        });
    }

    /**
     * Processes waiting requests in the queue.
     * REFACTOR: Add batch processing limit (NASA Rule 2).
     */
    private processQueue(): void {
        this.refill();

        let processed = 0;
        // NASA Rule 2: Bounded loop execution time
        while (
            this.waitQueue.length > 0 &&
            this.tokens >= 1 &&
            processed < MAX_PROCESSING_BATCH
        ) {
            const waiter = this.waitQueue.shift();
            if (waiter) {
                this.tokens -= 1;
                waiter.resolve();
                processed++;
            }
        }

        // If tasks remain, re-schedule to avoid blocking event loop
        if (this.waitQueue.length > 0 && this.tokens > 0) {
            setTimeout(() => this.processQueue(), 0);
        }
    }

    /**
     * Clears all pending requests in the queue.
     * Helper for cleanup/teardown.
     */
    clearQueue(): void {
        while (this.waitQueue.length > 0) {
            const waiter = this.waitQueue.shift();
            if (waiter) {
                waiter.reject(new Error('RateLimiter queue cleared'));
            }
        }
    }

    /**
     * Returns the current number of available tokens.
     *
     * @returns Number of available tokens.
     */
    getAvailableTokens(): number {
        this.refill();
        return this.tokens;
    }

    /**
     * Calculates the time in milliseconds until the next token refill.
     *
     * @returns Time in ms until next refill.
     */
    getTimeUntilNextToken(): number {
        if (this.tokens >= 1) { return 0; }
        const elapsed = Date.now() - this.lastRefill;
        return Math.max(0, this.refillIntervalMs - elapsed);
    }
}

/**
 * Registry of active rate limiters keyed by provider name.
 */
const limiters: Map<string, RateLimiter> = new Map();

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
    db: { maxTokens: 100, refillRate: 100, refillIntervalMs: 60000 },        // 100 writes per minute
    tools: { maxTokens: 30, refillRate: 30, refillIntervalMs: 60000 },       // 30 tool calls per minute
    git: { maxTokens: 60, refillRate: 60, refillIntervalMs: 60000 },         // 60 git operations per minute
    terminal: { maxTokens: 120, refillRate: 120, refillIntervalMs: 60000 }, // 120 writes per minute
    ssh: { maxTokens: 60, refillRate: 60, refillIntervalMs: 60000 },        // 60 SSH operations per minute
    // Added migration rate limit for safety
    migration: { maxTokens: 10, refillRate: 10, refillIntervalMs: 60000 },
    default: { maxTokens: 30, refillRate: 30, refillIntervalMs: 60000 }
};

/**
 * Get or create a rate limiter for a provider.
 *
 * @param provider - The provider identifier.
 * @returns The RateLimiter instance.
 */
export function getRateLimiter(provider: string): RateLimiter {
    const key = provider.toLowerCase();

    let limiter = limiters.get(key);
    if (!limiter) {
        const options = DEFAULT_LIMITS[key] ?? DEFAULT_LIMITS.default;
        limiter = new RateLimiter(options);
        limiters.set(key, limiter);
    }

    return limiter;
}

/**
 * Decorator to rate-limit a class method.
 *
 * @param provider - The provider identifier to rate limit against.
 * @returns Method decorator.
 */
export function rateLimited(provider: string) {
    return function (_target: object, _propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
        const original = descriptor.value as (this: RuntimeValue, ...args: RuntimeValue[]) => Promise<RuntimeValue>;

        descriptor.value = async function (this: RuntimeValue, ...args: RuntimeValue[]) {
            const limiter = getRateLimiter(provider);
            try {
                await limiter.acquire();
                return original.apply(this, args);
            } catch (error) {
                appLogger.warn('RateLimiter', `Method execution limited/rejected for ${provider}: ${error instanceof Error ? error.message : String(error)}`);
                throw error;
            }
        };

        return descriptor;
    };
}

/**
 * Wrapper function to rate-limit any async operation.
 *
 * @param provider - The provider identifier.
 * @param fn - The async function to execute.
 * @returns Promise resolving to the function result.
 */
export async function withRateLimit<T>(provider: string, fn: () => Promise<T>): Promise<T> {
    const limiter = getRateLimiter(provider);
    await limiter.acquire();
    return fn();
}

/**
 * Resets all rate limiters. Useful for testing.
 */
export function resetRateLimiters(): void {
    linkCleanup();
}

const linkCleanup = () => {
    limiters.forEach(limiter => limiter.clearQueue());
    limiters.clear();
};
