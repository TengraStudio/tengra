import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { initAppLogger } from './logging/logger'
import { createServices } from './startup/services'
import { registerSettingsIpc } from './ipc/settings'
import { registerAuthIpc } from './ipc/auth'
import { registerDbIpc } from './ipc/db'
import { registerOllamaIpc } from './ipc/ollama'
import { registerChatIpc } from './ipc/chat'
import { registerToolsIpc } from './ipc/tools'
import { registerScreenshotIpc } from './ipc/screenshot'
import { registerDialogIpc } from './ipc/dialog'
import { buildMcpServices } from './mcp/registry'
import { McpDispatcher } from './mcp/dispatcher'
import { registerMcpIpc } from './ipc/mcp'
import { registerProxyIpc } from './ipc/proxy'
import { registerProxyEmbedIpc } from './ipc/proxy-embed'
import { registerFilesIpc } from './ipc/files'
import { registerLoggingIpc } from './ipc/logging'
import { registerHistoryIpc } from './ipc/history'
import { registerHFModelIpc } from './ipc/huggingface'
import { registerWindowIpc } from './ipc/window'
import { ToolExecutor } from './tools/tool-executor'

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
    console.log('[MAIN] Another instance is already running. Quitting...')
    app.quit()
} else {
    app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })

    // Initialize Logger
    initAppLogger()
    console.log('[MAIN] Application starting up - Streamlined Services')
}

let mainWindow: BrowserWindow | null = null

const allowedFileRoots = new Set<string>([
    app.getPath('home'),
    app.getPath('desktop'),
    app.getPath('documents')
])

const {
    settingsService,
    databaseService,
    localAIService,
    ollamaService,
    copilotService,
    llmService,
    proxyService,
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
    commandService,
    fileSystemService,
    sshService
} = createServices(allowedFileRoots)

const mcpServices = buildMcpServices({
    web: contentService as any,
    utility: utilityService,
    system: systemService,
    ssh: sshService,
    screenshot: screenshotService,
    scanner: contentService as any,
    notification: notificationService,
    network: networkService,
    monitoring: monitoringService,
    git: gitService,
    security: securityService,
    settings: settingsService,
    filesystem: fileSystemService,
    file: fileSystemService as any,
    embedding: embeddingService,
    docker: dockerService,
    database: databaseService,
    content: contentService as any,
    command: commandService,
    clipboard: clipboardService
})

const mcpDispatcher = new McpDispatcher(mcpServices, settingsService)
const toolExecutor = new ToolExecutor({
    fileSystem: fileSystemService,
    command: commandService,
    web: contentService as any,
    screenshot: screenshotService,
    system: systemService,
    network: networkService,
    notification: notificationService,
    docker: dockerService,
    ssh: sshService,
    scanner: contentService as any,
    embedding: embeddingService,
    utility: utilityService,
    content: contentService as any,
    file: fileSystemService as any,
    monitor: monitoringService,
    clipboard: clipboardService,
    git: gitService,
    security: securityService,
    mcp: mcpDispatcher
})

function updateOpenAIConnection() {
    const settings = settingsService.getSettings()
    llmService.setOpenAIApiKey(settings.openai?.apiKey || '')
    llmService.setOpenAIBaseUrl(settings.proxy?.enabled && settings.proxy?.url ? settings.proxy.url : 'https://api.openai.com/v1')

    // Initialize other providers too
    if (settings.anthropic?.apiKey) llmService.setAnthropicApiKey(settings.anthropic.apiKey)
    if (settings.gemini?.apiKey) llmService.setGeminiApiKey(settings.gemini.apiKey)
    if (settings.groq?.apiKey) llmService.setGroqApiKey(settings.groq.apiKey)
}

function updateOllamaConnection() {
    // Handled internally by localAIService via settings updates
}

registerSettingsIpc({ settingsService, llmService, updateOpenAIConnection, updateOllamaConnection })
registerAuthIpc(proxyService, settingsService, copilotService)
registerDbIpc(databaseService)
registerOllamaIpc({ localAIService, settingsService, llmService, ollamaService })
registerChatIpc({ settingsService, copilotService, llmService, proxyService })
registerToolsIpc(toolExecutor, commandService)
registerMcpIpc(mcpDispatcher)
registerFilesIpc(() => mainWindow, fileSystemService, allowedFileRoots)
registerProxyIpc(proxyService)
registerProxyEmbedIpc(proxyService)
registerLoggingIpc()
registerHFModelIpc(llmService as any) // Casting as LLMService has searchHFModels
registerHistoryIpc(historyImportService)
registerScreenshotIpc()
registerDialogIpc(() => mainWindow)
registerWindowIpc(() => mainWindow)

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280, height: 800, minWidth: 900, minHeight: 600, frame: false,
        backgroundColor: '#00000000', transparent: true,
        webPreferences: { preload: join(__dirname, '../preload/preload.js'), nodeIntegration: false, contextIsolation: true }
    })
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http')) shell.openExternal(url)
        return { action: 'deny' }
    })
    mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(async () => {
    await databaseService.initialize()

    // Initial key load
    updateOpenAIConnection()

    const projects = databaseService.getProjects()
    projects.forEach(p => allowedFileRoots.add(p.path))
    fileSystemService.updateAllowedRoots(Array.from(allowedFileRoots))

    const settings = settingsService.getSettings()
    if (settings.copilot?.token) copilotService.setGithubToken(settings.copilot.token)

    await proxyService.startEmbeddedProxy({ port: 8317 })
    createWindow()
})

app.on('will-quit', async () => { await proxyService.stopEmbeddedProxy() })
