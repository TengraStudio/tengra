import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Cache, memoize } from './cache.util'

describe('Cache', () => {
    let cache: Cache<string>

    beforeEach(() => {
        cache = new Cache<string>({ maxSize: 3, defaultTTL: 1000 })
    })

    describe('basic operations', () => {
        it('should set and get values', () => {
            cache.set('key1', 'value1')
            expect(cache.get('key1')).toBe('value1')
        })

        it('should return undefined for missing keys', () => {
            expect(cache.get('missing')).toBeUndefined()
        })

        it('should check if key exists', () => {
            cache.set('key1', 'value1')
            expect(cache.has('key1')).toBe(true)
            expect(cache.has('missing')).toBe(false)
        })

        it('should delete keys', () => {
            cache.set('key1', 'value1')
            expect(cache.delete('key1')).toBe(true)
            expect(cache.get('key1')).toBeUndefined()
        })

        it('should clear all entries', () => {
            cache.set('key1', 'value1')
            cache.set('key2', 'value2')
            cache.clear()
            expect(cache.size()).toBe(0)
        })
    })

    describe('TTL expiration', () => {
        it('should expire entries after TTL', async () => {
            const shortCache = new Cache<string>({ defaultTTL: 50 })
            shortCache.set('key1', 'value1')
            expect(shortCache.get('key1')).toBe('value1')

            await new Promise(resolve => setTimeout(resolve, 60))
            expect(shortCache.get('key1')).toBeUndefined()
        })

        it('should respect custom TTL per entry', async () => {
            cache.set('short', 'value', 50)
            cache.set('long', 'value', 5000)

            await new Promise(resolve => setTimeout(resolve, 60))
            expect(cache.get('short')).toBeUndefined()
            expect(cache.get('long')).toBe('value')
        })
    })

    describe('LRU eviction', () => {
        it('should evict LRU entry when at capacity', () => {
            cache.set('a', 'value-a')
            cache.set('b', 'value-b')
            cache.set('c', 'value-c')

            // Access 'b' and 'c' to make them recently used
            cache.get('b')
            cache.get('c')

            // Add new entry, should evict 'a' (least recently used)
            cache.set('d', 'value-d')

            expect(cache.has('a')).toBe(false) // 'a' was never accessed after set
            expect(cache.size()).toBe(3)
        })
    })

    describe('prune', () => {
        it('should remove expired entries', async () => {
            const shortCache = new Cache<string>({ defaultTTL: 50 })
            shortCache.set('key1', 'value1')
            shortCache.set('key2', 'value2', 5000) // longer TTL

            await new Promise(resolve => setTimeout(resolve, 60))
            const removed = shortCache.prune()

            expect(removed).toBe(1)
            expect(shortCache.has('key1')).toBe(false)
            expect(shortCache.has('key2')).toBe(true)
        })
    })

    describe('onEvict callback', () => {
        it('should call onEvict when entry is deleted', () => {
            const onEvict = vi.fn()
            const callbackCache = new Cache<string>({ onEvict })

            callbackCache.set('key1', 'value1')
            callbackCache.delete('key1')

            expect(onEvict).toHaveBeenCalledWith('key1', 'value1')
        })
    })
})

describe('memoize', () => {
    it('should cache function results', async () => {
        const fn = vi.fn().mockResolvedValue('result')
        const memoized = memoize(fn, { ttl: 1000 })

        const result1 = await memoized('arg1')
        const result2 = await memoized('arg1')

        expect(result1).toBe('result')
        expect(result2).toBe('result')
        expect(fn).toHaveBeenCalledTimes(1) // Only called once due to caching
    })

    it('should cache different results for different args', async () => {
        let counter = 0
        const fn = vi.fn().mockImplementation((_arg) => Promise.resolve(`result-${counter++}`))
        const memoized = memoize(fn, { ttl: 1000 })

        const result1 = await memoized('arg1')
        const result2 = await memoized('arg2')
        const result3 = await memoized('arg1') // Should return cached

        expect(result1).toBe('result-0')
        expect(result2).toBe('result-1')
        expect(result3).toBe('result-0')
        expect(fn).toHaveBeenCalledTimes(2)
    })
})
