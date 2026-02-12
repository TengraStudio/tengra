import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { ProjectAgentService } from '@main/services/project/project-agent.service';
import { ProjectScaffoldService } from '@main/services/project/project-scaffold.service';
import { AuthService } from '@main/services/security/auth.service';
import { ProcessService } from '@main/services/system/process.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { SystemService } from '@main/services/system/system.service';
import { ThemeService } from '@main/services/ui/theme.service';
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

describe('Missing service TODO coverage (smoke)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('BaseService logs through logger facade', () => {
        const infoSpy = vi.spyOn(appLogger, 'info');
        const warnSpy = vi.spyOn(appLogger, 'warn');
        const debugSpy = vi.spyOn(appLogger, 'debug');
        const errorSpy = vi.spyOn(appLogger, 'error');

        const svc = new TestBaseService();
        svc.exerciseLogs();

        expect(infoSpy).toHaveBeenCalledWith('TestBaseService', 'info');
        expect(warnSpy).toHaveBeenCalledWith('TestBaseService', 'warn');
        expect(debugSpy).toHaveBeenCalledWith('TestBaseService', 'debug');
        expect(errorSpy).toHaveBeenCalled();
    });

    it('DataService initializes and resolves paths', async () => {
        const dataService = new DataService();

        await dataService.initialize();

        expect(dataService.getPath('data')).toContain('/tmp');
        expect(dataService.getPath('auth')).toContain('/tmp');
    });

    it('ProjectAgentService can be constructed with minimal dependencies', () => {
        const svc = new ProjectAgentService({
            databaseService: {} as any,
            llmService: {} as any,
            eventBus: { on: vi.fn() } as any,
            agentRegistryService: {} as any,
            agentCheckpointService: {} as any,
            gitService: {} as any,
            agentCollaborationService: {} as any,
            agentTemplateService: {} as any,
        });

        svc.setToolExecutor({} as any);

        expect(svc).toBeDefined();
    });

    it('ProjectScaffoldService exports scaffold function', () => {
        const svc = new ProjectScaffoldService();
        expect(typeof svc.scaffoldProject).toBe('function');
    });

    it('AuthService can be created and query accounts', async () => {
        const auth = new AuthService(
            {
                getLinkedAccounts: vi.fn(async () => []),
                getActiveLinkedAccount: vi.fn(async () => null),
                initialize: vi.fn(async () => undefined),
            } as any,
            {
                encrypt: vi.fn(),
                decrypt: vi.fn(),
            } as any,
            {
                emit: vi.fn(),
            } as any,
            {
                getPath: vi.fn(() => '/tmp/auth'),
            } as any
        );

        const accounts = await auth.getAccountsByProvider('github');
        expect(accounts).toEqual([]);
    });

    it('ProcessService exposes read-only listing APIs', () => {
        const processService = new ProcessService();

        expect(processService.getRunningTasks()).toEqual([]);
        expect(typeof processService.execute).toBe('function');
    });

    it('ProcessManagerService lifecycle methods run', async () => {
        const manager = new ProcessManagerService();

        await manager.initialize();
        await manager.cleanup();

        expect(manager).toBeDefined();
    });

    it('SystemService returns system info and health payload', async () => {
        const svc = new SystemService();

        const info = await svc.getSystemInfo();
        const health = await svc.healthCheck();

        expect(info.platform).toBe(process.platform);
        expect(health.success).toBe(true);
    });

    it('ThemeService returns current theme', () => {
        const svc = new ThemeService();
        expect(svc.getCurrentTheme()).toBe('graphite');
    });
});
