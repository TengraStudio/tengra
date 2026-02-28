import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';

interface RateLimitConfig {
    requestsPerMinute: number;
    maxBurst?: number;
}

/**
 * Status of a provider's rate limit bucket for UX indicators.
 */
export interface RateLimitProviderStatus {
    configured: boolean;
    tokensRemaining: number;
    tokensMax: number;
    msUntilNextToken: number;
}

/**
 * Standardized error codes for RateLimitService
 */
export enum RateLimitErrorCode {
    INVALID_PROVIDER = 'RATE_LIMIT_INVALID_PROVIDER',
    INVALID_CONFIG = 'RATE_LIMIT_INVALID_CONFIG',
    WAIT_EXCEEDED = 'RATE_LIMIT_WAIT_EXCEEDED',
    SERVICE_NOT_INITIALIZED = 'RATE_LIMIT_NOT_INITIALIZED'
}

/**
 * Telemetry events for rate limit monitoring dashboards
 */
export enum RateLimitTelemetryEvent {
    TOKEN_ACQUIRED = 'rate_limit_token_acquired',
    TOKEN_REJECTED = 'rate_limit_token_rejected',
    WAIT_STARTED = 'rate_limit_wait_started',
    WAIT_COMPLETED = 'rate_limit_wait_completed',
    WAIT_EXCEEDED = 'rate_limit_wait_exceeded',
    BUCKET_CLEANUP = 'rate_limit_bucket_cleanup',
    LIMIT_SET = 'rate_limit_limit_set'
}

/**
 * Performance regression budgets (in milliseconds) for rate limit operations
 */
export const RATE_LIMIT_PERFORMANCE_BUDGETS = {
    TRY_ACQUIRE_MS: 1,
    WAIT_FOR_TOKEN_MS: 60000,
    SET_LIMIT_MS: 1,
    CLEANUP_MS: 100
} as const;

/** Maximum allowed provider key length */
const MAX_PROVIDER_LENGTH = 256;

/** Upper bound for requestsPerMinute to prevent misconfigurations */
const MAX_REQUESTS_PER_MINUTE = 100_000;

export class RateLimitService extends BaseService {
    // Simple Token Bucket state: provider -> { tokens: number, lastRefill: number }
    private buckets: Map<string, { tokens: number; lastRefill: number; config: RateLimitConfig }> =
        new Map();
    private cleanupInterval?: NodeJS.Timeout;

    constructor() {
        super('RateLimitService');
    }

    /**
     * Checks if an operation exceeded its performance budget and logs a warning.
     * @param operation - Name of the operation being measured
     * @param durationMs - Actual duration in milliseconds
     * @param budgetMs - Maximum allowed duration in milliseconds
     */
    private checkPerformanceBudget(operation: string, durationMs: number, budgetMs: number): void {
        if (durationMs > budgetMs) {
            appLogger.warn(
                'RateLimitService',
                `Performance budget exceeded for ${operation}: ${durationMs.toFixed(2)}ms (budget: ${budgetMs}ms)`
            );
        }
    }

    /**
     * Validates a provider key string.
     * Must be a non-empty, non-whitespace-only string within length bounds.
     * @param provider - The provider key to validate
     * @throws {Error} If provider is invalid, with code INVALID_PROVIDER
     */
    private validateProvider(provider: string): void {
        if (!provider || typeof provider !== 'string' || provider.trim().length === 0) {
            const error = new Error(
                'Provider must be a non-empty string that is not purely whitespace'
            ) as Error & { code?: string };
            error.code = RateLimitErrorCode.INVALID_PROVIDER;
            throw error;
        }

        if (provider.length > MAX_PROVIDER_LENGTH) {
            const error = new Error(
                `Provider key exceeds maximum length of ${MAX_PROVIDER_LENGTH} characters`
            ) as Error & { code?: string };
            error.code = RateLimitErrorCode.INVALID_PROVIDER;
            throw error;
        }
    }

