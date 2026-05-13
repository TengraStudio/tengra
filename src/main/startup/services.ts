/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ApiServerService } from '@main/api/api-server.service';
import { Container } from '@main/core/container';
import { createLazyServiceProxy, type LazyServiceDependency, lazyServiceRegistry } from '@main/core/lazy-services';
import { appLogger } from '@main/logging/logger';
import { ChatEventService } from '@main/services/data/chat-event.service';
import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import { DatabaseClientService } from '@main/services/data/database-client.service';
import { FileManagementService } from '@main/services/data/file.service';
import { FileChangeTracker } from '@main/services/data/file-change-tracker.service';
import { FileSystemService } from '@main/services/data/filesystem.service';
import { GalleryService } from '@main/services/data/gallery.service'; 
import { ExportService } from '@main/services/export/export.service';
import { ExtensionService } from '@main/services/extension/extension.service';
import { CronSchedulerService } from '@main/services/external/cron-scheduler.service';
import { FeatureFlagService } from '@main/services/external/feature-flag.service';
import { HttpService } from '@main/services/external/http.service';
import { LogoService } from '@main/services/external/logo.service';
import { MarketplaceService } from '@main/services/external/marketplace.service';
import { NotificationDispatcherService } from '@main/services/external/notification-dispatcher.service';
import { RuleService } from '@main/services/external/rule.service';
import { SocialMediaService } from '@main/services/external/social-media.service';
import { WebService } from '@main/services/external/web.service';
import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { AgentService } from '@main/services/llm/agent.service';
import { BackgroundModelResolver } from '@main/services/llm/background-model-resolver.service';
import { BrainService } from '@main/services/llm/brain.service';
import { ContextRetrievalService } from '@main/services/llm/context-retrieval.service';
import { CopilotService } from '@main/services/llm/copilot/copilot.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { ImageStudioService } from '@main/services/llm/image-studio.service';
import { InlineSuggestionService } from '@main/services/llm/inline-suggestion.service';
import { LLMService } from '@main/services/llm/llm.service';
import { HuggingFaceService } from '@main/services/llm/local/huggingface.service';
import { LlamaService } from '@main/services/llm/local/llama.service';
import { LocalImageService } from '@main/services/llm/local/local-image.service';
import { OllamaService } from '@main/services/llm/local/ollama.service';
import { 
    OllamaHealthService,
} from '@main/services/llm/local/ollama-health.service';
import { MemoryService } from '@main/services/llm/memory.service';
import { ModelCollaborationService } from '@main/services/llm/model-collaboration.service';
import { ModelDownloaderService } from '@main/services/llm/model-downloader.service';
import { ModelRegistryService } from '@main/services/llm/model-registry.service';
import { MultiModelComparisonService } from '@main/services/llm/multi-model-comparison.service';
import { PromptTemplatesService } from '@main/services/llm/prompt-templates.service'; 
import { McpPluginService } from '@main/services/mcp/mcp-plugin.service';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { AuthService } from '@main/services/security/auth.service';
import { AuthAPIService } from '@main/services/security/auth-api.service';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { SecurityService } from '@main/services/security/security.service';
import { TokenService } from '@main/services/security/token.service';
import { CouncilCapabilityService } from '@main/services/session/capabilities/council-capability.service';
import { ChatSessionRegistryService } from '@main/services/session/chat-session-registry.service';
import { SessionConversationService } from '@main/services/session/session-conversation.service';
import { SessionDirectoryService } from '@main/services/session/session-directory.service';
import { SessionModuleRegistryService } from '@main/services/session/session-module-registry.service';
import { SessionWorkspaceService } from '@main/services/session/session-workspace.service';
import { AuditLogService } from '@main/services/system/audit-log.service'; 
import { CacheService } from '@main/services/system/cache.service';
import { CodeLanguageService } from '@main/services/system/code-language.service';
import { CommandService } from '@main/services/system/command.service';
import { ConfigService } from '@main/services/system/config.service';
import { DialogService } from '@main/services/system/dialog.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import {
    HealthCheckService,
} from '@main/services/system/health-check.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { LocaleService } from '@main/services/system/locale.service';
import { LoggingService } from '@main/services/system/logging.service';
import { NetworkService } from '@main/services/system/network.service';
import { PowerManagerService } from '@main/services/system/power-manager.service';
import { ProcessService } from '@main/services/system/process.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { RuntimeBootstrapService } from '@main/services/system/runtime-bootstrap.service';
import { RuntimeHealthService } from '@main/services/system/runtime-health.service';
import { RuntimeManifestService } from '@main/services/system/runtime-manifest.service';
import { SettingsService } from '@main/services/system/settings.service';
import { SystemService } from '@main/services/system/system.service';
import { ToolsService } from '@main/services/system/tools.service';
import { UpdateService } from '@main/services/system/update.service';
import { UsageService } from '@main/services/system/usage.service';
import { UtilityProcessService } from '@main/services/system/utility-process.service';
import { WindowService } from '@main/services/system/window.service'; 
import { SSHBackend } from '@main/services/terminal/backends/ssh.backend';
import { TerminalProfileService } from '@main/services/terminal/terminal-profile.service';
import { ThemeService } from '@main/services/theme/theme.service';
import { VoiceService } from '@main/services/ui/voice.service';
import { CodeIntelligenceService } from '@main/services/workspace/code-intelligence.service';
import { CodeSandboxService } from '@main/services/workspace/code-sandbox.service';
import { DockerService } from '@main/services/workspace/docker.service';
import { GitService } from '@main/services/workspace/git.service';
import { LspService } from '@main/services/workspace/lsp.service';
import { SSHService } from '@main/services/workspace/ssh.service';
import { TerminalService } from '@main/services/workspace/terminal.service';
import { WorkspaceService } from '@main/services/workspace/workspace.service';
import { WorkspaceAgentSessionService } from '@main/services/workspace/workspace-agent-session.service';
import { constructorInjectionServiceRegistry } from '@main/startup/constructor-injection-service-registry';
import {
    initDeferredServices,
} from '@main/startup/service-lifecycle';
import { IpcBatchService } from '@main/utils/ipc-batch.util';
import { RuntimeValue } from '@shared/types/common';
import { app, BrowserWindow } from 'electron';

