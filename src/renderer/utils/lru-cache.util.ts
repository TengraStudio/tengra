/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * LRU (Least Recently Used) Cache implementation for database queries
 * Provides efficient caching with automatic eviction of least recently used items
 */

interface CacheNode<K, V> {
    key: K
    value: V
    prev: CacheNode<K, V> | null
    next: CacheNode<K, V> | null
    timestamp: number
}

interface CacheEntry {
    value: RendererDataValue
    timestamp: number
}

export class LRUCache<K = string, V = CacheEntry> {
    private capacity: number;
    private cache = new Map<K, CacheNode<K, V>>();
    private head: CacheNode<K, V> | null = null;
    private tail: CacheNode<K, V> | null = null;
    private hitCount = 0;
    private missCount = 0;

    constructor(capacity: number = 100) {
        this.capacity = capacity;
    }

    /**
     * Get value from cache
     */
    get(key: K): V | null {
        const node = this.cache.get(key);

        if (!node) {
            this.missCount++;
            return null;
        }

        // Move to head (most recently used)
        this.moveToHead(node);
        node.timestamp = Date.now();
        this.hitCount++;

        return node.value;
    }

    /**
     * Set value in cache
     */
    set(key: K, value: V): void {
        const existingNode = this.cache.get(key);

        if (existingNode) {
            // Update existing node
            existingNode.value = value;
            existingNode.timestamp = Date.now();
            this.moveToHead(existingNode);
            return;
        }

        // Create new node
        const newNode: CacheNode<K, V> = {
            key,
            value,
            prev: null,
            next: null,
            timestamp: Date.now()
        };

        // Check capacity
        if (this.cache.size >= this.capacity) {
            this.removeTail();
        }

        this.cache.set(key, newNode);
        this.addToHead(newNode);
    }

    /**
     * Check if key exists in cache
     */
    has(key: K): boolean {
        return this.cache.has(key);
    }

    /**
     * Delete key from cache
     */
    delete(key: K): boolean {
        const node = this.cache.get(key);
        if (!node) {
            return false;
        }

        this.removeNode(node);
        this.cache.delete(key);
        return true;
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.cache.clear();
        this.head = null;
        this.tail = null;
        this.hitCount = 0;
        this.missCount = 0;
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const total = this.hitCount + this.missCount;
        return {
            size: this.cache.size,
            capacity: this.capacity,
            hitCount: this.hitCount,
            missCount: this.missCount,
            hitRate: total > 0 ? (this.hitCount / total) * 100 : 0,
            usage: (this.cache.size / this.capacity) * 100
        };
    }

    /**
     * Get cache entries sorted by access time
     */
    getEntries(): Array<{ key: K; value: V; timestamp: number }> {
        const entries: Array<{ key: K; value: V; timestamp: number }> = [];
        let current = this.head;

        while (current) {
            entries.push({
                key: current.key,
                value: current.value,
                timestamp: current.timestamp
            });
            current = current.next;
        }

        return entries;
    }

    /**
     * Remove entries older than specified milliseconds
     */
    evictExpired(maxAge: number): number {
        const now = Date.now();
        let evicted = 0;
        const toRemove: K[] = [];

        for (const [key, node] of this.cache.entries()) {
            if (now - node.timestamp > maxAge) {
                toRemove.push(key);
            }
        }

        for (const key of toRemove) {
            this.delete(key);
            evicted++;
        }

        return evicted;
    }

    private addToHead(node: CacheNode<K, V>): void {
        node.prev = null;
        node.next = this.head;

        if (this.head) {
            this.head.prev = node;
        }

        this.head = node;

        this.tail ??= node;
    }

    private removeNode(node: CacheNode<K, V>): void {
        if (node.prev) {
            node.prev.next = node.next;
        } else {
            this.head = node.next;
        }

        if (node.next) {
            node.next.prev = node.prev;
        } else {
            this.tail = node.prev;
        }
    }

    private moveToHead(node: CacheNode<K, V>): void {
        this.removeNode(node);
        this.addToHead(node);
    }

    private removeTail(): void {
        if (!this.tail) {
            return;
        }

        const lastNode = this.tail;
        this.cache.delete(lastNode.key);
        this.removeNode(lastNode);
    }
}

// Global cache instances for common use cases
export const dbQueryCache = new LRUCache<string, CacheEntry>(50);
export const chatCache = new LRUCache<string, CacheEntry>(20);
export const workspaceCache = new LRUCache<string, CacheEntry>(10);
export const settingsCache = new LRUCache<string, CacheEntry>(10);

/**
 * Cache wrapper for database queries
 */
export async function withCache<T extends RendererDataValue>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    cache: LRUCache<string, CacheEntry> = dbQueryCache,
    maxAge: number = 30000 // 30 seconds
): Promise<T> {
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < maxAge)) {
        return cached.value as T;
    }

    // Fetch and cache
    const result = await fetcher();
    cache.set(cacheKey, { value: result, timestamp: Date.now() });
    return result;
}

/**
 * Invalidate cache entries by pattern
 */
export function invalidateCache(pattern: string | RegExp, cache: LRUCache<string, CacheEntry> = dbQueryCache): number {
    let invalidated = 0;
    const toRemove: string[] = [];

    for (const { key } of cache.getEntries()) {
        const keyStr = String(key);
        const shouldRemove = pattern instanceof RegExp
            ? pattern.test(keyStr)
            : keyStr.includes(pattern);

        if (shouldRemove) {
            toRemove.push(keyStr);
        }
    }

    for (const key of toRemove) {
        cache.delete(key);
        invalidated++;
    }

    return invalidated;
}

// Auto-cleanup expired entries every 5 minutes
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

export function startCacheCleanupInterval(): void {
    if (cleanupIntervalId) {
        return; // Already running
    }
    cleanupIntervalId = setInterval(() => {
        const maxAge = 5 * 60 * 1000; // 5 minutes
        dbQueryCache.evictExpired(maxAge);
        chatCache.evictExpired(maxAge);
        workspaceCache.evictExpired(maxAge);
        settingsCache.evictExpired(maxAge);
    }, 5 * 60 * 1000);
}

export function stopCacheCleanupInterval(): void {
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
    }
}

// Start the cleanup interval by default
startCacheCleanupInterval();

