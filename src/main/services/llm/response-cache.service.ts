/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as crypto from 'crypto';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { OpenAIResponse } from '@main/types/llm.types';
import { Message } from '@shared/types/chat';

export interface CacheEntry {
    response: OpenAIResponse;
    timestamp: number;
    ttlMs: number;
    model: string;
    namespace: string;
}

export type CacheInvalidationReason =
    | 'manual'
    | 'model-change'
    | 'namespace-change'
    | 'ttl-expired'
    | 'entry-limit';

export interface CacheInvalidationResult {
    removed: number;
    remaining: number;
    reason: CacheInvalidationReason;
    namespace: string;
}

/**
 * Service for caching LLM responses to improve performance and reduce API costs.
 * Uses SHA256 hashes of normalized request parameters as cache keys.
 */
export class ResponseCacheService extends BaseService {
    static readonly serviceName = 'responseCacheService';
    static readonly dependencies = [] as const;
    private readonly cache = new Map<string, CacheEntry>();
    private readonly MAX_ENTRIES = 1000;
    private readonly MIN_TTL_MS = 1000;
    private readonly MAX_TTL_MS = 6 * 60 * 60 * 1000;
    private readonly KEY_VERSION = 2;
    private cacheNamespace = 'default';

    constructor() {
        super('ResponseCacheService');
    }

