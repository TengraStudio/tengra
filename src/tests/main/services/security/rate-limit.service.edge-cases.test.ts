import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { appLogger } from '@main/logging/logger';
import {
    RateLimitErrorCode,
    RateLimitService,
    RateLimitTelemetryEvent,
} from '@main/services/security/rate-limit.service';

describe('RateLimitService - Edge Cases', () => {
    let service: RateLimitService;

    beforeEach(() => {
        vi.useFakeTimers();
        service = new RateLimitService();
        vi.mocked(appLogger.debug).mockClear();
        vi.mocked(appLogger.info).mockClear();
    });

    afterEach(async () => {
        await service.cleanup();
        vi.useRealTimers();
    });

    describe('token refill capping', () => {
        it('should not refill tokens above maxBurst', () => {
            service.setLimit('cap-test', { requestsPerMinute: 60, maxBurst: 3 });
            service.tryAcquire('cap-test');
            // Advance enough to generate more tokens than maxBurst
            vi.advanceTimersByTime(10_000); // 10 tokens worth, but cap is 3
            const status = service.getProviderStatus('cap-test');
            expect(status.tokensRemaining).toBeLessThanOrEqual(3);
        });

        it('should cap at requestsPerMinute when maxBurst is undefined', () => {
            service.setLimit('no-burst', { requestsPerMinute: 5 });
            service.tryAcquire('no-burst');
            vi.advanceTimersByTime(120_000); // 2 minutes, should generate 10 tokens
            const status = service.getProviderStatus('no-burst');
            expect(status.tokensRemaining).toBeLessThanOrEqual(5);
        });
    });

    describe('provider config overwrite', () => {
        it('should replace existing config when setLimit is called again', () => {
            service.setLimit('overwrite', { requestsPerMinute: 60, maxBurst: 10 });
            service.setLimit('overwrite', { requestsPerMinute: 1, maxBurst: 1 });
            expect(service.tryAcquire('overwrite')).toBe(true);
            expect(service.tryAcquire('overwrite')).toBe(false);
        });

        it('should reset tokens when overwriting config', () => {
            service.setLimit('reset-tokens', { requestsPerMinute: 60, maxBurst: 5 });
            // Exhaust all tokens
            for (let i = 0; i < 5; i++) {
                service.tryAcquire('reset-tokens');
            }
            expect(service.tryAcquire('reset-tokens')).toBe(false);
            // Overwrite with new config → fresh tokens
            service.setLimit('reset-tokens', { requestsPerMinute: 60, maxBurst: 3 });
            expect(service.tryAcquire('reset-tokens')).toBe(true);
        });
    });

    describe('provider isolation', () => {
        it('should keep tokens independent across providers', () => {
            service.setLimit('provider-a', { requestsPerMinute: 60, maxBurst: 2 });
            service.setLimit('provider-b', { requestsPerMinute: 60, maxBurst: 2 });
            service.tryAcquire('provider-a');
            service.tryAcquire('provider-a');
            expect(service.tryAcquire('provider-a')).toBe(false);
            expect(service.tryAcquire('provider-b')).toBe(true);
        });
    });

    describe('maxBurst zero', () => {
        it('should start with zero tokens when maxBurst is 0', () => {
            service.setLimit('zero-burst', { requestsPerMinute: 60, maxBurst: 0 });
            expect(service.tryAcquire('zero-burst')).toBe(false);
        });

        it('should never acquire tokens when maxBurst is 0 even after time', () => {
            service.setLimit('zero-burst', { requestsPerMinute: 60, maxBurst: 0 });
            vi.advanceTimersByTime(60_000);
            expect(service.tryAcquire('zero-burst')).toBe(false);
        });
    });

    describe('special characters in provider', () => {
        it('should accept provider with colons', () => {
            expect(() => service.setLimit('mcp:filesystem', { requestsPerMinute: 60 })).not.toThrow();
        });

        it('should accept provider with unicode characters', () => {
            expect(() => service.setLimit('provider-ñ-日本語', { requestsPerMinute: 60 })).not.toThrow();
        });

        it('should accept provider with hyphens and underscores', () => {
            expect(() => service.setLimit('my_provider-v2', { requestsPerMinute: 60 })).not.toThrow();
        });
    });

    describe('very small requestsPerMinute', () => {
        it('should handle requestsPerMinute of 1', () => {
            service.setLimit('slow', { requestsPerMinute: 1, maxBurst: 1 });
            expect(service.tryAcquire('slow')).toBe(true);
            expect(service.tryAcquire('slow')).toBe(false);
            // Need 60 seconds for 1 token at 1 RPM
            vi.advanceTimersByTime(60_000);
            expect(service.tryAcquire('slow')).toBe(true);
        });

        it('should handle fractional requestsPerMinute', () => {
            service.setLimit('frac', { requestsPerMinute: 0.5, maxBurst: 1 });
            expect(service.tryAcquire('frac')).toBe(true);
            expect(service.tryAcquire('frac')).toBe(false);
        });
    });

    describe('getHealth accuracy', () => {
        it('should reflect added providers in health', () => {
            service.setLimit('h1', { requestsPerMinute: 60 });
            service.setLimit('h2', { requestsPerMinute: 60 });
            const health = service.getHealth();
            expect(health.activeBuckets).toBe(2);
            expect(health.providers).toContain('h1');
            expect(health.providers).toContain('h2');
        });

        it('should reflect removal after cleanup', async () => {
            service.setLimit('temp', { requestsPerMinute: 60 });
            await service.cleanup();
            const health = service.getHealth();
            expect(health.activeBuckets).toBe(0);
            expect(health.providers).toHaveLength(0);
        });
    });

    describe('double cleanup safety', () => {
        it('should not throw when cleanup is called twice', async () => {
            await service.initialize();
            await service.cleanup();
            await expect(service.cleanup()).resolves.toBeUndefined();
        });
    });

    describe('re-initialization', () => {
        it('should restore defaults after cleanup and re-initialize', async () => {
            await service.initialize();
            await service.cleanup();
            await service.initialize();
            expect(service.tryAcquire('openai')).toBe(true);
            expect(service.getHealth().activeBuckets).toBeGreaterThan(0);
        });
    });
});