// Export the container instance so it can be accessed if needed
export const container = new Container();

export type ConstructorDrivenServiceClass = {
    new (...deps: readonly unknown[]): unknown;
    readonly serviceName: string;
    readonly dependencies: readonly string[];
    readonly category?: string;
};

type RuntimeValueMap = Record<string, RuntimeValue>;

function createContainerBackedLazyDependency<T extends object>(serviceName: string): LazyServiceDependency<T> {
    return {
        serviceName,
        resolve: async () => container.resolve<T>(serviceName),
        isLoaded: () => container.has(serviceName),
    };
}

const DEPENDENCY_TOKEN_ALIASES: Record<string, string> = {
    database: 'databaseService',
    db: 'databaseService',
    dbService: 'databaseService',
    dbClient: 'databaseClientService',
    web: 'webService',
    system: 'systemService',
    eventBus: 'eventBusService',
    imagePersistence: 'imagePersistenceService',
    imagePersistenceService: 'imagePersistenceService',
    llm: 'llmService',
    llama: 'llamaService',
    ollama: 'ollamaService',
    embedding: 'embeddingService',
    filesystem: 'fileSystemService',
    file: 'fileService',
    docker: 'dockerService',
    jobScheduler: 'jobSchedulerService',
    processManager: 'processManagerService',
    _processManager: 'processManagerService',
    _dataService: 'dataService',
    command: 'commandService',
    ssh: 'sshService',
    network: 'networkService',
    git: 'gitService',
    security: 'securityService',
    settings: 'settingsService',
    workspace: 'workspaceService',
    proxy: 'proxyService',
    storagePath: 'storagePath',
    advancedMemory: 'advancedMemoryService',
    modelCollaboration: 'modelCollaborationService',
    allowedRoots: 'allowedRoots',
    allowedFileRoots: 'allowedFileRoots',
    mainWindowProvider: 'mainWindowProvider',
    getMainWindow: 'getMainWindow',
    getNormalizedModelName: 'getNormalizedModelName',
    getDispatcher: 'getDispatcher',
    toolExecutor: 'toolExecutor',
    options: 'options',
    config: 'config',
    deps: 'deps',
    breaker: 'breaker',
    orchestrator: 'orchestrator',
    proxyCore: 'proxyCore',
    mcpDeps: 'mcpDeps',
    baseUrl: 'baseUrl',
    getOpenAIBaseUrl: 'getOpenAIBaseUrl',
    backgroundModelResolver: 'backgroundModelResolver',
    fileChangeTracker: 'fileChangeTracker',
    pluginService: 'mcpPluginService',
};

