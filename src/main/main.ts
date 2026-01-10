import { app, BrowserWindow, shell, protocol, HandlerDetails } from 'electron'
import { join } from 'path'
import * as path from 'path'
import * as fs from 'fs'

import { createServices, container } from './startup/services'
import { McpDispatcher } from './mcp/dispatcher'
import { appLogger, LogLevel } from './logging/logger'

// Initialize Logger
appLogger.setLevel(LogLevel.DEBUG)
appLogger.installConsoleRedirect()

appLogger.info('Startup', `ELECTRON_RENDERER_URL: ${process.env['ELECTRON_RENDERER_URL']}`)
appLogger.info('Startup', `app.isPackaged: ${app.isPackaged}`)
appLogger.info('Startup', `Loading from: ${(!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) ? 'DEV SERVER (HMR Active)' : 'STATIC FILES (No HMR)'}`)

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
import { registerAgentIpc } from './ipc/agent'
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
import { registerMemoryIpc } from './ipc/memory'

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
        win.setTitle('ORBIT')
    })

    win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
        const levels = ['debug', 'info', 'warn', 'error']
        const lvl = levels[level] as 'debug' | 'info' | 'warn' | 'error'
        const context = `renderer:${path.basename(sourceId)}:${line}`
        appLogger[lvl](context, message)
    })

    win.webContents.setWindowOpenHandler((details: HandlerDetails) => {
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
    app.setAppUserModelId('Orbit')
    app.name = 'Orbit'

    // Isolate Electron runtime folders to a subfolder
    const runtimePath = join(app.getPath('appData'), 'Orbit', 'runtime')
    app.setPath('userData', runtimePath)

    // Migration from orbit-ai to Orbit
    const oldPath = path.join(app.getPath('appData'), 'orbit-ai')
    const newPath = app.getPath('userData') // This should now point to Orbit due to app.name change

    if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
        try {
            appLogger.info('Main', `Migrating AppData from ${oldPath} to ${newPath}`)
            fs.renameSync(oldPath, newPath)
        } catch (e) {
            appLogger.error('Main', `Failed to migrate AppData folder: ${e}`)
        }
    }

    const allowedFileRoots = new Set([app.getPath('userData'), app.getPath('home')])

    protocol.registerFileProtocol('safe-file', (request, callback) => {
        let url = request.url.replace('safe-file://', '')

        // Handle Windows drive letters (e.g., /C:/Users -> C:/Users)
        if (process.platform === 'win32') {
            if (/^\/[a-zA-Z]:/.test(url)) {
                url = url.slice(1)
            } else if (/^[a-zA-Z]\//.test(url)) {
                url = url.substring(0, 1) + ':' + url.substring(1)
            }
        }

        const decoded = decodeURIComponent(url)
        const absolutePath = path.resolve(decoded)

        // Security check: Must be in allowed roots
        const allowed = Array.from(allowedFileRoots).some(root => absolutePath.startsWith(path.resolve(root)))
        if (!allowed) {
            appLogger.error('Security', `Denied attempt to access file outside allowed roots via protocol: ${absolutePath}`)
            return callback({ error: -6 }) // NET_ERROR(FILE_NOT_FOUND) or similar
        }

        try {
            return callback(absolutePath)
        } catch (error) {
            console.error('[SAFE-FILE] Error:', error)
        }
    })

    const services = await createServices(allowedFileRoots)
    console.log(`[Main] !!! createServices completed.`);
    if (services.settingsService['authService']) {
        const tokens = services.settingsService['authService'].getAllTokens();
        console.log(`[Main] !!! AuthService identified ${Object.keys(tokens).length} tokens at startup. Keys: ${JSON.stringify(Object.keys(tokens))}`);
    }

    await services.databaseService.initialize()
    await services.proxyService.startEmbeddedProxy()

    const mcpDispatcher = new McpDispatcher([], services.settingsService)

    const toolExecutor = new ToolExecutor({
        fileSystem: services.fileSystemService,
        command: services.commandService,
        web: services.webService,
        screenshot: services.screenshotService,
        system: services.systemService,
        network: services.networkService,
        notification: services.notificationService,
        docker: services.dockerService,
        ssh: services.sshService,
        scanner: services.scannerService,
        embedding: services.embeddingService,
        utility: services.utilityService,
        content: services.contentService,
        file: services.fileManagementService,
        monitor: services.monitoringService,
        clipboard: services.clipboardService,
        git: services.gitService,
        security: services.securityService,
        mcp: mcpDispatcher,
        llm: services.llmService,
        memory: services.memoryService,
        pageSpeed: services.pageSpeedService
    })

    // Register all IPC handlers BEFORE creating window to prevent race conditions
    registerWindowIpc(() => mainWindow)

    // Initialize Copilot Token
    const settings = services.settingsService.getSettings()
    console.log(`[Main] !!! settings.github.token length: ${settings.github?.token?.length || 0}`);
    console.log(`[Main] !!! settings.copilot.token length: ${settings.copilot?.token?.length || 0}`);
    const copilotToken = settings.copilot?.token || settings.github?.token
    if (copilotToken) {
        services.copilotService.setGithubToken(copilotToken)
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
        proxyService: services.proxyService,
        codeIntelligenceService: services.codeIntelligenceService
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

    registerProjectIpc(() => mainWindow, services.projectService, services.logoService, services.codeIntelligenceService)
    registerAgentIpc(services.agentService)
    registerProcessIpc(services.processService)
    setupProcessEvents(services.processService)
    registerCodeIntelligenceIpc(services.codeIntelligenceService)

    registerDbIpc(services.databaseService, services.embeddingService)
    registerLlamaIpc(services.llamaService)
    registerMemoryIpc(services.memoryService)


    registerSettingsIpc({
        settingsService: services.settingsService,
        llmService: services.llmService,
        copilotService: services.copilotService,
        updateOpenAIConnection: () => mainWindow?.webContents.send('openai:connection-status', services.llmService.isOpenAIConnected()),
        updateOllamaConnection: () => { }
    })

    registerSshIpc(() => mainWindow, services.sshService)
    registerFilesIpc(() => mainWindow, services.fileSystemService, new Set([app.getPath('userData'), app.getPath('home')]))
    registerHFModelIpc(services.llmService, services.huggingFaceService)

    registerToolsIpc(toolExecutor, services.commandService)
    registerMcpIpc(mcpDispatcher)

    registerScreenshotIpc()
    registerLoggingIpc()

    // Terminal needs the instance - use getter for deferred access
    registerTerminalIpc(() => mainWindow)

    registerDialogIpc(() => mainWindow)
    registerHistoryIpc(services.historyImportService)

    registerProxyEmbedIpc(services.proxyService)
    registerExportIpc(() => mainWindow)

    // Council IPC
    registerCouncilIpc(services.agentCouncilService, services.databaseService)

    // Register Gallery IPC
    registerGalleryIpc(services.dataService.getPath('gallery'))

    // NOW create window after all handlers are registered
    mainWindow = createWindow()

    // Initialize Auto-Updater
    services.updateService.init(mainWindow)

    // Initialize Crash Reporting
    services.sentryService.init()



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

// Cleanup on app quit - prevent memory leaks
app.on('before-quit', async () => {
    console.log('[Main] Cleaning up before quit...')
    try {
        // Services cleanup will be triggered via global reference
        // This is a safety net for any remaining resources
        if (global.gc) {
            global.gc()
            console.log('[Main] Manual GC triggered')
        }

        await container.dispose();
        console.log('[Main] Services disposed gracefully');

    } catch (e) {
        console.error('[Main] Cleanup error:', e)
    }
})

