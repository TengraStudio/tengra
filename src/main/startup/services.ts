import { Container } from '@main/core/container'
import { appLogger } from '@main/logging/logger'
import { AuditLogService } from '@main/services/analysis/audit-log.service'
import { MonitoringService } from '@main/services/analysis/monitoring.service'
import { PageSpeedService } from '@main/services/analysis/pagespeed.service'
import { PerformanceService } from '@main/services/analysis/performance.service'
import { ScannerService } from '@main/services/analysis/scanner.service'
import { SentryService } from '@main/services/analysis/sentry.service'
import { TelemetryService } from '@main/services/analysis/telemetry.service'
import { UsageTrackingService } from '@main/services/analysis/usage-tracking.service'
import { BackupService } from '@main/services/data/backup.service'
import { ChatEventService } from '@main/services/data/chat-event.service'
import { DataService } from '@main/services/data/data.service'
import { DatabaseService } from '@main/services/data/database.service'
import { FileManagementService } from '@main/services/data/file.service'
import { FileSystemService } from '@main/services/data/filesystem.service'
import { ImagePersistenceService } from '@main/services/data/image-persistence.service'
import { CollaborationService } from '@main/services/external/collaboration.service'
import { ContentService } from '@main/services/external/content.service'
import { FeatureFlagService } from '@main/services/external/feature-flag.service'
import { HistoryImportService } from '@main/services/external/history-import.service'
import { HttpService } from '@main/services/external/http.service'
import { LogoService } from '@main/services/external/logo.service'
import { RuleService } from '@main/services/external/rule.service'
import { UtilityService } from '@main/services/external/utility.service'
import { WebService } from '@main/services/external/web.service'
import { AgentService } from '@main/services/llm/agent.service'
import { AgentCouncilService } from '@main/services/llm/agent-council.service'
import { ContextRetrievalService } from '@main/services/llm/context-retrieval.service'
import { CopilotService } from '@main/services/llm/copilot.service'
import { EmbeddingService } from '@main/services/llm/embedding.service'
import { HuggingFaceService } from '@main/services/llm/huggingface.service'
import { LlamaService } from '@main/services/llm/llama.service'
import { LLMService } from '@main/services/llm/llm.service'
import { LocalAIService } from '@main/services/llm/local-ai.service'
import { MemoryService } from '@main/services/llm/memory.service'
import { ModelCollaborationService } from '@main/services/llm/model-collaboration.service'
import { ModelRegistryService } from '@main/services/llm/model-registry.service'
import { MultiLLMOrchestrator } from '@main/services/llm/multi-llm-orchestrator.service'
import { MultiModelComparisonService } from '@main/services/llm/multi-model-comparison.service'
import { OllamaService } from '@main/services/llm/ollama.service'
import { getOllamaHealthService } from '@main/services/llm/ollama-health.service'
import { PromptTemplatesService } from '@main/services/llm/prompt-templates.service'
import { CodeIntelligenceService } from '@main/services/project/code-intelligence.service'
import { DockerService } from '@main/services/project/docker.service'
import { GitService } from '@main/services/project/git.service'
import { ProjectService } from '@main/services/project/project.service'
import { SSHService } from '@main/services/project/ssh.service'
import { ProxyService } from '@main/services/proxy/proxy.service'
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service'
import { QuotaService } from '@main/services/proxy/quota.service'
import { AuthService } from '@main/services/security/auth.service'
import { KeyRotationService } from '@main/services/security/key-rotation.service'
import { RateLimitService } from '@main/services/security/rate-limit.service'
import { SecurityService } from '@main/services/security/security.service'
import { TokenService } from '@main/services/security/token.service'
import { CommandService } from '@main/services/system/command.service'
import { ConfigService } from '@main/services/system/config.service'
import { EventBusService } from '@main/services/system/event-bus.service'
import { getHealthCheckService, HealthCheckService } from '@main/services/system/health-check.service'
import { JobSchedulerService } from '@main/services/system/job-scheduler.service'
import { NetworkService } from '@main/services/system/network.service'
import { ProcessService } from '@main/services/system/process.service'
import { ProcessManagerService } from '@main/services/system/process-manager.service'
import { SettingsService } from '@main/services/system/settings.service'
import { SystemService } from '@main/services/system/system.service'
import { UpdateService } from '@main/services/system/update.service'
import { ClipboardService } from '@main/services/ui/clipboard.service'
import { NotificationService } from '@main/services/ui/notification.service'
import { ScreenshotService } from '@main/services/ui/screenshot.service'
import { Logger } from '@main/utils/logger'

