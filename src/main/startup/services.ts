import { LocalAIService } from '../services/local-ai.service'
import { FileSystemService } from '../services/filesystem.service'
import { CommandService } from '../services/command.service'
import { DatabaseService } from '../services/database.service'
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
import { CopilotService } from '../services/copilot.service'
import { ScreenshotService } from '../services/screenshot.service'
import { HistoryImportService } from '../services/history-import.service'
import { OllamaService } from '../services/ollama.service'
import { CouncilService } from '../services/council.service'
import { getOllamaHealthService } from '../services/ollama-health.service'
import { LlamaService } from '../services/llama.service'
import { HuggingFaceService } from '../services/huggingface.service'
import { ProjectService } from '../services/project.service'
import { ProcessService } from '../services/process.service'
import { CodeIntelligenceService } from '../services/code-intelligence.service'
import { WebService } from '../services/web.service'

export function createServices(allowedFileRoots: Set<string>) {

    const settingsService = new SettingsService()
    const localAIService = new LocalAIService(settingsService)
    const llamaService = new LlamaService()
    const huggingFaceService = new HuggingFaceService()
    const ollamaService = new OllamaService(settingsService)
    const llmService = new LLMService()
    const fileSystemService = new FileSystemService(Array.from(allowedFileRoots))
    const commandService = new CommandService()
    const databaseService = new DatabaseService()
    const sshService = new SSHService()
    const proxyService = new ProxyService(settingsService)
    const copilotService = new CopilotService()
    const systemService = new SystemService()
    const networkService = new NetworkService()
    const notificationService = new NotificationService()
    const clipboardService = new ClipboardService()
    const gitService = new GitService()
    const securityService = new SecurityService()
    const contentService = new ContentService()
    const monitoringService = new MonitoringService()
    const historyImportService = new HistoryImportService(proxyService, databaseService)

    // Bridge logic for embedding/utility that still expect old services
    const embeddingService = new EmbeddingService(databaseService, ollamaService, llmService as any, llamaService)
    const utilityService = new UtilityService(databaseService, contentService as any, embeddingService)
    const dockerService = new DockerService(commandService, sshService)
    const screenshotService = new ScreenshotService()

    // Start Ollama health monitoring
    const ollamaHealthService = getOllamaHealthService(
        settingsService.getSettings()?.ollama?.url || 'http://localhost:11434'
    )
    ollamaHealthService.start()

    const projectService = new ProjectService()
    const processService = new ProcessService()
    const codeIntelligenceService = new CodeIntelligenceService()

    const webService = new WebService()
    const councilService = new CouncilService(
        llmService,
        databaseService,
        fileSystemService,
        processService,
        codeIntelligenceService,
        webService
    )

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
        processService,
        codeIntelligenceService,
        webService
    }

}
