import { JsonValue } from '@shared/types/common';
import { QuotaResponse } from '@shared/types/quota';
import { AppSettings } from '@shared/types/settings';

/**
 * @fileoverview In-memory cache utility with TTL and LRU eviction.
 * - Least Recently Used (LRU) eviction when capacity is reached
 * - Eviction callbacks for resource cleanup
 * - Memoization decorator for function result caching
 * 
 * @module utils/cache
 * @author Tengra Team
 * @license MIT
 */

/**
 * Configuration options for the Cache.
 * 
 * @interface CacheOptions
 * @property {number} [maxSize=100] - Maximum number of entries before eviction triggered
 * @property {number} [defaultTTL=300000] - Default time-to-live in milliseconds (default: 5 mins)
 * @property {Function} [onEvict] - Callback invoked when an item is removed (expired or evicted)
 */
export interface CacheOptions<T = JsonValue> {
    /** Optional cache name for global analytics snapshots */
    name?: string
    /** Maximum number of entries before eviction triggered */
    maxSize?: number
    /** Default time-to-live in milliseconds */
    defaultTTL?: number
    /** Callback invoked when an item is removed */
    onEvict?: (key: string, value: T) => void
}

/**
 * Internal storage structure for cache entries.
 * 
 * @template T - Type of the stored value
 * @internal
 */
interface CacheEntry<T> {
    value: T
    expiresAt: number
    lastAccessed: number
}

/**
 * Generic in-memory cache implementation.
 * 
 * @template T - Type of values stored in the cache (defaults to any)
 * 
 * @example
 * ```typescript
 * const userCache = new Cache<User>({ maxSize: 50, defaultTTL: 60000 });
 * userCache.set('user:1', { id: 1, name: 'Alice' });
 * const user = userCache.get('user:1');
 * ```
 */
export class Cache<T = JsonValue> {
    private entries: Map<string, CacheEntry<T>> = new Map();
    private readonly maxSize: number;
    private readonly defaultTTL: number;
    private readonly onEvict?: (key: string, value: T) => void;
    private readonly name?: string;
    private hits = 0;
    private misses = 0;
    private sets = 0;
    private evictions = 0;
    private pruned = 0;

    /**
     * Creates a new Cache instance.
     * 
     * @param options - Cache configuration options
     */
    constructor(options: CacheOptions<T> = {}) {
        this.name = options.name;
        this.maxSize = options.maxSize ?? 100;
        this.defaultTTL = options.defaultTTL ?? 5 * 60 * 1000; // 5 minutes
        this.onEvict = options.onEvict;
        if (this.name) {
            registerCache(this.name, () => this.stats());
        }
    }

    /**
     * Retrieves a value from the cache.
     * 
     * Updates the last accessed time for LRU tracking.
     * Returns undefined if the key doesn't exist or has expired.
     * 
     * @param key - The cache key to retrieve
     * @returns The cached value or undefined
     */
    get(key: string): T | undefined {
        const entry = this.entries.get(key);
        if (!entry) {
            this.misses++;
            return undefined;
        }

        // Check expiration
        if (Date.now() > entry.expiresAt) {
            this.delete(key);
            this.misses++;
            return undefined;
        }

        // Update last accessed time for LRU
        entry.lastAccessed = Date.now();
        this.hits++;
        return entry.value;
    }

    /**
     * Stores a value in the cache.
     * 
     * If the cache is full, the least recently used item is evicted.
     * 
     * @param key - The unique key for the entry
     * @param value - The value to store
     * @param ttl - Optional custom TTL in milliseconds for this specific entry
     */
    set(key: string, value: T, ttl?: number): void {
        // Evict if at capacity
        if (this.entries.size >= this.maxSize && !this.entries.has(key)) {
            this.evictLRU();
        }

        const expiresAt = Date.now() + (ttl ?? this.defaultTTL);
        this.entries.set(key, {
            value,
            expiresAt,
            lastAccessed: Date.now()
        });
        this.sets++;
    }

