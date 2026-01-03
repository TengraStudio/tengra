import { OllamaService } from '../services/ollama.service'
import { FileSystemService } from '../services/filesystem.service'
import { CommandService } from '../services/command.service'
import { WebService } from '../services/web.service'
import { LlamaService } from '../services/llama.service'
import { DatabaseService } from '../services/database.service'
import { SSHService } from '../services/ssh.service'
import { ScannerService } from '../services/scanner.service'
import { EmbeddingService } from '../services/embedding.service'
import { DockerService } from '../services/docker.service'
import { SecurityService } from '../services/security.service'
import { ContentService } from '../services/content.service'
import { FileManagementService } from '../services/file.service'
import { UtilityService } from '../services/utility.service'
import { OpenAIService } from '../services/openai.service'
import { AnthropicService } from '../services/anthropic.service'
import { GeminiService } from '../services/gemini.service'
import { GroqService } from '../services/groq.service'
import { MonitoringService } from '../services/monitoring.service'
import { SettingsService } from '../services/settings.service'
import { SystemService } from '../services/system.service'
import { NetworkService } from '../services/network.service'
import { NotificationService } from '../services/notification.service'
import { ClipboardService } from '../services/clipboard.service'
import { GitService } from '../services/git.service'
import { ProxyService } from '../services/proxy.service'
import { ProxyEmbedService } from '../services/proxy-embed.service'
import { AuthService } from '../services/auth.service'
import { CopilotService } from '../services/copilot.service'
import { ScreenshotService } from '../services/screenshot.service'
import { HistoryImportService } from '../services/history-import.service'
import { HuggingFaceService } from '../services/huggingface.service'

export function createServices(allowedFileRoots: Set<string>) {
    const settingsService = new SettingsService()
    const ollamaService = new OllamaService(settingsService)
    const huggingfaceService = new HuggingFaceService()
    const fileSystemService = new FileSystemService(Array.from(allowedFileRoots))
    const commandService = new CommandService()
    const webService = new WebService()
    const llamaService = new LlamaService()
    const databaseService = new DatabaseService()
    const sshService = new SSHService()
    const proxyService = new ProxyService(settingsService)
    const proxyEmbedService = new ProxyEmbedService(proxyService)
    const authService = new AuthService(settingsService)
    const copilotService = new CopilotService()
    const systemService = new SystemService()
    const networkService = new NetworkService()
    const notificationService = new NotificationService()
    const clipboardService = new ClipboardService()
    const gitService = new GitService()
    const openaiService = new OpenAIService()
    const securityService = new SecurityService()
    const contentService = new ContentService()
    const fileService = new FileManagementService()
    const scannerService = new ScannerService()
    const anthropicService = new AnthropicService()
    const geminiService = new GeminiService()
    const groqService = new GroqService()
    const monitoringService = new MonitoringService()
    const historyImportService = new HistoryImportService(proxyService, databaseService)

    const embeddingService = new EmbeddingService(databaseService, ollamaService, openaiService, llamaService)
    const utilityService = new UtilityService(databaseService, scannerService, embeddingService)
    const dockerService = new DockerService(commandService, sshService)
    const screenshotService = new ScreenshotService()

    return {
        ollamaService,
        fileSystemService,
        commandService,
        webService,
        llamaService,
        databaseService,
        sshService,
        settingsService,
        proxyService,
        proxyEmbedService,
        authService,
        copilotService,
        systemService,
        networkService,
        notificationService,
        clipboardService,
        gitService,
        openaiService,
        securityService,
        contentService,
        fileService,
        scannerService,
        anthropicService,
        geminiService,
        groqService,
        monitoringService,
        historyImportService,
        embeddingService,
        utilityService,
        dockerService,
        screenshotService,
        huggingfaceService
    }
}
