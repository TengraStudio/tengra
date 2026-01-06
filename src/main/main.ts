import { app, BrowserWindow, shell, protocol } from 'electron'
import { join } from 'path'


import { createServices } from './startup/services'
import { McpDispatcher } from './mcp/dispatcher'

// IPC Registrations
import { registerWindowIpc } from './ipc/window'
import { registerAuthIpc } from './ipc/auth'
import { registerProxyIpc } from './ipc/proxy'
import { registerChatIpc } from './ipc/chat'
import { registerOllamaIpc } from './ipc/ollama'
import { registerDbIpc } from './ipc/db'
import { registerSettingsIpc } from './ipc/settings'
import { registerSshIpc } from './ipc/ssh'
import { registerFilesIpc } from './ipc/files'
import { registerToolsIpc } from './ipc/tools'
import { registerMcpIpc } from './ipc/mcp'
import { registerScreenshotIpc } from './ipc/screenshot'
import { registerHFModelIpc } from './ipc/huggingface'
import { registerProjectIpc } from './ipc/project'
import { registerLoggingIpc } from './ipc/logging'
import { registerTerminalIpc } from './ipc/terminal'
import { registerDialogIpc } from './ipc/dialog'
import { registerHistoryIpc } from './ipc/history'
import { registerProxyEmbedIpc } from './ipc/proxy-embed'
import { registerExportIpc } from './ipc/export'
import { registerCouncilIpc } from './ipc/council'
import { registerGalleryIpc } from './ipc/gallery'
import { registerLlamaIpc } from './ipc/llama'
import { registerProcessIpc, setupProcessEvents } from './ipc/process'
import { registerCodeIntelligenceIpc } from './ipc/code-intelligence'
import { ToolExecutor } from './tools/tool-executor'

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false,
        frame: false,
        backgroundColor: '#000000',
        autoHideMenuBar: true,
        webPreferences: {
            preload: join(__dirname, '../preload/preload.js'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    win.on('ready-to-show', () => {
        win.show()
    })

    win.webContents.setWindowOpenHandler((details: any) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
        win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        win.loadFile(join(__dirname, '../renderer/index.html'))
    }

    return win
}

protocol.registerSchemesAsPrivileged([
    { scheme: 'safe-file', privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true } }
])

app.whenReady().then(async () => {
    app.setAppUserModelId('com.github.orbit-ai')

    protocol.registerFileProtocol('safe-file', (request, callback) => {
        let url = request.url.replace('safe-file://', '')

        // Handle Windows drive letters (e.g., /C:/Users -> C:/Users)
        // If the path starts with a slash followed by a drive letter, strip the slash
        if (process.platform === 'win32') {
            if (/^\/[a-zA-Z]:/.test(url)) {
                url = url.slice(1)
            } else if (/^[a-zA-Z]\//.test(url)) {
                // Handle malformed 2-slash URLs where colon is stripped (e.g. c/Users -> c:/Users)
                url = url.substring(0, 1) + ':' + url.substring(1)
            }
        }

        const decoded = decodeURIComponent(url)
        try {
            return callback(decoded)
        } catch (error) {
            console.error('[SAFE-FILE] Error:', error)
        }
    })

    const services = createServices(new Set([app.getPath('userData'), app.getPath('home')]))
    await services.databaseService.initialize()
    await services.proxyService.startEmbeddedProxy()

    const mcpDispatcher = new McpDispatcher([], services.settingsService)

    const toolExecutor = new ToolExecutor({
        fileSystem: services.fileSystemService,
        command: services.commandService,
        web: services.utilityService as any,
        screenshot: services.screenshotService,
        system: services.systemService,
        network: services.networkService,
        notification: services.notificationService,
        docker: services.dockerService,
        ssh: services.sshService,
        scanner: services.monitoringService as any,
        embedding: services.embeddingService,
        utility: services.utilityService,
        content: services.contentService,
        file: services.fileSystemService as any,
        monitor: services.monitoringService,
        clipboard: services.clipboardService,
        git: services.gitService,
        security: services.securityService,
        mcp: mcpDispatcher,
        llm: services.llmService
    })

    // Create window FIRST so we can pass it to synchronous registers if needed
    mainWindow = createWindow()

    // Register all IPC handlers
    registerWindowIpc(() => mainWindow)

    // Initialize Copilot Token
    const settings = services.settingsService.getSettings()
    const validToken = settings.copilot?.token || settings.github?.token
    if (validToken) {
        services.copilotService.setGithubToken(validToken)
    }

    // Sync proxy settings to LLMService
    const proxyUrl = settings.proxy?.url || 'http://localhost:8317/v1'
    const proxyKey = services.proxyService.getProxyKey()
    services.llmService.setProxySettings(proxyUrl, proxyKey)

    registerAuthIpc(services.proxyService, services.settingsService, services.copilotService)
    registerProxyIpc(services.proxyService)
    registerChatIpc({
        settingsService: services.settingsService,
        copilotService: services.copilotService,
        llmService: services.llmService,
        proxyService: services.proxyService
    })

    registerOllamaIpc({
        localAIService: services.localAIService,
        settingsService: services.settingsService,
        llmService: services.llmService,
        ollamaService: services.ollamaService,
        ollamaHealthService: services.ollamaHealthService,
        proxyService: services.proxyService,
        copilotService: services.copilotService,
        llamaService: services.llamaService
    })

    registerProjectIpc(services.projectService)
    registerProcessIpc(services.processService)
    setupProcessEvents(services.processService)
    registerCodeIntelligenceIpc(services.codeIntelligenceService)

    registerDbIpc(services.databaseService)
    registerLlamaIpc(services.llamaService)

    registerSettingsIpc({
        settingsService: services.settingsService,
        llmService: services.llmService,
        updateOpenAIConnection: () => { },
        updateOllamaConnection: () => { }
    })

    registerSshIpc(() => mainWindow, services.sshService)
    registerFilesIpc(() => mainWindow, services.fileSystemService, new Set([app.getPath('userData'), app.getPath('home')]))
    registerHFModelIpc(services.llmService, services.huggingFaceService)

    registerToolsIpc(toolExecutor, services.commandService)
    registerMcpIpc(mcpDispatcher)

    registerScreenshotIpc()
    registerLoggingIpc()

    // Terminal needs the instance
    registerTerminalIpc(mainWindow)

    registerDialogIpc(() => mainWindow)
    registerHistoryIpc(services.historyImportService)

    registerProxyEmbedIpc(services.proxyService)
    registerExportIpc(() => mainWindow)

    // Council IPC registered already? No, we will do it after creating service properly.
    // Actually, createServices does it. We just need to register IPC.
    // registerCouncilIpc(services.councilService, services.databaseService)
    // Wait, services.councilService in createServices was created with OLD deps.
    // We need to fix createServices function in services.ts first.
    registerCouncilIpc(services.councilService, services.databaseService)

    // Register Gallery IPC
    const galleryPath = join(app.getPath('pictures'), 'Orbit', 'Gallery')
    registerGalleryIpc(galleryPath)

    // Re-create on activate if needed
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