    /**
     * Checks if a key exists in the cache and is valid (not expired).
     * 
     * Note: This does not update the last accessed time.
     * 
     * @param key - The key to check
     * @returns True if the key exists and is valid
     */
    has(key: string): boolean {
        const entry = this.entries.get(key);
        if (!entry) { return false; }
        if (Date.now() > entry.expiresAt) {
            this.delete(key);
            return false;
        }
        return true;
    }

    /**
     * Removes an entry from the cache.
     * 
     * Triggers the onEvict callback if one was provided.
     * 
     * @param key - The key to remove
     * @returns True if an entry was removed, false if it didn't exist
     */
    delete(key: string): boolean {
        const entry = this.entries.get(key);
        if (entry && this.onEvict) {
            this.onEvict(key, entry.value);
        }
        return this.entries.delete(key);
    }

    /**
     * Removes all entries from the cache.
     * 
     * Triggers the onEvict callback for every entry.
     */
    clear(): void {
        if (this.onEvict) {
            for (const [key, entry] of this.entries) {
                this.onEvict(key, entry.value);
            }
        }
        this.entries.clear();
    }

    /**
     * Returns the current number of entries in the cache.
     * 
     * @returns The count of cached items
     */
    size(): number {
        return this.entries.size;
    }

    /**
     * Returns an array of all keys currently in the cache.
     * 
     * @returns Array of cache keys
     */
    keys(): string[] {
        return Array.from(this.entries.keys());
    }

    /**
     * Evicts the least recently used item from the cache.
     * Uses a single pass to find the oldest entry.
     * 
     * @private
     */
    private evictLRU(): void {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        // One-pass search for the LRU entry
        for (const [key, entry] of this.entries) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed;
                oldestKey = key;
            }
        }

        if (oldestKey !== null) {
            this.evictions++;
            this.delete(oldestKey);
        }
    }

    /**
     * Removes all expired entries from the cache.
     * 
     * @returns The number of entries removed
     */
    prune(): number {
        const now = Date.now();
        let removed = 0;

        for (const [key, entry] of this.entries) {
            if (now > entry.expiresAt) {
                this.delete(key);
                removed++;
            }
        }
        this.pruned += removed;

        return removed;
    }

    /**
     * Returns statistics about the cache.
     * 
     * @returns Object containing cache usage statistics
     */
    stats(): {
        size: number;
        maxSize: number;
        hitRate: number;
        hits: number;
        misses: number;
        sets: number;
        evictions: number;
        pruned: number;
    } {
        const totalReads = this.hits + this.misses;
        return {
            size: this.entries.size,
            maxSize: this.maxSize,
            hitRate: totalReads > 0 ? this.hits / totalReads : 0,
            hits: this.hits,
            misses: this.misses,
            sets: this.sets,
            evictions: this.evictions,
            pruned: this.pruned
        };
    }
}

const cacheRegistry = new Map<string, () => ReturnType<Cache<JsonValue>['stats']>>();

function registerCache(name: string, getStats: () => ReturnType<Cache<JsonValue>['stats']>): void {
    cacheRegistry.set(name, getStats);
}

export function getCacheAnalyticsSnapshot(): Record<string, ReturnType<Cache<JsonValue>['stats']>> {
    const snapshot: Record<string, ReturnType<Cache<JsonValue>['stats']>> = {};
    for (const [name, getStats] of cacheRegistry.entries()) {
        snapshot[name] = getStats();
    }
    return snapshot;
}

export interface MultiLevelCacheOptions<T = JsonValue> {
    name: string;
    hot: CacheOptions<T>;
    warm: CacheOptions<T>;
}

export class MultiLevelCache<T = JsonValue> {
    private readonly hotCache: Cache<T>;
    private readonly warmCache: Cache<T>;
    private l1Hits = 0;
    private l2Hits = 0;
    private misses = 0;