// Export the container instance so it can be accessed if needed
export const container = new Container();

// Define Services interface
export interface Services {
    settingsService: SettingsService;
    authService: AuthService;
    localAIService: LocalAIService;
    ollamaService: OllamaService;
    llmService: LLMService;
    fileSystemService: FileSystemService;
    commandService: CommandService;
    databaseService: DatabaseService;
    sshService: SSHService;
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
    historyImportService: HistoryImportService;
    embeddingService: EmbeddingService;
    dockerService: DockerService;
    screenshotService: ScreenshotService;
    agentCouncilService: AgentCouncilService;
    ollamaHealthService: ReturnType<typeof getOllamaHealthService>;
    llamaService: LlamaService;
    huggingFaceService: HuggingFaceService;
    projectService: ProjectService;
    logoService: LogoService;
    processService: ProcessService;
    codeIntelligenceService: CodeIntelligenceService;
    contextRetrievalService: ContextRetrievalService;
    modelCollaborationService: ModelCollaborationService;
    jobSchedulerService: JobSchedulerService;
    webService: WebService;
    memoryService: MemoryService;
    pageSpeedService: PageSpeedService;
    ruleService: RuleService;
    agentService: AgentService;
    dataService: DataService;
    updateService: UpdateService;
    sentryService: SentryService;
    healthCheckService: HealthCheckService;
    scannerService: ScannerService;
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
}

