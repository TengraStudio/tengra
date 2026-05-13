/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Container } from '@main/core/container';
import { appLogger } from '@main/logging/logger';
import { DataService } from '@main/services/data/data.service';
import { getHealthCheckService } from '@main/services/system/health-check.service';
import type { RuntimeValue } from '@shared/types/common';

type ContainerLike = Pick<Container, 'register' | 'resolve' | 'init' | 'markDeferred' | 'initDeferred'>;

interface ServiceGroupRegistrations {
    registerSystemServices: () => void;
    registerDataServices: () => void;
    registerSecurityServices: () => void;
    registerLLMServices: () => void;
    registerWorkspaceServices?: () => void;
    registerAnalysisServices: () => void;
    registerProxyServices: () => void;
    registerMcpServices: () => void;
    registerLazyServices: () => void;
    registerLazyProxies: () => void;
}

export async function bootstrapCoreData(container: ContainerLike): Promise<DataService> {
    container.register('dataService', () => new DataService());
    const dataService = container.resolve<DataService>('dataService');
    try {
        await dataService.initialize();
        await dataService.migrate();
    } catch (error) {
        appLogger.error('Startup', `Failed to initialize or migrate data service: ${error}`);
    }
    appLogger.init(dataService.getPath('logs'));
    return dataService;
}

export function registerServiceGroups(registrations: ServiceGroupRegistrations): void {
    registrations.registerSystemServices();
    registrations.registerDataServices();
    registrations.registerSecurityServices();
    registrations.registerLLMServices();
    registrations.registerWorkspaceServices?.();
    registrations.registerAnalysisServices();
    registrations.registerProxyServices();
    registrations.registerMcpServices();
    registrations.registerLazyServices();
    registrations.registerLazyProxies();
}

export async function initializeContainerSafely(container: ContainerLike): Promise<void> {
    markDeferredStartupServices(container);

    try {
        await container.init();
    } catch (error) {
        appLogger.error('Startup', `Container initialization failed partially: ${error}`);
    }
}

export function markDeferredStartupServices(container: ContainerLike): void {
    container.markDeferred(DEFERRED_SERVICE_NAMES);
}

export async function initDeferredServices(container: ContainerLike): Promise<void> {
    const start = Date.now();
    appLogger.debug('Startup', 'Starting deferred service initialization...');
    try {
        await container.initDeferred();
        appLogger.debug('Startup', `Deferred services initialized in ${Date.now() - start}ms`);
    } catch (error) {
        appLogger.error('Startup', `Deferred service initialization failed: ${error}`);
    }
}

const DEFERRED_SERVICE_NAMES: string[] = [
    'terminalService',
    'terminalProfileService',
    'terminalSmartService',
    'gitService',
    'lspService',
    'dockerService',
    'sshService',
    'extensionService',

    'llmService',
    'ollamaService',
    'copilotService',
    'proxyService',
    'proxyProcessManager',
    'proxyCore',
    'backgroundModelResolver',

    'usageStatsService',
    'usageTrackingService',
    'auditLogService',
    'timeTrackingService',
    'monitoringService',

    'screenshotService',
    'advancedMemoryService',
    'embeddingService',
    'brainService',
    'localImageService',
    'codeIntelligenceService',
    'contextRetrievalService',
    'multiModelComparisonService',
    'modelCollaborationService',
    'inlineSuggestionService',
    'promptTemplatesService',
    'modelRegistryDeps',
    'modelRegistryService',
    'modelSelectionService',
    'workspaceService',
    'toolsService',
    'databaseService',
    'databaseClientService',
    'authService',
    'securityService',
    'networkService',
    'httpService',
    'configService',
    'windowService',
    'systemService',
    'usageService',
    'dialogService',
    'processService',
    'processManagerService',
    'webService',
    'fileManagementService',
    'featureFlagService',
    'runtimeManifestService',
    'runtimeHealthService',
    'runtimeBootstrapService',

    'agentService',
    'councilCapabilityService',
    'sessionModuleRegistryService',
    'chatSessionRegistryService',
    'sessionDirectoryService',

    'mcpDeps',
    'marketplaceService',
    'mcpPluginService',
    'socialMediaService',
    'cronSchedulerService',
    'notificationDispatcherService',
    'imagePersistenceService',
    'chatEventService',
    'ruleService',
    'authAPIService',
    'keyRotationService',
    'tokenService',
];

export function startCriticalHealthChecks(deps: { databaseService: RuntimeValue; networkService: RuntimeValue }): void {
    const health = getHealthCheckService();
    health.registerCriticalChecks({
        databaseService: deps.databaseService as { getDatabase: () => { prepare: (sql: string) => { get: () => Promise<RuntimeValue> } } },
        networkService: deps.networkService,
    });
    health.start();
}

