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
 * Regression & integration tests for ProxyService critical flows.
 * Validates startup→config→stop lifecycle, error propagation, and telemetry.
 */
import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import {
    PROXY_PERFORMANCE_BUDGETS,
    ProxyErrorCode,
    ProxyService,
    ProxyTelemetryEvent
} from '@main/services/proxy/proxy.service';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { AuthService } from '@main/services/security/auth.service';
import { SecurityService } from '@main/services/security/security.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SettingsService } from '@main/services/system/settings.service';
import { AppErrorCode, ProxyServiceError } from '@shared/utils/error.util';
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

function buildService() {
    const mocks = {
        settingsService: {
            getSettings: vi.fn().mockReturnValue({ proxy: { key: 'test-key' } }),
            saveSettings: vi.fn().mockResolvedValue(undefined),
        } as never as SettingsService,
        processManager: {
            start: vi.fn().mockResolvedValue({ running: true, port: 8317 }),
            stop: vi.fn().mockResolvedValue(undefined),
            getStatus: vi.fn().mockReturnValue({ running: false }),
            generateConfig: vi.fn().mockResolvedValue(undefined),
        } as never as ProxyProcessManager,
        eventBus: {
            on: vi.fn(), off: vi.fn(), emit: vi.fn(), emitCustom: vi.fn(),
        } as never as EventBusService,
        authService: {
            saveToken: vi.fn(), getToken: vi.fn(), getAuthToken: vi.fn(),
        } as never as AuthService,
        databaseService: {
            exec: vi.fn(),
            getLinkedAccounts: vi.fn().mockResolvedValue([]),
        } as never as DatabaseService,
    };

    const service = new ProxyService({
        ...mocks,
        dataService: { getPath: vi.fn().mockReturnValue('/mock') } as never as DataService,
        securityService: {} as never as SecurityService,
    });

    return { service, ...mocks };
}