function resolveDependencyToken(token: string): string {
    return DEPENDENCY_TOKEN_ALIASES[token] ?? token;
}

function createDependencyProxy(
    container: Container,
    runtimeValues: RuntimeValueMap,
): Record<string, RuntimeValue> {
    return new Proxy(Object.create(null) as Record<string, RuntimeValue>, {
        get(_target, prop: string | symbol) {
            if (typeof prop === 'symbol') {
                return undefined;
            }

            const resolvedKey = resolveDependencyToken(prop);
            if (resolvedKey in runtimeValues) {
                return runtimeValues[resolvedKey];
            }

            if (container.has(resolvedKey)) {
                return container.resolve(resolvedKey);
            }

            return undefined;
        },
        has(_target, prop: string | symbol) {
            if (typeof prop === 'symbol') {
                return false;
            }
            const resolvedKey = resolveDependencyToken(prop);
            return resolvedKey in runtimeValues || container.has(resolvedKey);
        },
        ownKeys() {
            return [];
        },
        getOwnPropertyDescriptor() {
            return undefined;
        },
    });
}

function registerRuntimeValues(container: Container, runtimeValues: RuntimeValueMap): void {
    for (const [name, value] of Object.entries(runtimeValues)) {
        if (!container.has(name)) {
            container.registerInstance(name, value as never);
        }
    }
}

function registerDependencyBags(container: Container, runtimeValues: RuntimeValueMap): void {
    const dependencyBag = createDependencyProxy(container, runtimeValues);
    const configBag = createDependencyProxy(container, runtimeValues);
    const optionsBag = createDependencyProxy(container, runtimeValues);
    const proxyCoreBag = createDependencyProxy(container, runtimeValues);
    const mcpDepsBag = createDependencyProxy(container, runtimeValues);
    const orchestratorBag = createDependencyProxy(container, runtimeValues);
    const breakerBag = createDependencyProxy(container, runtimeValues);
    const toolExecutorBag = createDependencyProxy(container, runtimeValues);

    container.registerInstance('deps', dependencyBag as never);
    container.registerInstance('config', configBag as never);
    container.registerInstance('options', optionsBag as never);
    container.registerInstance('proxyCore', proxyCoreBag as never);
    container.registerInstance('mcpDeps', mcpDepsBag as never);
    container.registerInstance('orchestrator', orchestratorBag as never);
    container.registerInstance('breaker', breakerBag as never);
    container.registerInstance('toolExecutor', toolExecutorBag as never);
}

export interface ConstructorInjectionRegistrationResult {
    registered: number;
    duplicateServiceNames: Array<{ serviceName: string; ids: string[] }>;
}

const IGNORED_DUPLICATE_SERVICE_NAMES = new Set([
    'exportService',
    'themeService',
]);

export interface ServiceRegistryEntry {
    id: string;
    serviceClass: ConstructorDrivenServiceClass;
    serviceName: string;
    dependencies: string[];
    category: 'minimal' | 'important' | 'deferred' | 'lazy';
}

