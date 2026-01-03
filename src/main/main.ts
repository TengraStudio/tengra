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

// Settings IPC Handlers
ipcMain.handle('settings:get', () => {
    return settingsService.getSettings()
})

ipcMain.handle('settings:save', (_, newSettings) => {
    const saved = settingsService.saveSettings(newSettings)

    // Apply side effects
    if (newSettings.ollama) {
        updateOllamaConnection()
    }
    if (newSettings.openai) {
        openaiService.setApiKey(newSettings.openai.apiKey)
    }
    if (newSettings.anthropic) {
        anthropicService.setApiKey(newSettings.anthropic.apiKey)
    }
    if (newSettings.gemini) {
        geminiService.setApiKey(newSettings.gemini.apiKey)
    }
    if (newSettings.groq) {
        groqService.setApiKey(newSettings.groq.apiKey)
    }

    // Update OpenAIService for Proxy settings changes
    updateOpenAIConnection()

    return saved
})

ipcMain.handle('proxy:getModels', async () => {
    const settings = settingsService.getSettings()
    const models: any[] = []
    
    // GitHub Copilot models (requires GitHub token)
    if (settings.github?.token) {
        models.push(
            { id: 'copilot-gpt-4', name: 'GPT-4 (Copilot)', owned_by: 'github-copilot', category: 'copilot' },
            { id: 'copilot-gpt-4o', name: 'GPT-4o (Copilot)', owned_by: 'github-copilot', category: 'copilot' },
            { id: 'copilot-gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Copilot)', owned_by: 'github-copilot', category: 'copilot' }
        )
    }
    
    // OpenAI models (requires OpenAI API key)
    if (settings.openai?.apiKey) {
        models.push(
            { id: 'gpt-4', name: 'GPT-4', owned_by: 'openai', category: 'openai' },
            { id: 'gpt-4o', name: 'GPT-4o', owned_by: 'openai', category: 'openai' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', owned_by: 'openai', category: 'openai' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', owned_by: 'openai', category: 'openai' },
            { id: 'o1-preview', name: 'o1 Preview', owned_by: 'openai', category: 'openai' },
            { id: 'o1-mini', name: 'o1 Mini', owned_by: 'openai', category: 'openai' }
        )
    }
    
    // Anthropic models (requires Anthropic API key)
    if (settings.anthropic?.apiKey) {
        models.push(
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', owned_by: 'anthropic', category: 'anthropic' },
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', owned_by: 'anthropic', category: 'anthropic' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', owned_by: 'anthropic', category: 'anthropic' }
        )
    }
    
    // Google Gemini models (requires Gemini API key)
    if (settings.gemini?.apiKey) {
        models.push(
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', owned_by: 'google', category: 'gemini' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', owned_by: 'google', category: 'gemini' },
            { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', owned_by: 'google', category: 'gemini' }
        )
    }
    
    // Proxy models (when proxy is enabled, these are available through external proxy)
    if (settings.proxy?.enabled && settings.proxy?.url) {
        models.push(
            { id: 'gpt-4', name: 'GPT-4 (Proxy)', owned_by: 'proxy', category: 'proxy' },
            { id: 'gpt-4o', name: 'GPT-4o (Proxy)', owned_by: 'proxy', category: 'proxy' },
            { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (Proxy)', owned_by: 'proxy', category: 'proxy' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Proxy)', owned_by: 'proxy', category: 'proxy' }
        )
    }
    
    return models
})

ipcMain.handle('ollama:tags', async () => {
    return ollamaService.getModels()
})

ipcMain.handle('chat:copilot', async (_, messages, model) => {
    try {
        return await copilotService.chat(messages, model)
    } catch (error: any) {
        return { error: error.message }
    }
})

// Database Handlers
ipcMain.handle('db:createChat', (_, chat) => databaseService.createChat(chat))
ipcMain.handle('db:updateChat', (_, id, updates) => databaseService.updateChat(id, updates))
ipcMain.handle('db:deleteChat', (_, id) => databaseService.deleteChat(id))
ipcMain.handle('db:getChat', (_, id) => databaseService.getChat(id))
ipcMain.handle('db:getAllChats', () => databaseService.getAllChats())
ipcMain.handle('db:searchChats', (_, query) => databaseService.searchChats(query))
ipcMain.handle('db:addMessage', (_, message) => databaseService.addMessage(message))
ipcMain.handle('db:getMessages', (_, chatId) => databaseService.getMessages(chatId))
ipcMain.handle('db:getStats', () => databaseService.getStats())

// Ollama Alias
ipcMain.handle('ollama:getModels', async () => {
    return await ollamaService.getModels()
})

ipcMain.handle('ollama:chat', async (_, messages, model) => {
    return await ollamaService.chat(messages, model)
})