describe('RateLimitService - getProviderStatus', () => {
    let service: RateLimitService;

    beforeEach(() => {
        vi.useFakeTimers();
        service = new RateLimitService();
    });

    afterEach(async () => {
        await service.cleanup();
        vi.useRealTimers();
    });

    it('should return configured: false for unknown provider', () => {
        const status = service.getProviderStatus('unknown');
        expect(status.configured).toBe(false);
        expect(status.tokensRemaining).toBe(0);
        expect(status.tokensMax).toBe(0);
    });

    it('should return correct initial state', () => {
        service.setLimit('status-test', { requestsPerMinute: 60, maxBurst: 5 });
        const status = service.getProviderStatus('status-test');
        expect(status.configured).toBe(true);
        expect(status.tokensRemaining).toBe(5);
        expect(status.tokensMax).toBe(5);
        expect(status.msUntilNextToken).toBe(0);
    });

    it('should reflect token consumption', () => {
        service.setLimit('consume', { requestsPerMinute: 60, maxBurst: 3 });
        service.tryAcquire('consume');
        service.tryAcquire('consume');
        const status = service.getProviderStatus('consume');
        expect(status.tokensRemaining).toBe(1);
    });

    it('should report msUntilNextToken when exhausted', () => {
        service.setLimit('exhausted', { requestsPerMinute: 60, maxBurst: 1 });
        service.tryAcquire('exhausted');
        const status = service.getProviderStatus('exhausted');
        expect(status.tokensRemaining).toBe(0);
        expect(status.msUntilNextToken).toBeGreaterThan(0);
        expect(status.msUntilNextToken).toBeLessThanOrEqual(1000); // 60 RPM = 1s per token
    });

    it('should validate provider argument', () => {
        expect(() => service.getProviderStatus('')).toThrow('non-empty string');
    });
});

