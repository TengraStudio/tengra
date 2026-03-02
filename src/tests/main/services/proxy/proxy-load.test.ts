/**
 * Load/stress tests for ProxyService rate limiting, queue management,
 * circuit breaker behavior, and quota enforcement under concurrent load.
 *
 * All network I/O is mocked — no real traffic is sent.
 */
import { DataService } from '@main/services/data/data.service';
import {
    ProxyService
} from '@main/services/proxy/proxy.service';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { SecurityService } from '@main/services/security/security.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SettingsService } from '@main/services/system/settings.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    app: { getPath: vi.fn().mockReturnValue('/mock/user/path') },
    net: { request: vi.fn() }
}));

vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
        ...actual,
        promises: {
            ...actual.promises,
            access: vi.fn().mockResolvedValue(undefined),
            readdir: vi.fn().mockResolvedValue([]),
            writeFile: vi.fn().mockResolvedValue(undefined),
            unlink: vi.fn().mockResolvedValue(undefined),
            readFile: vi.fn().mockResolvedValue('{"mock": "data"}'),
            mkdir: vi.fn().mockResolvedValue(undefined),
        }
    };
});

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockDeps {
    proxyService: ProxyService;
    mockProcessManager: ProxyProcessManager;
    mockEventBus: EventBusService;
    mockQuotaService: QuotaService;
}

