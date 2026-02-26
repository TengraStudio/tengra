import { ApiServerService } from '@main/api/api-server.service';
import { Container } from '@main/core/container';
import { createLazyServiceDependency, createLazyServiceProxy, type LazyServiceDependency, lazyServiceRegistry } from '@main/core/lazy-services';
import { McpDeps } from '@main/mcp/server-utils';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { MonitoringService } from '@main/services/analysis/monitoring.service';
import { PageSpeedService } from '@main/services/analysis/pagespeed.service';
import { PerformanceService } from '@main/services/analysis/performance.service';
import { ScannerService } from '@main/services/analysis/scanner.service';
import { SentryService } from '@main/services/analysis/sentry.service';
import { TelemetryService } from '@main/services/analysis/telemetry.service';
import { TimeTrackingService } from '@main/services/analysis/time-tracking.service';
import { UsageTrackingService } from '@main/services/analysis/usage-tracking.service';
import { BackupService } from '@main/services/data/backup.service';
import { ChatEventService } from '@main/services/data/chat-event.service';
import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import { DatabaseClientService } from '@main/services/data/database-client.service';
import { FileManagementService } from '@main/services/data/file.service';
import { FileChangeTracker } from '@main/services/data/file-change-tracker.service';
import { FileSystemService } from '@main/services/data/filesystem.service';
import { ImagePersistenceService } from '@main/services/data/image-persistence.service';
import { ExportService } from '@main/services/export/export.service';
import { CollaborationService } from '@main/services/external/collaboration.service';
import { ContentService } from '@main/services/external/content.service';
import { FeatureFlagService } from '@main/services/external/feature-flag.service';
import { HttpService } from '@main/services/external/http.service';
import { LogoService } from '@main/services/external/logo.service';
import { MarketResearchService } from '@main/services/external/market-research.service';
import { RuleService } from '@main/services/external/rule.service';
import { UtilityService } from '@main/services/external/utility.service';
import { WebService } from '@main/services/external/web.service';
import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { AgentService } from '@main/services/llm/agent.service';
import { BrainService } from '@main/services/llm/brain.service';
import { ContextRetrievalService } from '@main/services/llm/context-retrieval.service';
import { CopilotService } from '@main/services/llm/copilot.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { HuggingFaceService } from '@main/services/llm/huggingface.service';
import { IdeaGeneratorService } from '@main/services/llm/idea-generator.service';
import { LlamaService } from '@main/services/llm/llama.service';
import { LLMService } from '@main/services/llm/llm.service';
import { LocalAIService } from '@main/services/llm/local-ai.service';
import { LocalImageService } from '@main/services/llm/local-image.service';
import { MarketplaceService } from '@main/services/llm/marketplace.service';
import { MemoryService } from '@main/services/llm/memory.service';
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
import { McpMarketplaceService } from '@main/services/mcp/mcp-marketplace.service';
import { McpPluginService } from '@main/services/mcp/mcp-plugin.service';
import { AgentCheckpointService } from '@main/services/project/agent/agent-checkpoint.service';
import { AgentCollaborationService } from '@main/services/project/agent/agent-collaboration.service';
import { AgentPerformanceService } from '@main/services/project/agent/agent-performance.service';
import { AgentPersistenceService } from '@main/services/project/agent/agent-persistence.service';
import { AgentRegistryService } from '@main/services/project/agent/agent-registry.service';
import { AgentTemplateService } from '@main/services/project/agent/agent-template.service';
import { CodeIntelligenceService } from '@main/services/project/code-intelligence.service';
import { DockerService } from '@main/services/project/docker.service';
import { GitService } from '@main/services/project/git.service';
import { MultiAgentOrchestratorService } from '@main/services/project/orchestrator.service';
import { ProjectService } from '@main/services/project/project.service';
import { ProjectAgentService } from '@main/services/project/project-agent.service';
import { ProjectScaffoldService } from '@main/services/project/project-scaffold.service';
import { SSHService } from '@main/services/project/ssh.service';
import { TerminalService } from '@main/services/project/terminal.service';
import { TerminalSmartService } from '@main/services/project/terminal-smart.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { QuotaService } from '@main/services/proxy/quota.service';
import { AuthService } from '@main/services/security/auth.service';
import { AuthAPIService } from '@main/services/security/auth-api.service';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { RateLimitService } from '@main/services/security/rate-limit.service';
import { SecurityService } from '@main/services/security/security.service';
import { TokenService } from '@main/services/security/token.service';
import { CommandService } from '@main/services/system/command.service';
import { ConfigService } from '@main/services/system/config.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import {
    getHealthCheckService,
    HealthCheckService,
} from '@main/services/system/health-check.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { NetworkService } from '@main/services/system/network.service';
import { ProcessService } from '@main/services/system/process.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { SettingsService } from '@main/services/system/settings.service';
import { SystemService } from '@main/services/system/system.service';
import { UpdateService } from '@main/services/system/update.service';
import { DockerBackend } from '@main/services/terminal/backends/docker.backend';
import { SSHBackend } from '@main/services/terminal/backends/ssh.backend';
import { TerminalProfileService } from '@main/services/terminal/terminal-profile.service';
import { ThemeService } from '@main/services/theme/theme.service';
import { ClipboardService } from '@main/services/ui/clipboard.service';
import { NotificationService } from '@main/services/ui/notification.service';
import { ScreenshotService } from '@main/services/ui/screenshot.service';
import { WorkflowService } from '@main/services/workflow/workflow.service';
import {
    bootstrapCoreData,
    initializeContainerSafely,
    registerServiceGroups,
    startCriticalHealthChecks,
} from '@main/startup/service-lifecycle';
import { JsonObject } from '@shared/types/common';

