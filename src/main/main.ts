import * as path from 'path';

import * as dotenv from 'dotenv';
import { app } from 'electron';

dotenv.config();

// Set the application name early
app.setName('Tandem');

import { ApiServerService } from '@main/api/api-server.service';
import { appLogger, LogLevel } from '@main/logging/logger';
import { McpDispatcher } from '@main/mcp/dispatcher';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { registerIpcHandlers } from '@main/startup/ipc';
import { container, createServices } from '@main/startup/services';
import { ToolExecutor } from '@main/tools/tool-executor';
import { validateEnvironmentVariables } from '@main/utils/env-validator.util';

import { registerLifecycleHandlers } from './startup/lifecycle';
import { preRegisterProtocols, registerProtocols } from './startup/protocols';
import { closeSplashWindow, shouldShowSplashWindow, showSplashWindow } from './startup/splash';
import { createWindow, getMainWindow, setupTray } from './startup/window';

/**
 * Security: Hardening Electron Configuration
 */
app.on('certificate-error', (...args) => {
    const [event, , _url, , , callback] = args;
    event.preventDefault();
    appLogger.warn('Security', `Blocked certificate error for ${_url}`);
    (callback as (allow: boolean) => void)(false);
});

app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');
app.commandLine.appendSwitch('disable-site-isolation-trials');

if (process.platform === 'win32') {
    app.setAppUserModelId('com.tandem.app');
}

// Security: Pre-register schemes before app is ready
preRegisterProtocols();

app.whenReady().then(async () => {
    appLogger.setLevel(LogLevel.DEBUG);
    appLogger.installConsoleRedirect();

    appLogger.info('Startup', 'Validating environment variables...');
    validateEnvironmentVariables();

    const shouldShowSplash = shouldShowSplashWindow();
    if (shouldShowSplash) {
        showSplashWindow();
    }

    // Security: Filter allowed roots for file protocol
    const galleryPath = path.join(path.dirname(app.getPath('userData')), 'Gallery');
    const tandemRoaming = path.join(app.getPath('appData'), 'Tandem');
    const allowedFileRoots = new Set([app.getPath('userData'), app.getPath('home'), galleryPath, tandemRoaming]);

    // Register Protocols
    registerProtocols(allowedFileRoots);

    // Initialize Services
    const services = await createServices(allowedFileRoots);

    // Initialize DB & Proxy
    void services.databaseService.initialize().catch(e => appLogger.error('Main', `DB Init Failed: ${e}`));
    void services.proxyService.startEmbeddedProxy().catch(e => appLogger.error('Main', `Proxy Init Failed: ${e}`));

    // Hardened Tool Executor
    const mcpDispatcher = new McpDispatcher(new Set<string>(), services.settingsService, services.mcpPluginService);
    await services.mcpPluginService.initialize();
    await services.mcpMarketplaceService.initialize();

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

    // Initialize Local API Server
    const proxyProcessManager = services.proxyService['processManager'] as ProxyProcessManager;
    const apiServerService = new ApiServerService({
        port: 42069,
        settingsService: services.settingsService,
        proxyProcessManager: proxyProcessManager,
        toolExecutor: toolExecutor,
        llmService: services.llmService,
        modelRegistry: services.modelRegistryService,
        rateLimitService: services.rateLimitService
    });
    services.apiServerService = apiServerService;

    // Manual registration so Container.dispose() finds it and calls cleanup()
    container.registerInstance('apiServerService', apiServerService);

    await apiServerService.initialize();

    // Register IPC & Lifecycle
    registerIpcHandlers(services, toolExecutor, getMainWindow, allowedFileRoots, mcpDispatcher);
    registerLifecycleHandlers(services.settingsService);

    // Configure Auto-Start
    const settings = services.settingsService.getSettings();
    if (app.isPackaged && settings.window?.startOnStartup !== undefined) {
        const shouldStartHidden = settings.window.workAtBackground ?? false;
        app.setLoginItemSettings({
            openAtLogin: settings.window.startOnStartup,
            openAsHidden: shouldStartHidden,
            path: process.execPath,
            args: shouldStartHidden ? ['--hidden'] : []
        });
    }

    if (settings.window?.workAtBackground) {
        setupTray(services.settingsService);
    }

    // Create Window
    const mainWindow = createWindow(services.settingsService);
    if (shouldShowSplash) {
        mainWindow.once('ready-to-show', () => {
            closeSplashWindow();
        });

        mainWindow.webContents.once('did-fail-load', () => {
            closeSplashWindow();
        });
    }

    // Background Tasks
    const { startOllama } = await import('@main/startup/ollama');
    void startOllama(getMainWindow, false).catch(err => appLogger.error('Main', `Ollama Fail: ${err}`));

    const openedMainWindow = getMainWindow();
    if (openedMainWindow) {
        services.updateService.init(openedMainWindow);
    }
    void services.sentryService.init();

}).catch(e => {
    closeSplashWindow();
    console.error('Critical failure on startup:', e);
    app.exit(1);
});
