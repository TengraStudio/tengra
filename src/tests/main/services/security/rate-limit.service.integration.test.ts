import { SESSION_CONVERSATION_CHANNELS } from '@shared/constants/ipc-channels';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({ appLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
import { RateLimitErrorCode, RateLimitService } from '@main/services/security/rate-limit.service';

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

describe('RateLimitService Integration - Multi-Provider Flows', () => {
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

    it('should independently track multiple providers', () => {
        // Exhaust openai but anthropic should still be available
        const openaiConfig = service.getProviderStatus('openai');
        for (let i = 0; i < openaiConfig.tokensMax; i++) {
            service.tryAcquire('openai');
        }
        expect(service.tryAcquire('openai')).toBe(false);
        expect(service.tryAcquire('anthropic')).toBe(true);
    });

    it('should handle all default IPC provider names', () => {
        const ipcProviders = [
            'openai', 'anthropic', 'gemini', 'ssh:execute',
            SESSION_CONVERSATION_CHANNELS.STREAM, 'files:search', 'files:read', 'files:write',
            'ollama:chat', 'ollama:operation', 'model-registry',
            'mcp:filesystem', 'mcp:git', 'mcp:database'
        ];
        for (const provider of ipcProviders) {
            expect(service.tryAcquire(provider)).toBe(true);
        }
    });

    it('should allow custom providers alongside defaults', () => {
        service.setLimit('custom:service', { requestsPerMinute: 10, maxBurst: 2 });
        expect(service.tryAcquire('custom:service')).toBe(true);
        expect(service.tryAcquire('openai')).toBe(true);
    });
});

describe('RateLimitService Integration - Full Lifecycle', () => {
    let service: RateLimitService;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should support init → use → cleanup → reinit cycle', async () => {
        service = new RateLimitService();
        await service.initialize();

        // Use the service
        expect(service.tryAcquire('openai')).toBe(true);
        service.setLimit('custom', { requestsPerMinute: 10, maxBurst: 1 });
        expect(service.tryAcquire('custom')).toBe(true);
        expect(service.tryAcquire('custom')).toBe(false);

        // Cleanup resets everything
        await service.cleanup();
        expect(service.getHealth().activeBuckets).toBe(0);
        // After cleanup, unknown providers → tryAcquire returns true
        expect(service.tryAcquire('openai')).toBe(true);
        expect(service.tryAcquire('custom')).toBe(true);

        // Re-initialize restores defaults
        await service.initialize();
        expect(service.getHealth().activeBuckets).toBeGreaterThan(0);
        expect(service.getHealth().providers).toContain('openai');
        // Custom provider is gone after reinit
        expect(service.getHealth().providers).not.toContain('custom');

        await service.cleanup();
    });

    it('should persist config changes until cleanup', async () => {
        service = new RateLimitService();
        await service.initialize();

        service.setLimit('openai', { requestsPerMinute: 1, maxBurst: 1 });
        expect(service.tryAcquire('openai')).toBe(true);
        expect(service.tryAcquire('openai')).toBe(false);

        // Config persists
        vi.advanceTimersByTime(60_000);
        expect(service.tryAcquire('openai')).toBe(true);
        expect(service.tryAcquire('openai')).toBe(false);

        await service.cleanup();
    });
});

describe('RateLimitService Integration - Regression Guards', () => {
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

    it('should maintain correct health count after many operations', () => {
        const initialCount = service.getHealth().activeBuckets;
        service.setLimit('extra-1', { requestsPerMinute: 10 });
        service.setLimit('extra-2', { requestsPerMinute: 10 });
        expect(service.getHealth().activeBuckets).toBe(initialCount + 2);
    });

    it('should not leak buckets when overwriting provider configs', () => {
        const initialCount = service.getHealth().activeBuckets;
        service.setLimit('openai', { requestsPerMinute: 100, maxBurst: 20 });
        expect(service.getHealth().activeBuckets).toBe(initialCount);
    });

    it('should properly throw WAIT_EXCEEDED with retryAfterMs', async () => {
        service.setLimit('regression', { requestsPerMinute: 60, maxBurst: 0 });

        const promise = service.waitForToken('regression').catch(
            (err: Error & { code?: string; retryAfterMs?: number }) => {
                expect(err.code).toBe(RateLimitErrorCode.WAIT_EXCEEDED);
                expect(err.retryAfterMs).toBe(1000);
                return 'caught';
            }
        );

        for (let i = 0; i < 101; i++) {
            await vi.advanceTimersByTimeAsync(1000);
        }

        expect(await promise).toBe('caught');
    });

    it('should provide accurate getProviderStatus after partial consumption', () => {
        service.setLimit('status-check', { requestsPerMinute: 60, maxBurst: 5 });
        service.tryAcquire('status-check');
        service.tryAcquire('status-check');
        const status = service.getProviderStatus('status-check');
        expect(status.configured).toBe(true);
        expect(status.tokensRemaining).toBe(3);
        expect(status.tokensMax).toBe(5);
        expect(status.msUntilNextToken).toBe(0);
    });
});