    /**
     * Retrieves a cached response if available and not expired.
     */
    async get(messages: Message[], model: string, options?: Record<string, RuntimeValue>): Promise<OpenAIResponse | null> {
        const normalizedModel = this.normalizeModel(model);
        const key = this.generateKey(messages, normalizedModel, options);
        const now = Date.now();
        const expiredCount = this.removeExpiredEntries(now);
        if (expiredCount > 0) {
            appLogger.debug('ResponseCacheService', `Expired ${expiredCount} cache entry(ies)`);
        }
        const entry = this.cache.get(key);

        if (entry) {
            if (now - entry.timestamp < entry.ttlMs) {
                this.cache.delete(key);
                this.cache.set(key, entry);
                appLogger.debug('ResponseCacheService', `Cache hit for ${normalizedModel}`);
                return entry.response;
            }
            this.cache.delete(key);
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
        options?: Record<string, RuntimeValue>
    ): Promise<void> {
        const normalizedModel = this.normalizeModel(model);
        const key = this.generateKey(messages, normalizedModel, options);
        const normalizedTtlMs = this.clampTtl(ttlMs);
        const now = Date.now();
        const expiredCount = this.removeExpiredEntries(now);
        if (expiredCount > 0) {
            appLogger.debug('ResponseCacheService', `Expired ${expiredCount} cache entry(ies)`);
        }

        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        this.cache.set(key, {
            response,
            timestamp: now,
            ttlMs: normalizedTtlMs,
            model: normalizedModel,
            namespace: this.cacheNamespace,
        });
        const evictedCount = this.enforceEntryLimit();
        if (evictedCount > 0) {
            appLogger.info(
                'ResponseCacheService',
                `Evicted ${evictedCount} cache entry(ies) due to entry limit`
            );
        }

        appLogger.debug('ResponseCacheService', `Cached response for ${normalizedModel} (TTL: ${normalizedTtlMs}ms, namespace: ${this.cacheNamespace})`);
    }

    private clampTtl(ttlMs: number): number {
        if (!Number.isFinite(ttlMs)) {
            return this.MAX_TTL_MS;
        }
        return Math.max(this.MIN_TTL_MS, Math.min(ttlMs, this.MAX_TTL_MS));
    }

    /**
     * Invalidates cache entries for a specific model.
     */
    invalidateByModel(model: string, reason: CacheInvalidationReason = 'model-change'): CacheInvalidationResult {
        const normalizedModel = this.normalizeModel(model);
        let removed = 0;

        for (const [cacheKey, entry] of this.cache.entries()) {
            if (entry.model === normalizedModel) {
                this.cache.delete(cacheKey);
                removed += 1;
            }
        }

        const result = this.createInvalidationResult(removed, reason);
        if (removed > 0) {
            appLogger.info(
                'ResponseCacheService',
                `Invalidated ${removed} cache entry(ies) for model '${normalizedModel}' (reason: ${reason})`
            );
        }
        return result;
    }

    /**
     * Invalidates all entries and returns deterministic invalidation metadata.
     */
    invalidateAll(reason: CacheInvalidationReason = 'manual'): CacheInvalidationResult {
        const removed = this.cache.size;
        this.cache.clear();
        const result = this.createInvalidationResult(removed, reason);
        if (removed > 0) {
            appLogger.info(
                'ResponseCacheService',
                `Invalidated ${removed} cache entry(ies) (reason: ${reason}, namespace: ${this.cacheNamespace})`
            );
        }
        return result;
    }

    /**
     * Switches cache namespace and invalidates stale entries when namespace changes.
     */
    setCacheNamespace(namespace: string): CacheInvalidationResult {
        const normalizedNamespace = this.normalizeNamespace(namespace);
        if (normalizedNamespace === this.cacheNamespace) {
            return this.createInvalidationResult(0, 'namespace-change');
        }
        this.cacheNamespace = normalizedNamespace;
        return this.invalidateAll('namespace-change');
    }

    /**
     * Safe invalidation API for callers needing explicit deterministic triggers.
     */
    invalidate(options: { model?: string; reason?: CacheInvalidationReason } = {}): CacheInvalidationResult {
        if (options.model) {
            return this.invalidateByModel(options.model, options.reason ?? 'model-change');
        }
        return this.invalidateAll(options.reason ?? 'manual');
    }

    private removeExpiredEntries(now: number): number {
        let removed = 0;
        for (const [cacheKey, entry] of this.cache.entries()) {
            if (now - entry.timestamp >= entry.ttlMs) {
                this.cache.delete(cacheKey);
                removed += 1;
            }
        }
        return removed;
    }

    private enforceEntryLimit(): number {
        let removed = 0;
        while (this.cache.size > this.MAX_ENTRIES) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey === undefined) {
                break;
            }
            this.cache.delete(oldestKey);
            removed += 1;
        }
        return removed;
    }

    /**
     * Generates a deterministic SHA256 hash for the given request parameters.
     */
    private generateKey(messages: Message[], model: string, options?: Record<string, RuntimeValue>): string {
        const payload = {
            keyVersion: this.KEY_VERSION,
            namespace: this.cacheNamespace,
            messages: messages.map(message => this.normalizeForKey({
                role: message.role,
                content: message.content
            })),
            model,
            options: this.normalizeForKey(options ?? {})
        };

        return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    }

    private normalizeModel(model: string): string {
        const trimmed = model.trim().toLowerCase();
        return trimmed.length > 0 ? trimmed : 'unknown-model';
    }

    private normalizeNamespace(namespace: string): string {
        const trimmed = namespace.trim().toLowerCase();
        return trimmed.length > 0 ? trimmed : 'default';
    }

    private normalizeForKey(value: RuntimeValue): RuntimeValue {
        if (value === null || value === undefined) {
            return null;
        }
        if (Array.isArray(value)) {
            return value.map(item => this.normalizeForKey(item));
        }
        if (typeof value === 'object') {
            const record = value as Record<string, RuntimeValue>;
            return Object.keys(record)
                .sort()
                .reduce<Record<string, RuntimeValue>>((accumulator, key) => {
                    const nestedValue = record[key];
                    if (nestedValue !== undefined && typeof nestedValue !== 'function') {
                        accumulator[key] = this.normalizeForKey(nestedValue);
                    }
                    return accumulator;
                }, {});
        }
        if (typeof value === 'number' && !Number.isFinite(value)) {
            return String(value);
        }
        return value;
    }

    private createInvalidationResult(
        removed: number,
        reason: CacheInvalidationReason
    ): CacheInvalidationResult {
        return {
            removed,
            remaining: this.cache.size,
            reason,
            namespace: this.cacheNamespace,
        };
    }

    /**
     * Clears the entire cache.
     */
    clear(): void {
        this.invalidateAll('manual');
    }

    /**
     * Returns cache statistics.
     */
    getStats(): {
        size: number;
        maxEntries: number;
        namespace: string;
        keyVersion: number;
    } {
        return {
            size: this.cache.size,
            maxEntries: this.MAX_ENTRIES,
            namespace: this.cacheNamespace,
            keyVersion: this.KEY_VERSION,
        };
    }
}