export function registerConstructorDrivenServices(
    container: Container,
    runtimeValues: RuntimeValueMap = {}
): ConstructorInjectionRegistrationResult {
    registerRuntimeValues(container, runtimeValues);
    registerDependencyBags(container, runtimeValues);

    const duplicateServiceNames = new Map<string, string[]>();
    const deferredServiceNames: string[] = [];
    let registered = 0;

    for (const entry of constructorInjectionServiceRegistry as unknown as ServiceRegistryEntry[]) {
        const serviceClass = entry.serviceClass;
        const serviceName = resolveDependencyToken(serviceClass.serviceName || entry.serviceName);
        const category = serviceClass.category ?? entry.category;

        const ids = duplicateServiceNames.get(serviceName);
        if (ids) {
            ids.push(entry.id);
        } else {
            duplicateServiceNames.set(serviceName, [entry.id]);
        }

        if (container.has(serviceName)) {
            continue;
        }

        const dependencies = (serviceClass.dependencies ?? entry.dependencies).map(resolveDependencyToken);

        if (category === 'lazy') {
            lazyServiceRegistry.register(serviceName, async () => {
                const resolvedDeps = dependencies.map(dep => {
                    if (container.has(dep)) {return container.resolve(dep);}
                    if (dep in runtimeValues) {return runtimeValues[dep];}
                    return undefined;
                });
                return new serviceClass(...resolvedDeps) as object;
            });
            
            container.register(
                serviceName,
                (() => createLazyServiceProxy(serviceName, serviceClass)) as never,
                []
            );
        } else {
            container.register(
                serviceName,
                ((...resolvedDeps: RuntimeValue[]) => new serviceClass(...resolvedDeps)) as never,
                dependencies
            );

            if (category === 'deferred') {
                deferredServiceNames.push(serviceName);
            }
        }
        
        registered++;
    }

    if (deferredServiceNames.length > 0) {
        container.markDeferred(deferredServiceNames);
    }

    const duplicateList = Array.from(duplicateServiceNames.entries())
        .filter(([serviceName, ids]) => ids.length > 1 && !IGNORED_DUPLICATE_SERVICE_NAMES.has(serviceName))
        .map(([serviceName, ids]) => ({ serviceName, ids }))
        .sort((left, right) => left.serviceName.localeCompare(right.serviceName));

    return {
        registered,
        duplicateServiceNames: duplicateList,
    };
}

export async function registerMinimalRegistryServices(
    container: Container,
    runtimeValues: RuntimeValueMap = {}
): Promise<Record<string, RuntimeValue>> {
    registerRuntimeValues(container, runtimeValues);
    
    const minimalServices: Record<string, RuntimeValue> = {};

    for (const entry of constructorInjectionServiceRegistry as unknown as ServiceRegistryEntry[]) {
        if (entry.category === 'minimal') {
            const serviceClass = entry.serviceClass;
            const serviceName = entry.serviceName;
            const dependencies = entry.dependencies.map(resolveDependencyToken);
            
            const resolvedDeps = dependencies.map(dep => {
                if (container.has(dep)) {return container.resolve(dep);}
                if (dep in runtimeValues) {return runtimeValues[dep];}
                return undefined;
            });

            const instance = new serviceClass(...resolvedDeps);
            container.registerInstance(serviceName, instance as never);
            minimalServices[serviceName] = instance as RuntimeValue;
        }
    }

    return minimalServices;
}