ipcMain.handle('ollama:chatStream', async (event, messages, model, tools) => {
    return await ollamaService.chatStream(messages, model, tools, (chunk) => {
        event.sender.send('ollama:streamChunk', chunk)
    })
})

ipcMain.handle('chat:openai', async (_, messages, model) => {
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    console.log('[Main] IPC chat:openai TRIGGERED for:', model)
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    try {
        const settings = settingsService.getSettings()
        
        // Determine the correct service based on model type
        const isCopilotModel = model.startsWith('copilot-') || model.startsWith('github-')
        const isGptModel = model.startsWith('gpt-') || model.startsWith('o1-')
        const isClaudeModel = model.startsWith('claude-')
        const isGeminiModel = model.startsWith('gemini-')
        const isGrokModel = model.startsWith('grok-')
        
        // Route Copilot-specific models to Copilot Service (requires GitHub token)
        if (isCopilotModel) {
            if (!settings.github?.token) {
                return { error: 'Copilot modelleri için GitHub Copilot girişi gereklidir. Ayarlar > GitHub bölümünden giriş yapın.' }
            }
            console.log('[Main] Routing Copilot model to Native Copilot Service:', model)
            return await copilotService.chat(messages, model)
        }
        
        // If proxy is enabled, route all non-Copilot models through proxy
        if (settings.proxy?.enabled && settings.proxy?.url) {
            console.log('[Main] Routing via Proxy:', model)
            return await openaiService.chat(messages, model)
        }
        
        // Route Claude models to Anthropic service or proxy
        if (isClaudeModel) {
            if (settings.anthropic?.apiKey) {
                console.log('[Main] Routing Claude model to Anthropic Service:', model)
                const result = await anthropicService.chat(messages, model)
                return result
            }
            return { error: 'Claude modelleri için Anthropic API anahtarı gereklidir veya Proxy modunu etkinleştirin.' }
        }
        
        // Route Gemini models to Gemini service or proxy
        if (isGeminiModel) {
            if (settings.gemini?.apiKey) {
                console.log('[Main] Routing Gemini model to Gemini Service:', model)
                const result = await geminiService.chat(messages, model)
                return result
            }
            return { error: 'Gemini modelleri için Google API anahtarı gereklidir veya Proxy modunu etkinleştirin.' }
        }
        
        // Route Grok models (xAI) - currently no direct API support, requires proxy
        // Note: Grok (xAI) is different from Groq (cloud provider)
        if (isGrokModel) {
            return { error: 'Grok (xAI) modelleri için Proxy modunu etkinleştirmeniz gerekiyor. Doğrudan API desteği henüz mevcut değil.' }
        }
        
        // Route GPT models - try Copilot first if token exists, then OpenAI API
        if (isGptModel) {
            // If user has GitHub Copilot access, use it for GPT models
            if (settings.github?.token) {
                console.log('[Main] Routing GPT model to Native Copilot Service:', model)
                return await copilotService.chat(messages, model)
            }
            // Otherwise use OpenAI API if key exists
            if (settings.openai?.apiKey) {
                console.log('[Main] Routing GPT model to OpenAI Service:', model)
                return await openaiService.chat(messages, model)
            }
            return { error: 'GPT modelleri için GitHub Copilot girişi veya OpenAI API anahtarı gereklidir.' }
        }
        
        // Fallback - try OpenAI service
        console.log('[Main] Fallback routing to OpenAI Service:', model)
        return await openaiService.chat(messages, model)
    } catch (error: any) {
        console.error('[Main] Chat Error:', error)
        return { error: error.message }
    }
})

ipcMain.handle('chat:anthropic', async (_, messages, model) => {
    try {
        const settings = settingsService.getSettings()
        // If proxy is enabled, route through OpenAI service
        if (settings.proxy?.enabled) {
            console.log(`Routing Anthropic request via proxy to ${model}`)
            const response = await openaiService.chat(messages, model)
            return {
                success: true,
                result: response.content
            }
        }
        return await anthropicService.chat(messages, model)
    } catch (error: any) {
        return { error: error.message }
    }
})

ipcMain.handle('chat:gemini', async (_, messages, model) => {
    try {
        const settings = settingsService.getSettings()
        // If proxy is enabled, route through OpenAI service
        if (settings.proxy?.enabled) {
            console.log(`Routing Gemini request via proxy to ${model}`)
            const response = await openaiService.chat(messages, model)
            return {
                success: true,
                result: response.content
            }
        }
        return await geminiService.chat(messages, model)
    } catch (error: any) {
        return { error: error.message }
    }
})

ipcMain.handle('chat:groq', async (_, messages, model) => {
    try {
        return await groqService.chat(messages, model)
    } catch (error: any) {
        return { error: error.message }
    }
})

