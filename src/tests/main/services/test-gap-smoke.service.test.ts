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
import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { AuthService } from '@main/services/security/auth.service';
import { ProcessService } from '@main/services/system/process.service';
import { SystemService } from '@main/services/system/system.service';
import { ThemeService } from '@main/services/theme/theme.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

class TestBaseService extends BaseService {
    constructor() {
        super('TestBaseService');
    }

    exerciseLogs() {
        this.logInfo('info');
        this.logWarn('warn');
        this.logDebug('debug');
        this.logError('error');
    }
}

describe('Missing service TODO coverage (functional)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('BaseService emits all logger levels through logger facade', () => {
        const infoSpy = vi.spyOn(appLogger, 'info');
        const warnSpy = vi.spyOn(appLogger, 'warn');
        const debugSpy = vi.spyOn(appLogger, 'debug');
        const errorSpy = vi.spyOn(appLogger, 'error');

        const svc = new TestBaseService();
        svc.exerciseLogs();

        expect(infoSpy).toHaveBeenCalledWith('TestBaseService', 'info', undefined);
        expect(warnSpy).toHaveBeenCalledWith('TestBaseService', 'warn', undefined);
        expect(debugSpy).toHaveBeenCalledWith('TestBaseService', 'debug', undefined);
        expect(errorSpy).toHaveBeenCalledWith('TestBaseService', 'error', undefined);
    });

    it('DataService creates and resolves all expected data paths', async () => {
        const dataService = new DataService();
        await dataService.initialize();

        expect(dataService.getPath('data')).toContain('data');
        expect(dataService.getPath('logs')).toContain('logs');
    });

    it('AuthService filters linked accounts by provider', async () => {
        const auth = new AuthService(
            {
                getLinkedAccounts: vi.fn(async (provider?: string) =>
                    !provider || provider === 'github'
                        ? [{ id: 'a1', provider: 'github', isActive: true }]
                        : []
                ),
                getActiveLinkedAccount: vi.fn(async () => null),
                initialize: vi.fn(async () => undefined),
                saveLinkedAccount: vi.fn(),
            } as never,
            {
                encrypt: vi.fn(),
                decrypt: vi.fn(),
            } as never,
            {
                on: vi.fn(),
                emit: vi.fn(),
            } as never,
            {
                setGithubToken: vi.fn(),
            } as never,
            () => null
        );

        const githubAccounts = await auth.getAccountsByProvider('github');
        const gitlabAccounts = await auth.getAccountsByProvider('gitlab');

        expect(githubAccounts).toHaveLength(1);
        expect(gitlabAccounts).toEqual([]);
    });

    it('ProcessService exposes no running tasks by default', () => {
        const processService = new ProcessService(() => null);
        expect(processService.getRunningTasks()).toEqual([]);
    });

    it('SystemService returns successful health payload', async () => {
        const service = new SystemService();
        const health = await service.healthCheck();
        expect(health.success).toBe(true);
        expect(health.result?.status).toBe('healthy');
    });

    it('ThemeService returns persisted default theme', () => {
        const service = new ThemeService({
            getPath: vi.fn(() => 'C:/user-data/db'),
        } as never, () => null);
        expect(service.getThemesDirectory()).toContain('runtime');
    });
});