    /**
     * Validates a RateLimitConfig object.
     * Ensures requestsPerMinute is a finite positive number and maxBurst is a finite non-negative number.
     * @param config - The rate limit configuration to validate
     * @throws {Error} If config is null/undefined or contains invalid values, with code INVALID_CONFIG
     */
    private validateConfig(config: RateLimitConfig): void {
        if (config == null || typeof config !== 'object') {
            const error = new Error(
                'Rate limit config must be a non-null object'
            ) as Error & { code?: string };
            error.code = RateLimitErrorCode.INVALID_CONFIG;
            throw error;
        }

        if (
            typeof config.requestsPerMinute !== 'number' ||
            !Number.isFinite(config.requestsPerMinute) ||
            config.requestsPerMinute <= 0
        ) {
            const error = new Error(
                'requestsPerMinute must be a finite positive number'
            ) as Error & { code?: string };
            error.code = RateLimitErrorCode.INVALID_CONFIG;
            throw error;
        }

        if (config.requestsPerMinute > MAX_REQUESTS_PER_MINUTE) {
            const error = new Error(
                `requestsPerMinute exceeds maximum of ${MAX_REQUESTS_PER_MINUTE}`
            ) as Error & { code?: string };
            error.code = RateLimitErrorCode.INVALID_CONFIG;
            throw error;
        }

        if (config.maxBurst !== undefined) {
            if (
                typeof config.maxBurst !== 'number' ||
                !Number.isFinite(config.maxBurst) ||
                config.maxBurst < 0
            ) {
                const error = new Error(
                    'maxBurst must be a finite non-negative number'
                ) as Error & { code?: string };
                error.code = RateLimitErrorCode.INVALID_CONFIG;
                throw error;
            }
        }
    }

    /**
     * Initialize the RateLimitService
     */
    async initialize(): Promise<void> {
        appLogger.info(this.name, 'Initializing rate limit service...');

        // Set default limits for providers
        this.setLimit('openai', { requestsPerMinute: 60, maxBurst: 10 });
        this.setLimit('anthropic', { requestsPerMinute: 50, maxBurst: 5 });
        this.setLimit('gemini', { requestsPerMinute: 60, maxBurst: 10 });
        this.setLimit('ssh:execute', { requestsPerMinute: 120, maxBurst: 20 });
        this.setLimit('chat:stream', { requestsPerMinute: 60, maxBurst: 5 }); // 1 per sec roughly
        this.setLimit('files:search', { requestsPerMinute: 20, maxBurst: 2 }); // Expensive op
        this.setLimit('files:read', { requestsPerMinute: 300, maxBurst: 50 }); // High frequency allowed
        this.setLimit('files:write', { requestsPerMinute: 100, maxBurst: 10 }); // More restricted
        this.setLimit('api:request', { requestsPerMinute: 600, maxBurst: 50 }); // ~10/sec burst, 10/sec sustained high

        // SEC-011: Additional rate limits for LLM and expensive operations
        this.setLimit('ollama:chat', { requestsPerMinute: 30, maxBurst: 5 }); // Local LLM calls
        this.setLimit('ollama:operation', { requestsPerMinute: 60, maxBurst: 10 }); // General Ollama ops
        this.setLimit('model-registry', { requestsPerMinute: 30, maxBurst: 5 }); // Model registry queries
        this.setLimit('ideas:generation', { requestsPerMinute: 10, maxBurst: 2 }); // Expensive idea generation
        this.setLimit('ideas:research', { requestsPerMinute: 20, maxBurst: 3 }); // Research pipeline
        this.setLimit('agent:execution', { requestsPerMinute: 20, maxBurst: 3 }); // Agent task execution
        this.setLimit('code-intelligence', { requestsPerMinute: 30, maxBurst: 5 }); // Code analysis ops
        this.setLimit('embedding', { requestsPerMinute: 100, maxBurst: 20 }); // Embedding generation
        this.setLimit('memory:operation', { requestsPerMinute: 60, maxBurst: 10 }); // Memory operations

        // MCP rate limits - per service type
        this.setLimit('mcp:filesystem', { requestsPerMinute: 200, maxBurst: 30 }); // File operations
        this.setLimit('mcp:git', { requestsPerMinute: 60, maxBurst: 10 }); // Git operations
        this.setLimit('mcp:docker', { requestsPerMinute: 30, maxBurst: 5 }); // Docker operations
        this.setLimit('mcp:database', { requestsPerMinute: 100, maxBurst: 20 }); // Database queries
        this.setLimit('mcp:ssh', { requestsPerMinute: 60, maxBurst: 10 }); // SSH commands
        this.setLimit('mcp:network', { requestsPerMinute: 30, maxBurst: 5 }); // Network utilities
        this.setLimit('mcp:internet', { requestsPerMinute: 60, maxBurst: 10 }); // Internet APIs
        this.setLimit('mcp:utility', { requestsPerMinute: 120, maxBurst: 20 }); // Utility operations
        this.setLimit('mcp:llm', { requestsPerMinute: 30, maxBurst: 5 }); // LLM operations
        this.setLimit('mcp:analysis', { requestsPerMinute: 60, maxBurst: 10 }); // Code analysis
        this.setLimit('mcp:ui', { requestsPerMinute: 100, maxBurst: 15 }); // UI operations
        this.setLimit('mcp:project', { requestsPerMinute: 100, maxBurst: 15 }); // Project operations
        this.setLimit('mcp:data', { requestsPerMinute: 120, maxBurst: 20 }); // Data operations

        // Start cleanup interval to remove old buckets
        this.cleanupInterval = setInterval(
            () => {
                this.cleanupOldBuckets();
            },
            5 * 60 * 1000
        ); // 5 minutes

        appLogger.info(this.name, `Rate limiting initialized for ${this.buckets.size} providers`);
    }

