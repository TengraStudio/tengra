import { Container } from '@main/core/container';
import { appLogger } from '@main/logging/logger';
import { DataService } from '@main/services/data/data.service';
import { getHealthCheckService } from '@main/services/system/health-check.service';

type ContainerLike = Pick<Container, 'register' | 'resolve' | 'init' | 'markDeferred' | 'initDeferred'>;

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
    // Mark non-critical services for deferred initialization
    container.markDeferred(DEFERRED_SERVICE_NAMES);

    try {
        await container.init();
    } catch (error) {
        appLogger.error('Startup', `Container initialization failed partially: ${error}`);
    }
}

/**
 * Initialize deferred (non-critical) services after the main window is shown.
 */
export async function initDeferredServices(container: ContainerLike): Promise<void> {
    const start = Date.now();
    appLogger.info('Startup', 'Starting deferred service initialization...');
    try {
        await container.initDeferred();
        appLogger.info('Startup', `Deferred services initialized in ${Date.now() - start}ms`);
    } catch (error) {
        appLogger.error('Startup', `Deferred service initialization failed: ${error}`);
    }
}

/** Services that don't need to be ready before the main window is shown. */
const DEFERRED_SERVICE_NAMES: string[] = [
    // Analysis & monitoring
    'telemetryService',
    'usageTrackingService',
    'auditLogService',
    'performanceService',
    'monitoringService',
    'sentryService',
    'collaborationService',
    // Export & screenshot
    'exportService',
    'screenshotService',
    // Advanced AI services
    'advancedMemoryService',
    'embeddingService',
    'brainService',
    'codeIntelligenceService',
    'contextRetrievalService',
    'multiModelComparisonService',
    'modelCollaborationService',
    'inlineSuggestionService',
    'promptTemplatesService',
    // Agent services
    'agentService',
    'agentRegistryService',
    'agentPersistenceService',
    'agentCheckpointService',
    'agentPerformanceService',
    'projectAgentService',
    'multiAgentOrchestratorService',
    // Project & external
    'marketResearchService',
    'ideaGeneratorService',
    'projectScaffoldService',
    'workflowService',
    'backupService',
    // MCP
    'mcpMarketplaceService',
];

export function startCriticalHealthChecks(deps: { databaseService: unknown; networkService: unknown }): void {
    const health = getHealthCheckService();
    health.registerCriticalChecks({
        databaseService: deps.databaseService as { getDatabase: () => { prepare: (sql: string) => { get: () => Promise<unknown> } } },
        networkService: deps.networkService,
    });
    health.start();
}
