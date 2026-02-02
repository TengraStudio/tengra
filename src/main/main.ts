import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';

dotenv.config();

import { app, BrowserWindow, HandlerDetails, Menu, nativeImage, protocol, shell, Tray } from 'electron';

declare const __BUILD_TIME__: string;



// Set the application name early - this affects Task Manager display on Windows
app.setName('Tandem');

// Increase memory limits for the Renderer process (Chromium/V8) to prevent "Oilpan: Normal allocation failed"
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');
app.commandLine.appendSwitch('disable-site-isolation-trials'); // Can save memory in some cases


// On Windows, set the AppUserModelId for taskbar grouping and display name
if (process.platform === 'win32') {
    app.setAppUserModelId('com.tandem.app');
}

import { ApiServerService } from '@main/api/api-server.service';
import { appLogger, LogLevel } from '@main/logging/logger';
import { McpDispatcher } from '@main/mcp/dispatcher';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { SettingsService } from '@main/services/system/settings.service';
import { registerIpcHandlers } from '@main/startup/ipc';
import { container, createServices } from '@main/startup/services';
import { ToolExecutor } from '@main/tools/tool-executor';
import { validateEnvironmentVariables } from '@main/utils/env-validator.util';
import { getErrorMessage } from '@shared/utils/error.util';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let globalServices: Awaited<ReturnType<typeof createServices>> | null = null;

// eslint-disable-next-line complexity
function createWindow(settingsService?: SettingsService): BrowserWindow {
    // Get saved window settings or use defaults
    const settings = settingsService?.getSettings();
    const windowSettings = settings?.window;
    const defaultWidth = 1280;
    const defaultHeight = 800;

    // Use correct icon path for both dev and production
    const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'icon.ico')
        : path.join(__dirname, '../../resources/icon.ico');

    const win = new BrowserWindow({
        width: windowSettings?.width ?? defaultWidth,
        height: windowSettings?.height ?? defaultHeight,
        x: windowSettings?.x,
        y: windowSettings?.y,
        show: false,
        frame: false,
        backgroundColor: '#000000',
        autoHideMenuBar: true,
        icon: nativeImage.createFromPath(iconPath),
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // Security: Set Content-Security-Policy
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self' safe-file: https: http://localhost:* ws://localhost:*; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: safe-file: https: http://localhost:*; media-src 'self' safe-file: https:; font-src 'self' data: https:;"
                ]
            }
        });
    });

    // Apply fullscreen if saved
    if (windowSettings?.fullscreen === true) {
        win.setFullScreen(true);
    }

    win.on('ready-to-show', () => {
        const isHidden = process.argv.includes('--hidden') ||
            process.argv.includes('/hidden') ||
            settings?.window?.workAtBackground === true && app.getLoginItemSettings().wasOpenedAtLogin;

        if (!isHidden) {
            win.show();
        }
        win.setTitle('TANDEM');
    });

    // Save window position and size on move/resize
    let saveTimeout: NodeJS.Timeout | null = null;
    const saveWindowState = () => {
        if (saveTimeout) { clearTimeout(saveTimeout); }
        saveTimeout = setTimeout(() => {
            if (settingsService && !win.isDestroyed()) {
                const bounds = win.getBounds();
                const isFullscreen = win.isFullScreen();
                const currentSettings = settingsService.getSettings();
                void settingsService.saveSettings({
                    ...currentSettings,
                    window: {
                        ...currentSettings.window,
                        width: bounds.width,
                        height: bounds.height,
                        x: bounds.x,
                        y: bounds.y,
                        fullscreen: isFullscreen
                    }
                });
            }
        }, 500); // Debounce saves
    };

    win.on('moved', saveWindowState);
    win.on('resized', saveWindowState);
    win.on('enter-full-screen', () => {
        if (settingsService) {
            const currentSettings = settingsService.getSettings();
            const currentWindow = currentSettings.window;
            void settingsService.saveSettings({
                ...currentSettings,
                window: {
                    width: currentWindow?.width ?? defaultWidth,
                    height: currentWindow?.height ?? defaultHeight,
                    x: currentWindow?.x ?? 0,
                    y: currentWindow?.y ?? 0,
                    ...currentWindow,
                    fullscreen: true
                }
            });
        }
    });
    win.on('leave-full-screen', () => {
        if (settingsService) {
            const currentSettings = settingsService.getSettings();
            const currentWindow = currentSettings.window;
            void settingsService.saveSettings({
                ...currentSettings,
                window: {
                    width: currentWindow?.width ?? defaultWidth,
                    height: currentWindow?.height ?? defaultHeight,
                    x: currentWindow?.x ?? 0,
                    y: currentWindow?.y ?? 0,
                    ...currentWindow,
                    fullscreen: false
                }
            });
        }
    });

    win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
        const levels = ['debug', 'info', 'warn', 'error'];
        const lvl = levels[level] as 'debug' | 'info' | 'warn' | 'error';
        const context = `renderer:${path.basename(sourceId)}:${line} `;
        appLogger[lvl](context, message);
    });

    win.webContents.setWindowOpenHandler((details: HandlerDetails) => {
        void shell.openExternal(details.url);
        return { action: 'deny' };
    });

    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
        void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
        void win.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    return win;
}