describe('RateLimitService - Telemetry Events', () => {
    let service: RateLimitService;

    beforeEach(() => {
        vi.useFakeTimers();
        service = new RateLimitService();
        vi.mocked(appLogger.debug).mockClear();
        vi.mocked(appLogger.info).mockClear();
    });

    afterEach(async () => {
        await service.cleanup();
        vi.useRealTimers();
    });

    it('should emit TOKEN_REJECTED when tryAcquire fails', () => {
        service.setLimit('telem', { requestsPerMinute: 60, maxBurst: 1 });
        service.tryAcquire('telem');
        service.tryAcquire('telem'); // should be rejected
        const debugCalls = vi.mocked(appLogger.debug).mock.calls;
        const rejectionCall = debugCalls.find(
            (call) => call[1] === RateLimitTelemetryEvent.TOKEN_REJECTED
        );
        expect(rejectionCall).toBeDefined();
        expect((rejectionCall?.[2] as Record<string, string>)?.provider).toBe('telem');
    });

    it('should not emit TOKEN_REJECTED on successful tryAcquire', () => {
        service.setLimit('telem-ok', { requestsPerMinute: 60, maxBurst: 5 });
        vi.mocked(appLogger.debug).mockClear();
        service.tryAcquire('telem-ok');
        const rejectionCall = vi.mocked(appLogger.debug).mock.calls.find(
            (call) => call[1] === RateLimitTelemetryEvent.TOKEN_REJECTED
        );
        expect(rejectionCall).toBeUndefined();
    });

    it('should emit LIMIT_SET on setLimit', () => {
        vi.mocked(appLogger.debug).mockClear();
        service.setLimit('telem-set', { requestsPerMinute: 42 });
        const setCalls = vi.mocked(appLogger.debug).mock.calls.filter(
            (call) => call[1] === RateLimitTelemetryEvent.LIMIT_SET
        );
        expect(setCalls).toHaveLength(1);
        expect((setCalls[0][2] as Record<string, TestValue>)?.requestsPerMinute).toBe(42);
    });

    it('should emit WAIT_STARTED and WAIT_EXCEEDED on waitForToken timeout', async () => {
        service.setLimit('telem-wait', { requestsPerMinute: 60, maxBurst: 0 });

        const promise = service.waitForToken('telem-wait').catch((err: Error & { code?: string; retryAfterMs?: number }) => {
            expect(err.code).toBe(RateLimitErrorCode.WAIT_EXCEEDED);
            expect(err.retryAfterMs).toBe(1000); // 60000 / 60
            return 'rejected';
        });

        for (let i = 0; i < 101; i++) {
            await vi.advanceTimersByTimeAsync(1000);
        }

        await promise;

        const debugCalls = vi.mocked(appLogger.debug).mock.calls;
        const waitStarted = debugCalls.find(
            (call) => call[1] === RateLimitTelemetryEvent.WAIT_STARTED
        );
        expect(waitStarted).toBeDefined();

        const infoCalls = vi.mocked(appLogger.info).mock.calls;
        const waitExceeded = infoCalls.find(
            (call) => call[1] === RateLimitTelemetryEvent.WAIT_EXCEEDED
        );
        expect(waitExceeded).toBeDefined();
    });

    it('should emit WAIT_COMPLETED when token acquired after waiting', async () => {
        // Use maxBurst=1 and exhaust it, then wait for refill
        await service.cleanup();
        service = new RateLimitService();
        vi.mocked(appLogger.debug).mockClear();
        service.setLimit('telem-wait-ok2', { requestsPerMinute: 60, maxBurst: 1 });
        service.tryAcquire('telem-wait-ok2'); // exhaust token

        const promise2 = service.waitForToken('telem-wait-ok2');
        // Advance time enough for 1 token refill
        await vi.advanceTimersByTimeAsync(1001);
        await promise2;

        const debugCalls = vi.mocked(appLogger.debug).mock.calls;
        const waitCompleted = debugCalls.find(
            (call) => call[1] === RateLimitTelemetryEvent.WAIT_COMPLETED
        );
        expect(waitCompleted).toBeDefined();
    });

    it('should emit BUCKET_CLEANUP when old buckets are removed', async () => {
        await service.initialize();
        vi.mocked(appLogger.info).mockClear();

        // Advance past 35 minutes: cleanup fires at 35min, buckets are >30min old (strict >)
        vi.advanceTimersByTime(36 * 60 * 1000);

        const infoCalls = vi.mocked(appLogger.info).mock.calls;
        const cleanupCall = infoCalls.find(
            (call) => call[1] === RateLimitTelemetryEvent.BUCKET_CLEANUP
        );
        expect(cleanupCall).toBeDefined();
        expect((cleanupCall?.[2] as Record<string, number>)?.removedCount).toBeGreaterThan(0);
    });
});
