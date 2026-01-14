import * as fs from 'fs'
import * as path from 'path'

import * as dotenv from 'dotenv'

dotenv.config()

import { app, BrowserWindow, HandlerDetails, Menu, nativeImage, protocol, shell, Tray } from 'electron'

// Set the application name early - this affects Task Manager display on Windows
app.setName('Orbit')

// On Windows, set the AppUserModelId for taskbar grouping and display name
if (process.platform === 'win32') {
    app.setAppUserModelId('com.orbit.app')
}

import { appLogger, LogLevel } from '@main/logging/logger'
import { McpDispatcher } from '@main/mcp/dispatcher'
import { SettingsService } from '@main/services/settings.service'
import { registerIpcHandlers } from '@main/startup/ipc'
import { container, createServices } from '@main/startup/services'
import { ToolExecutor } from '@main/tools/tool-executor'
import { getErrorMessage } from '@shared/utils/error.util'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let globalServices: Awaited<ReturnType<typeof createServices>> | null = null

function createWindow(settingsService?: SettingsService): BrowserWindow {
    // Get saved window settings or use defaults
    const settings = settingsService?.getSettings()
    const windowSettings = settings?.window
    const defaultWidth = 1280
    const defaultHeight = 800

    const win = new BrowserWindow({
        width: windowSettings?.width ?? defaultWidth,
        height: windowSettings?.height ?? defaultHeight,
        x: windowSettings?.x,
        y: windowSettings?.y,
        show: false,
        frame: false,
        backgroundColor: '#000000',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.resolve(app.getAppPath(), 'dist/preload/preload.js'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    // Apply fullscreen if saved
    if (windowSettings?.fullscreen === true) {
        win.setFullScreen(true)
    }

    win.on('ready-to-show', () => {
        win.show()
        win.setTitle('ORBIT')
    })

    // Save window position and size on move/resize
    let saveTimeout: NodeJS.Timeout | null = null
    const saveWindowState = () => {
        if (saveTimeout) { clearTimeout(saveTimeout) }
        saveTimeout = setTimeout(() => {
            if (settingsService && !win.isDestroyed()) {
                const bounds = win.getBounds()
                const isFullscreen = win.isFullScreen()
                const currentSettings = settingsService.getSettings()
                settingsService.saveSettings({
                    ...currentSettings,
                    window: {
                        ...currentSettings.window,
                        width: bounds.width,
                        height: bounds.height,
                        x: bounds.x,
                        y: bounds.y,
                        fullscreen: isFullscreen
                    }
                })
            }
        }, 500) // Debounce saves
    }

    win.on('moved', saveWindowState)
    win.on('resized', saveWindowState)
    win.on('enter-full-screen', () => {
        if (settingsService) {
            const currentSettings = settingsService.getSettings()
            const currentWindow = currentSettings.window
            settingsService.saveSettings({
                ...currentSettings,
                window: {
                    width: currentWindow?.width ?? defaultWidth,
                    height: currentWindow?.height ?? defaultHeight,
                    x: currentWindow?.x ?? 0,
                    y: currentWindow?.y ?? 0,
                    ...currentWindow,
                    fullscreen: true
                }
            })
        }
    })
    win.on('leave-full-screen', () => {
        if (settingsService) {
            const currentSettings = settingsService.getSettings()
            const currentWindow = currentSettings.window
            settingsService.saveSettings({
                ...currentSettings,
                window: {
                    width: currentWindow?.width ?? defaultWidth,
                    height: currentWindow?.height ?? defaultHeight,
                    x: currentWindow?.x ?? 0,
                    y: currentWindow?.y ?? 0,
                    ...currentWindow,
                    fullscreen: false
                }
            })
        }
    })

    win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
        const levels = ['debug', 'info', 'warn', 'error']
        const lvl = levels[level] as 'debug' | 'info' | 'warn' | 'error'
        const context = `renderer:${path.basename(sourceId)}:${line} `
        appLogger[lvl](context, message)
    })

    win.webContents.setWindowOpenHandler((details: HandlerDetails) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
        win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        win.loadFile(path.join(__dirname, '@renderer/index.html'))
    }

    return win
}

// Guard for when running in Node.js context during build (vite-plugin-electron)
if (protocol && typeof protocol.registerSchemesAsPrivileged === 'function') {
    protocol.registerSchemesAsPrivileged([
        { scheme: 'safe-file', privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true } }
    ])
}

