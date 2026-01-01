import { app, BrowserWindow, ipcMain, desktopCapturer, shell, dialog, globalShortcut, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as http from 'http'
import * as fs from 'fs'
// const pdf = require('pdf-parse')
import { OllamaService } from './services/ollama.service'
import { FileSystemService } from './services/filesystem.service'
import { CommandService } from './services/command.service'
import { WebService } from './services/web.service'
import { LlamaService } from './services/llama.service'
import { DatabaseService } from './services/database.service'
import { SSHService } from './services/ssh.service'
import { ScannerService } from './services/scanner.service'
import { EmbeddingService } from './services/embedding.service'
import { DockerService } from './services/docker.service'
import { SecurityService } from './services/security.service'
import { ContentService } from './services/content.service'
import { FileManagementService } from './services/file.service'
import { UtilityService } from './services/utility.service'
import { OpenAIService } from './services/openai.service'
import { AnthropicService } from './services/anthropic.service'
import { GeminiService } from './services/gemini.service'
import { GroqService } from './services/groq.service'
import { MonitoringService } from './services/monitoring.service'
import { SettingsService } from './services/settings.service'
import { SystemService } from './services/system.service'
import { NetworkService } from './services/network.service'
import { NotificationService } from './services/notification.service'
import { ClipboardService } from './services/clipboard.service'
import { GitService } from './services/git.service'

const execAsync = promisify(exec)

// Single instance lock - prevent multiple windows
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
    app.quit()
}

// Disable GPU shader disk cache to prevent permission errors
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-software-rasterizer')

import { AuthService } from './services/auth.service'
import { CopilotService } from './services/copilot.service'
import { ToolExecutor } from './tools/tool-executor'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// Services
const ollamaService = new OllamaService()
const fileSystemService = new FileSystemService()
const commandService = new CommandService()
const webService = new WebService()
const llamaService = new LlamaService()
const databaseService = new DatabaseService()
const sshService = new SSHService()
const settingsService = new SettingsService()
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

const embeddingService = new EmbeddingService(databaseService, ollamaService, openaiService, llamaService)
const utilityService = new UtilityService(databaseService, scannerService, embeddingService)
const dockerService = new DockerService(commandService, sshService)

const toolExecutor = new ToolExecutor(
    fileSystemService,
    commandService,
    webService,
    systemService,
    networkService,
    notificationService,
    clipboardService,
    utilityService,
    gitService,
    dockerService,
    securityService,
    contentService,
    fileService,
    monitoringService
)

// Window Controls
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize()
    } else {
        mainWindow?.maximize()
    }
})
ipcMain.on('window:close', () => mainWindow?.close())
ipcMain.on('window:toggle-compact', (_, enabled) => {
    if (enabled) {
        mainWindow?.setSize(400, 600)
    } else {
        mainWindow?.setSize(1200, 800)
    }
})

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

    // Update API Key
    if (settings.openai?.apiKey) {
        openaiService.setApiKey(settings.openai.apiKey)
    }

    // Update Proxy / Base URL
    if (settings.proxy && settings.proxy.enabled && settings.proxy.url) {
        openaiService.setBaseUrl(settings.proxy.url)
        // Use proxy key if provided, otherwise default fallback
        openaiService.setApiKey(settings.proxy.key || 'proxypal-local')
        console.log(`Proxy enabled: ${settings.proxy.url}`)
    } else {
        // Reset to default if proxy is disabled
        openaiService.setBaseUrl('https://api.openai.com/v1')
        // Restore OpenAI key
        if (settings.openai?.apiKey) {
            openaiService.setApiKey(settings.openai.apiKey)
        }
    }
    console.log('OpenAI Service updated.')
}

updateOpenAIConnection()

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        backgroundColor: '#00000000',
        transparent: true,
        webPreferences: {
            preload: join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false // Allow loading local resources
        }
    })

    if (process.env.NODE_ENV === 'development') {
        let rendererPort = process.argv[2]
        // If port is not provided or is a flag (like --no-sandbox), default to 5173
        if (!rendererPort || isNaN(Number(rendererPort))) {
            rendererPort = '5173'
        }
        console.log(`Loading Renderer on port: ${rendererPort}`)
        mainWindow.loadURL(`http://localhost:${rendererPort}`)
        mainWindow.webContents.openDevTools()
    } else {
        mainWindow.loadFile(join(app.getAppPath(), 'renderer', 'index.html'))
    }

    // Tray Setup
    try {
        const iconPath = process.env.NODE_ENV === 'development'
            ? join(process.cwd(), 'src/renderer/assets/logo.png')
            : join(process.resourcesPath, 'assets/logo.png')

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
    // Native Copilot Models (No external proxy needed)
    return [
        { id: 'gpt-4', name: 'GPT-4 (Native)', owned_by: 'copilot (native)' },
        { id: 'gpt-4o', name: 'GPT-4o (Native)', owned_by: 'copilot (native)' },
        { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Native)', owned_by: 'copilot (native)' },
        { id: 'gemini-2.0-flash-thinking-exp-1219', name: 'Gemini 2.0 Flash Thinking (Native)', owned_by: 'copilot (native)' }
    ]
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
        // NATIVE INTEGRATION:
        // Attempt to use Copilot Service for everything unless specifically routed otherwise
        // (Since we removed the external proxy)
        const settings = settingsService.getSettings()

        // If we have a GitHub token, prefer native Copilot service
        if (settings.github?.token) {
            console.log('[Main] Routing to Native Copilot Service')
            return await copilotService.chat(messages, model)
        }

        // Fallback (e.g. if user has OpenAI Key but no GitHub token)
        console.log('[Main] No GitHub token, falling back to OpenAI Service')
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
    console.error('Uncaught Exception:', error)
})

// Auth & Copilot Handlers
ipcMain.handle('auth:github-login', async () => {
    return await authService.startLoginFlow()
})

ipcMain.handle('auth:poll-token', async (_, deviceCode: string, interval: number) => {
    try {
        const token = await authService.pollForToken(deviceCode, interval)
        // Save token to settings
        const currentGithub = settingsService.getSettings().github;
        settingsService.saveSettings({
            github: {
                username: currentGithub?.username || '',
                token: token
            }
        })

        // Pass to Copilot Service
        copilotService.setGithubToken(token)

        return { success: true, token }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
})

// STARTUP
app.whenReady().then(async () => {
    // Load Extension
    // session.defaultSession.loadExtension('C:/Users/agnes/AppData/Local/Google/Chrome/User Data/Default/Extensions/jjndjgheafjngoipoacpjgeicjeomjli/1.0_0')

    // Initialize DB
    await databaseService.initialize()
    console.log(`Database initialized: ${databaseService['dbPath']}`)

    // Initialize Auth/Copilot with existing token if available
    const currentSettings = settingsService.getSettings()
    if (currentSettings.github?.token) {
        console.log('Found saved GitHub token, initializing Copilot Service...')
        copilotService.setGithubToken(currentSettings.github.token)
    }

    // Try to start Ollama automatically (without asking permission on startup)
    try {
        const ollamaRunning = await isOllamaRunning()
        if (!ollamaRunning) {
            console.log('Ollama is not running, attempting to start...')
            const result = await startOllama(false)
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