// Export the container instance so it can be accessed if needed
export const container = new Container();

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
    notificationService: NotificationService;
    clipboardService: ClipboardService;
    gitService: GitService;
    securityService: SecurityService;
    contentService: ContentService;
    monitoringService: MonitoringService;

    embeddingService: EmbeddingService;
    dockerService: LazyServiceDependency<DockerService>;
    screenshotService: ScreenshotService;

    ollamaHealthService: ReturnType<typeof getOllamaHealthService>;
    llamaService: LlamaService;
    huggingFaceService: HuggingFaceService;
    projectService: ProjectService;
    terminalService: TerminalService;
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
    pageSpeedService: LazyServiceDependency<PageSpeedService>;
    localImageService: LocalImageService;
    ruleService: RuleService;
    agentService: AgentService;
    dataService: DataService;
    updateService: UpdateService;
    sentryService: SentryService;
    healthCheckService: HealthCheckService;
    scannerService: LazyServiceDependency<ScannerService>;
    fileManagementService: FileManagementService;
    featureFlagService: FeatureFlagService;
    chatEventService: ChatEventService;
    telemetryService: TelemetryService;
    httpService: HttpService;
    configService: ConfigService;
    keyRotationService: KeyRotationService;
    rateLimitService: RateLimitService;
    utilityService: UtilityService;
    tokenService: TokenService;
    usageTrackingService: UsageTrackingService;
    auditLogService: AuditLogService;
    promptTemplatesService: PromptTemplatesService;
    performanceService: PerformanceService;
    multiModelComparisonService: MultiModelComparisonService;
    processManagerService: ProcessManagerService;
    backupService: BackupService;
    modelRegistryService: ModelRegistryService;
    eventBusService: EventBusService;
    marketResearchService: MarketResearchService;
    projectScaffoldService: ProjectScaffoldService;
    ideaGeneratorService: IdeaGeneratorService;
    projectAgentService: ProjectAgentService;
    multiAgentOrchestratorService: MultiAgentOrchestratorService;
    agentRegistryService: AgentRegistryService;
    agentPersistenceService: AgentPersistenceService;
    agentCheckpointService: AgentCheckpointService;
    agentPerformanceService: AgentPerformanceService;
    exportService: ExportService;
    mcpPluginService: McpPluginService;
    mcpMarketplaceService: McpMarketplaceService;
    apiServerService: ApiServerService;
    timeTrackingService: TimeTrackingService;
    themeService: ThemeService;
    terminalProfileService: TerminalProfileService;
    terminalSmartService: TerminalSmartService;
    marketplaceService: LazyServiceDependency<MarketplaceService>;
    modelDownloaderService: ModelDownloaderService;
    workflowService: WorkflowService;
}

