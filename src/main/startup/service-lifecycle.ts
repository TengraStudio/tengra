import { Container } from '@main/core/container';
import { appLogger } from '@main/logging/logger';
import { DataService } from '@main/services/data/data.service';
import { getHealthCheckService } from '@main/services/system/health-check.service';

type ContainerLike = Pick<Container, 'register' | 'resolve' | 'init'>;

interface ServiceGroupRegistrations {
    registerSystemServices: () => void;
    registerDataServices: () => void;
    registerSecurityServices: () => void;
    registerLLMServices: () => void;
    registerProjectServices: () => void;
    registerAnalysisServices: () => void;
    registerMcpServices: () => void;
    registerLazyServices: () => void;
    registerLazyProxies: () => void;
}

export async function bootstrapCoreData(container: ContainerLike): Promise<DataService> {
    container.register('dataService', () => new DataService());
    const dataService = container.resolve<DataService>('dataService');
    try {
        await dataService.migrate();
    } catch (error) {
        appLogger.error('Startup', `Failed to migrate data service: ${error}`);
    }
    appLogger.init(dataService.getPath('logs'));
    return dataService;
}

export function registerServiceGroups(registrations: ServiceGroupRegistrations): void {
    registrations.registerSystemServices();
    registrations.registerDataServices();
    registrations.registerSecurityServices();
    registrations.registerLLMServices();
    registrations.registerProjectServices();
    registrations.registerAnalysisServices();
    registrations.registerMcpServices();
    registrations.registerLazyServices();
    registrations.registerLazyProxies();
}

export async function initializeContainerSafely(container: ContainerLike): Promise<void> {
    try {
        await container.init();
    } catch (error) {
        appLogger.error('Startup', `Container initialization failed partially: ${error}`);
    }
}

export function startCriticalHealthChecks(deps: { databaseService: unknown; networkService: unknown }): void {
    const health = getHealthCheckService();
    health.registerCriticalChecks({
        databaseService: deps.databaseService as { getDatabase: () => { prepare: (sql: string) => { get: () => Promise<unknown> } } },
        networkService: deps.networkService,
    });
    health.start();
}
