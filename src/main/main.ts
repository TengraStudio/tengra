import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import os from 'os'
import { initAppLogger, appLogger } from './logging/logger'
import { createServices } from './startup/services'
import { registerSettingsIpc } from './ipc/settings'
import { registerAuthIpc } from './ipc/auth'
import { registerDbIpc } from './ipc/db'
import { registerOllamaIpc } from './ipc/ollama'
import { registerChatIpc } from './ipc/chat'
import { registerToolsIpc } from './ipc/tools'
import { registerScreenshotIpc } from './ipc/screenshot'
import { registerDialogIpc } from './ipc/dialog'
// const pdf = require('pdf-parse')
import { buildMcpServices } from './mcp/registry'
import { McpDispatcher } from './mcp/dispatcher'
import { registerWindowIpc } from './ipc/window'
import { registerProxyIpc } from './ipc/proxy'
import { registerMcpIpc } from './ipc/mcp'
import { registerProxyEmbedIpc } from './ipc/proxy-embed'
import { registerFilesIpc } from './ipc/files'
import { registerLoggingIpc } from './ipc/logging'
import { registerHistoryIpc } from './ipc/history'
import { registerHFModelIpc } from './ipc/huggingface'
import { registerSshIpc } from './ipc/ssh'

// Single instance lock - prevent multiple windows
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
    app.quit()
}

// Disable GPU shader disk cache to prevent permission errors
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-software-rasterizer')
initAppLogger()
appLogger.info('User data path resolved', { source: 'startup', data: { path: app.getPath('userData') } })

import { ToolExecutor } from './tools/tool-executor'
import { startOllama, isOllamaRunning } from './startup/ollama'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
const userHome = os.homedir()
const allowedFileRoots = new Set<string>([
    process.cwd(),
    app.getPath('userData'),
    userHome,
    join(userHome, 'Desktop'),
    join(userHome, 'Documents'),
    join(userHome, 'Downloads')
])

const services = createServices(allowedFileRoots)
const {
    ollamaService,
    fileSystemService,
    commandService,
    webService,
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
    embeddingService,
    utilityService,
    dockerService,
    screenshotService,
    historyImportService,
    huggingfaceService
} = services

const mcpDispatcher = new McpDispatcher(
    buildMcpServices({
        web: webService,
        utility: utilityService,
        system: systemService,
        ssh: sshService,
        screenshot: screenshotService,
        scanner: scannerService,
        notification: notificationService,
        network: networkService,
        monitoring: monitoringService,
        git: gitService,
        security: securityService,
        settings: settingsService,
        filesystem: fileSystemService,
        file: fileService,
        embedding: embeddingService,
        docker: dockerService,
        database: databaseService,
        content: contentService,
        command: commandService,
        clipboard: clipboardService
    }),
    settingsService
)

const toolExecutor = new ToolExecutor(
    {
        fileSystem: fileSystemService,
        command: commandService,
        web: webService,
        screenshot: screenshotService,
        system: systemService,
        network: networkService,
        notification: notificationService,
        clipboard: clipboardService,
        utility: utilityService,
        git: gitService,
        docker: dockerService,
        security: securityService,
        content: contentService,
        file: fileService,
        monitor: monitoringService,
        ssh: sshService,
        scanner: scannerService,
        embedding: embeddingService,
        mcp: mcpDispatcher
    }
)

registerWindowIpc(() => mainWindow)
registerFilesIpc(() => mainWindow, fileSystemService, allowedFileRoots)
registerSshIpc(() => mainWindow, sshService)
registerProxyIpc(proxyService)
registerProxyEmbedIpc(proxyEmbedService)
registerMcpIpc(mcpDispatcher)
registerLoggingIpc()
registerHistoryIpc(historyImportService)
registerSettingsIpc({
    settingsService,
    ollamaService,
    openaiService,
    anthropicService,
    geminiService,
    groqService,
    updateOllamaConnection,
    updateOpenAIConnection
})
registerAuthIpc(authService, settingsService, copilotService)
registerDbIpc(databaseService)
registerOllamaIpc({
    ollamaService,
    settingsService,
    copilotService,
    openaiService,
    toolExecutor
})
registerChatIpc({
    settingsService,
    copilotService,
    openaiService,
    anthropicService,
    geminiService,
    groqService
})
registerToolsIpc(toolExecutor, commandService)
registerScreenshotIpc()
registerDialogIpc(() => mainWindow)
registerHFModelIpc(huggingfaceService)

// Initialize Ollama Connection
function updateOllamaConnection() {
    const settings = settingsService.getSettings()
    try {
        const url = new URL(settings.ollama.url)
        ollamaService.setConnection(url.hostname, parseInt(url.port) || 80)
        console.log(`Ollama configured to: ${url.hostname}:${url.port}`)
    } catch (e) {
        console.error('Invalid Ollama URL in settings:', settings.ollama.url)
    }
}

// Call on startup
updateOllamaConnection()

function updateOpenAIConnection() {
    const settings = settingsService.getSettings()
    const resolvedOpenAiKey = settings.openai?.apiKey && settings.openai.apiKey !== 'connected'
        ? settings.openai.apiKey
        : ''
    const proxyUrl = settings.proxy?.url?.replace('localhost', '127.0.0.1')
    const shouldUseProxy = Boolean(proxyUrl) && (settings.proxy?.enabled || !resolvedOpenAiKey)

    // Update Proxy / Base URL
    if (shouldUseProxy) {
        openaiService.setBaseUrl(proxyUrl!)
        // Use proxy key if provided, otherwise clear any stale key
        openaiService.setApiKey(settings.proxy?.key || '')
        console.log(`Proxy enabled: ${proxyUrl}`)
    } else {
        // Reset to default if proxy is disabled
        openaiService.setBaseUrl('https://api.openai.com/v1')
        // Restore OpenAI key
        openaiService.setApiKey(resolvedOpenAiKey)
    }
    console.log('OpenAI Service updated.')
}