export async function createServices(allowedFileRoots: Set<string>): Promise<Services> {
    const dataService = await bootstrapCoreData(container);

    registerServiceGroups({
        registerSystemServices: () => registerSystemServices(allowedFileRoots),
        registerDataServices,
        registerSecurityServices,
        registerLLMServices,
        registerProjectServices,
        registerAnalysisServices,
        registerMcpServices,
        registerLazyServices,
        registerLazyProxies,
    });

    await initializeContainerSafely(container);

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
    container.register('notificationService', () => new NotificationService());
    container.register('clipboardService', () => new ClipboardService());
    container.register('gitService', () => new GitService());
    container.register('contentService', () => new ContentService());
    container.register('screenshotService', () => new ScreenshotService());
    container.register('processService', () => new ProcessService());
    container.register('processManagerService', () => new ProcessManagerService());
    container.register('webService', () => {
        const ws = new WebService();
        if (process.env['TAVILY_API_KEY']) {
            ws.setTavilyKey(process.env['TAVILY_API_KEY']);
        }
        return ws;
    });
    container.register(
        'updateService',
        (ss, ds) => new UpdateService(ss as SettingsService, ds as DataService),
        ['settingsService', 'dataService']
    );
    container.register('configService', ss => new ConfigService(ss as SettingsService), [
        'settingsService',
    ]);
    container.register(
        'jobSchedulerService',
        dbs => new JobSchedulerService(dbs as DatabaseService),
        ['databaseService']
    );
    container.register(
        'fileSystemService',
        fct => new FileSystemService(Array.from(allowedFileRoots), fct as FileChangeTracker),
        ['fileChangeTracker']
    );
    container.register('httpService', () => new HttpService());
    container.register('rateLimitService', () => new RateLimitService());
    container.register(
        'utilityService',
        (dbs, sec) => new UtilityService(dbs as DatabaseService, sec as SecurityService),
        ['databaseService', 'securityService']
    );


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

    // Time Tracking Service
    container.register(
        'timeTrackingService',
        dbcs => new TimeTrackingService(dbcs as DatabaseClientService),
        ['databaseClientService']
    );
}

function registerDataServices() {
    container.register(
        'databaseClientService',
        (ebs, pm) => new DatabaseClientService(ebs as EventBusService, pm as ProcessManagerService),
        ['eventBusService', 'processManagerService']
    );
    container.register(
        'databaseService',
        (ds, ebs, dbcs, tts) =>
            new DatabaseService(
                ds as DataService,
                ebs as EventBusService,
                dbcs as DatabaseClientService,
                tts as TimeTrackingService
            ),
        ['dataService', 'eventBusService', 'databaseClientService', 'timeTrackingService']
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
        'backupService',
        (ds, dbs) => new BackupService(ds as DataService, dbs as DatabaseService),
        ['dataService', 'databaseService']
    );
}

