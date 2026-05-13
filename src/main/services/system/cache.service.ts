/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { CacheRepository } from '@main/services/data/repositories/cache.repository';
import { EventBusService } from '@main/services/system/event-bus.service';

interface MemoryCacheEntry<T> {
    value: T;
    expiresAt: number | null;
}

export class CacheService extends BaseService {
    static readonly serviceName = 'cacheService';
    static readonly dependencies = ['dbService', 'eventBus'] as const;
    private repository!: CacheRepository;
    private memoryCache = new Map<string, Map<string, MemoryCacheEntry<unknown>>>();
    private cleanupInterval: NodeJS.Timeout | null = null;
    private tableInitialized = false;

    constructor(
        private dbService: DatabaseService,
        private eventBus: EventBusService
    ) {
        super('CacheService');
        
        // Listen for database ready event to retry initialization if it failed
        this.eventBus.on('db:ready', () => {
            if (!this.tableInitialized) {
                this.logInfo('Database ready, attempting to initialize cache table...');
                void this.ensureTableWithRetry();
            }
        });
    }

    override async initialize(): Promise<void> {
        this.repository = new CacheRepository(this.dbService.getDatabase());
        
        // Initial attempt - may fail if DB is not ready
        await this.ensureTableWithRetry();
        
        // Start background cleanup every 5 minutes
        this.cleanupInterval = setInterval(() => {
            void this.performBackgroundCleanup();
        }, 5 * 60 * 1000);
        
        this.logInfo('Cache service initialized');
    }

    private async ensureTableWithRetry(): Promise<void> {
        if (!this.repository) {
            this.logDebug('Cache repository not yet initialized, deferring table creation.');
            return;
        }
        try {
            await this.repository.ensureCacheTable();
            this.tableInitialized = true;
            this.logInfo('Cache table ensured');
        } catch (error) {
            this.logWarn('Failed to ensure cache table, will retry on db:ready', error as Error);
            this.tableInitialized = false;
        }
    }

    public isReady(): boolean {
        return this.tableInitialized;
    }

    async get<T>(namespace: string, key: string): Promise<T | null> {
        // 1. Check memory
        const nsCache = this.memoryCache.get(namespace);
        if (nsCache) {
            const entry = nsCache.get(key);
            if (entry) {
                if (entry.expiresAt === null || entry.expiresAt > Date.now()) {
                    return entry.value as T;
                }
                // Expired
                nsCache.delete(key);
            }
        }

        // 2. Check persistent
        try {
            const persistentEntry = await this.repository.get(namespace, key);
            if (persistentEntry) {
                if (persistentEntry.expiresAt === null || persistentEntry.expiresAt > Date.now()) {
                    const value = JSON.parse(persistentEntry.value) as T;
                    this.setInMemory(namespace, key, value, persistentEntry.expiresAt);
                    return value;
                }
                // Expired in DB
                void this.repository.delete(namespace, key);
            }
        } catch (error) {
            this.logError(`Failed to get persistent cache for ${namespace}:${key}`, error as Error);
        }

        return null;
    }

    async set<T>(namespace: string, key: string, value: T, ttlMs?: number): Promise<void> {
        const expiresAt = ttlMs ? Date.now() + ttlMs : null;
        
        // 1. Update memory
        this.setInMemory(namespace, key, value, expiresAt);

        // 2. Update persistent
        try {
            await this.repository.set(namespace, key, JSON.stringify(value), expiresAt);
        } catch (error) {
            this.logError(`Failed to set persistent cache for ${namespace}:${key}`, error as Error);
        }
    }

    async delete(namespace: string, key: string): Promise<void> {
        const nsCache = this.memoryCache.get(namespace);
        if (nsCache) {
            nsCache.delete(key);
        }
        await this.repository.delete(namespace, key);
    }

    async clearNamespace(namespace: string): Promise<void> {
        this.memoryCache.delete(namespace);
        await this.repository.clearNamespace(namespace);
    }

    private setInMemory<T>(namespace: string, key: string, value: T, expiresAt: number | null): void {
        let nsCache = this.memoryCache.get(namespace);
        if (!nsCache) {
            nsCache = new Map();
            this.memoryCache.set(namespace, nsCache);
        }
        nsCache.set(key, { value, expiresAt });
    }

    private async performBackgroundCleanup(): Promise<void> {
        try {
            const deleted = await this.repository.deleteExpired();
            if (deleted > 0) {
                this.logDebug(`Cleared ${deleted} expired persistent cache entries`);
            }

            // Sync memory cache cleanup
            const now = Date.now();
            for (const [_, nsCache] of this.memoryCache) {
                for (const [key, entry] of nsCache) {
                    if (entry.expiresAt !== null && entry.expiresAt < now) {
                        nsCache.delete(key);
                    }
                }
            }
        } catch (error) {
            this.logError('Cleanup failed', error as Error);
        }
    }

    override async cleanup(): Promise<void> {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

