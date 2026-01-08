
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RateLimiter, getRateLimiter, withRateLimit } from './rate-limiter.util'

describe('RateLimiter', () => {
    describe('RateLimiter class', () => {
        it('should allow requests within limit', () => {
            const limiter = new RateLimiter({ maxTokens: 3, refillRate: 1, refillIntervalMs: 1000 })

            expect(limiter.tryAcquire()).toBe(true)
            expect(limiter.tryAcquire()).toBe(true)
            expect(limiter.tryAcquire()).toBe(true)
        })

        it('should block requests when limit is exhausted', () => {
            const limiter = new RateLimiter({ maxTokens: 2, refillRate: 1, refillIntervalMs: 1000 })

            expect(limiter.tryAcquire()).toBe(true)
            expect(limiter.tryAcquire()).toBe(true)
            expect(limiter.tryAcquire()).toBe(false)
        })

        it('should refill tokens over time', async () => {
            const limiter = new RateLimiter({ maxTokens: 2, refillRate: 2, refillIntervalMs: 50 })

            expect(limiter.tryAcquire()).toBe(true)
            expect(limiter.tryAcquire()).toBe(true)
            expect(limiter.tryAcquire()).toBe(false)

            // Wait for refill
            await new Promise(resolve => setTimeout(resolve, 60))

            expect(limiter.tryAcquire()).toBe(true)
        })

        it('should report available tokens', () => {
            const limiter = new RateLimiter({ maxTokens: 5, refillRate: 1, refillIntervalMs: 1000 })

            expect(limiter.getAvailableTokens()).toBe(5)
            limiter.tryAcquire()
            expect(limiter.getAvailableTokens()).toBe(4)
        })
    })

    describe('getRateLimiter', () => {
        it('should return same instance for same provider', () => {
            const limiter1 = getRateLimiter('openai')
            const limiter2 = getRateLimiter('openai')

            expect(limiter1).toBe(limiter2)
        })

        it('should return different instances for different providers', () => {
            const openai = getRateLimiter('openai')
            const anthropic = getRateLimiter('anthropic')

            expect(openai).not.toBe(anthropic)
        })
    })

    describe('withRateLimit', () => {
        it('should execute function after acquiring token', async () => {
            const fn = vi.fn().mockResolvedValue('result')

            const result = await withRateLimit('default', fn)

            expect(result).toBe('result')
            expect(fn).toHaveBeenCalled()
        })
    })
})
