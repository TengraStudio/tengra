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
import { createLazyServiceDependency, createLazyServiceProxy, type LazyServiceDependency, lazyServiceRegistry } from '@main/core/lazy-services';
import { appLogger } from '@main/logging/logger';
import { McpDeps } from '@main/mcp/server-utils';
import type { PerformanceService } from '@main/services/analysis/performance.service';
import type { TelemetryService } from '@main/services/analysis/telemetry.service';
import { ChatEventService } from '@main/services/data/chat-event.service';
import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import { DatabaseClientService } from '@main/services/data/database-client.service';
import { FileManagementService } from '@main/services/data/file.service';
import { FileChangeTracker } from '@main/services/data/file-change-tracker.service';
import { FileSystemService } from '@main/services/data/filesystem.service';
import { ImagePersistenceService } from '@main/services/data/image-persistence.service';
import { ExportService } from '@main/services/export/export.service';
import { ExtensionService } from '@main/services/extension/extension.service';
import { CronSchedulerService } from '@main/services/external/cron-scheduler.service';
import { FeatureFlagService } from '@main/services/external/feature-flag.service';
import { HttpService } from '@main/services/external/http.service';
import type { LogoService } from '@main/services/external/logo.service';
import { MarketplaceService } from '@main/services/external/marketplace.service';
import { NotificationDispatcherService } from '@main/services/external/notification-dispatcher.service';
import { RuleService } from '@main/services/external/rule.service';
import { SocialMediaService } from '@main/services/external/social-media.service';
import { WebService } from '@main/services/external/web.service';
import type { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { AgentService } from '@main/services/llm/agent.service';
import { BackgroundModelResolver } from '@main/services/llm/background-model-resolver.service';
import type { BrainService } from '@main/services/llm/brain.service';
import { ContextRetrievalService } from '@main/services/llm/context-retrieval.service';
import { CopilotService } from '@main/services/llm/copilot.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { HuggingFaceService } from '@main/services/llm/huggingface.service';
import { InlineSuggestionService } from '@main/services/llm/inline-suggestion.service';
import { LlamaService } from '@main/services/llm/llama.service';
import { LLMService } from '@main/services/llm/llm.service';
import { LocalAIService } from '@main/services/llm/local-ai.service';
import { LocalImageService } from '@main/services/llm/local-image.service';
import type { MemoryService } from '@main/services/llm/memory.service';
import { ModelCollaborationService } from '@main/services/llm/model-collaboration.service';
import { ModelDownloaderService } from '@main/services/llm/model-downloader.service';
import { ModelFallbackService, modelFallbackService } from '@main/services/llm/model-fallback.service';
import {
    ModelRegistryDependencies,
    ModelRegistryService,
} from '@main/services/llm/model-registry.service';
import { ModelSelectionService } from '@main/services/llm/model-selection.service';
import { MultiLLMOrchestrator } from '@main/services/llm/multi-llm-orchestrator.service';
import { MultiModelComparisonService } from '@main/services/llm/multi-model-comparison.service';
import { OllamaService } from '@main/services/llm/ollama.service';
import {
    getOllamaHealthService,
    OllamaHealthService,
} from '@main/services/llm/ollama-health.service';
import { PromptTemplatesService } from '@main/services/llm/prompt-templates.service';
import { ResponseCacheService } from '@main/services/llm/response-cache.service';
import type { McpPluginService } from '@main/services/mcp/mcp-plugin.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { AuthService } from '@main/services/security/auth.service';
import { AuthAPIService } from '@main/services/security/auth-api.service';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { SecurityService } from '@main/services/security/security.service';
import { TokenService } from '@main/services/security/token.service';
import { CouncilCapabilityService } from '@main/services/session/capabilities/council-capability.service';
import { ChatSessionRegistryService } from '@main/services/session/chat-session-registry.service';
import { SessionDirectoryService } from '@main/services/session/session-directory.service';
import { SessionModuleRegistryService } from '@main/services/session/session-module-registry.service';
import { BackgroundServiceService } from '@main/services/system/background-service.service';
import { CacheService } from '@main/services/system/cache.service';
import { CodeLanguageService } from '@main/services/system/code-language.service';
import { CommandService } from '@main/services/system/command.service';
import { ConfigService } from '@main/services/system/config.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import {
    getHealthCheckService,
    HealthCheckService,
} from '@main/services/system/health-check.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { LocaleService } from '@main/services/system/locale.service';
import { NetworkService } from '@main/services/system/network.service';
import { PowerManagerService } from '@main/services/system/power-manager.service';
import { ProcessService } from '@main/services/system/process.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { AuditLogService } from '@main/services/system/audit-log.service';
import { RuntimeBootstrapService } from '@main/services/system/runtime-bootstrap.service';
import { RuntimeHealthService } from '@main/services/system/runtime-health.service';
import { RuntimeManifestService } from '@main/services/system/runtime-manifest.service';
import { SettingsService } from '@main/services/system/settings.service';
import { SystemService } from '@main/services/system/system.service';
import type { UpdateService } from '@main/services/system/update.service';
import { UtilityProcessService } from '@main/services/system/utility-process.service';
import { DockerBackend } from '@main/services/terminal/backends/docker.backend';
import { SSHBackend } from '@main/services/terminal/backends/ssh.backend';
import { TerminalProfileService } from '@main/services/terminal/terminal-profile.service';
import { ThemeService } from '@main/services/theme/theme.service';
import { CodeIntelligenceService } from '@main/services/workspace/code-intelligence.service';
import type { DockerService } from '@main/services/workspace/docker.service';
import { GitService } from '@main/services/workspace/git.service';
import { LspService } from '@main/services/workspace/lsp.service';
import type { SSHService } from '@main/services/workspace/ssh.service';
import { TerminalService } from '@main/services/workspace/terminal.service';
import { TerminalSmartService } from '@main/services/workspace/terminal-smart.service';
import type { WorkspaceService } from '@main/services/workspace/workspace.service';
import { 
    initDeferredServices, 
    markDeferredStartupServices,
    registerServiceGroups,
    startCriticalHealthChecks,
} from '@main/startup/service-lifecycle';
import { JsonObject } from '@shared/types/common';

