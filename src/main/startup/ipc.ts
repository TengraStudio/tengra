import { registerAgentIpc } from '@main/ipc/agent'
import { registerAuthIpc } from '@main/ipc/auth'
import { registerChatIpc } from '@main/ipc/chat'
import { registerCodeIntelligenceIpc } from '@main/ipc/code-intelligence'
import { registerCouncilIpc } from '@main/ipc/council'
import { registerDbIpc } from '@main/ipc/db'
import { registerDialogIpc } from '@main/ipc/dialog'
import { registerExportIpc } from '@main/ipc/export'
import { registerFilesIpc } from '@main/ipc/files'
import { registerGalleryIpc } from '@main/ipc/gallery'
import { registerGitIpc } from '@main/ipc/git'
import { registerHistoryIpc } from '@main/ipc/history'
import { registerHFModelIpc } from '@main/ipc/huggingface'
import { registerLlamaIpc } from '@main/ipc/llama'
import { registerLoggingIpc } from '@main/ipc/logging'
import { registerMcpIpc } from '@main/ipc/mcp'
import { registerMemoryIpc } from '@main/ipc/memory'
import { registerModelRegistryIpc } from '@main/ipc/model-registry'
import { registerOllamaIpc } from '@main/ipc/ollama'
import { registerProcessIpc, setupProcessEvents } from '@main/ipc/process'
import { registerProjectIpc } from '@main/ipc/project'
import { registerProxyIpc } from '@main/ipc/proxy'
import { registerProxyEmbedIpc } from '@main/ipc/proxy-embed'
import { registerScreenshotIpc } from '@main/ipc/screenshot'
import { registerSettingsIpc } from '@main/ipc/settings'
import { registerSshIpc } from '@main/ipc/ssh'
import { registerTerminalIpc } from '@main/ipc/terminal'
import { registerToolsIpc } from '@main/ipc/tools'
import { registerUsageIpc } from '@main/ipc/usage'
import { registerWindowIpc } from '@main/ipc/window'
import { appLogger } from '@main/logging/logger'
import { McpDispatcher } from '@main/mcp/dispatcher'
import { Services } from '@main/startup/services'
import { ToolExecutor } from '@main/tools/tool-executor'
import { BrowserWindow } from 'electron'

export function registerIpcHandlers(
    services: Services,
    toolExecutor: ToolExecutor,
    getMainWindow: () => BrowserWindow | null,
    allowedFileRoots: Set<string>,
    mcpDispatcher: McpDispatcher
) {
    registerWindowIpc(getMainWindow)
    registerModelRegistryIpc(services.modelRegistryService)

    registerAuthIpc(services.proxyService, services.settingsService, services.copilotService, services.authService)
    registerProxyIpc(services.proxyService, undefined, services.authService)
    registerUsageIpc(services.usageTrackingService, services.settingsService, services.proxyService)

    registerChatIpc({
        settingsService: services.settingsService,
        copilotService: services.copilotService,
        llmService: services.llmService,
        proxyService: services.proxyService,
        codeIntelligenceService: services.codeIntelligenceService,
        contextRetrievalService: services.contextRetrievalService
    })

    registerOllamaIpc({
        localAIService: services.localAIService,
        settingsService: services.settingsService,
        llmService: services.llmService,
        ollamaService: services.ollamaService,
        ollamaHealthService: services.ollamaHealthService,
        proxyService: services.proxyService
    })

    registerProjectIpc(getMainWindow, {
        projectService: services.projectService,
        logoService: services.logoService,
        codeIntelligenceService: services.codeIntelligenceService,
        jobSchedulerService: services.jobSchedulerService,
        databaseService: services.databaseService
    })
    registerAgentIpc(services.agentService)
    registerProcessIpc(services.processService)
    setupProcessEvents(services.processService)
    registerCodeIntelligenceIpc(services.codeIntelligenceService)

    registerDbIpc(services.databaseService, services.embeddingService)
    registerLlamaIpc(services.llamaService)
    registerMemoryIpc(services.memoryService)
    registerGitIpc(services.gitService)

    registerSettingsIpc({
        settingsService: services.settingsService,
        llmService: services.llmService,
        copilotService: services.copilotService,
        updateOpenAIConnection: () => {
            const mainWindow = getMainWindow()
            if (mainWindow) {
                mainWindow.webContents.send('openai:connection-status', services.llmService.isOpenAIConnected())
            }
        },
        updateOllamaConnection: async () => {
            const mainWindow = getMainWindow()
            if (mainWindow) {
                try {
                    const status = await services.ollamaHealthService.checkHealth()
                    mainWindow.webContents.send('ollama:connection-status', status.online)
                } catch (error) {
                    appLogger.error('IPC', `Failed to check Ollama connection: ${error}`)
                    mainWindow.webContents.send('ollama:connection-status', false)
                }
            }
        }
    })

    registerSshIpc(getMainWindow, services.sshService)
    registerFilesIpc(getMainWindow, services.fileSystemService, allowedFileRoots)
    registerHFModelIpc(services.llmService, services.huggingFaceService)

    registerToolsIpc(toolExecutor, services.commandService)
    registerMcpIpc(mcpDispatcher)

    registerScreenshotIpc()
    registerLoggingIpc()

    // Terminal needs the instance - use getter for deferred access
    registerTerminalIpc(getMainWindow)

    registerDialogIpc(getMainWindow)
    registerHistoryIpc(services.historyImportService)

    registerProxyEmbedIpc(services.proxyService)
    registerExportIpc(getMainWindow)

    // Council IPC
    registerCouncilIpc(services.agentCouncilService, services.databaseService)

    // Register Gallery IPC
    registerGalleryIpc(services.dataService.getPath('gallery'))
}
