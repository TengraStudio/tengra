import { BaseService } from '../base.service';
import { appLogger } from '../../logging/logger';

interface RateLimitConfig {
    requestsPerMinute: number;
    maxBurst?: number;
}

export class RateLimitService extends BaseService {
    // Simple Token Bucket state: provider -> { tokens: number, lastRefill: number }
    private buckets: Map<string, { tokens: number; lastRefill: number; config: RateLimitConfig }> = new Map();

    constructor() {
        super('RateLimitService');
        // Default limits (can be overridden or loaded from config)
        this.setLimit('openai', { requestsPerMinute: 60, maxBurst: 10 });
        this.setLimit('anthropic', { requestsPerMinute: 50, maxBurst: 5 });
        this.setLimit('gemini', { requestsPerMinute: 60, maxBurst: 10 });
    }

    setLimit(provider: string, config: RateLimitConfig) {
        this.buckets.set(provider, {
            tokens: config.maxBurst || config.requestsPerMinute,
            lastRefill: Date.now(),
            config
        });
    }

    /**
     * Waits for a token to be available.
     * Throws an error if the wait time would be excessive (optional design), 
     * but here we just wait.
     */
    async waitForToken(provider: string): Promise<void> {
        const bucket = this.buckets.get(provider);
        if (!bucket) return; // No limit set

        await this.refillBucket(provider);

        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            return;
        }

        // Calculate wait time
        const msPerToken = 60000 / bucket.config.requestsPerMinute;
        const waitTime = msPerToken;

        appLogger.debug('RateLimit', `Rate limit hit for ${provider}. Waiting ${waitTime.toFixed(0)}ms.`);

        await new Promise(resolve => setTimeout(resolve, waitTime));

        // Recursive call to try again after waiting (and refilling)
        return this.waitForToken(provider);
    }

    private async refillBucket(provider: string) {
        const bucket = this.buckets.get(provider);
        if (!bucket) return;

        const now = Date.now();
        const elapsed = now - bucket.lastRefill;
        const msPerToken = 60000 / bucket.config.requestsPerMinute;

        const newTokens = Math.floor(elapsed / msPerToken);

        if (newTokens > 0) {
            const maxTokens = bucket.config.maxBurst || bucket.config.requestsPerMinute;
            bucket.tokens = Math.min(bucket.tokens + newTokens, maxTokens);
            bucket.lastRefill = now;
        }
    }
}
