/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Edge case unit tests for ProxyService cleanup, status, and telemetry.
 */
import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import {
    ProxyService,
    ProxyTelemetryEvent
} from '@main/services/proxy/proxy.service';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
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
    } as never as SettingsService;

    const mockProcessManager = {
        start: vi.fn().mockResolvedValue({ running: true }),
        stop: vi.fn().mockResolvedValue(undefined),
        getStatus: vi.fn().mockReturnValue({ running: false }),
        generateConfig: vi.fn().mockResolvedValue(undefined),
    } as never as ProxyProcessManager;

    const mockEventBus = {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
        emitCustom: vi.fn(),
    } as never as EventBusService;

    const mockAuthService = {
        saveToken: vi.fn(),
        getToken: vi.fn(),
        getAuthToken: vi.fn(),
    } as never as AuthService;

    const proxyService = new ProxyService({
        settingsService: mockSettingsService,
        dataService: { getPath: vi.fn().mockReturnValue('/mock') } as never as DataService,
        securityService: {} as never as SecurityService,
        processManager: mockProcessManager,
        authService: mockAuthService,
        eventBus: mockEventBus,
        databaseService: {} as never as DatabaseService,
    });

    return { proxyService, mockProcessManager, mockEventBus };
}

describe('ProxyService edge cases', () => {
    beforeEach(() => { vi.clearAllMocks(); });

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
            expect(proxyService.getEmbeddedProxyStatus().port).toBe(9999);
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
        it('should leave background proxy running on cleanup', async () => {
            const { proxyService, mockProcessManager } = createProxyService();
            await proxyService.initialize();
            await proxyService.cleanup();
            expect(mockProcessManager.stop).not.toHaveBeenCalled();
        });

        it('should not throw when cleanup runs after stop failures elsewhere', async () => {
            const { proxyService, mockProcessManager } = createProxyService();
            vi.mocked(mockProcessManager.stop).mockRejectedValue(new Error('cleanup fail'));
            await proxyService.initialize();
            await expect(proxyService.cleanup()).resolves.not.toThrow();
        });
    });

    describe('getQuota delegation', () => {
        it('should return null when no quota broadcast is available', async () => {
            const { proxyService } = createProxyService();
            const result = await proxyService.getQuota();
            expect(result).toBeNull();
        });

        it('should return quota when cached broadcast exists', async () => {
            const { proxyService } = createProxyService();
            (proxyService as never as { latestQuotaBroadcast: RuntimeValue }).latestQuotaBroadcast = {
                quotaData: {
                    accounts: [{ email: 'test@test.com', status: 'active', next_reset: '', models: [] }]
                },
                copilotQuota: { accounts: [] },
                claudeQuota: { accounts: [] },
                codexUsage: { accounts: [] }
            } as never;
            const result = await proxyService.getQuota();
            expect(result).not.toBeNull();
            expect(result!.accounts).toHaveLength(1);
        });
    });
});
