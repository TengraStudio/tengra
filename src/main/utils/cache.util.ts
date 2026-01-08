/**
 * Cache Utility with TTL and LRU eviction
 */

export interface CacheOptions {
    maxSize?: number           // Maximum number of entries
    defaultTTL?: number        // Default TTL in milliseconds
    onEvict?: (key: string, value: any) => void
}

interface CacheEntry<T> {
    value: T
    expiresAt: number
    lastAccessed: number
}

export class Cache<T = any> {
    private entries: Map<string, CacheEntry<T>> = new Map()
    private readonly maxSize: number
    private readonly defaultTTL: number
    private readonly onEvict?: (key: string, value: T) => void

    constructor(options: CacheOptions = {}) {
        this.maxSize = options.maxSize ?? 100
        this.defaultTTL = options.defaultTTL ?? 5 * 60 * 1000 // 5 minutes
        this.onEvict = options.onEvict
    }

    /**
     * Get a value from cache
     */
    get(key: string): T | undefined {
        const entry = this.entries.get(key)
        if (!entry) return undefined

        // Check expiration
        if (Date.now() > entry.expiresAt) {
            this.delete(key)
            return undefined
        }

        // Update last accessed time for LRU
        entry.lastAccessed = Date.now()
        return entry.value
    }

    /**
     * Set a value in cache
     */
    set(key: string, value: T, ttl?: number): void {
        // Evict if at capacity
        if (this.entries.size >= this.maxSize && !this.entries.has(key)) {
            this.evictLRU()
        }

        const expiresAt = Date.now() + (ttl ?? this.defaultTTL)
        this.entries.set(key, {
            value,
            expiresAt,
            lastAccessed: Date.now()
        })
    }

    /**
     * Check if key exists and is not expired
     */
    has(key: string): boolean {
        const entry = this.entries.get(key)
        if (!entry) return false
        if (Date.now() > entry.expiresAt) {
            this.delete(key)
            return false
        }
        return true
    }

    /**
     * Delete a key from cache
     */
    delete(key: string): boolean {
        const entry = this.entries.get(key)
        if (entry && this.onEvict) {
            this.onEvict(key, entry.value)
        }
        return this.entries.delete(key)
    }

    /**
     * Clear all entries
     */
    clear(): void {
        if (this.onEvict) {
            for (const [key, entry] of this.entries) {
                this.onEvict(key, entry.value)
            }
        }
        this.entries.clear()
    }

    /**
     * Get cache size
     */
    size(): number {
        return this.entries.size
    }

    /**
     * Get all keys
     */
    keys(): string[] {
        return Array.from(this.entries.keys())
    }

    /**
     * Evict least recently used entry
     */
    private evictLRU(): void {
        let oldestKey: string | null = null
        let oldestTime = Infinity

        for (const [key, entry] of this.entries) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed
                oldestKey = key
            }
        }

        if (oldestKey) {
            this.delete(oldestKey)
        }
    }

    /**
     * Remove expired entries
     */
    prune(): number {
        const now = Date.now()
        let removed = 0

        for (const [key, entry] of this.entries) {
            if (now > entry.expiresAt) {
                this.delete(key)
                removed++
            }
        }

        return removed
    }

    /**
     * Get cache stats
     */
    stats(): { size: number; maxSize: number; hitRate?: number } {
        return {
            size: this.entries.size,
            maxSize: this.maxSize
        }
    }
}

/**
 * Create a memoized version of an async function with caching
 */
export function memoize<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options?: {
        cache?: Cache
        keyFn?: (...args: Parameters<T>) => string
        ttl?: number
    }
): T {
    const cache = options?.cache ?? new Cache({ defaultTTL: options?.ttl ?? 60000 })
    const keyFn = options?.keyFn ?? ((...args) => JSON.stringify(args))

    return (async (...args: Parameters<T>) => {
        const key = keyFn(...args)

        const cached = cache.get(key)
        if (cached !== undefined) {
            return cached
        }

        const result = await fn(...args)
        cache.set(key, result, options?.ttl)
        return result
    }) as T
}

// Pre-configured caches for common use cases
export const modelCache = new Cache<any[]>({
    maxSize: 10,
    defaultTTL: 5 * 60 * 1000 // 5 minutes
})

export const quotaCache = new Cache<any>({
    maxSize: 20,
    defaultTTL: 60 * 1000 // 1 minute
})

export const settingsCache = new Cache<any>({
    maxSize: 5,
    defaultTTL: 30 * 1000 // 30 seconds
})
