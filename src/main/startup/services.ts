import { Container } from '@main/core/container';
import { createLazyServiceProxy, lazyServiceRegistry } from '@main/core/lazy-services';
import { appLogger } from '@main/logging/logger';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { MonitoringService } from '@main/services/analysis/monitoring.service';
import { PageSpeedService } from '@main/services/analysis/pagespeed.service';
import { PerformanceService } from '@main/services/analysis/performance.service';
import { ScannerService } from '@main/services/analysis/scanner.service';
import { SentryService } from '@main/services/analysis/sentry.service';
import { TelemetryService } from '@main/services/analysis/telemetry.service';
import { UsageTrackingService } from '@main/services/analysis/usage-tracking.service';
import { BackupService } from '@main/services/data/backup.service';
import { ChatEventService } from '@main/services/data/chat-event.service';
import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import { FileManagementService } from '@main/services/data/file.service';
import { FileChangeTracker } from '@main/services/data/file-change-tracker.service';
import { FileSystemService } from '@main/services/data/filesystem.service';
import { ImagePersistenceService } from '@main/services/data/image-persistence.service';
import { ExportService } from '@main/services/export/export.service';
import { CollaborationService } from '@main/services/external/collaboration.service';
import { ContentService } from '@main/services/external/content.service';
import { FeatureFlagService } from '@main/services/external/feature-flag.service';
import { HistoryImportService } from '@main/services/external/history-import.service';
import { HttpService } from '@main/services/external/http.service';
import { LogoService } from '@main/services/external/logo.service';
import { MarketResearchService } from '@main/services/external/market-research.service';
import { RuleService } from '@main/services/external/rule.service';
import { UtilityService } from '@main/services/external/utility.service';
import { WebService } from '@main/services/external/web.service';
import { AgentService } from '@main/services/llm/agent.service';
import { AgentCouncilService } from '@main/services/llm/agent-council.service';
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
import { MemoryService } from '@main/services/llm/memory.service';
import { ModelCollaborationService } from '@main/services/llm/model-collaboration.service';
import { ModelRegistryDependencies, ModelRegistryService } from '@main/services/llm/model-registry.service';
import { MultiLLMOrchestrator } from '@main/services/llm/multi-llm-orchestrator.service';
import { MultiModelComparisonService } from '@main/services/llm/multi-model-comparison.service';
import { OllamaService } from '@main/services/llm/ollama.service';
import { getOllamaHealthService } from '@main/services/llm/ollama-health.service';
import { PromptTemplatesService } from '@main/services/llm/prompt-templates.service';
import { CodeIntelligenceService } from '@main/services/project/code-intelligence.service';
import { DockerService } from '@main/services/project/docker.service';
import { GitService } from '@main/services/project/git.service';
import { ProjectService } from '@main/services/project/project.service';
import { ProjectAgentService } from '@main/services/project/project-agent.service';
import { ProjectScaffoldService } from '@main/services/project/project-scaffold.service';
import { SSHService } from '@main/services/project/ssh.service';
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
import { getHealthCheckService, HealthCheckService } from '@main/services/system/health-check.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { NetworkService } from '@main/services/system/network.service';
import { ProcessService } from '@main/services/system/process.service';
import { ProcessManagerService } from '@main/services/system/process-manager.service';
import { SettingsService } from '@main/services/system/settings.service';
import { SystemService } from '@main/services/system/system.service';
import { UpdateService } from '@main/services/system/update.service';
import { ClipboardService } from '@main/services/ui/clipboard.service';
import { NotificationService } from '@main/services/ui/notification.service';
import { ScreenshotService } from '@main/services/ui/screenshot.service';
import { Logger } from '@main/utils/logger';
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
    brainService: BrainService;
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
    marketResearchService: MarketResearchService;
    projectScaffoldService: ProjectScaffoldService;
    ideaGeneratorService: IdeaGeneratorService;
    projectAgentService: ProjectAgentService;
    exportService: ExportService;
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

    // Register lazy services that are loaded on-demand
    registerLazyServices();

    // Register proxies in container for services that depend on lazy services
    registerLazyProxies();

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
    container.register('webService', () => {
        const ws = new WebService();
        if (process.env['TAVILY_API_KEY']) {
            ws.setTavilyKey(process.env['TAVILY_API_KEY']);
        }
        return ws;
    });
    container.register('updateService', (ss, ds) => new UpdateService(ss as SettingsService, ds as DataService), ['settingsService', 'dataService']);
    container.register('configService', (ss) => new ConfigService(ss as SettingsService), ['settingsService']);
    container.register('jobSchedulerService', (dbs) => new JobSchedulerService(dbs as DatabaseService), ['databaseService']);
    container.register('fileSystemService', (fct) => new FileSystemService(Array.from(allowedFileRoots), fct as FileChangeTracker), ['fileChangeTracker']);
    container.register('httpService', () => new HttpService());
    container.register('rateLimitService', () => new RateLimitService());
    container.register('utilityService', (dbs, scs, es) => new UtilityService(dbs as DatabaseService, scs as ScannerService, es as EmbeddingService), ['databaseService', 'scannerService', 'embeddingService']);
}