// Define Services interface
export interface Services {
    settingsService: SettingsService;
    dataService: DataService;
    authService: AuthService;
    authAPIService: AuthAPIService;
    usageService: UsageService;
    dialogService: DialogService;
    loggingService: LoggingService;
    toolsService: ToolsService;
    ollamaService: OllamaService;
    llmService: LLMService;
    fileSystemService: FileSystemService;
    commandService: CommandService;
    databaseClientService: DatabaseClientService;
    databaseService: DatabaseService;
    fileChangeTracker: FileChangeTracker;
    sshService: LazyServiceDependency<SSHService>;
    proxyService: ProxyService;
    copilotService: CopilotService;
    systemService: SystemService;
    networkService: NetworkService;
    gitService: GitService;
    securityService: SecurityService;
    utilityProcessService: UtilityProcessService;
    cacheService: CacheService;
    embeddingService: EmbeddingService;
    dockerService: LazyServiceDependency<DockerService>;
    ollamaHealthService: OllamaHealthService;
    llamaService: LlamaService;
    huggingFaceService: HuggingFaceService;
    workspaceService: WorkspaceService;
    lspService: LspService;
    terminalService: TerminalService;
    inlineSuggestionService: InlineSuggestionService;
    logoService: LazyServiceDependency<LogoService>;
    processService: ProcessService;
    processManagerService: ProcessManagerService;
    galleryService: GalleryService;
    imageStudioService: ImageStudioService;
    codeIntelligenceService: CodeIntelligenceService;
    codeSandboxService: LazyServiceDependency<CodeSandboxService>;
    contextRetrievalService: ContextRetrievalService;
    modelCollaborationService: ModelCollaborationService;
    jobSchedulerService: JobSchedulerService;
    webService: WebService;
    memoryService: MemoryService;
    advancedMemoryService: AdvancedMemoryService;
    brainService: BrainService;
    localImageService: LocalImageService;
    ruleService: RuleService;
    agentService: AgentService;
    updateService: UpdateService;
    localeService: LocaleService;
    codeLanguageService: CodeLanguageService;
    auditLogService: AuditLogService;
    healthCheckService: HealthCheckService;
    fileManagementService: FileManagementService;
    featureFlagService: FeatureFlagService;
    chatEventService: ChatEventService;
    chatSessionRegistryService: ChatSessionRegistryService;
    sessionDirectoryService: SessionDirectoryService;
    sessionModuleRegistryService: SessionModuleRegistryService;
    httpService: HttpService;
    configService: ConfigService;
    keyRotationService: KeyRotationService;
    tokenService: TokenService;
    windowService: WindowService;
    promptTemplatesService: PromptTemplatesService;
    multiModelComparisonService: MultiModelComparisonService;
    runtimeManifestService: RuntimeManifestService;
    runtimeHealthService: RuntimeHealthService;
    runtimeBootstrapService: RuntimeBootstrapService;
    modelRegistryService: ModelRegistryService;
    eventBusService: EventBusService;
    powerManagerService: PowerManagerService;
    exportService: ExportService;
    mcpPluginService: McpPluginService;
    apiServerService: ApiServerService;
    themeService: ThemeService;
    voiceService: VoiceService;
    ipcBatchService: IpcBatchService;
    terminalProfileService: TerminalProfileService; 
    modelDownloaderService: ModelDownloaderService;
    councilCapabilityService: CouncilCapabilityService;
    marketplaceService: MarketplaceService;
    socialMediaService: SocialMediaService;
    cronSchedulerService: CronSchedulerService;
    notificationDispatcherService: NotificationDispatcherService;
    extensionService: ExtensionService;
    sessionWorkspaceService: SessionWorkspaceService;
    sessionConversationService: SessionConversationService;
    workspaceAgentSessionService: WorkspaceAgentSessionService;
}

/**
 * Initialize deferred (non-critical) services. Call after main window is shown.
 */
export async function startDeferredServices(): Promise<void> {
    const deferredStartTime = performance.now();
    await initDeferredServices(container);
    
    // Link deferred services
    const authService = container.resolve<AuthService>('authService');
    const proxyService = container.resolve<ProxyService>('proxyService');
    authService.setProxyService(proxyService);

    const llamaService = container.resolve<LlamaService>('llamaService');
    const localImageService = container.resolve<LocalImageService>('localImageService');
    llamaService.setLocalImageService(localImageService);

    const deferredDurationMs = Math.round(performance.now() - deferredStartTime);
    appLogger.info('Benchmark', 'Deferred service load benchmark', {
        deferredDurationMs,
        registeredServices: container.getRegisteredNames().length,
        lazyServices: lazyServiceRegistry.getRegisteredServices().length,
    });
}

/**
 * Initialize a minimal set of services needed to create the application window.
 * This should be extremely fast (<100ms).
 */
export async function createMinimalServices(): Promise<{
    settingsService: SettingsService;
    dataService: DataService;
    eventBusService: EventBusService;
    runtimeBootstrapService: RuntimeBootstrapService;
}> {
    let dataService: DataService;

    if (container.has('dataService')) {
        dataService = container.resolve<DataService>('dataService');
    } else {
        dataService = new DataService();
        container.registerInstance('dataService', dataService);
    }

    const eventBusService = new EventBusService();
    container.registerInstance('eventBusService', eventBusService);

    // Runtime services are fast and needed for boot boundary
    const runtimeManifestService = new RuntimeManifestService();
    const runtimeHealthService = new RuntimeHealthService();
    const runtimeBootstrapService = new RuntimeBootstrapService(runtimeManifestService, runtimeHealthService);

    container.registerInstance('runtimeManifestService', runtimeManifestService);
    container.registerInstance('runtimeHealthService', runtimeHealthService);
    container.registerInstance('runtimeBootstrapService', runtimeBootstrapService);

    // Start scanning in background IMMEDIATELY so status is ready for renderer
    void runtimeBootstrapService.initialize().catch(e => {
        appLogger.error('Main', 'Early runtime bootstrap initialization failed', e);
    });

    // Settings needs dataService for path. We pass undefined for authService initially.
    const settingsService = new SettingsService(dataService, undefined);
    await settingsService.initialize();
    container.registerInstance('settingsService', settingsService);

    return { settingsService, dataService, eventBusService, runtimeBootstrapService };
}