export async function createServices(allowedFileRoots: Set<string>) {
    // 1. Data Service (Critical Intialization)
    container.register('dataService', () => new DataService());
    const dataService = container.resolve<DataService>('dataService');
    try {
        await dataService.migrate();
    } catch (error) {
        appLogger.error('Startup', `Failed to migrate data service: ${error}`);
    }

    // Initialize Logger
    Logger.init(dataService.getPath('logs'));

    // 2. Core Low-Level Services (No dependencies)
    container.register('securityService', () => new SecurityService());
    container.register('commandService', () => new CommandService());
    container.register('systemService', () => new SystemService());
    container.register('networkService', () => new NetworkService());
    container.register('eventBusService', () => new EventBusService());
    container.register('notificationService', () => new NotificationService());
    container.register('clipboardService', () => new ClipboardService());
    container.register('gitService', () => new GitService());
    container.register('contentService', () => new ContentService());
    container.register('monitoringService', () => new MonitoringService());
    container.register('screenshotService', () => new ScreenshotService());
    container.register('pageSpeedService', () => new PageSpeedService());
    container.register('ruleService', () => new RuleService());
    container.register('copilotService', (as, ns) => new CopilotService(as as AuthService, ns as NotificationService), ['authService', 'notificationService']);
    container.register('scannerService', () => new ScannerService());
    container.register('fileManagementService', () => new FileManagementService());
    container.register('huggingFaceService', () => new HuggingFaceService());
    container.register('projectService', () => new ProjectService());
    container.register('processService', () => new ProcessService());
    container.register('processManagerService', () => new ProcessManagerService());
    container.register('webService', () => new WebService());
    container.register('collaborationService', () => new CollaborationService());

    container.register('fileSystemService', () => new FileSystemService(Array.from(allowedFileRoots)));

    // 3. Services with Dependencies
    container.register('settingsService', (ds) => new SettingsService(ds as DataService), ['dataService']);
    container.register('authService', (dbs, ss) => new AuthService(dbs as DatabaseService, ss as SecurityService), ['databaseService', 'securityService']);
    container.register('localAIService', (ss) => new LocalAIService(ss as SettingsService), ['settingsService']);
    container.register('llamaService', (ds) => new LlamaService(ds as DataService), ['dataService']);
    container.register('ollamaService', (ss) => new OllamaService(ss as SettingsService), ['settingsService']);
    container.register('llmService', (hs, cs, krs, rls) => new LLMService(
        hs as HttpService,
        cs as ConfigService,
        krs as KeyRotationService,
        rls as RateLimitService
    ), ['httpService', 'configService', 'keyRotationService', 'rateLimitService']);
    // Database depends on Data
    container.register('databaseService', (ds) => new DatabaseService(ds as DataService), ['dataService']);
    // Initialize Database immediately as it is a core dependency for almost all other services
    const databaseService = container.resolve<DatabaseService>('databaseService');
    try {
        await databaseService.initialize();
        appLogger.info('Startup', 'DatabaseService initialized early');
    } catch (e) {
        appLogger.error('Startup', `CRITICAL: Failed to initialize DatabaseService: ${e}`);
        throw e;
    }

    container.register('chatEventService', (dbs) => new ChatEventService(dbs as DatabaseService), ['databaseService']);

    container.register('sshService', (ds) => new SSHService((ds as DataService).getPath('config')), ['dataService']);

    container.register('proxyProcessManager', (ss, ds, sec, as) => new ProxyProcessManager(ss as SettingsService, ds as DataService, sec as SecurityService, as as AuthService), ['settingsService', 'dataService', 'securityService', 'authService']);
    container.register('quotaService', (ss, as, pm) => new QuotaService(ss as SettingsService, as as AuthService, pm as ProcessManagerService), ['settingsService', 'authService', 'processManagerService']);

    // Proxy Service
    container.register('proxyService', (ss, ds, sec, ppm, qs, as) => new ProxyService(
        ss as SettingsService,
        ds as DataService,
        sec as SecurityService,
        ppm as ProxyProcessManager,
        qs as QuotaService,
        as as AuthService
    ), ['settingsService', 'dataService', 'securityService', 'proxyProcessManager', 'quotaService', 'authService']);

    container.register('historyImportService', (ps, dbs) => new HistoryImportService(ps as ProxyService, dbs as DatabaseService), ['proxyService', 'databaseService']);

    // Token Refresh Service
    container.register('tokenService', (ss, cs, as, pm, js) => new TokenService(
        ss as SettingsService,
        cs as CopilotService,
        as as AuthService,
        pm as ProcessManagerService,
        js as JobSchedulerService
    ), ['settingsService', 'copilotService', 'authService', 'processManagerService', 'jobSchedulerService']);

    // Complex Helpers
    container.register('embeddingService', (os, ls, lms, ss) => new EmbeddingService(
        os as OllamaService,
        ls as LLMService,
        lms as LlamaService,
        ss as SettingsService
    ), ['ollamaService', 'llmService', 'llamaService', 'settingsService']);

    container.register('utilityService', (dbs, scs, es) => new UtilityService(
        dbs as DatabaseService,
        scs as ScannerService,
        es as EmbeddingService
    ), ['databaseService', 'scannerService', 'embeddingService']);

    container.register('dockerService', (cs, ssh) => new DockerService(cs as CommandService, ssh as SSHService), ['commandService', 'sshService']);

    container.register('memoryService', (dbs, es, ls, pm) => new MemoryService(
        dbs as DatabaseService,
        es as EmbeddingService,
        ls as LLMService,
        pm as ProcessManagerService
    ), ['databaseService', 'embeddingService', 'llmService', 'processManagerService']);

    container.register('agentService', (dbs) => new AgentService(dbs as DatabaseService), ['databaseService']);

    container.register('updateService', (ss, ds) => new UpdateService(ss as SettingsService, ds as DataService), ['settingsService', 'dataService']);
    container.register('sentryService', (ss) => new SentryService(ss as SettingsService), ['settingsService']);
    container.register('featureFlagService', (ds) => new FeatureFlagService(ds as DataService), ['dataService']);
    container.register('telemetryService', (ss) => new TelemetryService(ss as SettingsService), ['settingsService']);
    container.register('httpService', () => new HttpService());
    container.register('configService', (ss) => new ConfigService(ss as SettingsService), ['settingsService']);
    container.register('keyRotationService', (ss) => new KeyRotationService(ss as SettingsService), ['settingsService']);
    container.register('rateLimitService', () => new RateLimitService());
    container.register('usageTrackingService', (dbs) => new UsageTrackingService(dbs as DatabaseService), ['databaseService'])
    container.register('auditLogService', (dbs) => new AuditLogService(dbs as DatabaseService), ['databaseService']);
    container.register('promptTemplatesService', (ds, dbs) => new PromptTemplatesService(ds as DataService, dbs as DatabaseService), ['dataService', 'databaseService']);
    container.register('modelCollaborationService', (ls) => new ModelCollaborationService(ls as LLMService), ['llmService']);
    container.register('performanceService', () => new PerformanceService());
    container.register('imagePersistenceService', (ds) => new ImagePersistenceService(ds as DataService), ['dataService']);
    container.register('multiLLMOrchestrator', () => new MultiLLMOrchestrator());
    container.register('backupService', (ds, dbs) => new BackupService(ds as DataService, dbs as DatabaseService), ['dataService', 'databaseService']);
    container.register('multiModelComparisonService', (ls, mo) => new MultiModelComparisonService(ls as LLMService, mo as MultiLLMOrchestrator), ['llmService', 'multiLLMOrchestrator']);

    // eslint-disable-next-line max-params
    container.register('modelRegistryService', (pm, js, ss, ps, ebs, as) => new ModelRegistryService(
        pm as ProcessManagerService,
        js as JobSchedulerService,
        ss as SettingsService,
        ps as ProxyService,
        ebs as EventBusService,
        as as AuthService
    ), ['processManagerService', 'jobSchedulerService', 'settingsService', 'proxyService', 'eventBusService', 'authService']);

    container.register('codeIntelligenceService', (dbs, es) => new CodeIntelligenceService(dbs as DatabaseService, es as EmbeddingService), ['databaseService', 'embeddingService']);
    container.register('contextRetrievalService', (dbs, es) => new ContextRetrievalService(dbs as DatabaseService, es as EmbeddingService), ['databaseService', 'embeddingService']);
    container.register('jobSchedulerService', (dbs) => new JobSchedulerService(dbs as DatabaseService), ['databaseService']);

    container.register('logoService', (ls, ps) => new LogoService(ls as LLMService, ps as ProjectService), ['llmService', 'projectService']);

    container.register('agentCouncilService', (ls, dbs, fss, ps, cis, ws, cos, es) => new AgentCouncilService(
        ls as LLMService,
        dbs as DatabaseService,
        fss as FileSystemService,
        ps as ProcessService,
        cis as CodeIntelligenceService,
        ws as WebService,
        cos as CollaborationService,
        es as EmbeddingService
    ), ['llmService', 'databaseService', 'fileSystemService', 'processService', 'codeIntelligenceService', 'webService', 'collaborationService', 'embeddingService']);

    // 4. Initialize Container (calls init on all LifecycleAware singletons)
    try {
        await container.init();
    } catch (e) {
        appLogger.error('Startup', `Container initialization failed partially: ${e}`);
    }

    // 5. Post-Init Setup
    const agentService = container.resolve<AgentService>('agentService');
    try {
        await agentService.init();
    } catch (error) {
        appLogger.error('Startup', `Failed to initialize AgentService: ${error}`);
    }

    // Start Ollama health monitoring
    const memoryService = container.resolve<MemoryService>('memoryService');
    try {
        await memoryService.initialize();
    } catch (error) {
        appLogger.warn('Startup', `Failed to initialize MemoryService: ${error}`);
    }

    const settingsService = container.resolve<SettingsService>('settingsService');
    let ollamaHealthService;
    try {
        ollamaHealthService = getOllamaHealthService(
            settingsService.getSettings()?.ollama?.url || 'http://127.0.0.1:11434'
        );
        ollamaHealthService.start();
    } catch (e) {
        appLogger.error('Startup', `Failed to start Ollama health service: ${e}`);
        // Fallback dummy if creation failed
        if (!ollamaHealthService) {
            ollamaHealthService = { start: () => { }, stop: () => { }, checkHealth: async () => ({ online: false }) } as any;
        }
    }

    // Health Check Service Setup
    const healthCheckService = getHealthCheckService();

    // 6. Return Map for IPC registration
    const services: Services = {
        settingsService,
        authService: container.resolve<AuthService>('authService'),
        localAIService: container.resolve<LocalAIService>('localAIService'),
        ollamaService: container.resolve<OllamaService>('ollamaService'),
        llmService: container.resolve<LLMService>('llmService'),
        fileSystemService: container.resolve<FileSystemService>('fileSystemService'),
        commandService: container.resolve<CommandService>('commandService'),
        databaseService: container.resolve<DatabaseService>('databaseService'),
        sshService: container.resolve<SSHService>('sshService'),
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
        historyImportService: container.resolve<HistoryImportService>('historyImportService'),
        embeddingService: container.resolve<EmbeddingService>('embeddingService'),
        utilityService: container.resolve<UtilityService>('utilityService'),
        dockerService: container.resolve<DockerService>('dockerService'),
        screenshotService: container.resolve<ScreenshotService>('screenshotService'),
        agentCouncilService: container.resolve<AgentCouncilService>('agentCouncilService'),
        ollamaHealthService,
        llamaService: container.resolve<LlamaService>('llamaService'),
        huggingFaceService: container.resolve<HuggingFaceService>('huggingFaceService'),
        projectService: container.resolve<ProjectService>('projectService'),
        logoService: container.resolve<LogoService>('logoService'),

        processService: container.resolve<ProcessService>('processService'),
        processManagerService: container.resolve<ProcessManagerService>('processManagerService'),
        codeIntelligenceService: container.resolve<CodeIntelligenceService>('codeIntelligenceService'),
        contextRetrievalService: container.resolve<ContextRetrievalService>('contextRetrievalService'),
        jobSchedulerService: container.resolve<JobSchedulerService>('jobSchedulerService'),
        webService: container.resolve<WebService>('webService'),
        memoryService: container.resolve<MemoryService>('memoryService'),
        pageSpeedService: container.resolve<PageSpeedService>('pageSpeedService'),
        ruleService: container.resolve<RuleService>('ruleService'),
        agentService,
        dataService,
        updateService: container.resolve<UpdateService>('updateService'),
        sentryService: container.resolve<SentryService>('sentryService'),
        healthCheckService,
        scannerService: container.resolve<ScannerService>('scannerService'),
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
        modelCollaborationService: container.resolve<ModelCollaborationService>('modelCollaborationService'),
        performanceService: container.resolve<PerformanceService>('performanceService'),
        multiModelComparisonService: container.resolve<MultiModelComparisonService>('multiModelComparisonService'),
        backupService: container.resolve<BackupService>('backupService'),
        modelRegistryService: container.resolve<ModelRegistryService>('modelRegistryService'),
        eventBusService: container.resolve<EventBusService>('eventBusService')
    };

    healthCheckService.registerCriticalChecks({
        databaseService: services.databaseService,
        networkService: services.networkService
    });
    healthCheckService.start();

    // Start token refresh service
    services.tokenService.start();

    // Initialize Model Registry (starts native service)
    try {
        await services.modelRegistryService.init();
    } catch (e) {
        appLogger.error('Startup', `Failed to initialize ModelRegistryService: ${e}`);
    }

    return services;
}