function registerDataServices() {
    container.register('databaseService', (ds, ebs) => new DatabaseService(ds as DataService, ebs as EventBusService), ['dataService', 'eventBusService']);
    container.register('fileChangeTracker', (dbs, ebs) => new FileChangeTracker(dbs as DatabaseService, ebs as EventBusService), ['databaseService', 'eventBusService']);
    container.register('chatEventService', (dbs) => new ChatEventService(dbs as DatabaseService), ['databaseService']);
    container.register('fileManagementService', () => new FileManagementService());
    container.register('imagePersistenceService', (ds, dbs) => new ImagePersistenceService(ds as DataService, dbs as DatabaseService), ['dataService', 'databaseService']);
    container.register('backupService', (ds, dbs) => new BackupService(ds as DataService, dbs as DatabaseService), ['dataService', 'databaseService']);
}

function registerSecurityServices() {
    container.register('authService', (dbs, ss, ebs, ds) => new AuthService(dbs as DatabaseService, ss as SecurityService, ebs as EventBusService, ds as DataService), ['databaseService', 'securityService', 'eventBusService', 'dataService']);
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
        const d = base as { ss: SettingsService, cs: CopilotService, as: AuthService, ebs: EventBusService };
        return new TokenService(
            d.ss, d.cs, d.as, d.ebs,
            {
                processManager: pm as ProcessManagerService,
                jobScheduler: js as JobSchedulerService
            }
        );
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
    container.register('brainService', (dbs, es, ls, pm) => new BrainService(dbs as DatabaseService, es as EmbeddingService, ls as LLMService, pm as ProcessManagerService), ['databaseService', 'embeddingService', 'llmService', 'processManagerService']);
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
        const d = deps as ModelRegistryDependencies;
        return new ModelRegistryService({
            ...d,
            authService: as as AuthService,
            tokenService: ts as TokenService
        });
    }, ['modelRegistryDeps', 'authService', 'tokenService']);
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
        const imagePersistenceService = container.resolve<ImagePersistenceService>('imagePersistenceService');
        const { LogoService } = await import('@main/services/external/logo.service');
        return new LogoService(llmService, projectService, localImageService, imagePersistenceService);
    });

    lazyServiceRegistry.register('scannerService', async () => {
        const { ScannerService } = await import('@main/services/analysis/scanner.service');
        return new ScannerService();
    });

    lazyServiceRegistry.register('pageSpeedService', async () => {
        const { PageSpeedService } = await import('@main/services/analysis/pagespeed.service');
        return new PageSpeedService();
    });
}

function registerLazyProxies() {
    container.register('dockerService', () => createLazyServiceProxy<DockerService>('dockerService'));
    container.register('sshService', () => createLazyServiceProxy<SSHService>('sshService'));
    container.register('logoService', () => createLazyServiceProxy<LogoService>('logoService'));
    container.register('scannerService', () => createLazyServiceProxy<ScannerService>('scannerService'));
    container.register('pageSpeedService', () => createLazyServiceProxy<PageSpeedService>('pageSpeedService'));
}

