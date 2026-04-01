import { ApiServerService } from '@main/api/api-server.service';
import { Container } from '@main/core/container';
import { createLazyServiceDependency, createLazyServiceProxy, type LazyServiceDependency, lazyServiceRegistry } from '@main/core/lazy-services';
import { McpDeps } from '@main/mcp/server-utils';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import type { PerformanceService } from '@main/services/analysis/performance.service';
import type { TelemetryService } from '@main/services/analysis/telemetry.service';
import type { BackupService } from '@main/services/data/backup.service';
import { ChatEventService } from '@main/services/data/chat-event.service';
import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import { DatabaseClientService } from '@main/services/data/database-client.service';
import { FileManagementService } from '@main/services/data/file.service';
import { FileChangeTracker } from '@main/services/data/file-change-tracker.service';
import { FileSystemService } from '@main/services/data/filesystem.service';
import { ImagePersistenceService } from '@main/services/data/image-persistence.service';
import { ExportService } from '@main/services/export/export.service';
import { FeatureFlagService } from '@main/services/external/feature-flag.service';
import { HttpService } from '@main/services/external/http.service';
import type { LogoService } from '@main/services/external/logo.service';
import { RuleService } from '@main/services/external/rule.service';
import { WebService } from '@main/services/external/web.service';
import type { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { AgentService } from '@main/services/llm/agent.service';
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
import { QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { AuthAPIService } from '@main/services/security/auth-api.service';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { RateLimitService } from '@main/services/security/rate-limit.service';
import { SecurityService } from '@main/services/security/security.service';
import { SecurityScanService } from '@main/services/security/security-scan.service';
import { TokenService } from '@main/services/security/token.service';
import { CouncilCapabilityService } from '@main/services/session/capabilities/council-capability.service';
import { ChatSessionRegistryService } from '@main/services/session/chat-session-registry.service';
import { SessionDirectoryService } from '@main/services/session/session-directory.service';
import { SessionModuleRegistryService } from '@main/services/session/session-module-registry.service';
import { CommandService } from '@main/services/system/command.service';
import { ConfigService } from '@main/services/system/config.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import {
    getHealthCheckService,
    HealthCheckService,
} from '@main/services/system/health-check.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { NetworkService } from '@main/services/system/network.service';
import { PowerManagerService } from '@main/services/system/power-manager.service';
import { ProcessService } from '@main/services/system/process.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
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
import { MarketplaceService } from '@main/services/external/marketplace.service';
import {
    bootstrapCoreData,
    initDeferredServices,
    initializeContainerSafely,
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
    authService: AuthService;
    authAPIService: AuthAPIService;
    localAIService: LocalAIService;
    ollamaService: OllamaService;
    llmService: LLMService;
    fileSystemService: FileSystemService;
    commandService: CommandService;
    databaseClientService: DatabaseClientService;
    databaseService: DatabaseService;
    sshService: LazyServiceDependency<SSHService>;
    proxyService: ProxyService;
    copilotService: CopilotService;

    systemService: SystemService;
    networkService: NetworkService;
    gitService: GitService;
    securityService: SecurityService;
    utilityProcessService: UtilityProcessService;

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
    dataService: DataService;
    updateService: UpdateService;

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
    rateLimitService: RateLimitService;
    tokenService: TokenService;
    securityScanService: SecurityScanService;
    auditLogService: AuditLogService;
    promptTemplatesService: PromptTemplatesService;
    performanceService: PerformanceService;
    multiModelComparisonService: MultiModelComparisonService;
    processManagerService: ProcessManagerService;
    runtimeManifestService: RuntimeManifestService;
    runtimeHealthService: RuntimeHealthService;
    runtimeBootstrapService: RuntimeBootstrapService;
    backupService: BackupService;
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
}

/**
 * Initialize deferred (non-critical) services. Call after main window is shown.
 */
export async function startDeferredServices(): Promise<void> {
    await initDeferredServices(container);
}

export async function createServices(allowedFileRoots: Set<string>): Promise<Services> {
    const dataService = await bootstrapCoreData(container);

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

    await initializeContainerSafely(container);
    await container.resolve<JobSchedulerService>('jobSchedulerService').start();

    // 4. Post-Init Setup
    const settingsService = container.resolve<SettingsService>('settingsService');
    const ollamaHealthService = container.resolve<OllamaHealthService>('ollamaHealthService');

    // 5. Build Services Map
    const services = buildServicesMap(dataService, settingsService, ollamaHealthService);

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
    container.register('runtimeManifestService', () => new RuntimeManifestService());
    container.register('runtimeHealthService', () => new RuntimeHealthService());
    container.register('utilityProcessService', () => new UtilityProcessService());
    container.register(
        'runtimeBootstrapService',
        (rms, rhs) =>
            new RuntimeBootstrapService(
                rms as RuntimeManifestService,
                rhs as RuntimeHealthService
            ),
        ['runtimeManifestService', 'runtimeHealthService']
    );
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
        'jobSchedulerService',
        (dbs, ebs) => new JobSchedulerService(dbs as DatabaseService, ebs as EventBusService),
        ['databaseService', 'eventBusService']
    );
    container.register(
        'fileSystemService',
        fct => new FileSystemService(Array.from(allowedFileRoots), fct as FileChangeTracker),
        ['fileChangeTracker']
    );
    container.register('httpService', () => new HttpService());
    container.register('rateLimitService', () => new RateLimitService());



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
    container.register('marketplaceService', () => new MarketplaceService());
}

