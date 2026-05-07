/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import {
    PROXY_PERFORMANCE_BUDGETS,
    ProxyService
} from '@main/services/proxy/proxy.service';
import { PROXY_PROCESS_PERFORMANCE_BUDGETS, ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
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

describe('ProxyService performance instrumentation', () => {
    let proxyService: ProxyService;
    let mockProcessManager: ProxyProcessManager;

    beforeEach(() => {
        vi.clearAllMocks();

        const mockSettingsService = {
            getSettings: vi.fn().mockReturnValue({ proxy: { key: 'mock-key' } }),
            saveSettings: vi.fn().mockResolvedValue(undefined),
        } as never as SettingsService;

        mockProcessManager = {
            start: vi.fn().mockResolvedValue({ running: true }),
            stop: vi.fn().mockResolvedValue(undefined),
            getStatus: vi.fn().mockReturnValue({ running: false }),
            generateConfig: vi.fn().mockResolvedValue(undefined),
        } as never as ProxyProcessManager;

        const mockAuthService = {
            saveToken: vi.fn(),
            getToken: vi.fn(),
            getAuthToken: vi.fn(),
            getActiveToken: vi.fn().mockResolvedValue(null),
            getAccountsByProviderFull: vi.fn().mockResolvedValue([]),
            getAccountsByProvider: vi.fn().mockResolvedValue([]),
            linkAccount: vi.fn().mockResolvedValue(undefined),
        } as never as AuthService;

        proxyService = new ProxyService({
            settingsService: mockSettingsService,
            dataService: { getPath: vi.fn().mockReturnValue('/mock') } as never as DataService,
            securityService: {} as never as SecurityService,
            processManager: mockProcessManager,
            authService: mockAuthService,
            eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), emitCustom: vi.fn() } as never as EventBusService,
            databaseService: {} as never as DatabaseService,
        });
    });

    describe('PROXY_PERFORMANCE_BUDGETS constants', () => {
        it('should define CONFIG_GENERATION_MS budget', () => {
            expect(PROXY_PERFORMANCE_BUDGETS.CONFIG_GENERATION_MS).toBe(2000);
        });

        it('should define GET_MODELS_MS budget', () => {
            expect(PROXY_PERFORMANCE_BUDGETS.GET_MODELS_MS).toBe(5000);
        });

        it('should have all budget values as positive finite numbers', () => {
            for (const value of Object.values(PROXY_PERFORMANCE_BUDGETS)) {
                expect(value).toBeTypeOf('number');
                expect(value).toBeGreaterThan(0);
                expect(Number.isFinite(value)).toBe(true);
            }
        });

        it('should be frozen (const assertion)', () => {
            const keys = Object.keys(PROXY_PERFORMANCE_BUDGETS);
            expect(keys).toContain('START_MS');
            expect(keys).toContain('STOP_MS');
            expect(keys).toContain('REQUEST_MS');
            expect(keys).toContain('AUTH_MS');
            expect(keys).toContain('HEALTH_CHECK_MS');
            expect(keys).toContain('INITIALIZE_MS');
            expect(keys).toContain('CONFIG_GENERATION_MS');
            expect(keys).toContain('GET_MODELS_MS');
            expect(keys.length).toBeGreaterThanOrEqual(8);
        });
    });

    describe('PROXY_PROCESS_PERFORMANCE_BUDGETS constants', () => {
        it('should define CONFIG_GENERATION_MS budget', () => {
            expect(PROXY_PROCESS_PERFORMANCE_BUDGETS.CONFIG_GENERATION_MS).toBe(2000);
        });

        it('should define START_MS budget', () => {
            expect(PROXY_PROCESS_PERFORMANCE_BUDGETS.START_MS).toBe(10000);
        });

        it('should define STOP_MS budget', () => {
            expect(PROXY_PROCESS_PERFORMANCE_BUDGETS.STOP_MS).toBe(5000);
        });

        it('should have exactly 3 budget entries', () => {
            const keys = Object.keys(PROXY_PROCESS_PERFORMANCE_BUDGETS);
            expect(keys).toHaveLength(3);
        });

        it('should have all budget values as positive finite numbers', () => {
            for (const value of Object.values(PROXY_PROCESS_PERFORMANCE_BUDGETS)) {
                expect(value).toBeTypeOf('number');
                expect(value).toBeGreaterThan(0);
                expect(Number.isFinite(value)).toBe(true);
            }
        });
    });

    describe('startEmbeddedProxy timing', () => {
        it('should not log warning when operation completes within budget', async () => {
            await proxyService.startEmbeddedProxy({ port: 8080 });
            const warnCalls = vi.mocked(appLogger.warn).mock.calls;
            const budgetWarnings = warnCalls.filter(
                (call) => typeof call[1] === 'string' && call[1].includes('startEmbeddedProxy exceeded budget')
            );
            expect(budgetWarnings).toHaveLength(0);
        });

        it('should log warning when operation exceeds budget', async () => {
            let callCount = 0;
            const perfSpy = vi.spyOn(performance, 'now');
            perfSpy.mockImplementation(() => {
                callCount++;
                return callCount * (PROXY_PERFORMANCE_BUDGETS.START_MS + 100);
            });

            await proxyService.startEmbeddedProxy({ port: 8080 });
            const warnCalls = vi.mocked(appLogger.warn).mock.calls;
            const budgetWarnings = warnCalls.filter(
                (call) => typeof call[1] === 'string' && call[1].includes('startEmbeddedProxy exceeded budget')
            );
            expect(budgetWarnings.length).toBeGreaterThanOrEqual(1);

            perfSpy.mockRestore();
        });
    });

    describe('stopEmbeddedProxy timing', () => {
        it('should not log warning when stop completes quickly', async () => {
            await proxyService.stopEmbeddedProxy();
            const warnCalls = vi.mocked(appLogger.warn).mock.calls;
            const budgetWarnings = warnCalls.filter(
                (call) => typeof call[1] === 'string' && call[1].includes('stopEmbeddedProxy exceeded budget')
            );
            expect(budgetWarnings).toHaveLength(0);
        });
    });

    describe('generateConfig timing', () => {
        it('should not log warning when config generation completes quickly', async () => {
            await proxyService.generateConfig(8317);
            const warnCalls = vi.mocked(appLogger.warn).mock.calls;
            const budgetWarnings = warnCalls.filter(
                (call) => typeof call[1] === 'string' && call[1].includes('generateConfig exceeded budget')
            );
            expect(budgetWarnings).toHaveLength(0);
        });
    });

    describe('initialize timing', () => {
        it('should not log warning when initialize completes quickly', async () => {
            await proxyService.initialize();
            const warnCalls = vi.mocked(appLogger.warn).mock.calls;
            const budgetWarnings = warnCalls.filter(
                (call) => typeof call[1] === 'string' && call[1].includes('initialize exceeded budget')
            );
            expect(budgetWarnings).toHaveLength(0);
        });
    });

    describe('budget value sanity', () => {
        it('REQUEST_MS should be the largest ProxyService budget', () => {
            const maxBudget = Math.max(...Object.values(PROXY_PERFORMANCE_BUDGETS));
            expect(PROXY_PERFORMANCE_BUDGETS.REQUEST_MS).toBe(maxBudget);
        });

        it('CONFIG_GENERATION_MS should be smaller than START_MS', () => {
            expect(PROXY_PERFORMANCE_BUDGETS.CONFIG_GENERATION_MS).toBeLessThan(
                PROXY_PERFORMANCE_BUDGETS.START_MS
            );
        });

        it('STOP_MS should be smaller than START_MS', () => {
            expect(PROXY_PERFORMANCE_BUDGETS.STOP_MS).toBeLessThan(
                PROXY_PERFORMANCE_BUDGETS.START_MS
            );
        });
    });
});

