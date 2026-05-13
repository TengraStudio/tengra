/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as os from 'os';
import * as path from 'path';

import { getHealthCheckService } from '@main/services/system/health-check.service';
import {
    bootstrapCoreData,
    initializeContainerSafely,
    registerServiceGroups,
    startCriticalHealthChecks
} from '@main/startup/service-lifecycle';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_LOGS_PATH = path.join(os.tmpdir(), 'tengra-tests', 'logs');

vi.mock('@main/services/data/data.service', () => ({
    DataService: class {
        migrate = vi.fn(async () => undefined);
        getPath = vi.fn(() => TEST_LOGS_PATH);
    }
}));

describe('startup service lifecycle integration', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('registers all service groups in expected order', () => {
        const calls: string[] = [];
        registerServiceGroups({
            registerSystemServices: () => calls.push('system'),
            registerDataServices: () => calls.push('data'),
            registerSecurityServices: () => calls.push('security'),
            registerLLMServices: () => calls.push('llm'),
            registerWorkspaceServices: () => calls.push('workspace'),
            registerAnalysisServices: () => calls.push('analysis'),
            registerProxyServices: () => calls.push('proxy'),
            registerMcpServices: () => calls.push('mcp'),
            registerLazyServices: () => calls.push('lazy'),
            registerLazyProxies: () => calls.push('lazy-proxy'),
        });

        expect(calls).toEqual(['system', 'data', 'security', 'llm', 'workspace', 'analysis', 'proxy', 'mcp', 'lazy', 'lazy-proxy']);
    });

    it('initializes container safely without throwing on init failure', async () => {
        const container = {
            init: vi.fn(async () => { throw new Error('boom'); }),
            markDeferred: vi.fn()
        };
        await expect(initializeContainerSafely(container as never)).resolves.toBeUndefined();
    });

    it('boots core data and resolves DataService from container', async () => {
        const dataService = { initialize: vi.fn(async () => undefined), migrate: vi.fn(async () => undefined), getPath: vi.fn(() => TEST_LOGS_PATH) };
        const container = {
            register: vi.fn(),
            resolve: vi.fn(() => dataService),
        };

        const result = await bootstrapCoreData(container as never);

        expect(container.register).toHaveBeenCalledWith('dataService', expect.any(Function));
        expect(container.resolve).toHaveBeenCalledWith('dataService');
        expect(dataService.migrate).toHaveBeenCalled();
        expect(result).toBe(dataService);
    });

    it('starts critical health checks with expected dependencies', () => {
        const health = getHealthCheckService();
        const registerSpy = vi.spyOn(health, 'registerCriticalChecks');
        const startSpy = vi.spyOn(health, 'start');

        const deps = { databaseService: { id: 'db' }, networkService: { id: 'net' } };
        startCriticalHealthChecks(deps);

        expect(registerSpy).toHaveBeenCalledWith(deps);
        expect(startSpy).toHaveBeenCalled();
    });
});