function registerDataServices() {
    container.register(
        'databaseClientService',
        (ebs, pm) => new DatabaseClientService(ebs as EventBusService, pm as ProcessManagerService),
        ['eventBusService', 'processManagerService']
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
        (base, js) => {
            const d = base as {
                dbs: DatabaseService;
                as: AuthService;
                ebs: EventBusService;
            };
            return new TokenService(d.dbs, d.as, d.ebs, {
                jobScheduler: js as JobSchedulerService,
            });
        },
        ['tokenDepsBase', 'jobSchedulerService']
    );
    container.register(
        'securityScanService',
        (ebs, js) => new SecurityScanService(ebs as EventBusService, js as JobSchedulerService),
        ['eventBusService', 'jobSchedulerService']
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
        (ds, lis) => new LlamaService(ds as DataService, lis as LocalImageService),
        ['dataService', 'localImageService']
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
                rateLimitService: args[3] as RateLimitService,
                settingsService: args[4] as SettingsService,
                proxyService: args[5] as ProxyService,
                tokenService: args[6] as TokenService,
                huggingFaceService: args[7] as HuggingFaceService,
                fallbackService: args[8] as ModelFallbackService,
                cacheService: args[9] as ResponseCacheService
            }),
        [
            'httpService',
            'configService',
            'keyRotationService',
            'rateLimitService',
            'settingsService',
            'proxyService',
            'tokenService',
            'huggingFaceService',
            'modelFallbackService',
            'responseCacheService'
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
        ls => new ModelCollaborationService(ls as LLMService),
        ['llmService']
    );
    container.register('multiLLMOrchestrator', () => new MultiLLMOrchestrator());
    container.register(
        'multiModelComparisonService',
        (ls, mo) => new MultiModelComparisonService(ls as LLMService, mo as MultiLLMOrchestrator),
        ['llmService', 'multiLLMOrchestrator']
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
            const [ss, ebs, as, ls, qs, ts] = args;
            return new LocalImageService({
                settingsService: ss as SettingsService,
                eventBusService: ebs as EventBusService,
                authService: as as AuthService,
                llmService: ls as LLMService,
                quotaService: qs as QuotaService,
                telemetryService: ts as TelemetryService,
            });
        },
        ['settingsService', 'eventBusService', 'authService', 'llmService', 'quotaService', 'telemetryService']
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
        'councilCapabilityService',
        (llm, quota) =>
            new CouncilCapabilityService({
                llm: llm as LLMService,
                quota: quota as QuotaService,
            }),
        ['llmService', 'quotaService']
    );
}

