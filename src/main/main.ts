import * as path from 'path';

import * as dotenv from 'dotenv';
import type { App, BrowserWindow as ElectronBrowserWindow, Certificate, Event as ElectronEvent, WebContents } from 'electron';
import * as electron from 'electron';

dotenv.config();

const electronModule = electron as Partial<typeof import('electron')>;

if (!electronModule.app || !electronModule.BrowserWindow) {
    process.stderr.write(
        'Tengra main process could not access Electron APIs. Clear ELECTRON_RUN_AS_NODE and start the app with Electron.\n'
    );
    process.exit(1);
}

const app: App = electronModule.app;
const BrowserWindow: typeof ElectronBrowserWindow = electronModule.BrowserWindow;

// Set the application name early
app.setName('Tengra');

import { appLogger, LogLevel } from '@main/logging/logger';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import type { DockerService } from '@main/services/workspace/docker.service';
import type { SSHService } from '@main/services/workspace/ssh.service';
import { container, createServices, type Services, startDeferredServices } from '@main/startup/services';
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

// Graphics: Fix for EGL/OpenGL initialization errors on Windows
if (process.platform === 'win32') {
    app.commandLine.appendSwitch('use-gl', 'angle');
    app.commandLine.appendSwitch('use-angle', 'd3d11');
    app.commandLine.appendSwitch('ignore-gpu-blocklist');
    app.commandLine.appendSwitch('disable-gpu-driver-bug-workarounds');
    app.commandLine.appendSwitch('disable-gpu-sandbox');
    app.commandLine.appendSwitch('disable-features', 'Vulkan');
    app.commandLine.appendSwitch('disable-es3-gl-context');
    app.commandLine.appendSwitch('disable-gpu-memory-buffer-video-frames');
}

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

    const debugLogsEnabled = process.env.TENGRA_DEBUG_LOGS !== 'false';
    const runtimeLogLevel = debugLogsEnabled ? LogLevel.DEBUG : LogLevel.INFO;
    appLogger.setShowDebugLogs(debugLogsEnabled);
    appLogger.setLevel(runtimeLogLevel);
    appLogger.installConsoleRedirect();
    appLogger.info('Main', `Logger configured: level=${LogLevel[runtimeLogLevel]}, debug=${debugLogsEnabled}`);

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

    if (runtimeStartupDecisions.database.shouldStart) {
        try {
            await services.databaseService.initialize();
            const workspaces = await services.databaseService.workspaces.getWorkspaces();
            for (const workspace of workspaces) {
                if (workspace.path) {
                    allowedFileRoots.add(path.resolve(workspace.path));
                }
            }
            appLogger.info('Main', `Populated allowedFileRoots with ${workspaces.length} workspace paths`);
        } catch (error) {
            appLogger.error('Main', 'Failed to populate allowedFileRoots from workspaces', error as Error);
        }
    } else {
        appLogger.warn(
            'Main',
            `Skipping DB init because managed runtime component ${runtimeStartupDecisions.database.componentId} is ${runtimeStartupDecisions.database.status ?? 'missing'}`
        );
        // Fallback: still try DB init so chat persistence continues even if runtime manifest is stale.
        try {
            await services.databaseService.initialize();
            const workspaces = await services.databaseService.workspaces.getWorkspaces();
            for (const workspace of workspaces) {
                if (workspace.path) {
                    allowedFileRoots.add(path.resolve(workspace.path));
                }
            }
            appLogger.info('Main', `DB fallback init succeeded; loaded ${workspaces.length} workspace paths`);
        } catch (error) {
            appLogger.error('Main', 'DB fallback init failed', error as Error);
        }
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
    const [{ McpDispatcher }, { ToolExecutor }, { ApiServerService }] = await Promise.all([
        import('@main/mcp/dispatcher'),
        import('@main/tools/tool-executor'),
        import('@main/api/api-server.service'),
    ]);
    const mcpDispatcher = new McpDispatcher(new Set<string>(), services.settingsService, services.mcpPluginService);

    const toolExecutor = new ToolExecutor({
        fileSystem: services.fileSystemService,
        eventBus: services.eventBusService,
        command: services.commandService,
        web: services.webService,
        docker: container.resolve<DockerService>('dockerService'),
        ssh: container.resolve<SSHService>('sshService'),
        embedding: services.embeddingService,
        memory: services.memoryService,
        localImage: services.localImageService,
        system: services.systemService,
        network: services.networkService,
        file: services.fileManagementService,
            git: services.gitService,
            security: services.securityService,
            mcp: mcpDispatcher,
            llm: services.llmService,
            terminal: services.terminalService,
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
    const {
        registerDeferredIpcHandlers,
        registerIpcHandlers,
        registerPostInteractiveIpcHandlers,
        registerPostStartupIpcHandlers,
    } = await import('@main/startup/ipc');
    registerIpcHandlers(services, toolExecutor, getMainWindow, allowedFileRoots, mcpDispatcher);
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
    let postInteractiveTasksStarted = false;
    const runDeferredStartupTasks = () => {
        if (deferredTasksStarted) {
            return;
        }
        deferredTasksStarted = true;
        void Promise.resolve().then(async () => {
            recordStartupPhase(services, 'deferredStartTime');
            await initializeDeferredCoreFeatures(services);
            registerPostStartupIpcHandlers(services, getMainWindow);
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
    const runPostInteractiveTasks = () => {
        if (postInteractiveTasksStarted) {
            return;
        }
        postInteractiveTasksStarted = true;
        void Promise.resolve().then(() => {
            registerPostInteractiveIpcHandlers(services, getMainWindow);
        }).catch(error => {
            appLogger.error('Main', 'Post-interactive startup tasks failed', error as Error);
        });
    };
    mainWindow.once('ready-to-show', () => {
        recordStartupPhase(services, 'readyTime');
        if (process.env.TENGRA_BENCHMARK) {
            appLogger.info('Benchmark', 'BENCHMARK_READY');
            setTimeout(() => app.exit(0), 100);
        }
        setTimeout(runDeferredStartupTasks, 0);
        setTimeout(runPostInteractiveTasks, OPERATION_TIMEOUTS.DEFERRED_STARTUP);
    });
    mainWindow.webContents.once('did-finish-load', () => {
        services.performanceService.recordStartupEvent('loadTime');
        runDeferredStartupTasks();
        setTimeout(runPostInteractiveTasks, 0);
    });
    setTimeout(runDeferredStartupTasks, OPERATION_TIMEOUTS.DEFERRED_STARTUP);
    setTimeout(runPostInteractiveTasks, OPERATION_TIMEOUTS.DEFERRED_STARTUP * 2);

}).catch(e => {
    closeSplashWindow();
    const normalizedError = e instanceof Error ? e : new Error(getErrorMessage(e));
    appLogger.error('Main', 'Critical failure on startup', normalizedError);
    appLogger.error('Main', `Critical failure details: ${getErrorMessage(e)}`);
    app.exit(1);
});
