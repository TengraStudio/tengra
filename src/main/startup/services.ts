import { CollaborationService } from '../services/collaboration.service'
import { LocalAIService } from '../services/local-ai.service'

// ... existing imports ...

// Duplicate definitions removed.
// Removed premature CouncilService instantiation
import { FileSystemService } from '../services/filesystem.service'
import { CommandService } from '../services/command.service'
import { DatabaseService } from '../services/database.service'
import { LanceDbService } from '../services/lancedb.service'
import { SSHService } from '../services/ssh.service'
import { EmbeddingService } from '../services/embedding.service'
import { DockerService } from '../services/docker.service'
import { SecurityService } from '../services/security.service'
import { ContentService } from '../services/content.service'
import { UtilityService } from '../services/utility.service'
import { LLMService } from '../services/llm.service'
import { MonitoringService } from '../services/monitoring.service'
import { SettingsService } from '../services/settings.service'
import { SystemService } from '../services/system.service'
import { NetworkService } from '../services/network.service'
import { NotificationService } from '../services/notification.service'
import { ClipboardService } from '../services/clipboard.service'
import { GitService } from '../services/git.service'
import { ProxyService } from '../services/proxy.service'
import { ProxyProcessManager } from '../services/proxy-process.manager'
import { QuotaService } from '../services/quota.service'
import { CopilotService } from '../services/copilot.service'
import { ScreenshotService } from '../services/screenshot.service'
import { HistoryImportService } from '../services/history-import.service'
import { OllamaService } from '../services/ollama.service'
import { CouncilService } from '../services/council.service'
import { getOllamaHealthService } from '../services/ollama-health.service'
import { LlamaService } from '../services/llama.service'
import { HuggingFaceService } from '../services/huggingface.service'
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
import { getHealthCheckService } from '../services/health-check.service'


import { DataService } from '../services/data.service'
import { AuthService } from '../services/auth.service'
import { Logger } from '../utils/logger'

export async function createServices(allowedFileRoots: Set<string>) {

    // Critical: Initialize Data Service first
    const dataService = new DataService()
    await dataService.migrate()

    // Initialize Logger with centralized path
    Logger.init(dataService.getPath('logs'))

    const securityService = new SecurityService()
    const authService = new AuthService(dataService, securityService)
    const settingsService = new SettingsService(dataService, authService)
    const localAIService = new LocalAIService(settingsService)
    const llamaService = new LlamaService(dataService)
    const huggingFaceService = new HuggingFaceService()
    const ollamaService = new OllamaService(settingsService)
    const llmService = new LLMService(dataService)
    const fileSystemService = new FileSystemService(Array.from(allowedFileRoots))
    const commandService = new CommandService()
    const lanceDbService = new LanceDbService(dataService)
    const databaseService = new DatabaseService(dataService, lanceDbService)
    const sshService = new SSHService(dataService.getPath('config'))
    const proxyProcessManager = new ProxyProcessManager(settingsService, dataService, securityService)
    const quotaService = new QuotaService(settingsService, dataService, securityService)
    const proxyService = new ProxyService(settingsService, dataService, securityService, proxyProcessManager, quotaService)
    const copilotService = new CopilotService()
    const systemService = new SystemService()
    const networkService = new NetworkService()
    const notificationService = new NotificationService()
    const clipboardService = new ClipboardService()
    const gitService = new GitService()
    // securityService moved up
    const contentService = new ContentService()
    const monitoringService = new MonitoringService()
    const historyImportService = new HistoryImportService(proxyService, databaseService)

    // Bridge logic for embedding/utility that still expect old services
    const embeddingService = new EmbeddingService(databaseService, ollamaService, llmService as any, llamaService, settingsService)
    const utilityService = new UtilityService(databaseService, contentService as any, embeddingService)
    const dockerService = new DockerService(commandService, sshService)
    const screenshotService = new ScreenshotService()
    const memoryService = new MemoryService(databaseService, embeddingService, llmService)
    const pageSpeedService = new PageSpeedService()
    const ruleService = new RuleService()
    const agentService = new AgentService(lanceDbService)
    await agentService.init()

    const updateService = new UpdateService(settingsService, dataService)
    const sentryService = new SentryService(settingsService)

    // Start Ollama health monitoring
    const ollamaHealthService = getOllamaHealthService(
        settingsService.getSettings()?.ollama?.url || 'http://127.0.0.1:11434'
    )
    ollamaHealthService.start()

    // Setup Health Check Service
    const healthCheckService = getHealthCheckService()
    healthCheckService.register('ollama', async () => {
        try {
            const res = await fetch((settingsService.getSettings()?.ollama?.url || 'http://127.0.0.1:11434') + '/api/tags')
            return res.ok
        } catch { return false }
    }, { intervalMs: 60000, critical: false })
    healthCheckService.register('proxy', async () => {
        try {
            const res = await fetch('http://127.0.0.1:8317/health')
            return res.ok
        } catch { return false }
    }, { intervalMs: 30000, critical: true })
    healthCheckService.start()

    const projectService = new ProjectService()
    const processService = new ProcessService()
    const codeIntelligenceService = new CodeIntelligenceService(databaseService, embeddingService)

    const webService = new WebService()
    const collaborationService = new CollaborationService()
    const councilService = new CouncilService(
        llmService,
        databaseService,
        fileSystemService,
        processService,
        codeIntelligenceService,
        webService,
        collaborationService,
        embeddingService
    )

    const logoService = new LogoService(llmService, projectService)


    return {
        settingsService,
        localAIService,
        ollamaService,
        llmService,
        fileSystemService,
        commandService,
        databaseService,
        sshService,
        proxyService,
        copilotService,
        systemService,
        networkService,
        notificationService,
        clipboardService,
        gitService,
        securityService,
        contentService,
        monitoringService,
        historyImportService,
        embeddingService,
        utilityService,
        dockerService,
        screenshotService,
        councilService,
        ollamaHealthService,
        llamaService,
        huggingFaceService,
        projectService,
        logoService,
        processService,
        codeIntelligenceService,
        webService,
        memoryService,
        pageSpeedService,
        ruleService,
        agentService,
        dataService,
        updateService,
        sentryService,
        healthCheckService
    }

}