describe('ProxyService lifecycle regression', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('should complete start→status→stop lifecycle', async () => {
        const { service, processManager, eventBus } = buildService();
        vi.mocked(processManager.getStatus).mockReturnValue({ running: true, port: 8317, pid: 100 });

        const startResult = await service.startEmbeddedProxy({ port: 8317 });
        expect(startResult.running).toBe(true);

        const status = service.getEmbeddedProxyStatus();
        expect(status.running).toBe(true);
        expect(status.port).toBe(8317);

        await service.stopEmbeddedProxy();

        const emittedEvents = vi.mocked(eventBus.emitCustom).mock.calls.map(c => c[0]);
        expect(emittedEvents).toContain(ProxyTelemetryEvent.PROXY_STARTED);
        expect(emittedEvents).toContain(ProxyTelemetryEvent.HEALTH_CHECK);
        expect(emittedEvents).toContain(ProxyTelemetryEvent.PROXY_STOPPED);
    });

    it('should propagate error codes through start failure', async () => {
        const { service, processManager } = buildService();
        vi.mocked(processManager.start).mockResolvedValue({
            running: false,
            error: 'Port in use',
            errorCode: AppErrorCode.PROXY_PORT_IN_USE
        });

        const result = await service.startEmbeddedProxy({ port: 8317 });
        expect(result.running).toBe(false);
        expect(result.errorCode).toBe(AppErrorCode.PROXY_PORT_IN_USE);
    });

    it('should throw ProxyServiceError through stop failure', async () => {
        const { service, processManager } = buildService();
        vi.mocked(processManager.stop).mockRejectedValue(new Error('SIGKILL failed'));

        try {
            await service.stopEmbeddedProxy();
            expect.unreachable('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(ProxyServiceError);
            expect((e as ProxyServiceError).code).toBe(AppErrorCode.PROXY_STOP_FAILED);
            expect((e as ProxyServiceError).retryable).toBe(true);
        }
    });

    it('should throw ProxyServiceError through generateConfig validation', async () => {
        const { service } = buildService();
        try {
            await service.generateConfig(-1);
            expect.unreachable('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(ProxyServiceError);
            expect((e as ProxyServiceError).code).toBe(AppErrorCode.PROXY_INVALID_CONFIG);
            expect((e as ProxyServiceError).retryable).toBe(false);
        }
    });
});

describe('ProxyService error code consistency', () => {
    it('ProxyErrorCode values should match AppErrorCode', () => {
        expect(ProxyErrorCode.NOT_INITIALIZED).toBe(AppErrorCode.PROXY_NOT_INITIALIZED);
        expect(ProxyErrorCode.START_FAILED).toBe(AppErrorCode.PROXY_START_FAILED);
        expect(ProxyErrorCode.STOP_FAILED).toBe(AppErrorCode.PROXY_STOP_FAILED);
        expect(ProxyErrorCode.AUTH_FAILED).toBe(AppErrorCode.PROXY_AUTH_FAILED);
        expect(ProxyErrorCode.REQUEST_FAILED).toBe(AppErrorCode.PROXY_REQUEST_FAILED);
        expect(ProxyErrorCode.INVALID_CONFIG).toBe(AppErrorCode.PROXY_INVALID_CONFIG);
        expect(ProxyErrorCode.CONNECTION_FAILED).toBe(AppErrorCode.PROXY_CONNECTION_FAILED);
        expect(ProxyErrorCode.TIMEOUT).toBe(AppErrorCode.PROXY_TIMEOUT);
        expect(ProxyErrorCode.PORT_IN_USE).toBe(AppErrorCode.PROXY_PORT_IN_USE);
        expect(ProxyErrorCode.BINARY_NOT_FOUND).toBe(AppErrorCode.PROXY_BINARY_NOT_FOUND);
    });

    it('ProxyServiceError should carry context through serialization', () => {
        const error = new ProxyServiceError(
            'Test error',
            AppErrorCode.PROXY_CONNECTION_FAILED,
            true,
            { port: 8317, method: 'GET' }
        );
        const json = error.toJSON();
        expect(json.code).toBe('PROXY_CONNECTION_FAILED');
        expect(json.message).toBe('Test error');
        expect(json.context).toEqual({ port: 8317, method: 'GET' });
    });
});

describe('ProxyService performance budget regression', () => {
    it('budget values should not regress below minimum thresholds', () => {
        expect(PROXY_PERFORMANCE_BUDGETS.START_MS).toBeGreaterThanOrEqual(5000);
        expect(PROXY_PERFORMANCE_BUDGETS.STOP_MS).toBeGreaterThanOrEqual(2000);
        expect(PROXY_PERFORMANCE_BUDGETS.REQUEST_MS).toBeGreaterThanOrEqual(10000);
        expect(PROXY_PERFORMANCE_BUDGETS.AUTH_MS).toBeGreaterThanOrEqual(10000);
        expect(PROXY_PERFORMANCE_BUDGETS.HEALTH_CHECK_MS).toBeGreaterThanOrEqual(2000);
        expect(PROXY_PERFORMANCE_BUDGETS.INITIALIZE_MS).toBeGreaterThanOrEqual(5000);
        expect(PROXY_PERFORMANCE_BUDGETS.CONFIG_GENERATION_MS).toBeGreaterThanOrEqual(1000);
        expect(PROXY_PERFORMANCE_BUDGETS.GET_MODELS_MS).toBeGreaterThanOrEqual(5000);
    });

    it('budget values should not exceed maximum thresholds', () => {
        expect(PROXY_PERFORMANCE_BUDGETS.START_MS).toBeLessThanOrEqual(30000);
        expect(PROXY_PERFORMANCE_BUDGETS.STOP_MS).toBeLessThanOrEqual(15000);
        expect(PROXY_PERFORMANCE_BUDGETS.REQUEST_MS).toBeLessThanOrEqual(60000);
        expect(PROXY_PERFORMANCE_BUDGETS.CONFIG_GENERATION_MS).toBeLessThanOrEqual(10000);
    });
});

describe('ProxyService telemetry event regression', () => {
    it('should have all 8 telemetry events defined', () => {
        const events = Object.values(ProxyTelemetryEvent);
        expect(events).toHaveLength(8);
    });

    it('telemetry event values should be stable strings', () => {
        expect(ProxyTelemetryEvent.PROXY_STARTED).toBe('proxy_started');
        expect(ProxyTelemetryEvent.PROXY_STOPPED).toBe('proxy_stopped');
        expect(ProxyTelemetryEvent.REQUEST_SENT).toBe('proxy_request_sent');
        expect(ProxyTelemetryEvent.REQUEST_FAILED).toBe('proxy_request_failed');
        expect(ProxyTelemetryEvent.AUTH_INITIATED).toBe('proxy_auth_initiated');
        expect(ProxyTelemetryEvent.AUTH_COMPLETED).toBe('proxy_auth_completed');
        expect(ProxyTelemetryEvent.AUTH_FAILED).toBe('proxy_auth_failed');
        expect(ProxyTelemetryEvent.HEALTH_CHECK).toBe('proxy_health_check');
    });
});
