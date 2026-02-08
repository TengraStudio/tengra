import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';

interface RateLimitConfig {
    requestsPerMinute: number;
    maxBurst?: number;
}

export class RateLimitService extends BaseService {
    // Simple Token Bucket state: provider -> { tokens: number, lastRefill: number }
    private buckets: Map<string, { tokens: number; lastRefill: number; config: RateLimitConfig }> = new Map();
    private cleanupInterval?: NodeJS.Timeout;

    constructor() {
        super('RateLimitService');
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
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldBuckets();
        }, 5 * 60 * 1000); // 5 minutes

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
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 minutes

        for (const [provider, bucket] of this.buckets) {
            if (now - bucket.lastRefill > maxAge) {
                this.buckets.delete(provider);
            }
        }
    }

    setLimit(provider: string, config: RateLimitConfig) {
        this.buckets.set(provider, {
            tokens: config.maxBurst ?? config.requestsPerMinute,
            lastRefill: Date.now(),
            config
        });
    }

    /**
     * Waits for a token to be available.
     * Throws an error if the wait time would be excessive.
     */
    async waitForToken(provider: string): Promise<void> {
        if (!provider || typeof provider !== 'string') {
            throw new Error('Provider must be a non-empty string');
        }

        const bucket = this.buckets.get(provider);
        if (!bucket) { return; } // No limit set

        const MAX_WAIT_ITERATIONS = 100; // Prevent infinite loops
        let iterations = 0;

        while (iterations < MAX_WAIT_ITERATIONS) {
            await this.refillBucket(provider);

            if (bucket.tokens >= 1) {
                bucket.tokens -= 1;
                return;
            }

            const msPerToken = 60000 / bucket.config.requestsPerMinute;
            const waitTime = msPerToken;

            appLogger.debug('RateLimit', `Rate limit hit for ${provider}. Waiting ${waitTime.toFixed(0)}ms.`);

            await new Promise(resolve => setTimeout(resolve, waitTime));
            iterations++;
        }

        throw new Error(`Rate limit wait exceeded maximum iterations (${MAX_WAIT_ITERATIONS}) for ${provider}`);
    }

    /**
     * Attempts to acquire a token immediately.
     * Returns true if acquired, false if rate limited.
     * Does not wait.
     */
    tryAcquire(provider: string): boolean {
        if (!this.buckets.has(provider)) {
            return true; // No limit set, allow
        }

        // We can't await refillBucket here since this must be synchronous-ish/non-blocking
        // But refillBucket uses Date.now() so it doesn't actually block.
        // We'll trust the lastRefill vs now math.

        // Actually refillBucket IS synchronous in implementation (just async signature in typical generic services, 
        // but here it returns void and uses no awaits). 
        // Let's copy the logic or fix refillBucket signature if possible. 
        // Looking at the file, refillBucket is private async refillBucket(provider: string) 
        // BUT it doesn't await anything. 
        // Let's just implement the logic inline for safety or cast call.

        const bucket = this.buckets.get(provider);
        if (!bucket) { return true; }

        const now = Date.now();
        const elapsed = now - bucket.lastRefill;
        const msPerToken = 60000 / bucket.config.requestsPerMinute;
        const newTokens = Math.floor(elapsed / msPerToken);

        if (newTokens > 0) {
            const maxTokens = bucket.config.maxBurst ?? bucket.config.requestsPerMinute;
            bucket.tokens = Math.min(bucket.tokens + newTokens, maxTokens);
            bucket.lastRefill = now;
        }

        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            return true;
        }

        return false;
    }

    private async refillBucket(provider: string) {
        const bucket = this.buckets.get(provider);
        if (!bucket) { return; }

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
