import { app, BrowserWindow, shell, protocol } from 'electron'
import { join } from 'path'
import * as path from 'path'

import { createServices } from './startup/services'
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
        const lvl = levels[level] || 'info'
        const context = `renderer:${path.basename(sourceId)}:${line}`
        // @ts-ignore
        appLogger[lvl](context, message)
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
    app.setAppUserModelId('Orbit')
    app.name = 'Orbit'

    // Isolate Electron runtime folders to a subfolder
    const runtimePath = join(app.getPath('appData'), 'Orbit', 'runtime')
    app.setPath('userData', runtimePath)

    // Migration from orbit-ai to Orbit
    const fs = require('fs')
    const path = require('path')
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

    const services = await createServices(new Set([app.getPath('userData'), app.getPath('home')]))
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
        llm: services.llmService,
        memory: services.memoryService,
        pageSpeed: services.pageSpeedService
    })

    // Register all IPC handlers BEFORE creating window to prevent race conditions
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

    registerProjectIpc(services.projectService, services.logoService, services.codeIntelligenceService)
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
    } catch (e) {
        console.error('[Main] Cleanup error:', e)
    }
})