app.whenReady().then(async () => {
    app.setAppUserModelId('Orbit')
    app.name = 'Orbit'

    // Isolate Electron runtime folders to a subfolder
    const runtimePath = path.join(app.getPath('appData'), 'Orbit', 'runtime')
    app.setPath('userData', runtimePath)

    // Initialize Logger
    appLogger.setLevel(LogLevel.DEBUG)
    appLogger.installConsoleRedirect()

    appLogger.info('Startup', `ELECTRON_RENDERER_URL: ${process.env['ELECTRON_RENDERER_URL']} `)
    appLogger.info('Startup', `app.isPackaged: ${app.isPackaged} `)
    appLogger.info('Startup', `Loading from: ${(!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) ? 'DEV SERVER (HMR Active)' : 'STATIC FILES (No HMR)'} `)

    // Migration from orbit-ai to Orbit
    const oldPath = path.join(app.getPath('appData'), 'orbit-ai')
    const newPath = app.getPath('userData') // This should now point to Orbit due to app.name change

    if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
        try {
            appLogger.info('Main', `Migrating AppData from ${oldPath} to ${newPath} `)
            fs.renameSync(oldPath, newPath)
        } catch (e) {
            appLogger.error('Main', `Failed to migrate AppData folder: ${e} `)
        }
    }

    // Add Gallery path to allowed roots (Gallery is at Roaming/Orbit/Gallery, outside runtime)
    // Add Gallery path to allowed roots (Gallery is at Roaming/Orbit/Gallery, outside runtime)
    const galleryPath = path.join(path.dirname(app.getPath('userData')), 'Gallery')
    const orbitRoaming = path.join(app.getPath('appData'), 'Orbit')
    const allowedFileRoots = new Set([app.getPath('userData'), app.getPath('home'), galleryPath, orbitRoaming])

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
        const isWindows = process.platform === 'win32'
        const allowed = Array.from(allowedFileRoots).some(root => {
            const resolvedRoot = path.resolve(root)
            if (isWindows) {
                return absolutePath.toLowerCase().startsWith(resolvedRoot.toLowerCase())
            }
            return absolutePath.startsWith(resolvedRoot)
        })
        if (!allowed) {
            appLogger.error('Security', `Denied attempt to access file outside allowed roots via protocol: ${absolutePath} `)
            return callback({ error: -6 }) // NET_ERROR(FILE_NOT_FOUND) or similar
        }

        try {
            return callback(absolutePath)
        } catch (error) {
            console.error('[SAFE-FILE] Error:', error)
        }
    })

    let services;
    try {
        services = await createServices(allowedFileRoots)
        console.log(`[Main]!!! createServices completed.`);
    } catch (e) {
        console.error('[Main] Critical error during service creation:', e)
        // Try to recover or exit gracefully? For now, let's allow it to fall through 
        // effectively continuing with undefined services, which will likely crash later 
        // BUT we might get some UI or logs. 
        // Ideally we should construct a minimal dummy services object but that's complex.

        // Let's rethrow for now if we can't recover, BUT the user wants debugging.
        // If we proceed, `services` is undefined.
        // We can't proceed with undefined services. 
        // We should probably show a dialog.

        // Re-creating a minimal services object is hard. 
        // Let's at least log it loud.
        throw e;
    }

    // Debug: Check what tokens are available
    if (services.settingsService['authService']) {
        const tokens = services.settingsService['authService'].getAllTokens();
        console.log(`[Main]!!! AuthService identified ${Object.keys(tokens).length} tokens at startup.Keys: ${JSON.stringify(Object.keys(tokens))} `);
        if (tokens['copilot_token']) {
            console.log(`[Main]!!! copilot_token found in AuthService, length: ${tokens['copilot_token'].length} `);
        }
        if (tokens['github_token']) {
            console.log(`[Main]!!! github_token found in AuthService, length: ${tokens['github_token'].length} `);
        }
    } else {
        console.warn(`[Main]!!! AuthService not available in settingsService`);
    }

    console.log('[Main] Starting Database initialization...');
    services.databaseService.initialize()
        .then(() => console.log('[Main] Database initialization completed.'))
        .catch(e => console.error('[Main] Failed to initialize database service:', e));

    console.log('[Main] Starting Proxy initialization...');
    services.proxyService.startEmbeddedProxy()
        .then(() => console.log('[Main] Proxy initialization completed.'))
        .catch(e => console.error('[Main] Failed to start embedded proxy:', e));

    console.log('[Main] Initializing ToolExecutor...');
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
    console.log('[Main] ToolExecutor initialized.');

    // Register all IPC handlers BEFORE creating window to prevent race conditions
    // registerWindowIpc(() => mainWindow) // This will be handled by registerIpcHandlers
    console.log('[Main] Window IPC registered.');

    // Initialize Copilot Token
    // Tokens are stored in data/auth folder, NOT in settings.json
    // We ONLY use copilot_token - NO fallback to github_token
    const initialSettings = services.settingsService.getSettings()
    console.log(`[Main]!!! settings.copilot.token length: ${initialSettings.copilot?.token?.length || 0} `);

    // Load token directly from AuthService (tokens are in data/auth folder)
    // ONLY use copilot_token, no fallback
    let copilotToken = initialSettings.copilot?.token

    // If not in settings, try AuthService directly
    if (!copilotToken) {
        console.log(`[Main]!!! Token not in settings, trying AuthService directly...`);
        if (services.settingsService['authService']) {
            const authService = services.settingsService['authService'] as any
            console.log(`[Main]!!! Attempting to get copilot_token from AuthService...`);
            copilotToken = authService.getToken('copilot_token')
            console.log(`[Main]!!! authService.getToken('copilot_token') result: ${copilotToken ? `found, length: ${copilotToken.length}` : 'NOT FOUND'} `);

            if (copilotToken) {
                console.log(`[Main]!!! Loaded copilot_token from AuthService, length: ${copilotToken.length} `)
            } else {
                console.warn(`[Main]!!! copilot_token not found in AuthService`)
            }
        } else {
            console.error(`[Main]!!! AuthService not available in settingsService`)
        }
    } else {
        console.log(`[Main]!!! Token found in settings, length: ${copilotToken.length} `)
    }

    if (copilotToken) {
        services.copilotService.setGithubToken(copilotToken)
        console.log(`[Main]!!! Set copilot_token to CopilotService, length: ${copilotToken.length} `)
        // Verify it was set
        console.log(`[Main]!!! CopilotService.isConfigured(): ${services.copilotService.isConfigured()} `)
    } else {
        console.warn(`[Main]!!! No copilot_token found - CopilotService will try to recover from AuthService when needed`)
    }

    // Sync proxy settings to LLMService
    const proxyUrl = initialSettings.proxy?.url || 'http://localhost:8317/v1'
    const proxyKey = services.proxyService.getProxyKey()
    services.llmService.setProxySettings(proxyUrl, proxyKey)

    // Register all IPC handlers
    registerIpcHandlers(services, toolExecutor, () => mainWindow, allowedFileRoots, mcpDispatcher)
    console.log('[Main] All IPC handlers registered.');

    // Store services for use in event handlers
    globalServices = services

    // Configure auto-start on boot
    const settings = services.settingsService.getSettings()
    if (settings.window?.startOnStartup !== undefined) {
        app.setLoginItemSettings({
            openAtLogin: settings.window.startOnStartup,
            openAsHidden: settings.window.workAtBackground || false
        })
    }

    // Setup system tray if workAtBackground is enabled
    if (settings.window?.workAtBackground) {
        setupTray()
    }

    // NOW create window after all handlers are registered
    console.log('[Main] Creating window...');
    try {
        mainWindow = createWindow(services.settingsService)
        console.log('[Main] Window created.');
    } catch (e) {
        console.error('[Main] Failed to create window:', e);
    }

    // Initialize Auto-Updater
    if (mainWindow) {
        services.updateService.init(mainWindow)
    } else {
        console.error('[Main] MainWindow is null, skipping updateService init');
    }

    // Initialize Crash Reporting
    services.sentryService.init()



    // Re-create on activate if needed
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            if (globalServices) {
                mainWindow = createWindow(globalServices.settingsService)
            } else {
                mainWindow = createWindow()
            }
        } else if (mainWindow) {
            mainWindow.show()
        }
    })
})