function registerSecurityServices() {
    container.register(
        'authService',
        (dbs, ss, ebs, ds) =>
            new AuthService(
                dbs as DatabaseService,
                ss as SecurityService,
                ebs as EventBusService,
                ds as DataService
            ),
        ['databaseService', 'securityService', 'eventBusService', 'dataService']
    );
    container.register('authAPIService', as => new AuthAPIService(as as AuthService), [
        'authService',
    ]);
    container.register('keyRotationService', ss => new KeyRotationService(ss as SettingsService), [
        'settingsService',
    ]);
    container.register(
        'copilotService',
        (as, ns) => new CopilotService(as as AuthService, ns as NotificationService),
        ['authService', 'notificationService']
    );

    // Token Service Bundle
    container.register(
        'tokenDepsBase',
        (ss, cs, as, ebs) => ({
            ss: ss as SettingsService,
            cs: cs as CopilotService,
            as: as as AuthService,
            ebs: ebs as EventBusService,
        }),
        ['settingsService', 'copilotService', 'authService', 'eventBusService']
    );
    container.register(
        'tokenService',
        (base, pm, js) => {
            const d = base as {
                ss: SettingsService;
                cs: CopilotService;
                as: AuthService;
                ebs: EventBusService;
            };
            return new TokenService(d.ss, d.cs, d.as, d.ebs, {
                processManager: pm as ProcessManagerService,
                jobScheduler: js as JobSchedulerService,
            });
        },
        ['tokenDepsBase', 'processManagerService', 'jobSchedulerService']
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
    container.register('ollamaService', ss => new OllamaService(ss as SettingsService), [
        'settingsService',
    ]);
    container.register('modelFallbackService', () => modelFallbackService);
    container.register('responseCacheService', () => new ResponseCacheService());

    container.register(
        'llmService',
        (...args: unknown[]) =>
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
    container.register(
        'advancedMemoryService',
        (dbs, es, ls) =>
            new AdvancedMemoryService(
                dbs as DatabaseService,
                es as EmbeddingService,
                ls as LLMService
            ),
        ['databaseService', 'embeddingService', 'llmService']
    );
    container.register('memoryService', ams => new MemoryService(ams as AdvancedMemoryService), [
        'advancedMemoryService',
    ]);
    container.register(
        'brainService',
        (dbs, es, ls, pm) =>
            new BrainService(
                dbs as DatabaseService,
                es as EmbeddingService,
                ls as LLMService,
                pm as ProcessManagerService
            ),
        ['databaseService', 'embeddingService', 'llmService', 'processManagerService']
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
        (...args: unknown[]) => {
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
}

function registerLazyServices() {
    // Register services that are only needed conditionally
    lazyServiceRegistry.register('dockerService', async () => {
        const commandService = container.resolve<CommandService>('commandService');
        const sshService = await lazyServiceRegistry.get<SSHService>('sshService');
        const { DockerService } = await import('@main/services/project/docker.service');
        return new DockerService(commandService, sshService);
    });

    lazyServiceRegistry.register('sshService', async () => {
        const dataService = container.resolve<DataService>('dataService');
        const securityService = container.resolve<SecurityService>('securityService');
        const { SSHService } = await import('@main/services/project/ssh.service');
        return new SSHService(dataService.getPath('config'), securityService);
    });

    lazyServiceRegistry.register('logoService', async () => {
        const llmService = container.resolve<LLMService>('llmService');
        const projectService = container.resolve<ProjectService>('projectService');
        const localImageService = container.resolve<LocalImageService>('localImageService');
        const imagePersistenceService =
            container.resolve<ImagePersistenceService>('imagePersistenceService');
        const authService = container.resolve<AuthService>('authService');
        const quotaService = container.resolve<QuotaService>('quotaService');
        const modelRegistryService = container.resolve<ModelRegistryService>('modelRegistryService');
        const { LogoService } = await import('@main/services/external/logo.service');
        return new LogoService({
            llmService,
            projectService,
            localImageService,
            imagePersistenceService,
            authService,
            quotaService,
            modelRegistryService
        });
    });

    lazyServiceRegistry.register('scannerService', async () => {
        const { ScannerService } = await import('@main/services/analysis/scanner.service');
        return new ScannerService();
    });

    lazyServiceRegistry.register('pageSpeedService', async () => {
        const { PageSpeedService } = await import('@main/services/analysis/pagespeed.service');
        return new PageSpeedService();
    });

    lazyServiceRegistry.register('marketplaceService', async () => {
        const databaseClient = container.resolve<DatabaseClientService>('databaseClientService');
        const jobScheduler = container.resolve<JobSchedulerService>('jobSchedulerService');
        const { MarketplaceService } = await import('@main/services/llm/marketplace.service');
        return new MarketplaceService({
            databaseClient,
            jobScheduler,
        });
    });
}

function registerLazyProxies() {
    container.register('dockerService', () =>
        createLazyServiceProxy<DockerService>('dockerService')
    );
    container.register('sshService', () => createLazyServiceProxy<SSHService>('sshService'));
    container.register('logoService', () => createLazyServiceProxy<LogoService>('logoService'));
    container.register('scannerService', () =>
        createLazyServiceProxy<ScannerService>('scannerService')
    );
    container.register('pageSpeedService', () =>
        createLazyServiceProxy<PageSpeedService>('pageSpeedService')
    );
    container.register('marketplaceService', () =>
        createLazyServiceProxy<MarketplaceService>('marketplaceService')
    );
}

function registerProjectServices() {
    container.register('projectService', () => new ProjectService());
    container.register(
        'terminalService',
        ss => {
            const terminalService = new TerminalService();
            // Register remote backends
            terminalService.addBackend(new SSHBackend(ss as SSHService));
            terminalService.addBackend(new DockerBackend());
            return terminalService;
        },
        ['sshService', 'dockerService']
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
        'codeIntelligenceService',
        (dbs, es) => new CodeIntelligenceService(dbs as DatabaseService, es as EmbeddingService),
        ['databaseService', 'embeddingService']
    );
    // Logo and Market Research services are now lazy-loaded
    container.register('projectScaffoldService', () => new ProjectScaffoldService());
    container.register('marketResearchService', ws => new MarketResearchService(ws as WebService), [
        'webService',
    ]);
    container.register(
        'ideaGeneratorService',
        (...deps) => {
            const [dbs, ls, mrs, pss, as, ebs, lis, bs] = deps;
            return new IdeaGeneratorService({
                databaseService: dbs as DatabaseService,
                llmService: ls as LLMService,
                marketResearchService: mrs as MarketResearchService,
                projectScaffoldService: pss as ProjectScaffoldService,
                authService: as as AuthService,
                eventBus: ebs as EventBusService,
                localImageService: lis as LocalImageService,
                brainService: bs as BrainService,
            });
        },
        [
            'databaseService',
            'llmService',
            'marketResearchService',
            'projectScaffoldService',
            'authService',
            'eventBusService',
            'localImageService',
            'brainService',
        ]
    );

    // Project Agent Service
    container.register(
        'agentRegistryService',
        dbs => new AgentRegistryService(dbs as DatabaseService),
        ['databaseService']
    );
    container.register(
        'agentPersistenceService',
        dbs => new AgentPersistenceService(dbs as DatabaseService),
        ['databaseService']
    );
    container.register(
        'agentCheckpointService',
        dbs => new AgentCheckpointService(dbs as DatabaseService),
        ['databaseService']
    );
    container.register(
        'agentCollaborationService',
        ls => new AgentCollaborationService({ llm: ls as LLMService }),
        ['llmService']
    );
    container.register(
        'agentTemplateService',
        dbs => new AgentTemplateService({ database: dbs as DatabaseService }),
        ['databaseService']
    );
    container.register(
        'agentPerformanceService',
        dbs => new AgentPerformanceService(dbs as DatabaseService),
        ['databaseService']
    );
    container.register(
        'projectAgentService',
        (...deps) => {
            const [dbs, ls, ebs, ars, acs, gs, col, tpl, perf] = deps;
            return new ProjectAgentService({
                databaseService: dbs as DatabaseService,
                llmService: ls as LLMService,
                eventBus: ebs as EventBusService,
                agentRegistryService: ars as AgentRegistryService,
                agentCheckpointService: acs as AgentCheckpointService,
                gitService: gs as GitService,
                agentCollaborationService: col as AgentCollaborationService,
                agentTemplateService: tpl as AgentTemplateService,
                agentPerformanceService: perf as AgentPerformanceService,
            });
        },
        [
            'databaseService',
            'llmService',
            'eventBusService',
            'agentRegistryService',
            'agentCheckpointService',
            'gitService',
            'agentCollaborationService',
            'agentTemplateService',
            'agentPerformanceService',
        ]
    );
    container.register(
        'multiAgentOrchestratorService',
        (dbs, ls, ebs, ars) =>
            new MultiAgentOrchestratorService(
                dbs as DatabaseService,
                ls as LLMService,
                ebs as EventBusService,
                ars as AgentRegistryService
            ),
        ['databaseService', 'llmService', 'eventBusService', 'agentRegistryService']
    );

    // Proxy Services
    container.register(
        'proxyProcessManager',
        (ss, ds, as, aapi) =>
            new ProxyProcessManager(
                ss as SettingsService,
                ds as DataService,
                as as AuthService,
                aapi as AuthAPIService
            ),
        ['settingsService', 'dataService', 'authService', 'authAPIService']
    );
    container.register(
        'quotaService',
        (ss, as, pm, ts) =>
            new QuotaService(
                ss as SettingsService,
                as as AuthService,
                pm as ProcessManagerService,
                ts as TokenService
            ),
        ['settingsService', 'authService', 'processManagerService', 'tokenService']
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
        (core, ppm, qs) => {
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
            });
        },
        ['proxyCore', 'proxyProcessManager', 'quotaService']
    );
}

function registerAnalysisServices() {
    container.register('monitoringService', () => new MonitoringService());
    // PageSpeed and Scanner services are now lazy-loaded
    container.register('sentryService', ss => new SentryService(ss as SettingsService), [
        'settingsService',
    ]);
    container.register('telemetryService', ss => new TelemetryService(ss as SettingsService), [
        'settingsService',
    ]);
    container.register(
        'usageTrackingService',
        dbs => new UsageTrackingService(dbs as DatabaseService),
        ['databaseService']
    );
    container.register('auditLogService', dbs => new AuditLogService(dbs as DatabaseService), [
        'databaseService',
    ]);
    container.register('performanceService', () => new PerformanceService());
    container.register('ruleService', () => new RuleService());
    container.register('featureFlagService', ds => new FeatureFlagService(ds as DataService), [
        'dataService',
    ]);
    container.register('collaborationService', () => new CollaborationService());
    container.register('exportService', () => new ExportService());
    container.register(
        'workflowService',
        (llmService, projectAgentService) =>
            new WorkflowService({
                llmService: llmService as LLMService,
                projectAgentService: projectAgentService as ProjectAgentService,
            }),
        ['llmService', 'projectAgentService']
    );
}

function registerMcpServices() {
    container.register(
        'mcpDeps',
        (...args: unknown[]) => {
            const services = args as unknown[];
            return {
                web: services[0] as WebService,
                utility: services[1] as UtilityService,
                system: services[2] as SystemService,
                ssh: services[3] as SSHService,
                screenshot: services[4] as ScreenshotService,
                scanner: services[5] as ScannerService,
                notification: services[6] as NotificationService,
                network: services[7] as NetworkService,
                monitoring: services[8] as MonitoringService,
                git: services[9] as GitService,
                security: services[10] as SecurityService,
                settings: services[11] as SettingsService,
                filesystem: services[12] as FileSystemService,
                file: services[13] as FileManagementService,
                embedding: services[14] as EmbeddingService,
                docker: services[15] as DockerService,
                database: services[16] as DatabaseService,
                content: services[17] as ContentService,
                command: services[18] as CommandService,
                clipboard: services[19] as ClipboardService,
                ollama: services[20] as OllamaService,
                advancedMemory: services[21] as AdvancedMemoryService,
                ideaGenerator: services[22] as IdeaGeneratorService,
                modelCollaboration: services[23] as ModelCollaborationService,
                rateLimit: services[24] as RateLimitService,
                auditLog: services[25] as AuditLogService,
            };
        },
        [
            'webService',
            'utilityService',
            'systemService',
            'sshService',
            'screenshotService',
            'scannerService',
            'notificationService',
            'networkService',
            'monitoringService',
            'gitService',
            'securityService',
            'settingsService',
            'fileSystemService',
            'fileManagementService',
            'embeddingService',
            'dockerService',
            'databaseService',
            'contentService',
            'commandService',
            'clipboardService',
            'ollamaService',
            'advancedMemoryService',
            'ideaGeneratorService',
            'modelCollaborationService',
            'rateLimitService',
            'auditLogService',
        ]
    );

    container.register(
        'mcpPluginService',
        (ss, deps) => new McpPluginService(ss as SettingsService, deps as McpDeps),
        ['settingsService', 'mcpDeps']
    );
    container.register('mcpMarketplaceService', () => new McpMarketplaceService());
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
        notificationService: container.resolve<NotificationService>('notificationService'),
        clipboardService: container.resolve<ClipboardService>('clipboardService'),
        gitService: container.resolve<GitService>('gitService'),
        securityService: container.resolve<SecurityService>('securityService'),
        contentService: container.resolve<ContentService>('contentService'),
        monitoringService: container.resolve<MonitoringService>('monitoringService'),

        embeddingService: container.resolve<EmbeddingService>('embeddingService'),
        utilityService: container.resolve<UtilityService>('utilityService'),
        dockerService: createLazyServiceDependency<DockerService>('dockerService'),
        screenshotService: container.resolve<ScreenshotService>('screenshotService'),

        llamaService: container.resolve<LlamaService>('llamaService'),
        huggingFaceService: container.resolve<HuggingFaceService>('huggingFaceService'),
        projectService: container.resolve<ProjectService>('projectService'),
        terminalService: container.resolve<TerminalService>('terminalService'),
        logoService: createLazyServiceDependency<LogoService>('logoService'),
        processService: container.resolve<ProcessService>('processService'),
        processManagerService: container.resolve<ProcessManagerService>('processManagerService'),
        codeIntelligenceService:
            container.resolve<CodeIntelligenceService>('codeIntelligenceService'),
        contextRetrievalService:
            container.resolve<ContextRetrievalService>('contextRetrievalService'),
        jobSchedulerService: container.resolve<JobSchedulerService>('jobSchedulerService'),
        webService: container.resolve<WebService>('webService'),
        memoryService: container.resolve<MemoryService>('memoryService'),
        advancedMemoryService: container.resolve<AdvancedMemoryService>('advancedMemoryService'),
        brainService: container.resolve<BrainService>('brainService'),
        pageSpeedService: createLazyServiceDependency<PageSpeedService>('pageSpeedService'),
        ruleService: container.resolve<RuleService>('ruleService'),
        agentService: container.resolve<AgentService>('agentService'),
        updateService: container.resolve<UpdateService>('updateService'),
        sentryService: container.resolve<SentryService>('sentryService'),
        healthCheckService: getHealthCheckService(),
        scannerService: createLazyServiceDependency<ScannerService>('scannerService'),
        fileManagementService: container.resolve<FileManagementService>('fileManagementService'),
        featureFlagService: container.resolve<FeatureFlagService>('featureFlagService'),
        chatEventService: container.resolve<ChatEventService>('chatEventService'),
        telemetryService: container.resolve<TelemetryService>('telemetryService'),
        httpService: container.resolve<HttpService>('httpService'),
        configService: container.resolve<ConfigService>('configService'),
        keyRotationService: container.resolve<KeyRotationService>('keyRotationService'),
        rateLimitService: container.resolve<RateLimitService>('rateLimitService'),
        tokenService: container.resolve<TokenService>('tokenService'),
        usageTrackingService: container.resolve<UsageTrackingService>('usageTrackingService'),
        auditLogService: container.resolve<AuditLogService>('auditLogService'),
        promptTemplatesService: container.resolve<PromptTemplatesService>('promptTemplatesService'),
        modelCollaborationService: container.resolve<ModelCollaborationService>(
            'modelCollaborationService'
        ),
        performanceService: container.resolve<PerformanceService>('performanceService'),
        multiModelComparisonService: container.resolve<MultiModelComparisonService>(
            'multiModelComparisonService'
        ),
        backupService: container.resolve<BackupService>('backupService'),
        modelRegistryService: container.resolve<ModelRegistryService>('modelRegistryService'),
        eventBusService: container.resolve<EventBusService>('eventBusService'),
        marketResearchService: container.resolve<MarketResearchService>('marketResearchService'),
        projectScaffoldService: container.resolve<ProjectScaffoldService>('projectScaffoldService'),
        ideaGeneratorService: container.resolve<IdeaGeneratorService>('ideaGeneratorService'),
        agentRegistryService: container.resolve<AgentRegistryService>('agentRegistryService'),
        agentPersistenceService:
            container.resolve<AgentPersistenceService>('agentPersistenceService'),
        agentCheckpointService: container.resolve<AgentCheckpointService>('agentCheckpointService'),
        agentPerformanceService:
            container.resolve<AgentPerformanceService>('agentPerformanceService'),
        projectAgentService: container.resolve<ProjectAgentService>('projectAgentService'),
        multiAgentOrchestratorService: container.resolve<MultiAgentOrchestratorService>(
            'multiAgentOrchestratorService'
        ),
        exportService: container.resolve<ExportService>('exportService'),
        mcpPluginService: container.resolve<McpPluginService>('mcpPluginService'),
        mcpMarketplaceService: container.resolve<McpMarketplaceService>('mcpMarketplaceService'),
        localImageService: container.resolve<LocalImageService>('localImageService'),
        timeTrackingService: container.resolve<TimeTrackingService>('timeTrackingService'),
        themeService: container.resolve<ThemeService>('themeService'),
        terminalProfileService: container.resolve<TerminalProfileService>('terminalProfileService'),
        terminalSmartService: container.resolve<TerminalSmartService>('terminalSmartService'),
        marketplaceService: createLazyServiceDependency<MarketplaceService>('marketplaceService'),
        modelDownloaderService: container.resolve<ModelDownloaderService>('modelDownloaderService'),
        workflowService: container.resolve<WorkflowService>('workflowService'),
        apiServerService: null as unknown as ApiServerService, // Will be created in main.ts after ToolExecutor
    };
}