/**
 * Complete the initialization of all core services after the window has been created.
 */
export async function createServices(allowedFileRoots: Set<string>, getMainWindow: () => BrowserWindow | null): Promise<Services> {
    const benchmarkStartTime = performance.now();
    const bootstrapSettingsService = container.resolve<SettingsService>('settingsService');

    // 1. Create a map of common/runtime services
    const commonServices: Record<string, RuntimeValue | ((...args: unknown[]) => unknown)> = {
        app,
        mainWindowProvider: getMainWindow,
        getMainWindow,
        allowedFileRoots,
        allowedRoots: allowedFileRoots,
        storagePath: app.getPath('userData'),
        baseUrl: bootstrapSettingsService.getSettings().ollama.url,
        getOpenAIBaseUrl: () => 'https://api.openai.com/v1',
        getNormalizedModelName: (modelName: string) => modelName,
        getDispatcher: () => null,
        toolExecutor: {
            execute: () => undefined,
            registerTool: () => undefined,
            getTools: () => [],
        },
    };

    // Register common services first
    for (const [name, service] of Object.entries(commonServices)) {
        if (!container.has(name)) {
            container.registerInstance(name, service as never);
        }
    }

    const registrationStartTime = performance.now();
    const registrationResult = registerConstructorDrivenServices(container, commonServices);
    const registrationDurationMs = Math.round(performance.now() - registrationStartTime);
    if (registrationResult.duplicateServiceNames.length > 0) {
        appLogger.warn(
            'Startup',
            `Constructor registry contains duplicate service names: ${registrationResult.duplicateServiceNames
                .map(entry => `${entry.serviceName} (${entry.ids.join(', ')})`)
                .join('; ')}`
        );
    }

    const dataService = container.resolve<DataService>('dataService');

    // Run migrations in background to not block critical path
    void dataService.migrate().catch(e => appLogger.error('DataService', 'Migration failed', e));

    // Resolve critical services for setup
    const settingsService = container.resolve<SettingsService>('settingsService');
    
    // Start critical services in parallel using the updated Container.init()
    const criticalInitStartTime = performance.now();
    await container.init();
    const criticalInitDurationMs = Math.round(performance.now() - criticalInitStartTime);

    // Resolve the now-ready AuthService and link it to SettingsService
    const authService = container.resolve<AuthService>('authService');
    const terminalService = container.resolve<TerminalService>('terminalService');
    const sshService = container.resolve<SSHService>('sshService');
    const proxyService = container.resolve<ProxyService>('proxyService');

    // Update settings service with auth dependency now that it's ready
    settingsService.setAuthService(authService);
    
    // Auth service might need proxy service
    if (authService.setProxyService) {
        authService.setProxyService(proxyService);
    }

    terminalService.addBackend(new SSHBackend(sshService));

    // Return the services object for the main application
    const serviceMapStartTime = performance.now();
    const services = {} as Record<string, RuntimeValue>;
    for (const name of container.getRegisteredNames()) {
        services[name] = container.resolve(name) as RuntimeValue;
    }
    services.sshService = createContainerBackedLazyDependency<SSHService>('sshService') as RuntimeValue;
    services.dockerService = createContainerBackedLazyDependency<DockerService>('dockerService') as RuntimeValue;
    services.codeSandboxService = createContainerBackedLazyDependency<CodeSandboxService>('codeSandboxService') as RuntimeValue;
    services.logoService = createContainerBackedLazyDependency<LogoService>('logoService') as RuntimeValue;
    const serviceMapDurationMs = Math.round(performance.now() - serviceMapStartTime);
    const totalDurationMs = Math.round(performance.now() - benchmarkStartTime);
    appLogger.info('Benchmark', 'Core service load benchmark', {
        totalDurationMs,
        registrationDurationMs,
        criticalInitDurationMs,
        serviceMapDurationMs,
        registeredServices: container.getRegisteredNames().length,
        duplicateServiceNames: registrationResult.duplicateServiceNames.length,
        lazyServices: lazyServiceRegistry.getRegisteredServices().length,
    });
    return services as unknown as Services;
}