// Force IPv4 fetch helper
function fetchIPv4(url: string, options?: RequestInit): Promise<Response> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url)
        const reqOptions: http.RequestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 80,
            path: urlObj.pathname + urlObj.search,
            method: options?.method || 'GET',
            headers: options?.headers as any,
            family: 4 // Force IPv4
        }

        const req = http.request(reqOptions, (res) => {
            let data = ''
            res.on('data', chunk => data += chunk)
            res.on('end', () => {
                resolve({
                    ok: res.statusCode! >= 200 && res.statusCode! < 300,
                    status: res.statusCode!,
                    json: () => Promise.resolve(JSON.parse(data)),
                    text: () => Promise.resolve(data)
                } as Response)
            })
        })

        req.on('error', reject)
        req.setTimeout(5000, () => {
            req.destroy()
            reject(new Error('Request timeout'))
        })

        if (options?.body) {
            req.write(options.body as string)
        }
        req.end()
    })
}

// Check if Ollama is running
async function isOllamaRunning(): Promise<boolean> {
    try {
        const response = await fetchIPv4('http://127.0.0.1:11434/api/tags')
        return response.ok
    } catch {
        return false
    }
}

// Check if Ollama is installed
async function isOllamaInstalled(): Promise<boolean> {
    try {
        await execAsync('where ollama', { shell: 'powershell.exe' })
        return true
    } catch {
        // Try common installation paths
        try {
            const result = await execAsync('Test-Path "$env:LOCALAPPDATA\\Programs\\Ollama\\ollama.exe"', { shell: 'powershell.exe' })
            return result.stdout.trim().toLowerCase() === 'true'
        } catch {
            return false
        }
    }
}

// Start Ollama with user confirmation
async function startOllama(askPermission: boolean = false): Promise<{ success: boolean; message: string }> {
    try {
        // First check if already running
        if (await isOllamaRunning()) {
            return { success: true, message: 'Ollama zaten çalışıyor' }
        }

        // Check if installed
        const installed = await isOllamaInstalled()
        if (!installed) {
            return {
                success: false,
                message: 'Ollama kurulu değil. https://ollama.com adresinden indirin.'
            }
        }

        // Ask for permission if needed
        if (askPermission && mainWindow) {
            const result = await dialog.showMessageBox(mainWindow, {
                type: 'question',
                buttons: ['Evet', 'Hayır'],
                defaultId: 0,
                title: 'Ollama Başlat',
                message: 'Ollama başlatılsın mı?',
                detail: 'AI modellerini kullanmak için Ollama\'nın çalışıyor olması gerekiyor.'
            })

            if (result.response !== 0) {
                return { success: false, message: 'Kullanıcı Ollama başlatmayı reddetti' }
            }
        }

        // Start Ollama using PowerShell Start-Process
        try {
            await execAsync(
                'Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden',
                { shell: 'powershell.exe' }
            )
        } catch (e) {
            // Try with full path
            try {
                await execAsync(
                    'Start-Process -FilePath "$env:LOCALAPPDATA\\Programs\\Ollama\\ollama.exe" -ArgumentList "serve" -WindowStyle Hidden',
                    { shell: 'powershell.exe' }
                )
            } catch {
                return { success: false, message: 'Ollama başlatılamadı' }
            }
        }

        // Wait for Ollama to start (max 15 seconds)
        for (let i = 0; i < 30; i++) {
            await new Promise(resolve => setTimeout(resolve, 500))
            if (await isOllamaRunning()) {
                return { success: true, message: 'Ollama başlatıldı' }
            }
        }

        return { success: false, message: 'Ollama başlatılamadı. Lütfen manuel olarak başlatın.' }
    } catch (error: any) {
        return { success: false, message: `Ollama başlatma hatası: ${error.message}` }
    }
}

ipcMain.handle('ollama:getLibraryModels', async () => {
    return await ollamaService.getLibraryModels()
})

// Tool execution
ipcMain.handle('tools:execute', async (_, toolName: string, args: any, toolCallId?: string) => {
    return await toolExecutor.execute(toolName, args, toolCallId)
})

ipcMain.handle('tools:kill', (_, toolCallId: string) => {
    return commandService.killCommand(toolCallId)
})

ipcMain.handle('tools:getDefinitions', () => {
    console.log('[Main] tools:getDefinitions called')
    try {
        const defs = toolExecutor.getToolDefinitions()
        console.log('[Main] tool definitions returned:', defs ? defs.length : 'null')
        return defs
    } catch (e) {
        console.error('[Main] tools:getDefinitions error:', e)
        return []
    }
})

// Screenshot
ipcMain.handle('screenshot:capture', async () => {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1920, height: 1080 }
        })
        const primarySource = sources[0] // Usually the first screen
        return primarySource.thumbnail.toDataURL()
    } catch (error) {
        console.error('Screenshot error:', error)
        throw error
    }
})

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
