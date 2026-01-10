import { Container } from '../core/container'
import { FeatureFlagService } from '../services/feature-flag.service'
import { TelemetryService } from '../services/telemetry.service'
import { HttpService } from '../services/http.service'
import { ConfigService } from '../services/config.service'
import { KeyRotationService } from '../services/security/key-rotation.service'
import { RateLimitService } from '../services/security/rate-limit.service'
import { ScannerService } from '../services/scanner.service'
import { FileManagementService } from '../services/data/file.service'
import { CollaborationService } from '../services/collaboration.service'
import { LocalAIService } from '../services/llm/local-ai.service'
import { FileSystemService } from '../services/data/filesystem.service'
import { CommandService } from '../services/command.service'
import { DatabaseService } from '../services/data/database.service'
import { LanceDbService } from '../services/data/lancedb.service'
import { SSHService } from '../services/ssh.service'
import { EmbeddingService } from '../services/llm/embedding.service'
import { DockerService } from '../services/docker.service'
import { SecurityService } from '../services/security.service'
import { ContentService } from '../services/content.service'
import { UtilityService } from '../services/utility.service'
import { LLMService } from '../services/llm/llm.service'
import { MonitoringService } from '../services/monitoring.service'
import { SettingsService } from '../services/settings.service'
import { SystemService } from '../services/system.service'
import { NetworkService } from '../services/network.service'
import { NotificationService } from '../services/notification.service'
import { ClipboardService } from '../services/clipboard.service'
import { GitService } from '../services/git.service'
import { ProxyService } from '../services/proxy/proxy.service'
import { ProxyProcessManager } from '../services/proxy/proxy-process.manager'
import { QuotaService } from '../services/proxy/quota.service'
import { CopilotService } from '../services/llm/copilot.service'
import { ScreenshotService } from '../services/screenshot.service'
import { HistoryImportService } from '../services/history-import.service'
import { OllamaService } from '../services/llm/ollama.service'
import { AgentCouncilService } from '../services/agent-council.service'
import { getOllamaHealthService } from '../services/llm/ollama-health.service'
import { LlamaService } from '../services/llm/llama.service'
import { HuggingFaceService } from '../services/llm/huggingface.service'
import { ProjectService } from '../services/project.service'
import { LogoService } from '../services/logo.service'
import { ProcessService } from '../services/process.service'
import { CodeIntelligenceService } from '../services/code-intelligence.service'
import { WebService } from '../services/web.service'
import { MemoryService } from '../services/memory.service'
import { PageSpeedService } from '../services/pagespeed.service'
import { RuleService } from '../services/rule.service'
import { AgentService } from '../services/agent.service'
import { UpdateService } from '../services/update.service'
import { SentryService } from '../services/sentry.service'
import { getHealthCheckService, HealthCheckService } from '../services/health-check.service'
import { DataService } from '../services/data/data.service'
import { AuthService } from '../services/auth.service'
import { ChatEventService } from '../services/data/chat-event.service'
import { Logger } from '../utils/logger'

// Export the container instance so it can be accessed if needed
export const container = new Container();

// Define Services interface
export interface Services {
    settingsService: SettingsService;
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
    ollamaHealthService: any;
    llamaService: LlamaService;
    huggingFaceService: HuggingFaceService;
    projectService: ProjectService;
    logoService: LogoService;
    processService: ProcessService;
    codeIntelligenceService: CodeIntelligenceService;
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
}

