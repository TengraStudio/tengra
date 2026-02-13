import * as crypto from 'crypto';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { OpenAIResponse } from '@main/types/llm.types';
import { Message } from '@shared/types/chat';

export interface CacheEntry {
    response: OpenAIResponse;
    timestamp: number;
    ttlMs: number;
}

/**
 * Service for caching LLM responses to improve performance and reduce API costs.
 * Uses SHA256 hashes of normalized request parameters as cache keys.
 */
export class ResponseCacheService extends BaseService {
    private cache: Map<string, CacheEntry> = new Map();
    private readonly MAX_ENTRIES = 1000;

    constructor() {
        super('ResponseCacheService');
    }

    /**
     * Retrieves a cached response if available and not expired.
     */
    async get(messages: Message[], model: string, options?: Record<string, unknown>): Promise<OpenAIResponse | null> {
        const key = this.generateKey(messages, model, options);
        const entry = this.cache.get(key);

        if (entry) {
            if (Date.now() - entry.timestamp < entry.ttlMs) {
                appLogger.debug('ResponseCacheService', `Cache hit for ${model}`);
                return entry.response;
            } else {
                this.cache.delete(key);
            }
        }

        return null;
    }

    /**
     * Saves a response to the cache.
     */
    async set(
        messages: Message[],
        model: string,
        response: OpenAIResponse,
        ttlMs: number = 3600000,
        options?: Record<string, unknown>
    ): Promise<void> {
        const key = this.generateKey(messages, model, options);

        if (this.cache.size >= this.MAX_ENTRIES) {
            // Simple LRU: remove first entry (oldest in Map insertion order)
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }

        this.cache.set(key, {
            response,
            timestamp: Date.now(),
            ttlMs
        });

        appLogger.debug('ResponseCacheService', `Cached response for ${model} (TTL: ${ttlMs}ms)`);
    }

    /**
     * Generates a deterministic SHA256 hash for the given request parameters.
     */
    private generateKey(messages: Message[], model: string, options?: Record<string, unknown>): string {
        // Normalize messages and options for deterministic key
        const normalizedMessages = messages.map(m => ({
            role: m.role,
            content: m.content
        }));

        const payload = {
            messages: normalizedMessages,
            model,
            options: options ? Object.keys(options).sort().reduce((acc, k) => {
                acc[k] = options[k];
                return acc;
            }, {} as Record<string, unknown>) : {}
        };

        return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    }

    /**
     * Clears the entire cache.
     */
    clear(): void {
        this.cache.clear();
        appLogger.info('ResponseCacheService', 'Cache cleared');
    }

    /**
     * Returns cache statistics.
     */
    getStats(): { size: number; maxEntries: number } {
        return {
            size: this.cache.size,
            maxEntries: this.MAX_ENTRIES
        };
    }
}