function registerLazyServices() {
    lazyServiceRegistry.register('workspaceService', async () => {
        const { WorkspaceService } = await import('@main/services/workspace/workspace.service');
        const lspService = container.resolve<LspService>('lspService');
        return new WorkspaceService(lspService);
    });

    lazyServiceRegistry.register('advancedMemoryService', async () => {
        const dbs = container.resolve<DatabaseService>('databaseService');
        const es = container.resolve<EmbeddingService>('embeddingService');
        const ls = container.resolve<LLMService>('llmService');
        const ss = container.resolve<SettingsService>('settingsService');
        const { AdvancedMemoryService } = await import('@main/services/llm/advanced-memory.service');
        return new AdvancedMemoryService(dbs, es, ls, ss);
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
        const { BrainService } = await import('@main/services/llm/brain.service');
        return new BrainService(dbs, es, ls, pm);
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
        const quotaService = container.resolve<QuotaService>('quotaService');
        const modelRegistryService = container.resolve<ModelRegistryService>('modelRegistryService');
        const { LogoService } = await import('@main/services/external/logo.service');
        return new LogoService({
            llmService,
            workspaceService: workspaceService,
            localImageService,
            imagePersistenceService,
            authService,
            quotaService,
            modelRegistryService
        });
    });

    lazyServiceRegistry.register('backupService', async () => {
        const dataService = container.resolve<DataService>('dataService');
        const databaseService = container.resolve<DatabaseService>('databaseService');
        const scheduler = container.resolve<JobSchedulerService>('jobSchedulerService');
        const { BackupService } = await import('@main/services/data/backup.service');
        return new BackupService(dataService, databaseService, scheduler);
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
    container.register('workspaceService', () => createLazyServiceProxy('workspaceService'));
    container.register('advancedMemoryService', () => createLazyServiceProxy('advancedMemoryService'));
    container.register('memoryService', () => createLazyServiceProxy('memoryService'));
    container.register('brainService', () => createLazyServiceProxy('brainService'));

    container.register('dockerService', () =>
        createLazyServiceProxy<DockerService>('dockerService')
    );
    container.register('sshService', () => createLazyServiceProxy<SSHService>('sshService'));
    container.register('logoService', () => createLazyServiceProxy<LogoService>('logoService'));
    container.register('performanceService', () => createLazyServiceProxy<PerformanceService>('performanceService'));
    container.register('telemetryService', () => createLazyServiceProxy<TelemetryService>('telemetryService'));
    container.register('backupService', () => createLazyServiceProxy<BackupService>('backupService'));
    container.register('updateService', () => createLazyServiceProxy<UpdateService>('updateService'));
    container.register('mcpPluginService', () => createLazyServiceProxy<McpPluginService>('mcpPluginService'));
}

function registerWorkspaceServices() {
    container.register(
        'terminalService',
        (ebs, ss, ssh) => {
            const terminalService = new TerminalService(ebs as EventBusService, ss as SettingsService);
            // Register remote backends
            terminalService.addBackend(new SSHBackend(ssh as SSHService));
            terminalService.addBackend(new DockerBackend());
            return terminalService;
        },
        ['eventBusService', 'settingsService', 'sshService', 'dockerService']
    );
    container.register('terminalProfileService', () => new TerminalProfileService());
    container.register(
        'terminalSmartService',
        (ls, ts) => new TerminalSmartService(ls as LLMService, ts as TerminalService),
        ['llmService', 'terminalService']
    );
    container.register('gitService', () => new GitService());
    // SSH and Docker services are now lazy-loaded
    container.register(
        'inlineSuggestionService',
        (ls, as) =>
            new InlineSuggestionService({
                llmService: ls as LLMService,
                authService: as as AuthService,
            }),
        ['llmService', 'authService']
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
        'proxyProcessManager',
        (ss, as, dbs) => new ProxyProcessManager(ss as SettingsService, as as AuthService, dbs as DatabaseService),
        ['settingsService', 'authService', 'databaseService']
    );
    container.register(
        'quotaService',
        (ss, as) =>
            new QuotaService(
                ss as SettingsService,
                as as AuthService
            ),
        ['settingsService', 'authService']
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
        (core, ppm, qs, dbs) => {
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
                quotaService: qs as QuotaService,
                databaseService: dbs as DatabaseService,
            });
        },
        ['proxyCore', 'proxyProcessManager', 'quotaService', 'databaseService']
    );
}

function registerAnalysisServices() {
    container.register('auditLogService', (dbs, utilityProcessService) => new AuditLogService(dbs as DatabaseService, utilityProcessService as UtilityProcessService), ['databaseService', 'utilityProcessService']);
    container.register('ruleService', () => new RuleService());
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
                rateLimit: services[16] as RateLimitService,
                auditLog: services[17] as AuditLogService,
                workspace: services[18] as WorkspaceService,
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
            'rateLimitService',
            'auditLogService',
            'workspaceService',
        ]
    );
}

function buildServicesMap(
    dataService: DataService,
    settingsService: SettingsService,
    ollamaHealthService: ReturnType<typeof getOllamaHealthService>
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
        sshService: createLazyServiceDependency<SSHService>('sshService'),
        proxyService: container.resolve<ProxyService>('proxyService'),
        copilotService: container.resolve<CopilotService>('copilotService'),

        systemService: container.resolve<SystemService>('systemService'),
        networkService: container.resolve<NetworkService>('networkService'),
        gitService: container.resolve<GitService>('gitService'),
        securityService: container.resolve<SecurityService>('securityService'),
        utilityProcessService: container.resolve<UtilityProcessService>('utilityProcessService'),

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
        rateLimitService: container.resolve<RateLimitService>('rateLimitService'),
        tokenService: container.resolve<TokenService>('tokenService'),
        securityScanService: container.resolve<SecurityScanService>('securityScanService'),
        auditLogService: createDeferredContainerProxy<AuditLogService>('auditLogService'),
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
        backupService: createDeferredContainerProxy<BackupService>('backupService'),
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
        apiServerService: null as RuntimeValue as ApiServerService, // Will be created in main.ts after ToolExecutor
    };
}