updateOpenAIConnection()

const iconPath = process.env.NODE_ENV === 'development'
    ? join(process.cwd(), 'src/renderer/assets/logo.png')
    : join(process.resourcesPath, 'assets/logo.png')

function createWindow() {
    const settings = settingsService.getSettings()
    const { width, height } = settings.window || { width: 1200, height: 800 }

    mainWindow = new BrowserWindow({
        width,
        height,
        minWidth: 1000,
        minHeight: 600,
        frame: false,
        backgroundColor: '#00000000',
        transparent: true,
        icon: nativeImage.createFromPath(iconPath),
        webPreferences: {
            preload: join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true
        }
    })

    mainWindow.on('resize', () => {
        if (!mainWindow) return
        const [newWidth, newHeight] = mainWindow.getSize()
        const current = settingsService.getSettings()
        settingsService.saveSettings({ ...current, window: { ...current.window, x: current.window?.x || 0, y: current.window?.y || 0, width: newWidth, height: newHeight } })
    })

    if (process.env.NODE_ENV === 'development') {
        let rendererPort = process.argv[2]
        // If port is not provided or is a flag (like --no-sandbox), default to 5173
        if (!rendererPort || isNaN(Number(rendererPort))) {
            rendererPort = '5173'
        }
        console.log(`Loading Renderer on port: ${rendererPort}`)
        mainWindow.loadURL(`http://localhost:${rendererPort}`)
        // mainWindow.webContents.openDevTools()
    } else {
        mainWindow.loadFile(join(app.getAppPath(), 'renderer', 'index.html'))
    }

    // Tray Setup
    try {
        // Create icon from file with better resizing for Windows Tray
        const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
        tray = new Tray(icon)

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Göster / Gizle', click: () => {
                    if (mainWindow?.isVisible()) {
                        mainWindow.hide()
                    } else {
                        mainWindow?.show()
                        mainWindow?.focus()
                    }
                }
            },
            {
                label: 'Yeni Sohbet', click: () => {
                    mainWindow?.webContents.send('tray:new-chat')
                    mainWindow?.show()
                    mainWindow?.focus()
                }
            },
            { type: 'separator' },
            { label: 'Çıkış', click: () => app.quit() }
        ])
        tray.setContextMenu(contextMenu)
        tray.on('click', () => {
            if (mainWindow?.isVisible()) {
                mainWindow.hide()
            } else {
                mainWindow?.show()
                mainWindow?.focus()
            }
        })
    } catch (e) {
        console.error('Tray icon error:', e)
    }

    mainWindow.on('closed', () => {
        mainWindow = null
    })
}

// Global Exception Handler
process.on('uncaughtException', (error) => {
    if (error instanceof Error) {
        appLogger.error('Uncaught exception', { source: 'process', data: { message: error.message, stack: error.stack } })
    } else {
        appLogger.error('Uncaught exception', { source: 'process', data: { error: String(error) } })
    }
})
process.on('unhandledRejection', (reason) => {
    if (reason instanceof Error) {
        appLogger.error('Unhandled rejection', { source: 'process', data: { message: reason.message, stack: reason.stack } })
    } else {
        appLogger.error('Unhandled rejection', { source: 'process', data: { reason: String(reason) } })
    }
})

// STARTUP
app.whenReady().then(async () => {
    // Load Extension
    // session.defaultSession.loadExtension('C:/Users/agnes/AppData/Local/Google/Chrome/User Data/Default/Extensions/jjndjgheafjngoipoacpjgeicjeomjli/1.0_0')

    // Initialize DB
    await databaseService.initialize()

    // Load projects into allowed roots
    try {
        const projects = databaseService.getProjects()
        projects.forEach(p => allowedFileRoots.add(p.path))
        fileSystemService.updateAllowedRoots(Array.from(allowedFileRoots))
        console.log(`Added ${projects.length} project paths to allow-list.`)
    } catch (e) {
        console.error('Failed to load project paths:', e)
    }

    // Initialize Auth/Copilot with existing token if available
    const currentSettings = settingsService.getSettings()
    if (currentSettings.copilot?.token) {
        console.log('Found saved Copilot token, initializing Copilot Service...')
        copilotService.setGithubToken(currentSettings.copilot.token)
    } else if (currentSettings.github?.token) {
        console.log('Found saved GitHub token, initializing Copilot Service...')
        copilotService.setGithubToken(currentSettings.github.token)
    }

    // Start embedded Proxy Service
    console.log('Starting embedded Proxy Service...')
    await proxyEmbedService.start({ port: 8317 })

    // Try to start Ollama automatically (without asking permission on startup)
    try {
        const ollamaRunning = await isOllamaRunning()
        if (!ollamaRunning) {
            console.log('Ollama is not running, attempting to start...')
            const result = await startOllama(() => mainWindow, false)
            console.log('Ollama start result:', result.message)
        } else {
            console.log('Ollama is already running')
        }
    } catch (e) {
        console.error('Ollama startup error:', e)
    }

    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('will-quit', async () => {
    await proxyEmbedService.stop()
})