export async function createServices(allowedFileRoots: Set<string>) {
    // 1. Data Service (Critical Intialization)
    container.register('dataService', () => new DataService());
    const dataService = container.resolve<DataService>('dataService');
    await dataService.migrate();

    // Initialize Logger
    Logger.init(dataService.getPath('logs'));

    // 2. Core Low-Level Services (No dependencies)
    container.register('securityService', () => new SecurityService());
    container.register('commandService', () => new CommandService());
    container.register('systemService', () => new SystemService());
    container.register('networkService', () => new NetworkService());
    container.register('notificationService', () => new NotificationService());
    container.register('clipboardService', () => new ClipboardService());
    container.register('gitService', () => new GitService());
    container.register('contentService', () => new ContentService());
    container.register('monitoringService', () => new MonitoringService());
    container.register('screenshotService', () => new ScreenshotService());
    container.register('pageSpeedService', () => new PageSpeedService());
    container.register('ruleService', () => new RuleService());
    container.register('copilotService', (as) => new CopilotService(as as AuthService), ['authService']);
    container.register('scannerService', () => new ScannerService());
    container.register('fileManagementService', () => new FileManagementService());
    container.register('huggingFaceService', () => new HuggingFaceService());
    container.register('projectService', () => new ProjectService());
    container.register('processService', () => new ProcessService());
    container.register('webService', () => new WebService());
    container.register('collaborationService', () => new CollaborationService());

    container.register('fileSystemService', () => new FileSystemService(Array.from(allowedFileRoots)));

    // 3. Services with Dependencies
    container.register('authService', (ds, ss) => new AuthService(ds as DataService, ss as SecurityService), ['dataService', 'securityService']);
    container.register('settingsService', (ds, as) => new SettingsService(ds as DataService, as as AuthService), ['dataService', 'authService']);
    container.register('localAIService', (ss) => new LocalAIService(ss as SettingsService), ['settingsService']);
    container.register('llamaService', (ds) => new LlamaService(ds as DataService), ['dataService']);
    container.register('ollamaService', (ss) => new OllamaService(ss as SettingsService), ['settingsService']);
    container.register('llmService', (hs, cs, krs, rls) => new LLMService(
        hs as HttpService,
        cs as ConfigService,
        krs as KeyRotationService,
        rls as RateLimitService
    ), ['httpService', 'configService', 'keyRotationService', 'rateLimitService']);
    container.register('lanceDbService', (ds) => new LanceDbService(ds as DataService), ['dataService']);

    // Database depends on Data, LanceDB
    container.register('databaseService', (ds, ldb) => new DatabaseService(ds as DataService, ldb as LanceDbService), ['dataService', 'lanceDbService']);
    container.register('chatEventService', (dbs) => new ChatEventService(dbs as DatabaseService), ['databaseService']);

    container.register('sshService', (ds) => new SSHService((ds as DataService).getPath('config')), ['dataService']);
    container.register('proxyProcessManager', (ss, ds, sec) => new ProxyProcessManager(ss as SettingsService, ds as DataService, sec as SecurityService), ['settingsService', 'dataService', 'securityService']);
    container.register('quotaService', (ss, ds, sec) => new QuotaService(ss as SettingsService, ds as DataService, sec as SecurityService), ['settingsService', 'dataService', 'securityService']);

    // Proxy Service
    container.register('proxyService', (ss, ds, sec, ppm, qs) => new ProxyService(
        ss as SettingsService,
        ds as DataService,
        sec as SecurityService,
        ppm as ProxyProcessManager,
        qs as QuotaService
    ), ['settingsService', 'dataService', 'securityService', 'proxyProcessManager', 'quotaService']);

    container.register('historyImportService', (ps, dbs) => new HistoryImportService(ps as ProxyService, dbs as DatabaseService), ['proxyService', 'databaseService']);

    // Complex Helpers
    container.register('embeddingService', (dbs, os, ls, lms, ss) => new EmbeddingService(
        dbs as DatabaseService,
        os as OllamaService,
        ls as LLMService,
        lms as LlamaService,
        ss as SettingsService
    ), ['databaseService', 'ollamaService', 'llmService', 'llamaService', 'settingsService']);

    container.register('utilityService', (dbs, scs, es) => new UtilityService(
        dbs as DatabaseService,
        scs as ScannerService,
        es as EmbeddingService
    ), ['databaseService', 'scannerService', 'embeddingService']);

    container.register('dockerService', (cs, ssh) => new DockerService(cs as CommandService, ssh as SSHService), ['commandService', 'sshService']);

    container.register('memoryService', (dbs, es, ls) => new MemoryService(
        dbs as DatabaseService,
        es as EmbeddingService,
        ls as LLMService
    ), ['databaseService', 'embeddingService', 'llmService']);

    container.register('agentService', (ldb) => new AgentService(ldb as LanceDbService), ['lanceDbService']);

    container.register('updateService', (ss, ds) => new UpdateService(ss as SettingsService, ds as DataService), ['settingsService', 'dataService']);
    container.register('sentryService', (ss) => new SentryService(ss as SettingsService), ['settingsService']);
    container.register('featureFlagService', (ds) => new FeatureFlagService(ds as DataService), ['dataService']);
    container.register('telemetryService', (ss) => new TelemetryService(ss as SettingsService), ['settingsService']);
    container.register('httpService', () => new HttpService());
    container.register('configService', (ss) => new ConfigService(ss as SettingsService), ['settingsService']);
    container.register('keyRotationService', (ss) => new KeyRotationService(ss as SettingsService), ['settingsService']);
    container.register('rateLimitService', () => new RateLimitService());

    container.register('codeIntelligenceService', (dbs, es) => new CodeIntelligenceService(dbs as DatabaseService, es as EmbeddingService), ['databaseService', 'embeddingService']);

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
    await container.init();

    // 5. Post-Init Setup
    const agentService = container.resolve<AgentService>('agentService');
    await agentService.init();

    // Start Ollama health monitoring
    const settingsService = container.resolve<SettingsService>('settingsService');
    const ollamaHealthService = getOllamaHealthService(
        settingsService.getSettings()?.ollama?.url || 'http://127.0.0.1:11434'
    );
    ollamaHealthService.start();

    // Health Check Service Setup
    const healthCheckService = getHealthCheckService();

    // 6. Return Map for IPC registration
    const services: Services = {
        settingsService,
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
        codeIntelligenceService: container.resolve<CodeIntelligenceService>('codeIntelligenceService'),
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
        rateLimitService: container.resolve<RateLimitService>('rateLimitService')
    };

    healthCheckService.registerCriticalChecks({
        databaseService: services.databaseService,
        networkService: services.networkService
    });
    healthCheckService.start();

    return services;
}