// Guard for when running in Node.js context during build (vite-plugin-electron)
if (typeof protocol.registerSchemesAsPrivileged === 'function') {
    protocol.registerSchemesAsPrivileged([
        { scheme: 'safe-file', privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true } }
    ]);
}

// eslint-disable-next-line max-lines-per-function, complexity
app.whenReady().then(async () => {
    app.setAppUserModelId('Tandem');
    app.name = 'Tandem';

    // Isolate Electron runtime folders to a subfolder
    const runtimePath = path.join(app.getPath('appData'), 'Tandem', 'runtime');
    app.setPath('userData', runtimePath);

    // Initialize Logger
    appLogger.setLevel(LogLevel.DEBUG);
    appLogger.installConsoleRedirect();

    // Validate environment variables
    appLogger.info('Startup', 'Validating environment variables...');
    validateEnvironmentVariables();

    appLogger.info('Startup', `ELECTRON_RENDERER_URL: ${process.env['ELECTRON_RENDERER_URL']} `);
    appLogger.info('Startup', `app.isPackaged: ${app.isPackaged} `);
    appLogger.info('Startup', `Build Time: ${typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'N/A'} `);
    appLogger.info('Startup', `Loading from: ${(!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) ? 'DEV SERVER (HMR Active)' : 'STATIC FILES (No HMR)'} `);

    const oldPath = path.join(app.getPath('appData'), 'tandem');
    const newPath = app.getPath('userData'); // This should now point to Tandem due to app.name change

    if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
        try {
            appLogger.info('Main', `Migrating AppData from ${oldPath} to ${newPath} `);
            fs.renameSync(oldPath, newPath);
        } catch (e) {
            appLogger.error('Main', `Failed to migrate AppData folder: ${e} `);
        }
    }

    // Add Gallery path to allowed roots (Gallery is at Roaming/Tandem/Gallery, outside runtime)
    // Add Gallery path to allowed roots (Gallery is at Roaming/Tandem/Gallery, outside runtime)
    const galleryPath = path.join(path.dirname(app.getPath('userData')), 'Gallery');
    const tandemRoaming = path.join(app.getPath('appData'), 'Tandem');
    const allowedFileRoots = new Set([app.getPath('userData'), app.getPath('home'), galleryPath, tandemRoaming]);

    protocol.registerFileProtocol('safe-file', (request, callback) => {
        let url = request.url.replace('safe-file://', '');

        // Handle Windows drive letters (e.g., /C:/Users -> C:/Users)
        if (process.platform === 'win32') {
            if (/^\/[a-zA-Z]:/.test(url)) {
                url = url.slice(1);
            } else if (/^[a-zA-Z]\//.test(url)) {
                url = url.substring(0, 1) + ':' + url.substring(1);
            }
        }

        const decoded = decodeURIComponent(url);
        const absolutePath = path.resolve(decoded);

        // Security check: Must be in allowed roots
        const isWindows = process.platform === 'win32';
        const allowed = Array.from(allowedFileRoots).some(root => {
            const resolvedRoot = path.resolve(root);
            if (isWindows) {
                return absolutePath.toLowerCase().startsWith(resolvedRoot.toLowerCase());
            }
            return absolutePath.startsWith(resolvedRoot);
        });
        if (!allowed) {
            appLogger.error('Security', `Denied attempt to access file outside allowed roots via protocol: ${absolutePath} `);
            return callback({ error: -6 }); // NET_ERROR(FILE_NOT_FOUND) or similar
        }

        try {
            return callback(absolutePath);
        } catch (error) {
            appLogger.error('Main', `SAFE-FILE protocol error: ${error}`);
        }
    });

    let services;
    try {
        services = await createServices(allowedFileRoots);
        appLogger.info('Main', 'createServices completed');
    } catch (e) {
        appLogger.error('Main', `Critical error during service creation: ${e}`);
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

    appLogger.info('Main', 'Starting Database initialization...');
    void services.databaseService.initialize()
        .then(() => appLogger.info('Main', 'Database initialization completed'))
        .catch(e => {
            appLogger.error('Main', `Failed to initialize database service: ${e}`);
            // Non-critical for startup, but functionality will be limited
        });

    // Debug: Check what tokens are available (Now safe to call)
    {
        const accounts = await services.authService.getAllAccountsFull();
        appLogger.debug('Main', `AuthService identified ${accounts.length} accounts at startup. Providers: ${JSON.stringify(accounts.map(a => a.provider))}`);
        const copilot = accounts.find(a => a.provider === 'copilot_token' || a.provider === 'copilot');
        if (copilot?.accessToken) {
            appLogger.debug('Main', `copilot account found in AuthService, token length: ${copilot.accessToken.length}`);
        }
        const github = accounts.find(a => a.provider === 'github_token' || a.provider === 'github');
        if (github?.accessToken) {
            appLogger.debug('Main', `github account found in AuthService, token length: ${github.accessToken.length}`);
        }
    }

    appLogger.info('Main', 'Starting Proxy initialization...');
    services.proxyService.startEmbeddedProxy()
        .then(() => appLogger.info('Main', 'Proxy initialization completed'))
        .catch(e => appLogger.error('Main', `Failed to start embedded proxy: ${e}`));

    appLogger.info('Main', 'Initializing ToolExecutor...');
    const mcpDispatcher = new McpDispatcher([], services.settingsService, services.mcpPluginService);
    // Explicitly initialize McpPluginService (though container.init() might have done it, we ensure order here)
    await services.mcpPluginService.initialize();

    const toolExecutor = new ToolExecutor({
        fileSystem: services.fileSystemService,
        eventBus: services.eventBusService,
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
        pageSpeed: services.pageSpeedService,
        localImage: services.localImageService
    });
    appLogger.info('Main', 'ToolExecutor initialized');

    // Initialize API Server for browser extension
    appLogger.info('Main', 'Initializing API Server...');

    // ProxyProcessManager is already imported statically at the top
    const proxyProcessManager = services.proxyService['processManager'] as ProxyProcessManager;
    const apiServerService = new ApiServerService({
        port: 42069,
        settingsService: services.settingsService,
        proxyProcessManager: proxyProcessManager,
        toolExecutor: toolExecutor,
        llmService: services.llmService,
        modelRegistry: services.modelRegistryService
    });

    services.apiServerService = apiServerService;
    await apiServerService.initialize();
    appLogger.info('Main', `API Server running on port ${apiServerService.getPort()}`);

    // Register all IPC handlers BEFORE creating window to prevent race conditions
    // registerWindowIpc(() => mainWindow) // This will be handled by registerIpcHandlers
    appLogger.info('Main', 'Window IPC registered');





    // Register all IPC handlers
    registerIpcHandlers(services, toolExecutor, () => mainWindow, allowedFileRoots, mcpDispatcher);
    appLogger.info('Main', 'All IPC handlers registered');

    // Store services for use in event handlers
    globalServices = services;

    // Cookie Interceptor removed as requested


    // Configure auto-start on boot
    const settings = services.settingsService.getSettings();
    if (settings.window?.startOnStartup !== undefined) {
        app.setLoginItemSettings({
            openAtLogin: settings.window.startOnStartup,
            openAsHidden: settings.window.workAtBackground ?? false
        });
    }

    // Setup system tray if workAtBackground is enabled
    if (settings.window?.workAtBackground) {
        setupTray();
    }

    // NOW create window after all handlers are registered
    appLogger.info('Main', 'Creating window...');
    try {
        mainWindow = createWindow(services.settingsService);
        appLogger.info('Main', 'Window created');
    } catch (e) {
        appLogger.error('Main', `Failed to create window: ${e}`);
    }

    // Initialize Services
    // The original `services` variable is already defined and assigned above.
    // This line is likely a remnant from a different refactoring.
    // services = buildServices(mainWindow, app.getPath('userData')) 

    // Register IPC
    // registerIpc(services, mainWindow) // This is handled by registerIpcHandlers above

    // Auto-start Ollama
    try {
        const { startOllama } = await import('@main/startup/ollama');
        appLogger.info('Main', 'Initiating Ollama auto-start...');
        // Don't await this to avoid blocking startup
        void startOllama(() => mainWindow, false).catch(err => {
            appLogger.error('Main', `Ollama auto-start failed: ${err}`);
        });
    } catch (e) {
        appLogger.error('Main', `Failed to import startOllama: ${e}`);
    }

    // Initialize Auto-Updater
    if (mainWindow) {
        services.updateService.init(mainWindow);
    } else {
        appLogger.error('Main', 'MainWindow is null, skipping updateService init');
    }

    // Initialize Crash Reporting
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    services.sentryService.init();



    // Re-create on activate if needed
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            if (globalServices) {
                mainWindow = createWindow(globalServices.settingsService);
            } else {
                mainWindow = createWindow();
            }
        } else if (mainWindow) {
            mainWindow.show();
        }
    });
}).catch(e => {
    appLogger.error('Main', `Failed to start application: ${e}`);
    app.exit(1);
});

