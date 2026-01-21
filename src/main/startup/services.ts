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
import { ModelRegistryDependencies, ModelRegistryService } from '@main/services/llm/model-registry.service'
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
import { AuthAPIService } from '@main/services/security/auth-api.service'
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
import { JsonObject } from '@shared/types/common'

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

export async function createServices(allowedFileRoots: Set<string>): Promise<Services> {
    // 1. Core Data & Logging
    container.register('dataService', () => new DataService());
    const dataService = container.resolve<DataService>('dataService');
    try {
        await dataService.migrate();
    } catch (error) {
        appLogger.error('Startup', `Failed to migrate data service: ${error}`);
    }

    Logger.init(dataService.getPath('logs'));

    // 2. Register Service Groups
    registerSystemServices(allowedFileRoots);
    registerDataServices();
    registerSecurityServices();
    registerLLMServices();
    registerProjectServices();
    registerAnalysisServices();

    // 3. Initialize Container (calls init on all LifecycleAware singletons)
    try {
        await container.init();
    } catch (e) {
        appLogger.error('Startup', `Container initialization failed partially: ${e}`);
    }

    // 4. Post-Init Setup
    const settingsService = container.resolve<SettingsService>('settingsService');
    const settings = settingsService.getSettings();
    const ollamaHealthService = initOllamaHealth(settings);

    // 5. Build Services Map
    const services = buildServicesMap(dataService, settingsService, ollamaHealthService);

    getHealthCheckService().registerCriticalChecks({
        databaseService: services.databaseService,
        networkService: services.networkService
    });
    getHealthCheckService().start();

    return services;
}

function registerSystemServices(allowedFileRoots: Set<string>) {
    container.register('securityService', (ds) => new SecurityService(ds as DataService), ['dataService']);
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
    container.register('webService', () => new WebService());
    container.register('updateService', (ss, ds) => new UpdateService(ss as SettingsService, ds as DataService), ['settingsService', 'dataService']);
    container.register('configService', (ss) => new ConfigService(ss as SettingsService), ['settingsService']);
    container.register('jobSchedulerService', (dbs) => new JobSchedulerService(dbs as DatabaseService), ['databaseService']);
    container.register('fileSystemService', () => new FileSystemService(Array.from(allowedFileRoots)));
    container.register('httpService', () => new HttpService());
    container.register('rateLimitService', () => new RateLimitService());
    container.register('utilityService', (dbs, scs, es) => new UtilityService(dbs as DatabaseService, scs as ScannerService, es as EmbeddingService), ['databaseService', 'scannerService', 'embeddingService']);
}

function registerDataServices() {
    container.register('databaseService', (ds, ebs) => new DatabaseService(ds as DataService, ebs as EventBusService), ['dataService', 'eventBusService']);
    container.register('chatEventService', (dbs) => new ChatEventService(dbs as DatabaseService), ['databaseService']);
    container.register('fileManagementService', () => new FileManagementService());
    container.register('imagePersistenceService', (ds) => new ImagePersistenceService(ds as DataService), ['dataService']);
    container.register('backupService', (ds, dbs) => new BackupService(ds as DataService, dbs as DatabaseService), ['dataService', 'databaseService']);
}

function registerSecurityServices() {
    container.register('authService', (dbs, ss) => new AuthService(dbs as DatabaseService, ss as SecurityService), ['databaseService', 'securityService']);
    container.register('authAPIService', (as) => new AuthAPIService(as as AuthService), ['authService']);
    container.register('keyRotationService', (ss) => new KeyRotationService(ss as SettingsService), ['settingsService']);
    container.register('copilotService', (as, ns) => new CopilotService(as as AuthService, ns as NotificationService), ['authService', 'notificationService']);

    // Token Service Bundle
    container.register('tokenDepsBase', (ss, cs, as, ebs) => ({
        ss: ss as SettingsService,
        cs: cs as CopilotService,
        as: as as AuthService,
        ebs: ebs as EventBusService
    }), ['settingsService', 'copilotService', 'authService', 'eventBusService']);
    container.register('tokenService', (base, pm, js) => {
        const d = base as { ss: SettingsService, cs: CopilotService, as: AuthService, ebs: EventBusService }
        return new TokenService(
            d.ss, d.cs, d.as, d.ebs,
            { processManager: pm as ProcessManagerService, jobScheduler: js as JobSchedulerService }
        )
    }, ['tokenDepsBase', 'processManagerService', 'jobSchedulerService']);
}