function registerProjectServices() {
    container.register('projectService', () => new ProjectService());
    container.register('gitService', () => new GitService());
    // SSH and Docker services are now lazy-loaded
    container.register('codeIntelligenceService', (dbs, es) => new CodeIntelligenceService(dbs as DatabaseService, es as EmbeddingService), ['databaseService', 'embeddingService']);
    container.register('localImageService', (ss) => new LocalImageService(ss as SettingsService), ['settingsService']);
    // Logo and Market Research services are now lazy-loaded
    container.register('projectScaffoldService', () => new ProjectScaffoldService());
    container.register('marketResearchService', (ws) => new MarketResearchService(ws as WebService), ['webService']);
    container.register('ideaGeneratorService', (...deps) => {
        const [dbs, ls, mrs, pss, as, ebs, lis, bs] = deps;
        return new IdeaGeneratorService({
            databaseService: dbs as DatabaseService,
            llmService: ls as LLMService,
            marketResearchService: mrs as MarketResearchService,
            projectScaffoldService: pss as ProjectScaffoldService,
            authService: as as AuthService,
            eventBus: ebs as EventBusService,
            localImageService: lis as LocalImageService,
            brainService: bs as BrainService
        });
    }, ['databaseService', 'llmService', 'marketResearchService', 'projectScaffoldService', 'authService', 'eventBusService', 'localImageService', 'brainService']);

    // Project Agent Service
    container.register('projectAgentService', (ds, ls, ebs) => new ProjectAgentService(ds as DataService, ls as LLMService, ebs as EventBusService), ['dataService', 'llmService', 'eventBusService']);

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
        const c = core as { ss: SettingsService, ds: DataService, sec: SecurityService, as: AuthService, ebs: EventBusService };
        return new ProxyService({
            settingsService: c.ss,
            dataService: c.ds,
            securityService: c.sec,
            authService: c.as,
            eventBus: c.ebs,
            processManager: ppm as ProxyProcessManager,
            quotaService: qs as QuotaService
        });
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
    container.register('agentCouncilService', (d1, ws, cos, es, bs) => {
        const d = d1 as { ls: LLMService, dbs: DatabaseService, fss: FileSystemService, ps: ProcessService, cis: CodeIntelligenceService };
        return new AgentCouncilService({
            llm: d.ls,
            db: d.dbs,
            fs: d.fss,
            process: d.ps,
            codeIntel: d.cis,
            web: ws as WebService,
            collaboration: cos as CollaborationService,
            embedding: es as EmbeddingService,
            brain: bs as BrainService
        });
    }, ['councilDeps1', 'webService', 'collaborationService', 'embeddingService', 'brainService']);
}

function registerAnalysisServices() {
    container.register('monitoringService', () => new MonitoringService());
    // PageSpeed and Scanner services are now lazy-loaded
    container.register('sentryService', (ss) => new SentryService(ss as SettingsService), ['settingsService']);
    container.register('telemetryService', (ss) => new TelemetryService(ss as SettingsService), ['settingsService']);
    container.register('usageTrackingService', (dbs) => new UsageTrackingService(dbs as DatabaseService), ['databaseService']);
    container.register('auditLogService', (dbs) => new AuditLogService(dbs as DatabaseService), ['databaseService']);
    container.register('performanceService', () => new PerformanceService());
    container.register('ruleService', () => new RuleService());
    container.register('featureFlagService', (ds) => new FeatureFlagService(ds as DataService), ['dataService']);
    container.register('collaborationService', () => new CollaborationService());
    container.register('exportService', () => new ExportService());
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
        sshService: createLazyServiceProxy<SSHService>('sshService'),
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
        dockerService: createLazyServiceProxy<DockerService>('dockerService'),
        screenshotService: container.resolve<ScreenshotService>('screenshotService'),
        agentCouncilService: container.resolve<AgentCouncilService>('agentCouncilService'),
        llamaService: container.resolve<LlamaService>('llamaService'),
        huggingFaceService: container.resolve<HuggingFaceService>('huggingFaceService'),
        projectService: container.resolve<ProjectService>('projectService'),
        logoService: createLazyServiceProxy<LogoService>('logoService'),
        processService: container.resolve<ProcessService>('processService'),
        processManagerService: container.resolve<ProcessManagerService>('processManagerService'),
        codeIntelligenceService: container.resolve<CodeIntelligenceService>('codeIntelligenceService'),
        contextRetrievalService: container.resolve<ContextRetrievalService>('contextRetrievalService'),
        jobSchedulerService: container.resolve<JobSchedulerService>('jobSchedulerService'),
        webService: container.resolve<WebService>('webService'),
        memoryService: container.resolve<MemoryService>('memoryService'),
        brainService: container.resolve<BrainService>('brainService'),
        pageSpeedService: createLazyServiceProxy<PageSpeedService>('pageSpeedService'),
        ruleService: container.resolve<RuleService>('ruleService'),
        agentService: container.resolve<AgentService>('agentService'),
        updateService: container.resolve<UpdateService>('updateService'),
        sentryService: container.resolve<SentryService>('sentryService'),
        healthCheckService: getHealthCheckService(),
        scannerService: createLazyServiceProxy<ScannerService>('scannerService'),
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
        eventBusService: container.resolve<EventBusService>('eventBusService'),
        marketResearchService: container.resolve<MarketResearchService>('marketResearchService'),
        projectScaffoldService: container.resolve<ProjectScaffoldService>('projectScaffoldService'),
        ideaGeneratorService: container.resolve<IdeaGeneratorService>('ideaGeneratorService'),
        projectAgentService: container.resolve<ProjectAgentService>('projectAgentService'),
        exportService: container.resolve<ExportService>('exportService')
    };
}
