import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@main/logging/logger', () => ({ appLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
import { RateLimitService } from '@main/services/security/rate-limit.service';

describe('RateLimitService Integration', () => {
    let service: RateLimitService;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        service = new RateLimitService();
        await service.initialize();
    });

    afterEach(async () => {
        await service.cleanup();
        vi.useRealTimers();
    });

    it('should initialize with default providers and allow token acquisition', () => {
        expect(service.tryAcquire('openai')).toBe(true);
    });

    it('should exhaust tokens and then reject', () => {
        service.setLimit('test-provider', { requestsPerMinute: 2, maxBurst: 2 });
        expect(service.tryAcquire('test-provider')).toBe(true);
        expect(service.tryAcquire('test-provider')).toBe(true);
        expect(service.tryAcquire('test-provider')).toBe(false);
    });

    it('should refill tokens after time passes', () => {
        service.setLimit('test-provider', { requestsPerMinute: 1, maxBurst: 1 });
        expect(service.tryAcquire('test-provider')).toBe(true);
        expect(service.tryAcquire('test-provider')).toBe(false);
        vi.advanceTimersByTime(61000);
        expect(service.tryAcquire('test-provider')).toBe(true);
    });

    it('should report health after initialization', () => {
        const health = service.getHealth();
        expect(health.activeBuckets).toBeGreaterThan(0);
        expect(health.providers.length).toBeGreaterThan(0);
    });

    it('should clean up all state on cleanup', async () => {
        await service.cleanup();
        const health = service.getHealth();
        expect(health.activeBuckets).toBe(0);
    });
});
