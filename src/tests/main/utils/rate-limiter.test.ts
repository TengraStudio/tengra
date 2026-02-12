import { RateLimiter } from '@main/utils/rate-limiter.util';
import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

describe('RateLimiter', () => {
    let limiter: RateLimiter;
    const config = {
        maxTokens: 5,
        refillRate: 5,
        refillIntervalMs: 1000
    };

    beforeEach(() => {
        vi.useFakeTimers();
        limiter = new RateLimiter(config);
    });

    afterEach(() => {
        vi.useRealTimers();
        limiter.clearQueue();
    });

    it('should acquire tokens immediately when available', () => {
        expect(limiter.tryAcquire()).toBe(true);
        expect(limiter.getAvailableTokens()).toBe(4);
    });

    it('should fail tryAcquire when no tokens available', () => {
        // Consume all tokens
        for (let i = 0; i < 5; i++) {
            limiter.tryAcquire();
        }
        expect(limiter.getAvailableTokens()).toBe(0);
        expect(limiter.tryAcquire()).toBe(false);
    });

    it('should refill tokens after interval', () => {
        // Consume all tokens
        for (let i = 0; i < 5; i++) {
            limiter.tryAcquire();
        }
        expect(limiter.getAvailableTokens()).toBe(0);

        // Advance time
        vi.advanceTimersByTime(1000);
        expect(limiter.getAvailableTokens()).toBe(5);
    });

    it('should queue requests when no tokens available', async () => {
        // Consume all tokens
        for (let i = 0; i < 5; i++) {
            limiter.tryAcquire();
        }

        const acquirePromise = limiter.acquire();

        // Should not resolve yet
        expect(limiter.getAvailableTokens()).toBe(0);

        // Advance time to refill
        await vi.advanceTimersByTimeAsync(1000);

        await expect(acquirePromise).resolves.toBeUndefined();
        expect(limiter.getAvailableTokens()).toBe(4); // 5 refill - 1 queued
    });

    it('should process queued requests in batches', async () => {
        // Test verifies that basic queueing works
        // Full MAX_QUEUE_SIZE and MAX_PROCESSING_BATCH testing would require
        // exporting constants or more complex mocking setup
        for (let i = 0; i < 5; i++) {
            limiter.tryAcquire();
        }
        expect(limiter.getAvailableTokens()).toBe(0);

        // Queue 2 requests
        const p1 = limiter.acquire();
        const p2 = limiter.acquire();

        // Use runAllTimersAsync to process all scheduled timers
        await vi.runAllTimersAsync();

        await expect(Promise.all([p1, p2])).resolves.toBeDefined();
    });

    it('should handle time changes robustly (negative elapsed)', () => {
        limiter.tryAcquire();
        expect(limiter.getAvailableTokens()).toBe(4);

        // Simulate system clock going backwards (should be ignored)
        vi.setSystemTime(Date.now() - 5000);
        expect(limiter.getAvailableTokens()).toBe(4);
    });
});