    /**
     * Cleanup the RateLimitService
     */
    async cleanup(): Promise<void> {
        appLogger.info(this.name, 'Cleaning up rate limit service...');

        // Stop cleanup interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }

        // Clear all buckets
        this.buckets.clear();

        appLogger.info(this.name, 'Rate limit service cleaned up');
    }

    /**
     * Clean up old unused buckets
     */
    private cleanupOldBuckets(): void {
        const start = performance.now();
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 minutes
        let removedCount = 0;

        for (const [provider, bucket] of this.buckets) {
            if (now - bucket.lastRefill > maxAge) {
                this.buckets.delete(provider);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            appLogger.info('RateLimitService', RateLimitTelemetryEvent.BUCKET_CLEANUP, { removedCount });
        }
        this.checkPerformanceBudget('cleanupOldBuckets', performance.now() - start, RATE_LIMIT_PERFORMANCE_BUDGETS.CLEANUP_MS);
    }

    /**
     * Sets the rate limit configuration for a given provider.
     * Creates or replaces the token bucket with the specified config.
     * @param provider - Unique identifier for the rate-limited provider
     * @param config - Rate limit configuration with requestsPerMinute and optional maxBurst
     * @throws {Error} If provider is not a non-empty string or config values are invalid
     */
    setLimit(provider: string, config: RateLimitConfig): void {
        const start = performance.now();

        this.validateProvider(provider);
        this.validateConfig(config);

        this.buckets.set(provider, {
            tokens: config.maxBurst ?? config.requestsPerMinute,
            lastRefill: Date.now(),
            config,
        });

        appLogger.debug('RateLimitService', RateLimitTelemetryEvent.LIMIT_SET, { provider, requestsPerMinute: config.requestsPerMinute });
        this.checkPerformanceBudget('setLimit', performance.now() - start, RATE_LIMIT_PERFORMANCE_BUDGETS.SET_LIMIT_MS);
    }

    /**
     * Waits for a token to be available.
     * Throws an error if the wait time would be excessive.
     */
    async waitForToken(provider: string): Promise<void> {
        const start = performance.now();

        this.validateProvider(provider);

        const bucket = this.buckets.get(provider);
        if (!bucket) {
            this.checkPerformanceBudget('waitForToken', performance.now() - start, RATE_LIMIT_PERFORMANCE_BUDGETS.WAIT_FOR_TOKEN_MS);
            return;
        } // No limit set

        const MAX_WAIT_ITERATIONS = 100; // Prevent infinite loops
        let iterations = 0;

        while (iterations < MAX_WAIT_ITERATIONS) {
            await this.refillBucket(provider);

            if (bucket.tokens >= 1) {
                bucket.tokens -= 1;
                if (iterations > 0) {
                    appLogger.debug('RateLimitService', RateLimitTelemetryEvent.WAIT_COMPLETED, { provider, iterations });
                }
                this.checkPerformanceBudget('waitForToken', performance.now() - start, RATE_LIMIT_PERFORMANCE_BUDGETS.WAIT_FOR_TOKEN_MS);
                return;
            }

            if (iterations === 0) {
                appLogger.debug('RateLimitService', RateLimitTelemetryEvent.WAIT_STARTED, { provider });
            }

            const msPerToken = 60000 / bucket.config.requestsPerMinute;
            const waitTime = msPerToken;

            await new Promise(resolve => setTimeout(resolve, waitTime));
            iterations++;
        }

        appLogger.info('RateLimitService', RateLimitTelemetryEvent.WAIT_EXCEEDED, { provider });
        const retryAfterMs = 60000 / bucket.config.requestsPerMinute;
        const error = new Error(
            `Rate limit wait exceeded maximum iterations (${MAX_WAIT_ITERATIONS}) for ${provider}`
        ) as Error & { code?: string; retryAfterMs?: number };
        error.code = RateLimitErrorCode.WAIT_EXCEEDED;
        error.retryAfterMs = retryAfterMs;
        throw error;
    }

    /**
     * Attempts to acquire a token immediately.
     * Returns true if acquired, false if rate limited.
     * Does not wait.
     */
    tryAcquire(provider: string): boolean {
        const start = performance.now();

        this.validateProvider(provider);

        if (!this.buckets.has(provider)) {
            this.checkPerformanceBudget('tryAcquire', performance.now() - start, RATE_LIMIT_PERFORMANCE_BUDGETS.TRY_ACQUIRE_MS);
            return true; // No limit set, allow
        }

        const bucket = this.buckets.get(provider);
        if (!bucket) {
            this.checkPerformanceBudget('tryAcquire', performance.now() - start, RATE_LIMIT_PERFORMANCE_BUDGETS.TRY_ACQUIRE_MS);
            return true;
        }

        const now = Date.now();
        const elapsed = now - bucket.lastRefill;
        const msPerToken = 60000 / bucket.config.requestsPerMinute;
        const newTokens = Math.floor(elapsed / msPerToken);

        if (newTokens > 0) {
            const maxTokens = bucket.config.maxBurst ?? bucket.config.requestsPerMinute;
            bucket.tokens = Math.min(bucket.tokens + newTokens, maxTokens);
            bucket.lastRefill = now;
        }

        let result: boolean;
        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            result = true;
        } else {
            appLogger.debug('RateLimitService', RateLimitTelemetryEvent.TOKEN_REJECTED, { provider });
            result = false;
        }

        this.checkPerformanceBudget('tryAcquire', performance.now() - start, RATE_LIMIT_PERFORMANCE_BUDGETS.TRY_ACQUIRE_MS);
        return result;
    }

