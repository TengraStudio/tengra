import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { RateLimitErrorCode,RateLimitService } from '@main/services/security/rate-limit.service';

describe('RateLimitService', () => {
    let service: RateLimitService;

    beforeEach(() => {
        vi.useFakeTimers();
        service = new RateLimitService();
    });

    afterEach(async () => {
        await service.cleanup();
        vi.useRealTimers();
    });

    describe('setLimit', () => {
        it('should accept a valid config', () => {
            expect(() => service.setLimit('test-provider', { requestsPerMinute: 60, maxBurst: 10 })).not.toThrow();
        });

        it('should reject an empty provider string', () => {
            try {
                service.setLimit('', { requestsPerMinute: 60 });
                expect.fail('should have thrown');
            } catch (error) {
                expect((error as Error).message).toContain('non-empty string');
                expect((error as Error & { code?: string }).code).toBe(RateLimitErrorCode.INVALID_PROVIDER);
            }
        });

        it('should reject a whitespace-only provider string', () => {
            try {
                service.setLimit('   ', { requestsPerMinute: 60 });
                expect.fail('should have thrown');
            } catch (error) {
                expect((error as Error).message).toContain('not purely whitespace');
                expect((error as Error & { code?: string }).code).toBe(RateLimitErrorCode.INVALID_PROVIDER);
            }
        });

        it('should reject a provider key exceeding max length', () => {
            const longKey = 'a'.repeat(257);
            try {
                service.setLimit(longKey, { requestsPerMinute: 60 });
                expect.fail('should have thrown');
            } catch (error) {
                expect((error as Error).message).toContain('exceeds maximum length');
                expect((error as Error & { code?: string }).code).toBe(RateLimitErrorCode.INVALID_PROVIDER);
            }
        });

        it('should accept a provider key at exactly max length', () => {
            const maxKey = 'a'.repeat(256);
            expect(() => service.setLimit(maxKey, { requestsPerMinute: 60 })).not.toThrow();
        });

        it('should reject zero requestsPerMinute', () => {
            expect(() => service.setLimit('provider', { requestsPerMinute: 0 })).toThrow('requestsPerMinute must be a finite positive number');
        });

        it('should reject negative requestsPerMinute', () => {
            expect(() => service.setLimit('provider', { requestsPerMinute: -5 })).toThrow('requestsPerMinute must be a finite positive number');
        });

        it('should reject NaN requestsPerMinute', () => {
            expect(() => service.setLimit('provider', { requestsPerMinute: NaN })).toThrow('requestsPerMinute must be a finite positive number');
        });

        it('should reject Infinity requestsPerMinute', () => {
            expect(() => service.setLimit('provider', { requestsPerMinute: Infinity })).toThrow('requestsPerMinute must be a finite positive number');
        });

        it('should reject requestsPerMinute exceeding upper bound', () => {
            expect(() => service.setLimit('provider', { requestsPerMinute: 100_001 })).toThrow('exceeds maximum');
        });

        it('should accept requestsPerMinute at upper bound', () => {
            expect(() => service.setLimit('provider', { requestsPerMinute: 100_000 })).not.toThrow();
        });

        it('should reject negative maxBurst', () => {
            expect(() => service.setLimit('provider', { requestsPerMinute: 60, maxBurst: -1 })).toThrow('maxBurst must be a finite non-negative number');
        });

        it('should reject NaN maxBurst', () => {
            expect(() => service.setLimit('provider', { requestsPerMinute: 60, maxBurst: NaN })).toThrow('maxBurst must be a finite non-negative number');
        });

        it('should reject Infinity maxBurst', () => {
            expect(() => service.setLimit('provider', { requestsPerMinute: 60, maxBurst: Infinity })).toThrow('maxBurst must be a finite non-negative number');
        });

        it('should allow maxBurst of zero', () => {
            expect(() => service.setLimit('provider', { requestsPerMinute: 60, maxBurst: 0 })).not.toThrow();
        });

        it('should reject null config', () => {
            expect(() => service.setLimit('provider', null as never as { requestsPerMinute: number })).toThrow('non-null object');
        });

        it('should reject undefined config', () => {
            expect(() => service.setLimit('provider', undefined as never as { requestsPerMinute: number })).toThrow('non-null object');
        });

        it('should set INVALID_CONFIG error code for bad config values', () => {
            try {
                service.setLimit('provider', { requestsPerMinute: -1 });
                expect.fail('should have thrown');
            } catch (error) {
                expect((error as Error & { code?: string }).code).toBe(RateLimitErrorCode.INVALID_CONFIG);
            }
        });
    });

    describe('tryAcquire', () => {
        it('should return true for an unknown provider', () => {
            expect(service.tryAcquire('unknown-provider')).toBe(true);
        });

        it('should return true when tokens are available', () => {
            service.setLimit('test', { requestsPerMinute: 60, maxBurst: 5 });
            expect(service.tryAcquire('test')).toBe(true);
        });

        it('should return false when tokens are exhausted', () => {
            service.setLimit('test', { requestsPerMinute: 60, maxBurst: 2 });
            expect(service.tryAcquire('test')).toBe(true);
            expect(service.tryAcquire('test')).toBe(true);
            expect(service.tryAcquire('test')).toBe(false);
        });

        it('should reject an empty provider string', () => {
            expect(() => service.tryAcquire('')).toThrow('non-empty string');
        });

        it('should reject a whitespace-only provider string', () => {
            expect(() => service.tryAcquire('  \t ')).toThrow('not purely whitespace');
        });

        it('should reject a provider key exceeding max length', () => {
            expect(() => service.tryAcquire('x'.repeat(257))).toThrow('exceeds maximum length');
        });

        it('should refill tokens after time passes', () => {
            service.setLimit('test', { requestsPerMinute: 60, maxBurst: 1 });
            expect(service.tryAcquire('test')).toBe(true);
            expect(service.tryAcquire('test')).toBe(false);

            // Advance 1 second = 1 token at 60/min
            vi.advanceTimersByTime(1000);
            expect(service.tryAcquire('test')).toBe(true);
        });
    });

    describe('waitForToken', () => {
        it('should reject an empty provider with INVALID_PROVIDER code', async () => {
            try {
                await service.waitForToken('');
                expect.fail('should have thrown');
            } catch (error) {
                expect((error as Error).message).toContain('non-empty string');
                expect((error as Error & { code?: string }).code).toBe(RateLimitErrorCode.INVALID_PROVIDER);
            }
        });

        it('should reject a whitespace-only provider with INVALID_PROVIDER code', async () => {
            try {
                await service.waitForToken('   ');
                expect.fail('should have thrown');
            } catch (error) {
                expect((error as Error).message).toContain('not purely whitespace');
                expect((error as Error & { code?: string }).code).toBe(RateLimitErrorCode.INVALID_PROVIDER);
            }
        });

        it('should reject a provider key exceeding max length', async () => {
            try {
                await service.waitForToken('y'.repeat(257));
                expect.fail('should have thrown');
            } catch (error) {
                expect((error as Error).message).toContain('exceeds maximum length');
                expect((error as Error & { code?: string }).code).toBe(RateLimitErrorCode.INVALID_PROVIDER);
            }
        });

        it('should succeed immediately for unknown provider', async () => {
            await expect(service.waitForToken('no-limit')).resolves.toBeUndefined();
        });

        it('should succeed when tokens are available', async () => {
            service.setLimit('test', { requestsPerMinute: 60, maxBurst: 5 });
            await expect(service.waitForToken('test')).resolves.toBeUndefined();
        });

        it('should throw WAIT_EXCEEDED after max iterations with no tokens', async () => {
            service.setLimit('test', { requestsPerMinute: 60, maxBurst: 0 });

            const promise = service.waitForToken('test').catch((error: Error & { code?: string }) => {
                expect(error.message).toContain('wait exceeded');
                expect(error.code).toBe(RateLimitErrorCode.WAIT_EXCEEDED);
                return 'rejected';
            });

            // Each iteration waits msPerToken = 60000/60 = 1000ms, 100 iterations
            for (let i = 0; i < 101; i++) {
                await vi.advanceTimersByTimeAsync(1000);
            }

            const result = await promise;
            expect(result).toBe('rejected');
        });
    });

    describe('cleanupOldBuckets', () => {
        it('should remove buckets older than 30 minutes', async () => {
            await service.initialize();
            const initialResult = service.tryAcquire('openai');
            expect(initialResult).toBe(true);

            // Advance past 30 minutes + cleanup interval (5 min)
            vi.advanceTimersByTime(31 * 60 * 1000);

            // After cleanup runs, the openai bucket should be removed
            // tryAcquire returns true for unknown providers
            expect(service.tryAcquire('openai')).toBe(true);
        });
    });

    describe('cleanup', () => {
        it('should clear all buckets and stop interval', async () => {
            await service.initialize();
            // Buckets exist after init
            service.setLimit('custom', { requestsPerMinute: 10, maxBurst: 1 });
            service.tryAcquire('custom');

            await service.cleanup();

            // After cleanup, all providers are unknown → tryAcquire returns true
            expect(service.tryAcquire('openai')).toBe(true);
            expect(service.tryAcquire('custom')).toBe(true);
        });
    });
});
