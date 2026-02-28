/**
 * Edge case unit tests for ProxyService rate limiting, cleanup, and status.
 */
import { DataService } from '@main/services/data/data.service';
import {
    ProxyService,
    ProxyTelemetryEvent
} from '@main/services/proxy/proxy.service';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { SecurityService } from '@main/services/security/security.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SettingsService } from '@main/services/system/settings.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

function createProxyService() {
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

describe('ProxyService edge cases', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    describe('rate limiting', () => {
        it('should track allowed requests per provider', async () => {
            const { proxyService } = createProxyService();
            await proxyService.initialize();
            const metrics = proxyService.getProviderRateLimitMetrics();
            expect(metrics.generatedAt).toBeTypeOf('number');
            expect(metrics.providers.length).toBeGreaterThan(0);
            for (const p of metrics.providers) {
                expect(p.allowed).toBe(0);
                expect(p.blocked).toBe(0);
            }
        });

        it('should return config for all default providers', async () => {
            const { proxyService } = createProxyService();
            await proxyService.initialize();
            const config = proxyService.getProviderRateLimitConfig();
            expect(config).toHaveProperty('github');
            expect(config).toHaveProperty('claude');
            expect(config).toHaveProperty('codex');
            expect(config).toHaveProperty('antigravity');
            expect(config).toHaveProperty('proxy');
            expect(config).toHaveProperty('default');
        });

        it('should enforce windowMs minimum of 1000ms', () => {
            const { proxyService } = createProxyService();
            const result = proxyService.setProviderRateLimitConfig('github', { windowMs: 100 });
            expect(result.windowMs).toBe(1000);
        });

        it('should enforce maxRequests minimum of 1', () => {
            const { proxyService } = createProxyService();
            const result = proxyService.setProviderRateLimitConfig('github', { maxRequests: 0 });
            expect(result.maxRequests).toBe(1);
        });

        it('should clamp warningThreshold between 0.1 and 0.99', () => {
            const { proxyService } = createProxyService();
            const low = proxyService.setProviderRateLimitConfig('github', { warningThreshold: 0.01 });
            expect(low.warningThreshold).toBe(0.1);
            const high = proxyService.setProviderRateLimitConfig('github', { warningThreshold: 1.5 });
            expect(high.warningThreshold).toBe(0.99);
        });

        it('should normalize provider names for rate limits', () => {
            const { proxyService } = createProxyService();
            const r1 = proxyService.setProviderRateLimitConfig('GitHub Copilot', { maxRequests: 50 });
            expect(r1.maxRequests).toBe(50);
            const config = proxyService.getProviderRateLimitConfig();
            expect(config.github.maxRequests).toBe(50);
        });

        it('should report queued count of 0 when no requests blocked', () => {
            const { proxyService } = createProxyService();
            const metrics = proxyService.getProviderRateLimitMetrics();
            for (const p of metrics.providers) {
                expect(p.queued).toBe(0);
            }
        });
    });

    describe('getEmbeddedProxyStatus', () => {
        it('should return status from process manager', () => {
            const { proxyService, mockProcessManager } = createProxyService();
            vi.mocked(mockProcessManager.getStatus).mockReturnValue({
                running: true, pid: 12345, port: 8317
            });
            const status = proxyService.getEmbeddedProxyStatus();
            expect(status.running).toBe(true);
            expect(status.pid).toBe(12345);
            expect(status.port).toBe(8317);
        });

        it('should emit HEALTH_CHECK telemetry', () => {
            const { proxyService, mockProcessManager, mockEventBus } = createProxyService();
            vi.mocked(mockProcessManager.getStatus).mockReturnValue({ running: false });
            proxyService.getEmbeddedProxyStatus();
            expect(mockEventBus.emitCustom).toHaveBeenCalledWith(
                ProxyTelemetryEvent.HEALTH_CHECK,
                expect.objectContaining({ running: false })
            );
        });

        it('should update currentPort from running status', () => {
            const { proxyService, mockProcessManager } = createProxyService();
            vi.mocked(mockProcessManager.getStatus).mockReturnValue({
                running: true, port: 9999
            });
            proxyService.getEmbeddedProxyStatus();
            const metrics = proxyService.getProviderRateLimitMetrics();
            expect(metrics.generatedAt).toBeTypeOf('number');
        });
    });

    describe('telemetry emission', () => {
        it('should emit PROXY_STARTED on successful start', async () => {
            const { proxyService, mockEventBus } = createProxyService();
            await proxyService.startEmbeddedProxy({ port: 8080 });
            expect(mockEventBus.emitCustom).toHaveBeenCalledWith(
                ProxyTelemetryEvent.PROXY_STARTED,
                expect.objectContaining({ port: 8080 })
            );
        });

        it('should NOT emit PROXY_STARTED on failed start', async () => {
            const { proxyService, mockProcessManager, mockEventBus } = createProxyService();
            vi.mocked(mockProcessManager.start).mockResolvedValue({
                running: false, error: 'fail'
            });
            await proxyService.startEmbeddedProxy({ port: 8080 });
            const startEvents = vi.mocked(mockEventBus.emitCustom).mock.calls
                .filter(c => c[0] === ProxyTelemetryEvent.PROXY_STARTED);
            expect(startEvents).toHaveLength(0);
        });

        it('should emit PROXY_STOPPED on successful stop', async () => {
            const { proxyService, mockEventBus } = createProxyService();
            await proxyService.stopEmbeddedProxy();
            expect(mockEventBus.emitCustom).toHaveBeenCalledWith(
                ProxyTelemetryEvent.PROXY_STOPPED,
                expect.objectContaining({ elapsedMs: expect.any(Number) })
            );
        });
    });

    describe('cleanup', () => {
        it('should force stop proxy on cleanup', async () => {
            const { proxyService, mockProcessManager } = createProxyService();
            await proxyService.initialize();
            await proxyService.cleanup();
            expect(mockProcessManager.stop).toHaveBeenCalledWith(true);
        });

        it('should not throw when cleanup stop fails', async () => {
            const { proxyService, mockProcessManager } = createProxyService();
            vi.mocked(mockProcessManager.stop).mockRejectedValue(new Error('cleanup fail'));
            await proxyService.initialize();
            await expect(proxyService.cleanup()).resolves.not.toThrow();
        });
    });

    describe('getQuota delegation', () => {
        it('should return null when quotaService returns null', async () => {
            const { proxyService } = createProxyService();
            const result = await proxyService.getQuota();
            expect(result).toBeNull();
        });

        it('should return quota when available', async () => {
            const { proxyService, mockQuotaService } = createProxyService();
            vi.mocked(mockQuotaService.getQuota).mockResolvedValue({
                accounts: [{ email: 'test@test.com', status: 'active', next_reset: '', models: [] }]
            });
            const result = await proxyService.getQuota();
            expect(result).not.toBeNull();
            expect(result!.accounts).toHaveLength(1);
        });
    });
});