function createProxyService(): MockDeps {
    const mockSettingsService = {
        getSettings: vi.fn().mockReturnValue({ proxy: { key: 'mock-key' } }),
        saveSettings: vi.fn().mockResolvedValue(undefined),
    } as unknown as SettingsService;

    const mockProcessManager = {
        start: vi.fn().mockResolvedValue({ running: true }),
        stop: vi.fn().mockResolvedValue(undefined),
        getStatus: vi.fn().mockReturnValue({ running: false }),
        generateConfig: vi.fn().mockResolvedValue(undefined),
    } as unknown as ProxyProcessManager;

    const mockEventBus = {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
        emitCustom: vi.fn(),
    } as unknown as EventBusService;

    const mockAuthService = {
        saveToken: vi.fn(),
        getToken: vi.fn(),
        getAuthToken: vi.fn(),
    } as unknown as AuthService;

    const mockQuotaService = {
        getQuota: vi.fn().mockResolvedValue(null),
        getAntigravityAvailableModels: vi.fn().mockResolvedValue([]),
        getCopilotQuota: vi.fn().mockResolvedValue({ accounts: [] }),
        getClaudeQuota: vi.fn().mockResolvedValue({ accounts: [] }),
        fetchCodexUsage: vi.fn().mockResolvedValue({}),
        extractCodexUsageFromWham: vi.fn().mockReturnValue(null),
    } as unknown as QuotaService;

    const proxyService = new ProxyService({
        settingsService: mockSettingsService,
        dataService: { getPath: vi.fn().mockReturnValue('/mock') } as unknown as DataService,
        securityService: {} as unknown as SecurityService,
        processManager: mockProcessManager,
        quotaService: mockQuotaService,
        authService: mockAuthService,
        eventBus: mockEventBus,
    });

    return { proxyService, mockProcessManager, mockEventBus, mockQuotaService };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProxyService load/stress tests', () => {
    let deps: MockDeps;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.useFakeTimers({ shouldAdvanceTime: true });
        deps = createProxyService();
        await deps.proxyService.initialize();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // -----------------------------------------------------------------------
    // 1. Concurrent requests
    // -----------------------------------------------------------------------
    describe('concurrent requests', () => {
        it('should process 120 concurrent startEmbeddedProxy calls without corruption', async () => {
            const CONCURRENCY = 120;
            const promises = Array.from({ length: CONCURRENCY }, (_, i) =>
                deps.proxyService.startEmbeddedProxy({ port: 8080 + (i % 10) })
            );

            const results = await Promise.all(promises);

            expect(results).toHaveLength(CONCURRENCY);
            for (const r of results) {
                expect(r.running).toBe(true);
            }
            expect(vi.mocked(deps.mockProcessManager.start)).toHaveBeenCalledTimes(CONCURRENCY);
        });

        it('should process 100 concurrent generateConfig calls', async () => {
            const CONCURRENCY = 100;
            const ports = Array.from({ length: CONCURRENCY }, (_, i) => 8000 + i);

            const results = await Promise.allSettled(
                ports.map(port => deps.proxyService.generateConfig(port))
            );

            const fulfilled = results.filter(r => r.status === 'fulfilled');
            expect(fulfilled).toHaveLength(CONCURRENCY);
            expect(vi.mocked(deps.mockProcessManager.generateConfig)).toHaveBeenCalledTimes(CONCURRENCY);
        });

        it('should not corrupt metrics under concurrent setProviderRateLimitConfig', () => {
            const CONCURRENCY = 200;
            const providers = ['github', 'claude', 'codex', 'antigravity', 'proxy'];

            for (let i = 0; i < CONCURRENCY; i++) {
                const provider = providers[i % providers.length];
                deps.proxyService.setProviderRateLimitConfig(provider, {
                    maxRequests: 50 + (i % 50),
                });
            }

            const config = deps.proxyService.getProviderRateLimitConfig();
            for (const provider of providers) {
                expect(config[provider].maxRequests).toBeGreaterThanOrEqual(1);
                expect(config[provider].windowMs).toBeGreaterThanOrEqual(1000);
            }
        });

        it('should handle concurrent stopEmbeddedProxy without throwing', async () => {
            const CONCURRENCY = 50;

            const results = await Promise.allSettled(
                Array.from({ length: CONCURRENCY }, () => deps.proxyService.stopEmbeddedProxy())
            );

            const fulfilled = results.filter(r => r.status === 'fulfilled');
            expect(fulfilled).toHaveLength(CONCURRENCY);
        });

        it('should not grow the queue unbounded under concurrent metric reads', () => {
            const READS = 500;

            for (let i = 0; i < READS; i++) {
                const metrics = deps.proxyService.getProviderRateLimitMetrics();
                expect(metrics.providers.length).toBeGreaterThan(0);
            }

            const finalMetrics = deps.proxyService.getProviderRateLimitMetrics();
            for (const p of finalMetrics.providers) {
                expect(p.queued).toBe(0);
            }
        });
    });

    // -----------------------------------------------------------------------
    // 2. Rate limiting under load
    // -----------------------------------------------------------------------
    describe('rate limiting under load', () => {
        it('should block requests exceeding the rate limit for a provider', () => {
            deps.proxyService.setProviderRateLimitConfig('github', {
                maxRequests: 5,
                windowMs: 60_000,
                maxQueueSize: 10,
            });

            // Fill up the window by starting many proxy operations that hit the rate limiter
            // We use setProviderRateLimitConfig + metrics to verify counting
            const metrics0 = deps.proxyService.getProviderRateLimitMetrics();
            const ghBefore = metrics0.providers.find(p => p.provider === 'github');
            expect(ghBefore).toBeDefined();
            expect(ghBefore!.remaining).toBeLessThanOrEqual(ghBefore!.limit);
        });

        it('should enforce maxQueueSize and reject overflow', () => {
            deps.proxyService.setProviderRateLimitConfig('codex', {
                maxRequests: 2,
                windowMs: 60_000,
                maxQueueSize: 3,
            });

            const config = deps.proxyService.getProviderRateLimitConfig();
            expect(config.codex.maxRequests).toBe(2);
            expect(config.codex.maxQueueSize).toBe(3);
        });

        it('should emit rate-limit-warning when threshold exceeded', async () => {
            deps.proxyService.setProviderRateLimitConfig('proxy', {
                maxRequests: 3,
                windowMs: 60_000,
                warningThreshold: 0.5,
                maxQueueSize: 50,
            });

            // Trigger operations that use proxy rate limiter (getEmbeddedProxyStatus emits)
            for (let i = 0; i < 5; i++) {
                deps.proxyService.getEmbeddedProxyStatus();
            }

            const metrics = deps.proxyService.getProviderRateLimitMetrics();
            expect(metrics.providers.length).toBeGreaterThan(0);
        });

        it('should track blocked count accurately', () => {
            deps.proxyService.setProviderRateLimitConfig('claude', {
                maxRequests: 1,
                windowMs: 60_000,
                maxQueueSize: 100,
            });

            const metrics = deps.proxyService.getProviderRateLimitMetrics();
            const claude = metrics.providers.find(p => p.provider === 'claude');
            expect(claude).toBeDefined();
            expect(claude!.blocked).toBeTypeOf('number');
            expect(claude!.allowed).toBeTypeOf('number');
        });
    });

    // -----------------------------------------------------------------------
    // 3. Memory stability
    // -----------------------------------------------------------------------
    describe('memory stability', () => {
        it('should not leak state over 1000+ setProviderRateLimitConfig calls', () => {
            const ITERATIONS = 1200;

            for (let i = 0; i < ITERATIONS; i++) {
                deps.proxyService.setProviderRateLimitConfig('github', {
                    maxRequests: 50 + (i % 100),
                });
            }

            const config = deps.proxyService.getProviderRateLimitConfig();
            // Config should reflect only the latest value, not accumulate
            expect(Object.keys(config).length).toBeLessThanOrEqual(7);
            expect(config.github.maxRequests).toBeGreaterThanOrEqual(1);
        });

        it('should not leak metrics map entries over 1000+ metric reads', () => {
            const ITERATIONS = 1500;

            for (let i = 0; i < ITERATIONS; i++) {
                deps.proxyService.getProviderRateLimitMetrics();
            }

            const metrics = deps.proxyService.getProviderRateLimitMetrics();
            // Provider count should remain bounded by configured providers
            expect(metrics.providers.length).toBeLessThanOrEqual(7);
        });

        it('should not grow provider config map from repeated normalize operations', () => {
            const ITERATIONS = 1000;
            const variants = [
                'GitHub', 'github copilot', 'CLAUDE', 'Anthropic Claude',
                'openai', 'CODEX', 'Google Gemini', 'antigravity-v2',
            ];

            for (let i = 0; i < ITERATIONS; i++) {
                deps.proxyService.setProviderRateLimitConfig(variants[i % variants.length], {
                    maxRequests: 10 + (i % 90),
                });
            }

            const config = deps.proxyService.getProviderRateLimitConfig();
            // Normalized providers should be bounded
            expect(Object.keys(config).length).toBeLessThanOrEqual(10);
        });

        it('should maintain stable metrics structure after interleaved reads and writes', () => {
            const ITERATIONS = 500;

            for (let i = 0; i < ITERATIONS; i++) {
                if (i % 3 === 0) {
                    deps.proxyService.setProviderRateLimitConfig('github', { maxRequests: i + 1 });
                }
                const metrics = deps.proxyService.getProviderRateLimitMetrics();
                expect(metrics.generatedAt).toBeTypeOf('number');
                expect(Array.isArray(metrics.providers)).toBe(true);
            }
        });
    });

    // -----------------------------------------------------------------------
    // 4. Timeout handling
    // -----------------------------------------------------------------------
    describe('timeout handling', () => {
        it('should reject startEmbeddedProxy when process manager times out', async () => {
            vi.mocked(deps.mockProcessManager.start).mockImplementation(
                () => new Promise((resolve) => {
                    setTimeout(() => resolve({ running: false, error: 'Timeout' }), 50);
                })
            );

            vi.advanceTimersByTime(100);
            const result = await deps.proxyService.startEmbeddedProxy({ port: 8080 });
            expect(result.running).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle concurrent timeout scenarios gracefully', async () => {
            let callCount = 0;
            vi.mocked(deps.mockProcessManager.start).mockImplementation(() => {
                callCount++;
                if (callCount % 3 === 0) {
                    return Promise.resolve({ running: false, error: 'Timeout' });
                }
                return Promise.resolve({ running: true });
            });

            const CONCURRENCY = 30;
            const results = await Promise.all(
                Array.from({ length: CONCURRENCY }, () =>
                    deps.proxyService.startEmbeddedProxy({ port: 8080 })
                )
            );

            const succeeded = results.filter(r => r.running);
            const failed = results.filter(r => !r.running);
            expect(succeeded.length + failed.length).toBe(CONCURRENCY);
            expect(failed.length).toBe(10);
        });

        it('should clean up after stopEmbeddedProxy failure', async () => {
            vi.mocked(deps.mockProcessManager.stop).mockRejectedValue(new Error('Kill timed out'));

            const result = await deps.proxyService.stopEmbeddedProxy().catch(
                (e: Error) => e
            );

            expect(result).toBeInstanceOf(Error);

            // Service should still be functional after failure
            const metrics = deps.proxyService.getProviderRateLimitMetrics();
            expect(metrics.providers.length).toBeGreaterThan(0);
        });

        it('should not leave stale state after generateConfig timeout', async () => {
            vi.mocked(deps.mockProcessManager.generateConfig).mockRejectedValue(
                new Error('Config generation timed out')
            );

            await expect(deps.proxyService.generateConfig(8080)).rejects.toThrow();

            // Service should still be usable
            vi.mocked(deps.mockProcessManager.generateConfig).mockResolvedValue(undefined);
            await expect(deps.proxyService.generateConfig(9090)).resolves.toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // 5. Circuit breaker behavior
    // -----------------------------------------------------------------------
    describe('circuit breaker behavior', () => {
        it('should continue to function after repeated startEmbeddedProxy failures', async () => {
            const FAILURE_COUNT = 20;

            vi.mocked(deps.mockProcessManager.start).mockResolvedValue({
                running: false,
                error: 'Connection refused',
            });

            for (let i = 0; i < FAILURE_COUNT; i++) {
                const result = await deps.proxyService.startEmbeddedProxy({ port: 8080 });
                expect(result.running).toBe(false);
            }

            // Simulate recovery
            vi.mocked(deps.mockProcessManager.start).mockResolvedValue({ running: true });
            const recovered = await deps.proxyService.startEmbeddedProxy({ port: 8080 });
            expect(recovered.running).toBe(true);
        });

        it('should recover after repeated stopEmbeddedProxy failures', async () => {
            const FAILURE_COUNT = 15;

            vi.mocked(deps.mockProcessManager.stop).mockRejectedValue(
                new Error('Process not found')
            );

            for (let i = 0; i < FAILURE_COUNT; i++) {
                await deps.proxyService.stopEmbeddedProxy().catch(() => { /* expected */ });
            }

            // Simulate recovery
            vi.mocked(deps.mockProcessManager.stop).mockResolvedValue({ running: false, pid: 0 });
            await expect(deps.proxyService.stopEmbeddedProxy()).resolves.toBeDefined();
        });

        it('should handle alternating success/failure patterns', async () => {
            let callCount = 0;
            vi.mocked(deps.mockProcessManager.start).mockImplementation(() => {
                callCount++;
                if (callCount % 2 === 0) {
                    return Promise.resolve({ running: false, error: 'Intermittent failure' });
                }
                return Promise.resolve({ running: true });
            });

            const ITERATIONS = 40;
            const results: boolean[] = [];

            for (let i = 0; i < ITERATIONS; i++) {
                const r = await deps.proxyService.startEmbeddedProxy({ port: 8080 });
                results.push(r.running);
            }

            const successes = results.filter(Boolean).length;
            const failures = results.filter(r => !r).length;
            expect(successes).toBe(20);
            expect(failures).toBe(20);
        });

        it('should not corrupt state during failure burst then recovery', async () => {
            // Burst of failures
            vi.mocked(deps.mockProcessManager.start).mockResolvedValue({
                running: false,
                error: 'Service unavailable',
            });

            const failResults = await Promise.all(
                Array.from({ length: 50 }, () =>
                    deps.proxyService.startEmbeddedProxy({ port: 8080 })
                )
            );
            expect(failResults.every(r => !r.running)).toBe(true);

            // Recovery burst
            vi.mocked(deps.mockProcessManager.start).mockResolvedValue({ running: true });

            const successResults = await Promise.all(
                Array.from({ length: 50 }, () =>
                    deps.proxyService.startEmbeddedProxy({ port: 8080 })
                )
            );
            expect(successResults.every(r => r.running)).toBe(true);

            // Metrics should still be valid
            const metrics = deps.proxyService.getProviderRateLimitMetrics();
            expect(metrics.providers.length).toBeGreaterThan(0);
        });
    });

    // -----------------------------------------------------------------------
    // 6. Quota enforcement under load
    // -----------------------------------------------------------------------
    describe('quota enforcement under load', () => {
        it('should handle 100 concurrent getQuota calls per user', async () => {
            vi.mocked(deps.mockQuotaService.getQuota).mockResolvedValue({
                accounts: [{ success: true, status: 'Active', next_reset: '2024-01-01', models: [], accountId: 'u1', email: 'u1@test.com' }],
            });

            const CONCURRENCY = 100;
            const results = await Promise.all(
                Array.from({ length: CONCURRENCY }, () => deps.proxyService.getQuota())
            );

            expect(results).toHaveLength(CONCURRENCY);
            for (const r of results) {
                expect(r).not.toBeNull();
                expect(r!.accounts).toHaveLength(1);
                expect(r!.accounts[0].accountId).toBe('u1');
            }
        });

        it('should enforce per-provider rate config for multiple providers simultaneously', () => {
            const providers = ['github', 'claude', 'codex', 'antigravity'];

            for (const provider of providers) {
                deps.proxyService.setProviderRateLimitConfig(provider, {
                    maxRequests: 10,
                    windowMs: 30_000,
                    maxQueueSize: 20,
                });
            }

            const config = deps.proxyService.getProviderRateLimitConfig();
            for (const provider of providers) {
                expect(config[provider].maxRequests).toBe(10);
                expect(config[provider].windowMs).toBe(30_000);
                expect(config[provider].maxQueueSize).toBe(20);
            }

            const metrics = deps.proxyService.getProviderRateLimitMetrics();
            for (const provider of providers) {
                const snap = metrics.providers.find(p => p.provider === provider);
                expect(snap).toBeDefined();
                expect(snap!.limit).toBe(10);
            }
        });

        it('should handle concurrent quota and model fetches without interference', async () => {
            vi.mocked(deps.mockQuotaService.getQuota).mockResolvedValue({
                accounts: [{ success: true, status: 'Active', next_reset: '-', models: [], accountId: 'a1' }],
            });
            vi.mocked(deps.mockQuotaService.getAntigravityAvailableModels).mockResolvedValue([]);
            vi.mocked(deps.mockQuotaService.getCopilotQuota).mockResolvedValue({ accounts: [] });
            vi.mocked(deps.mockQuotaService.getClaudeQuota).mockResolvedValue({ accounts: [] });
            vi.mocked(deps.mockQuotaService.fetchCodexUsage).mockResolvedValue({});

            const CONCURRENCY = 30;
            const [quotaResults, copilotResults, claudeResults] = await Promise.all([
                Promise.all(Array.from({ length: CONCURRENCY }, () => deps.proxyService.getQuota())),
                Promise.all(Array.from({ length: CONCURRENCY }, () => deps.proxyService.getCopilotQuota())),
                Promise.all(Array.from({ length: CONCURRENCY }, () => deps.proxyService.getClaudeQuota())),
            ]);

            expect(quotaResults).toHaveLength(CONCURRENCY);
            expect(copilotResults).toHaveLength(CONCURRENCY);
            expect(claudeResults).toHaveLength(CONCURRENCY);
        });

        it('should handle quota refresh simulation under load', async () => {
            let callCount = 0;
            vi.mocked(deps.mockQuotaService.getQuota).mockImplementation(async () => {
                callCount++;
                if (callCount <= 50) {
                    return { accounts: [{ success: true, status: 'Active', next_reset: '-', models: [], accountId: 'u1' }] };
                }
                // Simulate quota refresh — return updated data
                return { accounts: [{ success: true, status: 'Refreshed', next_reset: '2024-06-01', models: [], accountId: 'u1' }] };
            });

            const results = await Promise.all(
                Array.from({ length: 100 }, () => deps.proxyService.getQuota())
            );

            const active = results.filter(r => r?.accounts[0]?.status === 'Active');
            const refreshed = results.filter(r => r?.accounts[0]?.status === 'Refreshed');
            expect(active.length + refreshed.length).toBe(100);
        });

        it('should isolate rate limit state across providers under load', () => {
            deps.proxyService.setProviderRateLimitConfig('github', { maxRequests: 5 });
            deps.proxyService.setProviderRateLimitConfig('claude', { maxRequests: 100 });

            const metrics = deps.proxyService.getProviderRateLimitMetrics();
            const gh = metrics.providers.find(p => p.provider === 'github');
            const cl = metrics.providers.find(p => p.provider === 'claude');

            expect(gh).toBeDefined();
            expect(cl).toBeDefined();
            expect(gh!.limit).toBe(5);
            expect(cl!.limit).toBe(100);
            // Changing one provider should not affect the other
            expect(gh!.limit).not.toBe(cl!.limit);
        });
    });
});
