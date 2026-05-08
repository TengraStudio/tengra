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
import { ChatEventService } from '@main/services/data/chat-event.service';
import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import { DatabaseClientService } from '@main/services/data/database-client.service';
import { FileManagementService } from '@main/services/data/file.service';
import { FileChangeTracker } from '@main/services/data/file-change-tracker.service';
import { FileSystemService } from '@main/services/data/filesystem.service';
import { GalleryService } from '@main/services/data/gallery.service';
import { ImagePersistenceService } from '@main/services/data/image-persistence.service';
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
    getOllamaHealthService,
    OllamaHealthService,
} from '@main/services/llm/local/ollama-health.service';
import { MemoryService } from '@main/services/llm/memory.service';
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
import { PromptTemplatesService } from '@main/services/llm/prompt-templates.service';
import { ResponseCacheService } from '@main/services/llm/response-cache.service';
import { McpPluginService } from '@main/services/mcp/mcp-plugin.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
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
import { BackgroundServiceService } from '@main/services/system/background-service.service';
import { CacheService } from '@main/services/system/cache.service';
import { CodeLanguageService } from '@main/services/system/code-language.service';
import { CommandService } from '@main/services/system/command.service';
import { ConfigService } from '@main/services/system/config.service';
import { DialogService } from '@main/services/system/dialog.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import {
    getHealthCheckService,
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
import { DockerBackend } from '@main/services/terminal/backends/docker.backend';
import { SSHBackend } from '@main/services/terminal/backends/ssh.backend';
import { TerminalProfileService } from '@main/services/terminal/terminal-profile.service';
import { ThemeService } from '@main/services/theme/theme.service';
import { getVoiceService,VoiceService } from '@main/services/ui/voice.service';
import { CodeIntelligenceService } from '@main/services/workspace/code-intelligence.service';
import { CodeSandboxService } from '@main/services/workspace/code-sandbox.service';
import { DockerService } from '@main/services/workspace/docker.service';
import { GitService } from '@main/services/workspace/git.service';
import { LspService } from '@main/services/workspace/lsp.service';
import { SSHService } from '@main/services/workspace/ssh.service';
import { TerminalService } from '@main/services/workspace/terminal.service';
import { TerminalSmartService } from '@main/services/workspace/terminal-smart.service';
import { WorkspaceService } from '@main/services/workspace/workspace.service';
import { WorkspaceAgentSessionService } from '@main/services/workspace/workspace-agent-session.service';
import {
    initDeferredServices,
    markDeferredStartupServices,
    registerServiceGroups,
    startCriticalHealthChecks,
} from '@main/startup/service-lifecycle';
import { IpcBatchService } from '@main/utils/ipc-batch.util';
import { JsonObject } from '@shared/types/common';
import { BrowserWindow } from 'electron';

// Export the container instance so it can be accessed if needed
export const container = new Container();