function setupTray() {
    if (tray) { return; } // Already set up

    try {
        const iconPath = app.isPackaged
            ? path.join(process.resourcesPath, 'icon.ico')
            : path.join(__dirname, '../../resources/icon.ico');
        const icon = nativeImage.createFromPath(iconPath);

        tray = new Tray(icon);

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show Tandem',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                    } else if (globalServices) {
                        mainWindow = createWindow(globalServices.settingsService);
                    }
                }
            },
            {
                label: 'Quit',
                click: () => {
                    app.quit();
                }
            }
        ]);

        tray.setToolTip('Tandem');
        tray.setContextMenu(contextMenu);

        tray.on('click', () => {
            if (mainWindow) {
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.show();
                    mainWindow.focus();
                }
            } else if (globalServices) {
                mainWindow = createWindow(globalServices.settingsService);
            }
        });
    } catch (error) {
        appLogger.error('Main', `Failed to setup tray: ${error} `);
    }
}

app.on('window-all-closed', () => {
    if (!globalServices) { return; }

    const settings = globalServices.settingsService.getSettings();
    // If workAtBackground is enabled, don't quit - keep app running in background
    if (settings.window?.workAtBackground) {
        // Hide window instead of closing
        if (mainWindow) {
            mainWindow.hide();
        }
        // Ensure tray is visible
        if (!tray) {
            setupTray();
        }
        return;
    }

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Cleanup on app quit - prevent memory leaks
// eslint-disable-next-line @typescript-eslint/no-misused-promises
app.on('before-quit', async (event) => {
    appLogger.info('Main', 'Application shutdown initiated');

    // Prevent default quit to allow cleanup
    event.preventDefault();

    try {
        // Close all windows gracefully
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.removeAllListeners('close');
            mainWindow.close();
        }

        // Cleanup services
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (container) {
            appLogger.info('Main', 'Disposing service container (native services will persist)...');
            try {
                // container.dispose() often kills processes, but we want them to persist.
                // Our ProcessManagerService.killAll() is now a no-op for native services.
                await container.dispose();
                appLogger.info('Main', 'Service container disposed successfully');
            } catch (e) {
                appLogger.error('Main', `Failed to dispose container: ${getErrorMessage(e)} `);
            }
        }
        if (tray) {
            tray.destroy();
            tray = null;
        }

        appLogger.info('Main', 'Cleanup completed, quitting application');

        // Now actually quit
        app.exit(0);

    } catch (e) {
        appLogger.error('Main', `Cleanup error: ${e}`);
        // Force quit even if cleanup fails
        app.exit(1);
    }
}) as unknown as (event: Event) => void;