function registerLLMServices() {
    container.register('settingsService', (ds) => new SettingsService(ds as DataService), ['dataService']);
    container.register('localAIService', (ss) => new LocalAIService(ss as SettingsService), ['settingsService']);
    container.register('llamaService', (ds) => new LlamaService(ds as DataService), ['dataService']);
    container.register('ollamaService', (ss) => new OllamaService(ss as SettingsService), ['settingsService']);
    container.register('llmService', (hs, cs, krs, rls, ts) => new LLMService(hs as HttpService, cs as ConfigService, krs as KeyRotationService, rls as RateLimitService, ts as TokenService), ['httpService', 'configService', 'keyRotationService', 'rateLimitService', 'tokenService']);
    container.register('embeddingService', (os, ls, lms, ss) => new EmbeddingService(os as OllamaService, ls as LLMService, lms as LlamaService, ss as SettingsService), ['ollamaService', 'llmService', 'llamaService', 'settingsService']);
    container.register('memoryService', (dbs, es, ls, pm) => new MemoryService(dbs as DatabaseService, es as EmbeddingService, ls as LLMService, pm as ProcessManagerService), ['databaseService', 'embeddingService', 'llmService', 'processManagerService']);
    container.register('agentService', (dbs) => new AgentService(dbs as DatabaseService), ['databaseService']);
    container.register('modelCollaborationService', (ls) => new ModelCollaborationService(ls as LLMService), ['llmService']);
    container.register('multiLLMOrchestrator', () => new MultiLLMOrchestrator());
    container.register('multiModelComparisonService', (ls, mo) => new MultiModelComparisonService(ls as LLMService, mo as MultiLLMOrchestrator), ['llmService', 'multiLLMOrchestrator']);
    container.register('promptTemplatesService', (ds, dbs) => new PromptTemplatesService(ds as DataService, dbs as DatabaseService), ['dataService', 'databaseService']);
    container.register('huggingFaceService', () => new HuggingFaceService());
    container.register('contextRetrievalService', (dbs, es) => new ContextRetrievalService(dbs as DatabaseService, es as EmbeddingService), ['databaseService', 'embeddingService']);

    // Model Registry Bundle
    container.register('modelRegistryDeps', (pm, js, ss, ps, ebs) => ({
        processManager: pm as ProcessManagerService,
        jobScheduler: js as JobSchedulerService,
        settingsService: ss as SettingsService,
        proxyService: ps as ProxyService,
        eventBus: ebs as EventBusService
    }), ['processManagerService', 'jobSchedulerService', 'settingsService', 'proxyService', 'eventBusService']);
    container.register('modelRegistryService', (deps, as, ts) => {
        const d = deps as ModelRegistryDependencies
        return new ModelRegistryService({
            ...d,
            authService: as as AuthService,
            tokenService: ts as TokenService
        })
    }, ['modelRegistryDeps', 'authService', 'tokenService']);
}

