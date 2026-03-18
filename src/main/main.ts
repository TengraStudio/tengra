import * as path from 'path';

import * as dotenv from 'dotenv';
import { app, BrowserWindow, type Certificate, type Event as ElectronEvent, type WebContents } from 'electron';

dotenv.config();

// Set the application name early
app.setName('Tengra');

import { ApiServerService } from '@main/api/api-server.service';
import { appLogger, LogLevel } from '@main/logging/logger';
import { McpDispatcher } from '@main/mcp/dispatcher';
import type { PageSpeedService } from '@main/services/analysis/pagespeed.service';
import type { ScannerService } from '@main/services/analysis/scanner.service';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import type { DockerService } from '@main/services/workspace/docker.service';
import type { SSHService } from '@main/services/workspace/ssh.service';
import { registerDeferredIpcHandlers, registerIpcHandlers } from '@main/startup/ipc';
import { container, createServices, type Services,startDeferredServices } from '@main/startup/services';
import { ToolExecutor } from '@main/tools/tool-executor';
import { validateEnvironmentVariables } from '@main/utils/env-validator.util';
import { OPERATION_TIMEOUTS } from '@shared/constants/timeouts';
import type { StartupMetrics } from '@shared/types/system';
import { getErrorMessage } from '@shared/utils/error.util';

import { registerLifecycleHandlers } from './startup/lifecycle';
import { preRegisterProtocols, registerProtocols } from './startup/protocols';
import { getRuntimeStartupDecisions } from './startup/runtime-startup-gate';
import { closeSplashWindow, shouldShowSplashWindow, showSplashWindow } from './startup/splash';
import { createWindow, getMainWindow, setupTray } from './startup/window';

type StartupMetricEvent = Exclude<keyof StartupMetrics, 'startTime' | 'totalTime'>;
type SourceMapsEnabledFn = (enabled: boolean) => void;
type CertificateErrorDetails = [
    error: string,
    certificate: Certificate,
    callback: (isTrusted: boolean) => void,
];

function recordStartupPhase(services: Services, event: StartupMetricEvent): void {
    services.performanceService.recordStartupEvent(event);
}

async function initializeDeferredCoreFeatures(services: Services): Promise<void> {
    const startupTasks = [
        services.localImageService
            .initialize()
            .then(() => {
                recordStartupPhase(services, 'localImageReadyTime');
            })
            .catch(error => {
                appLogger.error('Main', `LocalImage Init Failed: ${getErrorMessage(error)}`);
            }),
        services.apiServerService
            .initialize()
            .then(() => {
                recordStartupPhase(services, 'apiServerReadyTime');
            })
            .catch(error => {
                appLogger.error('Main', `API Server Init Failed: ${getErrorMessage(error)}`);
            }),
    ];

    await Promise.all(startupTasks);
}

// Performance Optimization: V8 Compile Cache for fast startup
try {
    // Built-in V8 compile cache for Node 22 (Electron 40+)
    const setSourceMapsEnabled = Reflect.get(process, 'setSourceMapsEnabled') as SourceMapsEnabledFn | undefined;
    if (typeof setSourceMapsEnabled === 'function') {
        app.commandLine.appendSwitch('v8-cache-options', 'code');
    }
} catch {
    // Fail-safe if module is not present: continue normally
    appLogger.debug('Main', 'V8 Compile Cache could not be explicitly enabled');
}

/**
 * Security: Hardening Electron Configuration
 */
function handleCertificateError(event: ElectronEvent, url: string, callback: (isTrusted: boolean) => void): void {
    event.preventDefault();
    appLogger.warn('Security', `Blocked certificate error for ${url}`);
    callback(false);
}

app.on('certificate-error', (event: ElectronEvent, _webContents: WebContents, url: string, ...details: CertificateErrorDetails) => {
    const [, , callback] = details;
    handleCertificateError(event, url, callback);
});

app.commandLine.appendSwitch('js-flags', '--max-old-space-size=2048');
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('disable-background-timer-throttling', 'false');
app.commandLine.appendSwitch('disable-renderer-backgrounding', 'false');
app.commandLine.appendSwitch('enable-low-end-device-mode');
app.commandLine.appendSwitch('process-per-site');

// Performance: Hardware acceleration selection
if (process.env.TENGRA_LOW_RESOURCE_MODE === 'true' || process.env.TENGRA_DISABLE_GPU === 'true') {
    app.disableHardwareAcceleration();
    appLogger.info('Main', 'Hardware acceleration disabled (TENGRA_LOW_RESOURCE_MODE=true)');
}

if (process.platform === 'win32') {
    app.setAppUserModelId('com.tengra.app');
}

// Security: Pre-register schemes before app is ready
preRegisterProtocols();

