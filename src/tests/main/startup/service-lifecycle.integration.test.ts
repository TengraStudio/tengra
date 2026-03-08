import { getHealthCheckService } from '@main/services/system/health-check.service';
import {
    bootstrapCoreData,
    initializeContainerSafely,
    registerServiceGroups,
    startCriticalHealthChecks
} from '@main/startup/service-lifecycle';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/services/data/data.service', () => ({
    DataService: class {
        migrate = vi.fn(async () => undefined);
        getPath = vi.fn(() => '/tmp/logs');
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
            registerMcpServices: () => calls.push('mcp'),
            registerLazyServices: () => calls.push('lazy'),
            registerLazyProxies: () => calls.push('lazy-proxy'),
        });

        expect(calls).toEqual(['system', 'data', 'security', 'llm', 'workspace', 'analysis', 'mcp', 'lazy', 'lazy-proxy']);
    });

    it('initializes container safely without throwing on init failure', async () => {
        const container = {
            init: vi.fn(async () => { throw new Error('boom'); }),
            markDeferred: vi.fn()
        };
        await expect(initializeContainerSafely(container as never)).resolves.toBeUndefined();
    });

    it('boots core data and resolves DataService from container', async () => {
        const dataService = { migrate: vi.fn(async () => undefined), getPath: vi.fn(() => '/tmp/logs') };
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