function setupTray() {
    if (tray) { return } // Already set up

    try {
        // Create a simple icon (you can replace this with an actual icon file)
        const icon = nativeImage.createEmpty()
        // For now, use a simple approach - you may want to load an actual icon file
        // const iconPath = path.join(process.cwd(), 'src/renderer/assets/logo.png')
        // const icon = nativeImage.createFromPath(iconPath)

        tray = new Tray(icon)

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show Orbit',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show()
                        mainWindow.focus()
                    } else if (globalServices) {
                        mainWindow = createWindow(globalServices.settingsService)
                    }
                }
            },
            {
                label: 'Quit',
                click: () => {
                    app.quit()
                }
            }
        ])

        tray.setToolTip('Orbit')
        tray.setContextMenu(contextMenu)

        tray.on('click', () => {
            if (mainWindow) {
                if (mainWindow.isVisible()) {
                    mainWindow.hide()
                } else {
                    mainWindow.show()
                    mainWindow.focus()
                }
            } else if (globalServices) {
                mainWindow = createWindow(globalServices.settingsService)
            }
        })
    } catch (error) {
        appLogger.error('Main', `Failed to setup tray: ${error} `)
    }
}

app.on('window-all-closed', () => {
    if (!globalServices) { return }

    const settings = globalServices.settingsService.getSettings()
    // If workAtBackground is enabled, don't quit - keep app running in background
    if (settings.window?.workAtBackground) {
        // Hide window instead of closing
        if (mainWindow) {
            mainWindow.hide()
        }
        // Ensure tray is visible
        if (!tray) {
            setupTray()
        }
        return
    }

    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// Cleanup on app quit - prevent memory leaks
app.on('before-quit', async (event) => {
    appLogger.info('Main', 'Application shutdown initiated')

    // Prevent default quit to allow cleanup
    event.preventDefault()

    try {
        // Close all windows gracefully
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.removeAllListeners('close')
            mainWindow.close()
        }

        // Cleanup services
        if (container) {
            appLogger.info('Main', 'Disposing service container...')
            try {
                await container.dispose()
                appLogger.info('Main', 'Service container disposed successfully')
            } catch (e) {
                appLogger.error('Main', `Failed to dispose container: ${getErrorMessage(e)} `)
            }
        }
        if (tray) {
            tray.destroy()
            tray = null
        }

        appLogger.info('Main', 'Cleanup completed, quitting application')

        // Now actually quit
        app.exit(0)

    } catch (e) {
        console.error('[Main] Cleanup error:', e)
        // Force quit even if cleanup fails
        app.exit(1)
    }
})