    /**
     * Get health status for rate limit monitoring dashboards
     */
    getHealth(): { activeBuckets: number; providers: string[] } {
        return {
            activeBuckets: this.buckets.size,
            providers: Array.from(this.buckets.keys())
        };
    }

    /**
     * Returns current rate limit status for a provider, useful for UX indicators.
     * @param provider - The provider key to query
     * @returns Status with token availability and timing information
     */
    getProviderStatus(provider: string): RateLimitProviderStatus {
        this.validateProvider(provider);
        const bucket = this.buckets.get(provider);
        if (!bucket) {
            return { configured: false, tokensRemaining: 0, tokensMax: 0, msUntilNextToken: 0 };
        }
        const maxTokens = bucket.config.maxBurst ?? bucket.config.requestsPerMinute;
        const msPerToken = 60000 / bucket.config.requestsPerMinute;
        const elapsed = Date.now() - bucket.lastRefill;
        const msUntilNext = bucket.tokens >= 1 ? 0 : Math.max(0, msPerToken - elapsed);
        return {
            configured: true,
            tokensRemaining: Math.floor(bucket.tokens),
            tokensMax: maxTokens,
            msUntilNextToken: msUntilNext
        };
    }

    private async refillBucket(provider: string) {
        const bucket = this.buckets.get(provider);
        if (!bucket) {
            return;
        }

        const now = Date.now();
        const elapsed = now - bucket.lastRefill;
        const msPerToken = 60000 / bucket.config.requestsPerMinute;

        const newTokens = Math.floor(elapsed / msPerToken);

        if (newTokens > 0) {
            const maxTokens = bucket.config.maxBurst ?? bucket.config.requestsPerMinute;
            bucket.tokens = Math.min(bucket.tokens + newTokens, maxTokens);
            bucket.lastRefill = now;
        }
    }
}