// Export the container instance so it can be accessed if needed
export const container = new Container();

function createDeferredContainerProxy<T extends object>(serviceName: string): T {
    let resolvedService: T | null = null;
    const getService = (): T => {
        if (!resolvedService) {
            resolvedService = container.resolve<T>(serviceName);
        }
        return resolvedService;
    };

    return new Proxy({} as T, {
        get(_target: T, prop: string | symbol): RuntimeValue {
            const value = (getService() as Record<string | symbol, RuntimeValue>)[prop];
            if (typeof value === 'function') {
                return (...args: RuntimeValue[]) => {
                    const method = (getService() as Record<string | symbol, RuntimeValue>)[prop];
                    if (typeof method === 'function') {
                        return (method as (...methodArgs: RuntimeValue[]) => RuntimeValue)
                            .apply(getService(), args);
                    }
                    return method;
                };
            }
            return value;
        },
    });
}

// Define Services interface
export interface Services {
    settingsService: SettingsService;
    dataService: DataService;
    authService: AuthService;
    authAPIService: AuthAPIService;
    localAIService: LocalAIService;
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

    ollamaHealthService: ReturnType<typeof getOllamaHealthService>;
    llamaService: LlamaService;
    huggingFaceService: HuggingFaceService;
    workspaceService: WorkspaceService;
    lspService: LspService;
    terminalService: TerminalService;
    inlineSuggestionService: InlineSuggestionService;
    logoService: LazyServiceDependency<LogoService>;
    processService: ProcessService;
    processManagerService: ProcessManagerService;
    codeIntelligenceService: CodeIntelligenceService;
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
    telemetryService: TelemetryService;
    httpService: HttpService;
    configService: ConfigService;
    keyRotationService: KeyRotationService;
    tokenService: TokenService; 

    promptTemplatesService: PromptTemplatesService;
    performanceService: PerformanceService;
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
    terminalProfileService: TerminalProfileService;
    terminalSmartService: TerminalSmartService;
    modelDownloaderService: ModelDownloaderService;
    councilCapabilityService: CouncilCapabilityService;
    marketplaceService: MarketplaceService;
    socialMediaService: SocialMediaService;
    cronSchedulerService: CronSchedulerService;
    notificationDispatcherService: NotificationDispatcherService;
    extensionService: ExtensionService;
}

/**
 * Initialize deferred (non-critical) services. Call after main window is shown.
 */