function createDeferredContainerProxy<T extends object>(serviceName: string, serviceClass?: any): T {
    let resolvedService: T | null = null;
    const getService = (): T => {
        if (!resolvedService) {
            resolvedService = container.resolve<T>(serviceName);
        }
        return resolvedService;
    };

    return new Proxy({} as T, {
        get(_target: T, prop: string | symbol): RuntimeValue {
            if (prop === 'constructor' && serviceClass) {
                return serviceClass;
            }
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
    terminalSmartService: TerminalSmartService;
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
    await initDeferredServices(container);
    
    // Link deferred services
    const authService = container.resolve<AuthService>('authService');
    const proxyService = container.resolve<ProxyService>('proxyService');
    authService.setProxyService(proxyService);

    const llamaService = container.resolve<LlamaService>('llamaService');
    const localImageService = container.resolve<LocalImageService>('localImageService');
    llamaService.setLocalImageService(localImageService);
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
    container.registerInstance('mainWindowProvider', getMainWindow);
    container.registerInstance('allowedFileRoots', allowedFileRoots);
    const dataService = container.resolve<DataService>('dataService');

    // Run migrations in background to not block critical path
    void dataService.migrate().catch(e => appLogger.error('DataService', 'Migration failed', e));

    registerServiceGroups({
        registerSystemServices: () => registerSystemServices(allowedFileRoots),
        registerDataServices: () => registerDataServices(getMainWindow),
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

    // Link proxy service to auth service (ProxyService is deferred, so we resolve it lazily when needed or now if we want to break cycles)
    // Note: Since ProxyService is deferred, we don't resolve it here to keep startup fast.
    // Instead, AuthService will check for it when needed, or we can set it here if we don't mind instantiating it.
    // However, ProxyService is also registered as a lazy proxy in some places.
    
    await container.resolve<JobSchedulerService>('jobSchedulerService').start();

    // 5. Build Services Map
    const ollamaHealthService = container.resolve<OllamaHealthService>('ollamaHealthService');
    const extensionService = container.resolve<ExtensionService>('extensionService');
    const services = buildServicesMap(dataService, settingsService, ollamaHealthService, extensionService);

    // 6. Post-Map Setup
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
    container.register('windowService', (mwp, ss) => new WindowService(mwp as () => BrowserWindow | null, allowedFileRoots, ss as SettingsService), ['mainWindowProvider', 'settingsService']);

    container.register('networkService', () => new NetworkService());
    container.register('eventBusService', () => new EventBusService());
    container.register('usageService', ss => new UsageService(ss as SettingsService), ['settingsService']);
    container.register('dialogService', mwp => new DialogService(mwp as () => BrowserWindow | null), ['mainWindowProvider']);
    container.register('loggingService', () => new LoggingService());
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
    container.register(
        'gitService',
        (ls, as) => new GitService(ls as LLMService, as as AuthService),
        ['llmService', 'authService']
    );
    container.register('lspService', (mwp, rbs) => new LspService(mwp as () => BrowserWindow | null, rbs as RuntimeBootstrapService), [
        'mainWindowProvider',
        'runtimeBootstrapService'
    ]);
    container.register('processService', mwp => new ProcessService(mwp as () => BrowserWindow | null), [
        'mainWindowProvider',
    ]);
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
        (fct, als) => new FileSystemService(allowedFileRoots, fct as FileChangeTracker, als as AuditLogService),
        ['fileChangeTracker', 'auditLogService']
    );
    container.register('httpService', () => new HttpService());
    // Theme service
    container.register('themeService', (ds, mwp) => new ThemeService(ds as DataService, mwp as () => BrowserWindow | null), ['dataService', 'mainWindowProvider']);

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
                ls, ts, cls, mds, hfs, os, ss, lls, exts, settings, mcp, mwp
            ] = args as [
                LocaleService, ThemeService, CodeLanguageService, ModelDownloaderService, HuggingFaceService,
                OllamaService, SystemService,
                LlamaService, ExtensionService, SettingsService, McpPluginService,
                () => BrowserWindow | null
            ];
            return new MarketplaceService({
                localeService: ls,
                themeService: ts,
                codeLanguageService: cls,
                modelDownloaderService: mds,
                huggingFaceService: hfs,
                ollamaService: os,
                systemService: ss,
                llamaService: lls,
                extensionService: exts,
                settingsService: settings,
                mcpPluginService: mcp
            }, mwp);
        },
        ['localeService', 'themeService', 'codeLanguageService', 'modelDownloaderService', 'huggingFaceService', 'ollamaService', 'systemService', 'llamaService', 'extensionService', 'settingsService', 'mcpPluginService', 'mainWindowProvider']
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

function registerDataServices(getMainWindow: () => BrowserWindow | null) {
    container.register(
        'databaseClientService',
        (ebs, pm, ds) => new DatabaseClientService(ebs as EventBusService, pm as ProcessManagerService, ds as DataService),
        ['eventBusService', 'processManagerService', 'dataService']
    );
    container.register(
        'databaseService',
        (ds, ebs, dbcs, afr) =>
            new DatabaseService(
                ds as DataService,
                ebs as EventBusService,
                dbcs as DatabaseClientService,
                getMainWindow,
                afr as Set<string>
            ),
        ['dataService', 'eventBusService', 'databaseClientService', 'allowedFileRoots']
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
        'galleryService',
        (dbs, ips) => new GalleryService(dbs as DatabaseService, ips as ImagePersistenceService),
        ['databaseService', 'imagePersistenceService']
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
        (dbs, ss, ebs, cs, mwp) => new AuthService(
            dbs as DatabaseService,
            ss as SecurityService,
            ebs as EventBusService,
            cs as CopilotService,
            mwp as () => BrowserWindow | null
        ),
        ['databaseService', 'securityService', 'eventBusService', 'copilotService', 'mainWindowProvider']
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
        'llamaService',
        (ds, rbs, ss) => new LlamaService(
            ds as DataService,
            rbs as RuntimeBootstrapService,
            ss as SettingsService
        ),
        ['dataService', 'runtimeBootstrapService', 'settingsService']
    );
    container.register('ollamaService', (ss, ebs, as) => new OllamaService(
        ss as SettingsService,
        ebs as EventBusService,
        as as AuthService
    ), [
        'settingsService',
        'eventBusService',
        'authService'
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
        (hs, mwp) => new HuggingFaceService(hs as HttpService, mwp as () => BrowserWindow | null),
        ['httpService', 'mainWindowProvider']
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
            const [ss, ebs, as, ls, ps, ams] = args;
            return new LocalImageService({
                settingsService: ss as SettingsService,
                eventBusService: ebs as EventBusService,
                authService: as as AuthService,
                llmService: ls as LLMService,
                proxyService: ps as ProxyService,
                advancedMemoryService: ams as AdvancedMemoryService,
            });
        },
        ['settingsService', 'eventBusService', 'authService', 'llmService', 'proxyService', 'advancedMemoryService']
    );
    container.register(
        'imageStudioService',
        (ls, lis, mrs, ips) => new ImageStudioService(
            ls as LLMService,
            lis as LocalImageService,
            mrs as ModelRegistryService,
            ips as ImagePersistenceService
        ),
        ['llmService', 'localImageService', 'modelRegistryService', 'imagePersistenceService']
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
        (llm, proxy, mss, db) =>
            new CouncilCapabilityService({
                llm: llm as LLMService,
                proxy: proxy as ProxyService,
                modelSelectionService: mss as ModelSelectionService,
                databaseService: db as DatabaseService,
            }),
        ['llmService', 'proxyService', 'modelSelectionService', 'databaseService']
    );
    container.register(
        'sessionWorkspaceService',
        (db) => new SessionWorkspaceService(db as DatabaseService),
        ['databaseService']
    );
    container.register(
        'sessionConversationService',
        (settingsService, localeService, llmService, proxyService, codeIntelligenceService, contextRetrievalService, databaseService, chatSessionRegistryService) => new SessionConversationService({
            settingsService: settingsService as SettingsService,
            localeService: localeService as LocaleService,
            llmService: llmService as LLMService,
            proxyService: proxyService as ProxyService,
            codeIntelligenceService: codeIntelligenceService as CodeIntelligenceService,
            contextRetrievalService: contextRetrievalService as ContextRetrievalService,
            databaseService: databaseService as DatabaseService,
            chatSessionRegistryService: chatSessionRegistryService as ChatSessionRegistryService,
            advancedMemoryService: createDeferredContainerProxy<AdvancedMemoryService>('advancedMemoryService'),
            brainService: createDeferredContainerProxy<BrainService>('brainService'),
        }),
        ['settingsService', 'localeService', 'llmService', 'proxyService', 'codeIntelligenceService', 'contextRetrievalService', 'databaseService', 'chatSessionRegistryService']
    );
    container.register(
        'workspaceAgentSessionService',
        (databaseService, modelRegistryService) => new WorkspaceAgentSessionService({
            databaseService: databaseService as DatabaseService,
            modelRegistryService: modelRegistryService as ModelRegistryService,
            advancedMemoryService: createDeferredContainerProxy<AdvancedMemoryService>('advancedMemoryService')
        }),
        ['databaseService', 'modelRegistryService']
    );
}

function registerLazyServices() {
    lazyServiceRegistry.register('workspaceService', async () => {
        const { WorkspaceService } = await import('@main/services/workspace/workspace.service');
        const lspService = container.resolve<LspService>('lspService');
        const ups = container.resolve<UtilityProcessService>('utilityProcessService');
        const cs = container.resolve<CacheService>('cacheService');
        const proxyService = container.resolve<ProxyService>('proxyService');
        const dbs = container.resolve<DatabaseService>('databaseService');
        const cis = container.resolve<CodeIntelligenceService>('codeIntelligenceService');
        const jss = container.resolve<JobSchedulerService>('jobSchedulerService');
        const mwp = container.resolve<() => BrowserWindow | null>('mainWindowProvider');
        const afr = container.resolve<Set<string>>('allowedFileRoots');
        return new WorkspaceService(lspService, ups, cs, proxyService, dbs, cis, jss, mwp, afr);
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

    lazyServiceRegistry.register('codeSandboxService', async () => {
        const { CodeSandboxService } = await import('@main/services/workspace/code-sandbox.service');
        return new CodeSandboxService();
    });

    lazyServiceRegistry.register('sshService', async () => {
        const dataService = container.resolve<DataService>('dataService');
        const securityService = container.resolve<SecurityService>('securityService');
        const { SSHService } = await import('@main/services/workspace/ssh.service');
        const mainWindowProvider = container.resolve<() => BrowserWindow | null>('mainWindowProvider');
        const allowedFileRoots = container.resolve<Set<string>>('allowedFileRoots');
        return new SSHService(dataService.getPath('config'), securityService, mainWindowProvider, allowedFileRoots);
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
        const dialogService = container.resolve<DialogService>('dialogService');
        const { LogoService } = await import('@main/services/external/logo.service');
        return new LogoService({
            llmService,
            workspaceService: workspaceService,
            localImageService,
            imagePersistenceService,
            authService,
            proxyService,
            advancedMemoryService,
            modelRegistryService,
            dialogService,
            allowedFileRoots: container.resolve<Set<string>>('allowedFileRoots')
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
}

function registerLazyProxies() {
    container.register('workspaceService', () => createLazyServiceProxy<WorkspaceService>('workspaceService', WorkspaceService), ['lspService', 'utilityProcessService', 'cacheService', 'proxyService', 'databaseService', 'codeIntelligenceService', 'jobSchedulerService', 'mainWindowProvider', 'allowedFileRoots']);
    container.register('advancedMemoryService', () => createLazyServiceProxy<AdvancedMemoryService>('advancedMemoryService', AdvancedMemoryService), ['databaseService', 'embeddingService', 'eventBusService', 'settingsService', 'authService']);
    container.register('memoryService', () => createLazyServiceProxy<MemoryService>('memoryService', MemoryService), ['databaseService', 'eventBusService', 'advancedMemoryService']);
    container.register('brainService', () => createLazyServiceProxy<BrainService>('brainService', BrainService), ['settingsService', 'llmService', 'eventBusService', 'advancedMemoryService']);

    container.register('dockerService', () =>
        createLazyServiceProxy<DockerService>('dockerService', DockerService),
        ['commandService', 'sshService']
    );
    container.register('sshService', () => createLazyServiceProxy<SSHService>('sshService', SSHService), ['dataService', 'securityService', 'mainWindowProvider', 'allowedFileRoots']);
    container.register('codeSandboxService', () => createLazyServiceProxy<CodeSandboxService>('codeSandboxService', CodeSandboxService), []);
    container.register('logoService', () => createLazyServiceProxy<LogoService>('logoService', LogoService), ['llmService', 'workspaceService', 'localImageService', 'imagePersistenceService', 'authService', 'proxyService', 'advancedMemoryService', 'modelRegistryService', 'dialogService', 'allowedFileRoots']);

    container.register('updateService', () => createLazyServiceProxy<UpdateService>('updateService', UpdateService), ['settingsService']);
    container.register('mcpPluginService', () => createLazyServiceProxy<McpPluginService>('mcpPluginService', McpPluginService), ['settingsService', 'mcpDeps']);
}

function registerWorkspaceServices() {
    container.register(
        'terminalService',
        (ebs, ss, as, ssh) => {
            const mainWindowProvider = container.resolve<() => BrowserWindow | null>('mainWindowProvider');
            const terminalService = new TerminalService(
                ebs as EventBusService,
                ss as SettingsService,
                as as AuthService,
                mainWindowProvider
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
    container.register(
        'gitService',
        (ls, as) => new GitService(ls as LLMService, as as AuthService),
        ['llmService', 'authService']
    );
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
        (ss, as, dbs, ls) => new ProxyProcessManager(ss as SettingsService, as as AuthService, dbs as DatabaseService, ls as LoggingService),
        ['settingsService', 'authService', 'databaseService', 'loggingService']
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
    container.register('voiceService', () => getVoiceService());
    container.register('ipcBatchService', () => new IpcBatchService());
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
        usageService: container.resolve<UsageService>('usageService'),
        dialogService: container.resolve<DialogService>('dialogService'),
        loggingService: container.resolve<LoggingService>('loggingService'),
        toolsService: null as RuntimeValue as ToolsService, // Will be created in app.ts after ToolExecutor
        auditLogService: container.resolve<AuditLogService>('auditLogService'),
        embeddingService: container.resolve<EmbeddingService>('embeddingService'),
        dockerService: createLazyServiceDependency<DockerService>('dockerService'),

        llamaService: container.resolve<LlamaService>('llamaService'),
        huggingFaceService: container.resolve<HuggingFaceService>('huggingFaceService'),
        workspaceService: container.resolve<WorkspaceService>('workspaceService'),
        lspService: container.resolve<LspService>('lspService'),
        terminalService: container.resolve<TerminalService>('terminalService'),
        inlineSuggestionService: createDeferredContainerProxy<InlineSuggestionService>('inlineSuggestionService', InlineSuggestionService),
        logoService: createLazyServiceDependency<LogoService>('logoService'),
        processService: container.resolve<ProcessService>('processService'),
        processManagerService: container.resolve<ProcessManagerService>('processManagerService'),
        codeIntelligenceService: createDeferredContainerProxy<CodeIntelligenceService>('codeIntelligenceService', CodeIntelligenceService),
        codeSandboxService: createLazyServiceDependency<CodeSandboxService>('codeSandboxService'),
        galleryService: container.resolve<GalleryService>('galleryService'),
        imageStudioService: container.resolve<ImageStudioService>('imageStudioService'),
        contextRetrievalService: createDeferredContainerProxy<ContextRetrievalService>('contextRetrievalService', ContextRetrievalService),
        jobSchedulerService: container.resolve<JobSchedulerService>('jobSchedulerService'),
        webService: container.resolve<WebService>('webService'),
        memoryService: container.resolve<MemoryService>('memoryService'),
        advancedMemoryService: container.resolve<AdvancedMemoryService>('advancedMemoryService'),
        brainService: container.resolve<BrainService>('brainService'),
        ruleService: container.resolve<RuleService>('ruleService'),
        agentService: createDeferredContainerProxy<AgentService>('agentService', AgentService),
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
        httpService: container.resolve<HttpService>('httpService'),
        configService: container.resolve<ConfigService>('configService'),
        keyRotationService: container.resolve<KeyRotationService>('keyRotationService'),
        tokenService: container.resolve<TokenService>('tokenService'),
        windowService: container.resolve<WindowService>('windowService'),

        promptTemplatesService: createDeferredContainerProxy<PromptTemplatesService>('promptTemplatesService', PromptTemplatesService),
        modelCollaborationService: createDeferredContainerProxy<ModelCollaborationService>('modelCollaborationService', ModelCollaborationService),
        multiModelComparisonService: createDeferredContainerProxy<MultiModelComparisonService>('multiModelComparisonService', MultiModelComparisonService),
        runtimeManifestService: container.resolve<RuntimeManifestService>(
            'runtimeManifestService'
        ),
        runtimeHealthService: container.resolve<RuntimeHealthService>('runtimeHealthService'),
        runtimeBootstrapService: container.resolve<RuntimeBootstrapService>(
            'runtimeBootstrapService'
        ),

        modelRegistryService: createDeferredContainerProxy<ModelRegistryService>('modelRegistryService', ModelRegistryService),
        eventBusService: container.resolve<EventBusService>('eventBusService'),
        powerManagerService: container.resolve<PowerManagerService>('powerManagerService'),
        exportService: createDeferredContainerProxy<ExportService>('exportService', ExportService),
        mcpPluginService: container.resolve<McpPluginService>('mcpPluginService'),
        localImageService: createDeferredContainerProxy<LocalImageService>('localImageService', LocalImageService),
        themeService: container.resolve<ThemeService>('themeService'),
        voiceService: container.resolve<VoiceService>('voiceService'),
        ipcBatchService: container.resolve<IpcBatchService>('ipcBatchService'),
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
        sessionConversationService: container.resolve<SessionConversationService>('sessionConversationService'),
        workspaceAgentSessionService: container.resolve<WorkspaceAgentSessionService>('workspaceAgentSessionService'),
        sessionWorkspaceService: container.resolve<SessionWorkspaceService>('sessionWorkspaceService'),
        apiServerService: null as RuntimeValue as ApiServerService, // Will be created in main.ts after ToolExecutor
    };
}