    constructor(options: MultiLevelCacheOptions<T>) {
        this.hotCache = new Cache<T>({ ...options.hot, name: `${options.name}:hot` });
        this.warmCache = new Cache<T>({ ...options.warm, name: `${options.name}:warm` });
    }

    get(key: string): T | undefined {
        const hotValue = this.hotCache.get(key);
        if (hotValue !== undefined) {
            this.l1Hits++;
            return hotValue;
        }

        const warmValue = this.warmCache.get(key);
        if (warmValue !== undefined) {
            this.l2Hits++;
            this.hotCache.set(key, warmValue);
            return warmValue;
        }

        this.misses++;
        return undefined;
    }

    set(key: string, value: T, ttl?: { hot?: number; warm?: number }): void {
        this.hotCache.set(key, value, ttl?.hot);
        this.warmCache.set(key, value, ttl?.warm);
    }

    clear(): void {
        this.hotCache.clear();
        this.warmCache.clear();
    }

    warm(entries: Array<{ key: string; value: T; hotTtl?: number; warmTtl?: number }>): void {
        for (const entry of entries) {
            this.set(entry.key, entry.value, { hot: entry.hotTtl, warm: entry.warmTtl });
        }
    }

    stats(): {
        l1Hits: number;
        l2Hits: number;
        misses: number;
        totalReads: number;
        hitRate: number;
        levels: {
            hot: ReturnType<Cache<T>['stats']>;
            warm: ReturnType<Cache<T>['stats']>;
        };
    } {
        const totalReads = this.l1Hits + this.l2Hits + this.misses;
        return {
            l1Hits: this.l1Hits,
            l2Hits: this.l2Hits,
            misses: this.misses,
            totalReads,
            hitRate: totalReads > 0 ? (this.l1Hits + this.l2Hits) / totalReads : 0,
            levels: {
                hot: this.hotCache.stats(),
                warm: this.warmCache.stats()
            }
        };
    }
}

/**
 * Creates a memoized version of an async function.
 *
 * Results are cached based on the arguments passed to the function.
 *
 * @template Args - The types of the arguments passed to the function
 * @template Result - The type of the result returned by the function
 * @param fn - The function to memoize
 * @param options - Configuration options for memoization
 * @returns A wrapped version of the function that caches results
 *
 * @example
 * ```typescript
 * const fetchUser = memoize(async (id: number) => api.getUser(id), { ttl: 60000 });
 * ```
 */
export function memoize<Args extends unknown[], Result>(
    fn: (...args: Args) => Promise<Result>,
    options?: {
        cache?: Cache<Result>
        keyFn?: (...args: Args) => string
        ttl?: number
    }
): (...args: Args) => Promise<Result> {
    const defaultTTL = options?.ttl ?? 60000;
    const cache = options?.cache ?? new Cache<Result>({ defaultTTL });
    const keyFn = options?.keyFn ?? ((...args) => JSON.stringify(args));

    return async (...args: Args): Promise<Result> => {
        const key = keyFn(...args);

        const cached = cache.get(key);
        if (cached !== undefined) {
            return cached;
        }

        const result = await fn(...args);
        cache.set(key, result, options?.ttl);
        return result;
    };
}

// Pre-configured caches for common use cases

/** Cache for LLM model lists (Short TTL) */
export const modelCache = new Cache<JsonValue[]>({
    name: 'models',
    maxSize: 10,
    defaultTTL: 5 * 60 * 1000 // 5 minutes
});

/** Cache for API quota information (Very short TTL) */
export const quotaCache = new Cache<QuotaResponse>({
    name: 'quota',
    maxSize: 20,
    defaultTTL: 60 * 1000 // 1 minute
});

/** Cache for application settings (Short TTL) */
export const settingsCache = new Cache<AppSettings>({
    name: 'settings',
    maxSize: 5,
    defaultTTL: 30 * 1000 // 30 seconds
});