function registerProjectServices() {
    container.register('projectService', () => new ProjectService());
    container.register('gitService', () => new GitService());
    container.register('sshService', (ds) => new SSHService((ds as DataService).getPath('config')), ['dataService']);
    container.register('dockerService', (cs, ssh) => new DockerService(cs as CommandService, ssh as SSHService), ['commandService', 'sshService']);
    container.register('codeIntelligenceService', (dbs, es) => new CodeIntelligenceService(dbs as DatabaseService, es as EmbeddingService), ['databaseService', 'embeddingService']);
    container.register('logoService', (ls, ps) => new LogoService(ls as LLMService, ps as ProjectService), ['llmService', 'projectService']);

    // Proxy Services
    container.register('proxyProcessManager', (ss, ds, sec, as, aapi) => new ProxyProcessManager(ss as SettingsService, ds as DataService, sec as SecurityService, as as AuthService, aapi as AuthAPIService), ['settingsService', 'dataService', 'securityService', 'authService', 'authAPIService']);
    container.register('quotaService', (ss, as, pm, ts, ds) => new QuotaService(ss as SettingsService, as as AuthService, pm as ProcessManagerService, ts as TokenService, ds as DataService), ['settingsService', 'authService', 'processManagerService', 'tokenService', 'dataService']);

    container.register('proxyCore', (ss, ds, sec, as, ebs) => ({
        ss: ss as SettingsService,
        ds: ds as DataService,
        sec: sec as SecurityService,
        as: as as AuthService,
        ebs: ebs as EventBusService
    }), ['settingsService', 'dataService', 'securityService', 'authService', 'eventBusService']);
    container.register('proxyService', (core, ppm, qs) => {
        const c = core as { ss: SettingsService, ds: DataService, sec: SecurityService, as: AuthService, ebs: EventBusService }
        return new ProxyService({
            settingsService: c.ss,
            dataService: c.ds,
            securityService: c.sec,
            authService: c.as,
            eventBus: c.ebs,
            processManager: ppm as ProxyProcessManager,
            quotaService: qs as QuotaService
        })
    }, ['proxyCore', 'proxyProcessManager', 'quotaService']);

    container.register('historyImportService', (ps, dbs) => new HistoryImportService(ps as ProxyService, dbs as DatabaseService), ['proxyService', 'databaseService']);

    // Agent Council Bundle
    container.register('councilDeps1', (ls, dbs, fss, ps, cis) => ({
        ls: ls as LLMService,
        dbs: dbs as DatabaseService,
        fss: fss as FileSystemService,
        ps: ps as ProcessService,
        cis: cis as CodeIntelligenceService
    }), ['llmService', 'databaseService', 'fileSystemService', 'processService', 'codeIntelligenceService']);
    container.register('agentCouncilService', (d1, ws, cos, es) => {
        const d = d1 as { ls: LLMService, dbs: DatabaseService, fss: FileSystemService, ps: ProcessService, cis: CodeIntelligenceService }
        return new AgentCouncilService({
            llm: d.ls,
            db: d.dbs,
            fs: d.fss,
            process: d.ps,
            codeIntel: d.cis,
            web: ws as WebService,
            collaboration: cos as CollaborationService,
            embedding: es as EmbeddingService
        })
    }, ['councilDeps1', 'webService', 'collaborationService', 'embeddingService']);
}

function registerAnalysisServices() {
    container.register('monitoringService', () => new MonitoringService());
    container.register('pageSpeedService', () => new PageSpeedService());
    container.register('scannerService', () => new ScannerService());
    container.register('sentryService', (ss) => new SentryService(ss as SettingsService), ['settingsService']);
    container.register('telemetryService', (ss) => new TelemetryService(ss as SettingsService), ['settingsService']);
    container.register('usageTrackingService', (dbs) => new UsageTrackingService(dbs as DatabaseService), ['databaseService']);
    container.register('auditLogService', (dbs) => new AuditLogService(dbs as DatabaseService), ['databaseService']);
    container.register('performanceService', () => new PerformanceService());
    container.register('ruleService', () => new RuleService());
    container.register('featureFlagService', (ds) => new FeatureFlagService(ds as DataService), ['dataService']);
    container.register('collaborationService', () => new CollaborationService());
}

function initOllamaHealth(settings: Record<string, unknown>) {
    try {
        const ollamaSettings = settings['ollama'] as JsonObject | undefined;
        const ollamaUrl = (ollamaSettings?.['url'] as string | undefined) ?? 'http://localhost:11434';
        const health = getOllamaHealthService(ollamaUrl);
        health.start();
        return health;
    } catch (e) {
        appLogger.error('Startup', `Failed to start Ollama health service: ${e}`);
        return { start: () => { }, stop: () => { }, checkHealth: async () => ({ online: false }) } as ReturnType<typeof getOllamaHealthService>;
    }
}

function buildServicesMap(dataService: DataService, settingsService: SettingsService, ollamaHealthService: ReturnType<typeof getOllamaHealthService>): Services {
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
        agentService: container.resolve<AgentService>('agentService'),
        updateService: container.resolve<UpdateService>('updateService'),
        sentryService: container.resolve<SentryService>('sentryService'),
        healthCheckService: getHealthCheckService(),
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
}