app.whenReady().then(async () => {
    // Memory management: throttle when app is not in focus
    app.on('browser-window-blur', () => {
        // Free up some memory when the app is backgrounded
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
            if (!win.isDestroyed() && win.webContents) {
                win.webContents.invalidate();
                // Forces GC sweep if memory is high
                if (process.memoryUsage().heapUsed > 512 * 1024 * 1024) {
                    win.webContents.closeDevTools();
                }
            }
        }
    });

    appLogger.setLevel(app.isPackaged ? LogLevel.INFO : LogLevel.DEBUG);
    appLogger.installConsoleRedirect();

    appLogger.info('Startup', 'Validating environment variables...');
    validateEnvironmentVariables();

    const shouldShowSplash = shouldShowSplashWindow();
    if (shouldShowSplash) {
        showSplashWindow();
    }

    // Security: Filter allowed roots for file protocol
    const galleryPath = path.join(path.dirname(app.getPath('userData')), 'Gallery');
    const tengraRoaming = path.join(app.getPath('appData'), 'Tengra');
    const appRoot = path.resolve(__dirname, '../..');
    const allowedFileRoots = new Set([
        app.getPath('userData'),
        app.getPath('home'),
        galleryPath,
        tengraRoaming,
        appRoot,
    ]);

    // Register Protocols
    registerProtocols(allowedFileRoots);

    // Initialize Services
    const services = await createServices(allowedFileRoots);
    recordStartupPhase(services, 'coreServicesReadyTime');
    const runtimeBootstrapResult = services.runtimeBootstrapService.getLatestExecutionResult();
    if (
        runtimeBootstrapResult?.summary.blockingFailures ||
        runtimeBootstrapResult?.summary.installRequired
    ) {
        appLogger.warn(
            'Main',
            `Managed runtime scan requires attention: installRequired=${runtimeBootstrapResult.summary.installRequired}, blockingFailures=${runtimeBootstrapResult.summary.blockingFailures}`
        );
    }
    const runtimeStartupDecisions = getRuntimeStartupDecisions(runtimeBootstrapResult);

    // Initialize DB & Proxy
    if (runtimeStartupDecisions.database.shouldStart) {
        void services.databaseService.initialize().catch(e => appLogger.error('Main', `DB Init Failed: ${e}`));
    } else {
        appLogger.warn(
            'Main',
            `Skipping DB init because managed runtime component ${runtimeStartupDecisions.database.componentId} is ${runtimeStartupDecisions.database.status ?? 'missing'}`
        );
    }
    if (runtimeStartupDecisions.embeddedProxy.shouldStart) {
        void services.proxyService.startEmbeddedProxy().catch(e => appLogger.error('Main', `Proxy Init Failed: ${e}`));
    } else {
        appLogger.warn(
            'Main',
            `Skipping embedded proxy init because managed runtime component ${runtimeStartupDecisions.embeddedProxy.componentId} is ${runtimeStartupDecisions.embeddedProxy.status ?? 'missing'}`
        );
    }

    // Hardened Tool Executor
    // mcpPluginService.initialize() is intentionally deferred to after window creation;
    // McpDispatcher holds the reference and will find plugins populated once deferred init runs.
    const mcpDispatcher = new McpDispatcher(new Set<string>(), services.settingsService, services.mcpPluginService);

    const toolExecutor = new ToolExecutor({
        fileSystem: services.fileSystemService,
        eventBus: services.eventBusService,
        command: services.commandService,
        web: services.webService,
        screenshot: services.screenshotService,
        system: services.systemService,
        network: services.networkService,
        notification: services.notificationService,
        docker: container.resolve<DockerService>('dockerService'),
        ssh: container.resolve<SSHService>('sshService'),
        scanner: container.resolve<ScannerService>('scannerService'),
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
        pageSpeed: container.resolve<PageSpeedService>('pageSpeedService'),
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

    // Register IPC & Lifecycle
    await registerIpcHandlers(services, toolExecutor, getMainWindow, allowedFileRoots, mcpDispatcher);
    registerLifecycleHandlers(services.settingsService);
    recordStartupPhase(services, 'ipcReadyTime');

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
    recordStartupPhase(services, 'windowCreatedTime');
    if (shouldShowSplash) {
        mainWindow.once('ready-to-show', () => {
            closeSplashWindow();
        });

        mainWindow.webContents.once('did-fail-load', () => {
            closeSplashWindow();
        });
    }

    let deferredTasksStarted = false;
    const runDeferredStartupTasks = () => {
        if (deferredTasksStarted) {
            return;
        }
        deferredTasksStarted = true;
        void Promise.resolve().then(async () => {
            recordStartupPhase(services, 'deferredStartTime');
            await initializeDeferredCoreFeatures(services);
            await registerDeferredIpcHandlers(services, getMainWindow);

            // Initialize deferred (non-critical) services first
            await services.mcpPluginService.initialize();
            await startDeferredServices();
            recordStartupPhase(services, 'deferredServicesReadyTime');

            await services.localAIService.maybeStartOllama().catch(error => {
                appLogger.warn('Main', `Headless Ollama auto-start fallback failed: ${getErrorMessage(error)}`);
            });
            const { startOllama } = await import('@main/startup/ollama');
            void startOllama(getMainWindow, false).catch(err => appLogger.error('Main', `Ollama Fail: ${err}`));
            const openedMainWindow = getMainWindow();
            if (openedMainWindow) {
                services.updateService.init(openedMainWindow);
            }
        }).catch(error => {
            appLogger.error('Main', 'Deferred startup tasks failed', error as Error);
        });
    };
    mainWindow.once('ready-to-show', () => {
        recordStartupPhase(services, 'readyTime');
        if (process.env.TENGRA_BENCHMARK) { 
            appLogger.info('Benchmark', 'BENCHMARK_READY'); 
            setTimeout(() => app.exit(0), 100); 
        }
        setTimeout(runDeferredStartupTasks, 0);
    });
    mainWindow.webContents.once('did-finish-load', () => {
        services.performanceService.recordStartupEvent('loadTime');
        runDeferredStartupTasks();
    });
    setTimeout(runDeferredStartupTasks, OPERATION_TIMEOUTS.DEFERRED_STARTUP);

}).catch(e => {
    closeSplashWindow();
    const normalizedError = e instanceof Error ? e : new Error(getErrorMessage(e));
    appLogger.error('Main', 'Critical failure on startup', normalizedError);
    appLogger.error('Main', `Critical failure details: ${getErrorMessage(e)}`);
    app.exit(1);
});
