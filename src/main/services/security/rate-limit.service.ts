import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';

interface RateLimitConfig {
    requestsPerMinute: number;
    maxBurst?: number;
}

export class RateLimitService extends BaseService {
    // Simple Token Bucket state: provider -> { tokens: number, lastRefill: number }
    private buckets: Map<string, { tokens: number; lastRefill: number; config: RateLimitConfig }> = new Map();
    private cleanupInterval?: NodeJS.Timer;

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
            clearInterval(this.cleanupInterval as any);
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
                appLogger.debug(this.name, `Cleaned up unused bucket for provider: ${provider}`);
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
        if (!bucket) {return;} // No limit set

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

    private async refillBucket(provider: string) {
        const bucket = this.buckets.get(provider);
        if (!bucket) {return;}

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