export async function startDeferredServices(): Promise<void> {
    await initDeferredServices(container);
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
export async function createServices(allowedFileRoots: Set<string>): Promise<Services> {
    const dataService = container.resolve<DataService>('dataService');
    
    // Run migrations in background to not block critical path
    void dataService.migrate().catch(e => appLogger.error('DataService', 'Migration failed', e));

    registerServiceGroups({
        registerSystemServices: () => registerSystemServices(allowedFileRoots),
        registerDataServices,
        registerSecurityServices,
        registerLLMServices,
        registerWorkspaceServices,
        registerAnalysisServices,
        registerMcpServices,
        registerLazyServices,
        registerLazyProxies,
    });

    // Keep heavy services off the first interactive path; they are initialized after load.
    markDeferredStartupServices(container);

    // Start critical services in parallel using the updated Container.init()
    await container.init();
    
    // Resolve the now-ready AuthService and link it to SettingsService
    const authService = container.resolve<AuthService>('authService');
    const settingsService = container.resolve<SettingsService>('settingsService');
    
    // Update settings service with auth dependency now that it's ready
    settingsService.setAuthService(authService);
    await settingsService.initialize(); // Re-run to sync tokens

    await container.resolve<JobSchedulerService>('jobSchedulerService').start();

    // 5. Build Services Map
    const ollamaHealthService = container.resolve<OllamaHealthService>('ollamaHealthService');
    const extensionService = container.resolve<ExtensionService>('extensionService');
    const services = buildServicesMap(dataService, settingsService, ollamaHealthService, extensionService);

    // 6. Post-Map Setup
    dataService.setTelemetryService(services.telemetryService);
    startCriticalHealthChecks({
        databaseService: services.databaseService,
        networkService: services.networkService,
    });

    return services;
}

function registerSystemServices(allowedFileRoots: Set<string>) {
    container.register('securityService', ds => new SecurityService(ds as DataService), [
        'dataService',
    ]);
    container.register('commandService', () => new CommandService());
    container.register('systemService', () => new SystemService());

    container.register('networkService', () => new NetworkService());
    container.register('eventBusService', () => new EventBusService());
    container.register('auditLogService', () => new AuditLogService());
    // Runtime services are now part of the minimal set
    container.register('utilityProcessService', () => new UtilityProcessService());

    container.register(
        'chatSessionRegistryService',
        (ebs, modules) =>
            new ChatSessionRegistryService(
                ebs as EventBusService,
                modules as SessionModuleRegistryService
            ),
        ['eventBusService', 'sessionModuleRegistryService']
    );
    container.register(
        'sessionDirectoryService',
        chatRegistry => {
            const directory = new SessionDirectoryService();
            directory.registerRegistry(
                'chat',
                chatRegistry as ChatSessionRegistryService
            );
            return directory;
        },
        ['chatSessionRegistryService']
    );
    container.register('gitService', () => new GitService());
    container.register('lspService', () => new LspService());
    container.register('processService', () => new ProcessService());
    container.register('processManagerService', () => new ProcessManagerService());
    container.register('webService', () => {
        const ws = new WebService();
        if (process.env['TAVILY_API_KEY']) {
            ws.setTavilyKey(process.env['TAVILY_API_KEY']);
        }
        return ws;
    });
    // updateService is now lazy-loaded
    container.register('configService', ss => new ConfigService(ss as SettingsService), [
        'settingsService',
    ]);

    container.register(
        'fileSystemService',
        fct => new FileSystemService(Array.from(allowedFileRoots), fct as FileChangeTracker),
        ['fileChangeTracker']
    );
    container.register('httpService', () => new HttpService());
    // Theme service
    container.register('themeService', ds => new ThemeService(ds as DataService), ['dataService']);

    // Health Check Service
    container.register('healthCheckService', () => getHealthCheckService());

    // Ollama Health Service
    container.register(
        'ollamaHealthService',
        ss => {
            const settings = (ss as SettingsService).getSettings();
            const ollamaSettings = settings['ollama'] as JsonObject | undefined;
            const ollamaUrl =
                (ollamaSettings?.['url'] as string | undefined) ?? 'http://localhost:11434';
            return getOllamaHealthService(ollamaUrl);
        },
        ['settingsService']
    );

    container.register(
        'powerManagerService',
        (ss, eb) => new PowerManagerService(ss as SettingsService, eb as EventBusService),
        ['settingsService', 'eventBusService']
    );

    // Marketplace Service
    container.register(
        'marketplaceService',
        (...args: RuntimeValue[]) => {
            const [
                ls, mds, hfs, os, ss, ps, lls, exts, settings, mcp
            ] = args as [
                LocaleService, ModelDownloaderService, HuggingFaceService,
                OllamaService, SystemService, PerformanceService,
                LlamaService, ExtensionService, SettingsService, McpPluginService
            ];
            return new MarketplaceService({
                localeService: ls,
                modelDownloaderService: mds,
                huggingFaceService: hfs,
                ollamaService: os,
                systemService: ss,
                performanceService: ps,
                llamaService: lls,
                extensionService: exts,
                settingsService: settings,
                mcpPluginService: mcp
            });
        },
        ['localeService', 'modelDownloaderService', 'huggingFaceService', 'ollamaService', 'systemService', 'performanceService', 'llamaService', 'extensionService', 'settingsService', 'mcpPluginService']
    );

    container.register(
        'socialMediaService',
        (ss, ls, eb, ams) => new SocialMediaService(
            ss as SettingsService,
            ls as LLMService,
            eb as EventBusService,
            ams as AdvancedMemoryService
        ),
        ['settingsService', 'llmService', 'eventBusService', 'advancedMemoryService']
    );

    container.register(
        'cronSchedulerService',
        (ss, eb) => new CronSchedulerService(ss as SettingsService, eb as EventBusService),
        ['settingsService', 'eventBusService']
    );

    container.register(
        'notificationDispatcherService',
        (sm, eb) => new NotificationDispatcherService(sm as SocialMediaService, eb as EventBusService),
        ['socialMediaService', 'eventBusService']
    );

    container.register('localeService', ds => new LocaleService(ds as DataService), [
        'dataService',
    ]);
    container.register('codeLanguageService', ds => new CodeLanguageService(ds as DataService), [
        'dataService',
    ]);
    container.register('extensionService', ss => new ExtensionService(ss as SettingsService), [
        'settingsService',
    ]);
}

function registerDataServices() {
    container.register(
        'databaseClientService',
        (ebs, pm, ds) => new DatabaseClientService(ebs as EventBusService, pm as ProcessManagerService, ds as DataService),
        ['eventBusService', 'processManagerService', 'dataService']
    );
    container.register(
        'databaseService',
        (ds, ebs, dbcs) =>
            new DatabaseService(
                ds as DataService,
                ebs as EventBusService,
                dbcs as DatabaseClientService
            ),
        ['dataService', 'eventBusService', 'databaseClientService']
    );
    container.register(
        'fileChangeTracker',
        (dbs, ebs) => new FileChangeTracker(dbs as DatabaseService, ebs as EventBusService),
        ['databaseService', 'eventBusService']
    );
    container.register('chatEventService', dbs => new ChatEventService(dbs as DatabaseService), [
        'databaseService',
    ]);
    container.register('fileManagementService', () => new FileManagementService());
    container.register(
        'imagePersistenceService',
        (ds, dbs) => new ImagePersistenceService(ds as DataService, dbs as DatabaseService),
        ['dataService', 'databaseService']
    );

    container.register(
        'cacheService',
        (dbs, ebs) => new CacheService(dbs as DatabaseService, ebs as EventBusService),
        ['databaseService', 'eventBusService']
    );

    container.register(
        'jobSchedulerService',
        (dbs, ebs) => new JobSchedulerService(dbs as DatabaseService, ebs as EventBusService),
        ['databaseService', 'eventBusService']
    );
}

function registerSecurityServices() {
    container.register(
        'authService',
        (dbs, ss, ebs) => new AuthService(dbs as DatabaseService, ss as SecurityService, ebs as EventBusService),
        ['databaseService', 'securityService', 'eventBusService']
    );
    container.register('authAPIService', as => new AuthAPIService(as as AuthService), [
        'authService',
    ]);
    container.register('keyRotationService', ss => new KeyRotationService(ss as SettingsService), [
        'settingsService',
    ]);
    container.register(
        'copilotService',
        () => new CopilotService()
    );

    // Token Service Bundle
    container.register(
        'tokenDepsBase',
        (dbs, as, ebs) => ({
            dbs: dbs as DatabaseService,
            as: as as AuthService,
            ebs: ebs as EventBusService,
        }),
        ['databaseService', 'authService', 'eventBusService']
    );
    container.register(
        'tokenService',
        (base, js, ss) => {
            const d = base as {
                dbs: DatabaseService;
                as: AuthService;
                ebs: EventBusService;
            };
            return new TokenService(d.dbs, d.as, d.ebs, {
                jobScheduler: js as JobSchedulerService,
                getTokenRefreshIntervals: () => {
                    const settings = (ss as SettingsService).getSettings();
                    return {
                        tokenRefreshInterval: settings.ai?.tokenRefreshInterval,
                        copilotRefreshInterval: settings.ai?.copilotRefreshInterval,
                    };
                },
            });
        },
        ['tokenDepsBase', 'jobSchedulerService', 'settingsService']
    ); 
}

function registerLLMServices() {
    container.register(
        'settingsService',
        (ds, as) => new SettingsService(ds as DataService, as as AuthService),
        ['dataService', 'authService']
    );
    container.register('localAIService', ss => new LocalAIService(ss as SettingsService), [
        'settingsService',
    ]);
    container.register(
        'llamaService',
        (ds, rbs) => new LlamaService(ds as DataService, rbs as RuntimeBootstrapService),
        ['dataService', 'runtimeBootstrapService']
    );
    container.register('ollamaService', (ss, ebs) => new OllamaService(ss as SettingsService, ebs as EventBusService), [
        'settingsService',
        'eventBusService',
    ]);
    container.register('modelFallbackService', () => modelFallbackService);
    container.register('responseCacheService', () => new ResponseCacheService());

    container.register(
        'llmService',
        (...args: RuntimeValue[]) =>
            new LLMService({
                httpService: args[0] as HttpService,
                configService: args[1] as ConfigService,
                keyRotationService: args[2] as KeyRotationService,
                settingsService: args[3] as SettingsService,
                authService: args[4] as AuthService,
                proxyService: args[5] as ProxyService,
                tokenService: args[6] as TokenService,
                huggingFaceService: args[7] as HuggingFaceService,
                fallbackService: args[8] as ModelFallbackService,
                cacheService: args[9] as ResponseCacheService,
                llamaService: args[10] as LlamaService
            }),
        [
            'httpService',
            'configService',
            'keyRotationService',
            'settingsService',
            'authService',
            'proxyService',
            'tokenService',
            'huggingFaceService',
            'modelFallbackService',
            'responseCacheService',
            'llamaService'
        ]
    );
    container.register(
        'embeddingService',
        (os, ls, lms, ss) =>
            new EmbeddingService(
                os as OllamaService,
                ls as LLMService,
                lms as LlamaService,
                ss as SettingsService
            ),
        ['ollamaService', 'llmService', 'llamaService', 'settingsService']
    );
    container.register('agentService', dbs => new AgentService(dbs as DatabaseService), [
        'databaseService',
    ]);
    container.register(
        'modelCollaborationService',
        (ls, ams) => new ModelCollaborationService(
            ls as LLMService,
            ams as AdvancedMemoryService
        ),
        ['llmService', 'advancedMemoryService']
    );
    container.register('multiLLMOrchestrator', () => new MultiLLMOrchestrator());
    container.register(
        'multiModelComparisonService',
        (ls, mo, ams) => new MultiModelComparisonService(
            ls as LLMService,
            mo as MultiLLMOrchestrator,
            ams as AdvancedMemoryService
        ),
        ['llmService', 'multiLLMOrchestrator', 'advancedMemoryService']
    );
    container.register(
        'promptTemplatesService',
        (ds, dbs) => new PromptTemplatesService(ds as DataService, dbs as DatabaseService),
        ['dataService', 'databaseService']
    );
    container.register(
        'huggingFaceService',
        hs => new HuggingFaceService(hs as HttpService),
        ['httpService']
    );
    container.register(
        'modelDownloaderService',
        (os, hs, ls) =>
            new ModelDownloaderService({
                ollamaService: os as OllamaService,
                huggingFaceService: hs as HuggingFaceService,
                llamaService: ls as LlamaService,
            }),
        ['ollamaService', 'huggingFaceService', 'llamaService']
    );
    container.register(
        'contextRetrievalService',
        (dbs, es) => new ContextRetrievalService(dbs as DatabaseService, es as EmbeddingService),
        ['databaseService', 'embeddingService']
    );
    container.register(
        'localImageService',
        (...args: RuntimeValue[]) => {
            const [ss, ebs, as, ls, ps, ams, ts] = args;
            return new LocalImageService({
                settingsService: ss as SettingsService,
                eventBusService: ebs as EventBusService,
                authService: as as AuthService,
                llmService: ls as LLMService,
                proxyService: ps as ProxyService,
                advancedMemoryService: ams as AdvancedMemoryService,
                telemetryService: ts as TelemetryService,
            });
        },
        ['settingsService', 'eventBusService', 'authService', 'llmService', 'proxyService', 'advancedMemoryService', 'telemetryService']
    );

    // Model Registry Bundle
    container.register(
        'modelRegistryDeps',
        hfs => ({
            processManager: container.resolve<ProcessManagerService>('processManagerService'),
            jobScheduler: container.resolve<JobSchedulerService>('jobSchedulerService'),
            settingsService: container.resolve<SettingsService>('settingsService'),
            proxyService: container.resolve<ProxyService>('proxyService'),
            eventBus: container.resolve<EventBusService>('eventBusService'),
            ollamaService: container.resolve<OllamaService>('ollamaService'),
            localImageService: container.resolve<LocalImageService>('localImageService'),
            huggingFaceService: hfs as HuggingFaceService
        }),
        ['huggingFaceService']
    );
    container.register(
        'modelRegistryService',
        (deps, as, ts) => {
            const d = deps as ModelRegistryDependencies;
            return new ModelRegistryService({
                ...d,
                authService: as as AuthService,
                tokenService: ts as TokenService,
            });
        },
        ['modelRegistryDeps', 'authService', 'tokenService']
    );
    container.register(
        'modelSelectionService',
        (as) => new ModelSelectionService({
            authService: as as AuthService,
            getModels: async () => container.resolve<ModelRegistryService>('modelRegistryService').getAllModels(),
        }),
        ['authService']
    );
    container.register(
        'backgroundModelResolver',
        (as) => new BackgroundModelResolver({
            authService: as as AuthService,
            getModels: async () => container.resolve<ModelRegistryService>('modelRegistryService').getAllModels(),
        }),
        ['authService']
    );
    container.register(
        'councilCapabilityService',
        (llm, proxy, mss) =>
            new CouncilCapabilityService({
                llm: llm as LLMService,
                proxy: proxy as ProxyService,
                modelSelectionService: mss as ModelSelectionService,
            }),
        ['llmService', 'proxyService', 'modelSelectionService']
    );
}

function registerLazyServices() {
    lazyServiceRegistry.register('workspaceService', async () => {
        const { WorkspaceService } = await import('@main/services/workspace/workspace.service');
        const lspService = container.resolve<LspService>('lspService');
        const ups = container.resolve<UtilityProcessService>('utilityProcessService');
        const cs = container.resolve<CacheService>('cacheService');
        const proxyService = container.resolve<ProxyService>('proxyService');
        return new WorkspaceService(lspService, ups, cs, proxyService);
    });

    lazyServiceRegistry.register('advancedMemoryService', async () => {
        const dbs = container.resolve<DatabaseService>('databaseService');
        const es = container.resolve<EmbeddingService>('embeddingService');
        const ls = container.resolve<LLMService>('llmService');
        const ss = container.resolve<SettingsService>('settingsService');
        const bmr = container.resolve<BackgroundModelResolver>('backgroundModelResolver');
        const { AdvancedMemoryService } = await import('@main/services/llm/advanced-memory.service');
        return new AdvancedMemoryService(dbs, es, ls, ss, bmr);
    });

    lazyServiceRegistry.register('memoryService', async () => {
        const ams = await lazyServiceRegistry.get<AdvancedMemoryService>('advancedMemoryService');
        const { MemoryService } = await import('@main/services/llm/memory.service');
        return new MemoryService(ams);
    });

    lazyServiceRegistry.register('brainService', async () => {
        const dbs = container.resolve<DatabaseService>('databaseService');
        const es = container.resolve<EmbeddingService>('embeddingService');
        const ls = container.resolve<LLMService>('llmService');
        const pm = container.resolve<ProcessManagerService>('processManagerService');
        const bmr = container.resolve<BackgroundModelResolver>('backgroundModelResolver');
        const { BrainService } = await import('@main/services/llm/brain.service');
        return new BrainService(dbs, es, ls, pm, bmr);
    });

    // Register services that are only needed conditionally
    lazyServiceRegistry.register('dockerService', async () => {
        const commandService = container.resolve<CommandService>('commandService');
        const sshService = await lazyServiceRegistry.get<SSHService>('sshService');
        const { DockerService } = await import('@main/services/workspace/docker.service');
        return new DockerService(commandService, sshService);
    });

    lazyServiceRegistry.register('sshService', async () => {
        const dataService = container.resolve<DataService>('dataService');
        const securityService = container.resolve<SecurityService>('securityService');
        const { SSHService } = await import('@main/services/workspace/ssh.service');
        return new SSHService(dataService.getPath('config'), securityService);
    });

    lazyServiceRegistry.register('logoService', async () => {
        const llmService = container.resolve<LLMService>('llmService');
        const workspaceService = container.resolve<WorkspaceService>('workspaceService');
        const localImageService = container.resolve<LocalImageService>('localImageService');
        const imagePersistenceService =
            container.resolve<ImagePersistenceService>('imagePersistenceService');
        const authService = container.resolve<AuthService>('authService');
        const proxyService = container.resolve<ProxyService>('proxyService');
        const advancedMemoryService = container.resolve<AdvancedMemoryService>('advancedMemoryService');
        const modelRegistryService = container.resolve<ModelRegistryService>('modelRegistryService');
        const { LogoService } = await import('@main/services/external/logo.service');
        return new LogoService({
            llmService,
            workspaceService: workspaceService,
            localImageService,
            imagePersistenceService,
            authService,
            proxyService,
            advancedMemoryService,
            modelRegistryService
        });
    });



    lazyServiceRegistry.register('updateService', async () => {
        const settingsService = container.resolve<SettingsService>('settingsService');
        const { UpdateService } = await import('@main/services/system/update.service');
        return new UpdateService(settingsService);
    });

    lazyServiceRegistry.register('mcpPluginService', async () => {
        const settingsService = container.resolve<SettingsService>('settingsService');
        const mcpDeps = container.resolve<McpDeps>('mcpDeps');
        const { McpPluginService } = await import('@main/services/mcp/mcp-plugin.service');
        return new McpPluginService(settingsService, mcpDeps);
    });

    lazyServiceRegistry.register('performanceService', async () => {
        const pm = container.resolve<PowerManagerService>('powerManagerService');
        const ebs = container.resolve<EventBusService>('eventBusService');
        const scheduler = container.resolve<JobSchedulerService>('jobSchedulerService');
        const { PerformanceService } = await import('@main/services/analysis/performance.service');
        return new PerformanceService(pm, ebs, scheduler);
    });

    lazyServiceRegistry.register('telemetryService', async () => {
        const ss = container.resolve<SettingsService>('settingsService');
        const pm = container.resolve<PowerManagerService>('powerManagerService');
        const ebs = container.resolve<EventBusService>('eventBusService');
        const scheduler = container.resolve<JobSchedulerService>('jobSchedulerService');
        const ups = container.resolve<UtilityProcessService>('utilityProcessService');
        const { TelemetryService } = await import('@main/services/analysis/telemetry.service');
        return new TelemetryService(ss, pm, ebs, scheduler, ups);
    });
}

function registerLazyProxies() {
    container.register('workspaceService', () => createLazyServiceProxy('workspaceService'), ['lspService', 'utilityProcessService', 'cacheService', 'proxyService']);
    container.register('advancedMemoryService', () => createLazyServiceProxy('advancedMemoryService'), ['databaseService', 'embeddingService', 'eventBusService', 'settingsService', 'authService']);
    container.register('memoryService', () => createLazyServiceProxy('memoryService'), ['databaseService', 'eventBusService', 'advancedMemoryService']);
    container.register('brainService', () => createLazyServiceProxy('brainService'), ['settingsService', 'llmService', 'eventBusService', 'advancedMemoryService']);

    container.register('dockerService', () =>
        createLazyServiceProxy<DockerService>('dockerService'),
        ['commandService', 'sshService']
    );
    container.register('sshService', () => createLazyServiceProxy<SSHService>('sshService'), ['dataService', 'securityService']);
    container.register('logoService', () => createLazyServiceProxy<LogoService>('logoService'), ['llmService', 'workspaceService', 'localImageService', 'imagePersistenceService', 'authService', 'proxyService', 'advancedMemoryService', 'modelRegistryService']);
    container.register('performanceService', () => createLazyServiceProxy<PerformanceService>('performanceService'), ['powerManagerService', 'eventBusService', 'jobSchedulerService']);
    container.register('telemetryService', () => createLazyServiceProxy<TelemetryService>('telemetryService'), ['settingsService', 'powerManagerService', 'eventBusService', 'jobSchedulerService', 'utilityProcessService']);

    container.register('updateService', () => createLazyServiceProxy<UpdateService>('updateService'), ['settingsService']);
    container.register('mcpPluginService', () => createLazyServiceProxy<McpPluginService>('mcpPluginService'), ['settingsService', 'mcpDeps']);
}

function registerWorkspaceServices() {
    container.register(
        'terminalService',
        (ebs, ss, as, ssh) => {
            const terminalService = new TerminalService(
                ebs as EventBusService, 
                ss as SettingsService,
                as as AuthService
            );
            // Register remote backends
            terminalService.addBackend(new SSHBackend(ssh as SSHService));
            terminalService.addBackend(new DockerBackend(as as AuthService));
            return terminalService;
        },
        ['eventBusService', 'settingsService', 'authService', 'sshService', 'dockerService']
    );
    container.register('terminalProfileService', () => new TerminalProfileService());
    container.register(
        'terminalSmartService',
        (ls, ts, ams) => new TerminalSmartService(
            ls as LLMService,
            ts as TerminalService,
            ams as AdvancedMemoryService
        ),
        ['llmService', 'terminalService', 'advancedMemoryService']
    );
    container.register('gitService', () => new GitService());
    // SSH and Docker services are now lazy-loaded
    container.register(
        'inlineSuggestionService',
        (ls, as, ams) =>
            new InlineSuggestionService({
                llmService: ls as LLMService,
                authService: as as AuthService,
                advancedMemoryService: ams as AdvancedMemoryService,
            }),
        ['llmService', 'authService', 'advancedMemoryService']
    );
    container.register(
        'codeIntelligenceService',
        (dbs, es) => new CodeIntelligenceService(dbs as DatabaseService, es as EmbeddingService),
        ['databaseService', 'embeddingService']
    );
    // Logo, scaffold, and market research services are lazy-loaded.

    container.register(
        'sessionModuleRegistryService',
        (ebs, council) =>
            new SessionModuleRegistryService(
                ebs as EventBusService,
                council as CouncilCapabilityService
            ),
        ['eventBusService', 'councilCapabilityService']
    );


    // Proxy Services
    container.register(
        'backgroundServiceService',
        () => new BackgroundServiceService()
    );

    container.register(
        'proxyProcessManager',
        (ss, as, dbs) => new ProxyProcessManager(ss as SettingsService, as as AuthService, dbs as DatabaseService),
        ['settingsService', 'authService', 'databaseService']
    );
    container.register(
        'proxyCore',
        (ss, ds, sec, as, ebs) => ({
            ss: ss as SettingsService,
            ds: ds as DataService,
            sec: sec as SecurityService,
            as: as as AuthService,
            ebs: ebs as EventBusService,
        }),
        ['settingsService', 'dataService', 'securityService', 'authService', 'eventBusService']
    );
    container.register(
        'proxyService',
        (core, ppm, dbs) => {
            const c = core as {
                ss: SettingsService;
                ds: DataService;
                sec: SecurityService;
                as: AuthService;
                ebs: EventBusService;
            };
            return new ProxyService({
                settingsService: c.ss,
                dataService: c.ds,
                securityService: c.sec,
                authService: c.as,
                eventBus: c.ebs,
                processManager: ppm as ProxyProcessManager,
                databaseService: dbs as DatabaseService,
            });
        },
        ['proxyCore', 'proxyProcessManager', 'databaseService']
    );
}

function registerAnalysisServices() {

    container.register('ruleService', dbs => new RuleService(dbs as DatabaseService), ['databaseService']);
    container.register('featureFlagService', ds => new FeatureFlagService(ds as DataService), ['dataService']);
    container.register('exportService', () => new ExportService());
}

function registerMcpServices() {
    container.register(
        'mcpDeps',
        (...args: RuntimeValue[]) => {
            const services = args as RuntimeValue[];
            return {
                web: services[0] as WebService,
                system: services[1] as SystemService,
                ssh: services[2] as SSHService,
                network: services[3] as NetworkService,
                git: services[4] as GitService,
                security: services[5] as SecurityService,
                settings: services[6] as SettingsService,
                filesystem: services[7] as FileSystemService,
                file: services[8] as FileManagementService,
                embedding: services[9] as EmbeddingService,
                docker: services[10] as DockerService,
                database: services[11] as DatabaseService,
                command: services[12] as CommandService,
                ollama: services[13] as OllamaService,
                advancedMemory: services[14] as AdvancedMemoryService,
                modelCollaboration: services[15] as ModelCollaborationService,

                workspace: services[16] as WorkspaceService,
                proxy: services[17] as ProxyService,
            };
        },
        [
            'webService',
            'systemService',
            'sshService',
            'networkService',
            'gitService',
            'securityService',
            'settingsService',
            'fileSystemService',
            'fileManagementService',
            'embeddingService',
            'dockerService',
            'databaseService',
            'commandService',
            'ollamaService',
            'advancedMemoryService',
            'modelCollaborationService',

            'workspaceService',
            'proxyService',
        ]
    );
}

function buildServicesMap(
    dataService: DataService,
    settingsService: SettingsService,
    ollamaHealthService: ReturnType<typeof getOllamaHealthService>,
    extensionService: ExtensionService
): Services {
    return {
        settingsService,
        dataService,
        ollamaHealthService,
        authService: container.resolve<AuthService>('authService'),
        authAPIService: container.resolve<AuthAPIService>('authAPIService'),
        localAIService: container.resolve<LocalAIService>('localAIService'),
        ollamaService: container.resolve<OllamaService>('ollamaService'),
        llmService: container.resolve<LLMService>('llmService'),
        fileSystemService: container.resolve<FileSystemService>('fileSystemService'),
        commandService: container.resolve<CommandService>('commandService'),
        databaseClientService: container.resolve<DatabaseClientService>('databaseClientService'),
        databaseService: container.resolve<DatabaseService>('databaseService'),
        fileChangeTracker: container.resolve<FileChangeTracker>('fileChangeTracker'),
        sshService: createLazyServiceDependency<SSHService>('sshService'),
        proxyService: container.resolve<ProxyService>('proxyService'),
        copilotService: container.resolve<CopilotService>('copilotService'),

        systemService: container.resolve<SystemService>('systemService'),
        networkService: container.resolve<NetworkService>('networkService'),
        gitService: container.resolve<GitService>('gitService'),
        securityService: container.resolve<SecurityService>('securityService'),
        utilityProcessService: container.resolve<UtilityProcessService>('utilityProcessService'),
        cacheService: container.resolve<CacheService>('cacheService'),
        codeLanguageService: container.resolve<CodeLanguageService>('codeLanguageService'),
        auditLogService: container.resolve<AuditLogService>('auditLogService'),
        embeddingService: container.resolve<EmbeddingService>('embeddingService'),
        dockerService: createLazyServiceDependency<DockerService>('dockerService'),

        llamaService: container.resolve<LlamaService>('llamaService'),
        huggingFaceService: container.resolve<HuggingFaceService>('huggingFaceService'),
        workspaceService: container.resolve<WorkspaceService>('workspaceService'),
        lspService: container.resolve<LspService>('lspService'),
        terminalService: container.resolve<TerminalService>('terminalService'),
        inlineSuggestionService: createDeferredContainerProxy<InlineSuggestionService>('inlineSuggestionService'),
        logoService: createLazyServiceDependency<LogoService>('logoService'),
        processService: container.resolve<ProcessService>('processService'),
        processManagerService: container.resolve<ProcessManagerService>('processManagerService'),
        codeIntelligenceService: createDeferredContainerProxy<CodeIntelligenceService>('codeIntelligenceService'),
        contextRetrievalService: createDeferredContainerProxy<ContextRetrievalService>('contextRetrievalService'),
        jobSchedulerService: container.resolve<JobSchedulerService>('jobSchedulerService'),
        webService: container.resolve<WebService>('webService'),
        memoryService: container.resolve<MemoryService>('memoryService'),
        advancedMemoryService: container.resolve<AdvancedMemoryService>('advancedMemoryService'),
        brainService: container.resolve<BrainService>('brainService'),
        ruleService: container.resolve<RuleService>('ruleService'),
        agentService: createDeferredContainerProxy<AgentService>('agentService'),
        updateService: container.resolve<UpdateService>('updateService'),

        healthCheckService: getHealthCheckService(),
        fileManagementService: container.resolve<FileManagementService>('fileManagementService'),
        featureFlagService: container.resolve<FeatureFlagService>('featureFlagService'),
        chatEventService: container.resolve<ChatEventService>('chatEventService'),
        chatSessionRegistryService:
            container.resolve<ChatSessionRegistryService>('chatSessionRegistryService'),
        sessionDirectoryService: container.resolve<SessionDirectoryService>(
            'sessionDirectoryService'
        ),
        sessionModuleRegistryService: container.resolve<SessionModuleRegistryService>(
            'sessionModuleRegistryService'
        ),
        telemetryService: createDeferredContainerProxy<TelemetryService>('telemetryService'),
        httpService: container.resolve<HttpService>('httpService'),
        configService: container.resolve<ConfigService>('configService'),
        keyRotationService: container.resolve<KeyRotationService>('keyRotationService'),
        tokenService: container.resolve<TokenService>('tokenService'),

        promptTemplatesService: createDeferredContainerProxy<PromptTemplatesService>('promptTemplatesService'),
        modelCollaborationService: createDeferredContainerProxy<ModelCollaborationService>('modelCollaborationService'),
        performanceService: createDeferredContainerProxy<PerformanceService>('performanceService'),
        multiModelComparisonService: createDeferredContainerProxy<MultiModelComparisonService>('multiModelComparisonService'),
        runtimeManifestService: container.resolve<RuntimeManifestService>(
            'runtimeManifestService'
        ),
        runtimeHealthService: container.resolve<RuntimeHealthService>('runtimeHealthService'),
        runtimeBootstrapService: container.resolve<RuntimeBootstrapService>(
            'runtimeBootstrapService'
        ),

        modelRegistryService: createDeferredContainerProxy<ModelRegistryService>('modelRegistryService'),
        eventBusService: container.resolve<EventBusService>('eventBusService'),
        powerManagerService: container.resolve<PowerManagerService>('powerManagerService'),
        exportService: createDeferredContainerProxy<ExportService>('exportService'),
        mcpPluginService: container.resolve<McpPluginService>('mcpPluginService'),
        localImageService: createDeferredContainerProxy<LocalImageService>('localImageService'),
        themeService: container.resolve<ThemeService>('themeService'),
        terminalProfileService: container.resolve<TerminalProfileService>('terminalProfileService'),
        terminalSmartService: container.resolve<TerminalSmartService>('terminalSmartService'),
        modelDownloaderService: container.resolve<ModelDownloaderService>('modelDownloaderService'),
        councilCapabilityService: container.resolve<CouncilCapabilityService>(
            'councilCapabilityService'
        ),
        marketplaceService: container.resolve<MarketplaceService>('marketplaceService'),
        socialMediaService: container.resolve<SocialMediaService>('socialMediaService'),
        cronSchedulerService: container.resolve<CronSchedulerService>('cronSchedulerService'),
        notificationDispatcherService: container.resolve<NotificationDispatcherService>('notificationDispatcherService'),
        localeService: container.resolve<LocaleService>('localeService'),
        extensionService,
        apiServerService: null as RuntimeValue as ApiServerService, // Will be created in main.ts after ToolExecutor
    };
}
