/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as path from 'path';

import { appLogger, LogLevel } from '@main/logging/logger';
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service';
import { RuntimeBootstrapService } from '@main/services/system/runtime-bootstrap.service';
import { SettingsService } from '@main/services/system/settings.service';
import type { DockerService } from '@main/services/workspace/docker.service';
import type { SSHService } from '@main/services/workspace/ssh.service';
import { container, createMinimalServices, createServices, type Services, startDeferredServices } from '@main/startup/services';
import { OPERATION_TIMEOUTS } from '@shared/constants/timeouts';
import { RuntimeBootstrapExecutionResult } from '@shared/types/runtime-manifest';
import type { StartupMetrics } from '@shared/types/system';
import { getErrorMessage } from '@shared/utils/error.util';
import {
    app,
    BrowserWindow,
    Certificate,
    Event as ElectronEvent,
    WebContents,
} from 'electron';

import { registerLifecycleHandlers } from './startup/lifecycle';
import { isDev } from './startup/paths';
import { preRegisterProtocols, registerProtocols } from './startup/protocols';
import { getRuntimeStartupDecisions } from './startup/runtime-startup-gate';
import { closeSplashWindow, shouldShowSplashWindow, showSplashWindow } from './startup/splash';
import { createWindow, getMainWindow } from './startup/window';

// --- ABSOLUTE EARLY BOOTSTRAP ---
// Register critical handlers before anything else happens
const GLOBAL_STATE = {
    isReady: false,
    ipcRegistered: false,
    latestResult: null as RuntimeBootstrapExecutionResult | null
};

export const isIpcRegistered = () => GLOBAL_STATE.ipcRegistered;
export const isSystemReady = () => GLOBAL_STATE.isReady;

// Handle unhandled rejections and exceptions globally
process.on('unhandledRejection', (reason, promise) => {
    appLogger.error('Main', 'Unhandled Promise Rejection', {
        reason: reason instanceof Error ? reason.stack : String(reason),
        promise
    });
});

process.on('uncaughtException', (error) => {
    appLogger.error('Main', 'Uncaught Exception', error);
    // Give logger a moment to write before exiting if it's fatal
    setTimeout(() => app.quit(), 1000);
});

// Performance: Pre-calculate roots
const allowedFileRoots = new Set<string>();

// --- INSTANT BOOTSTRAP START ---
let settingsService: SettingsService;
let runtimeBootstrapService: RuntimeBootstrapService;
// --- INSTANT BOOTSTRAP END ---

type StartupMetricEvent = Exclude<keyof StartupMetrics, 'startTime' | 'totalTime'>;
type SourceMapsEnabledFn = (enabled: boolean) => void;
type CertificateErrorDetails = [
    error: string,
    certificate: Certificate,
    callback: (isTrusted: boolean) => void,
];
function recordStartupPhase(services: Services, event: StartupMetricEvent): void {
    services?.performanceService?.recordStartupEvent(event);
}

type WindowLifecycleFlags = {
    readyToShow: boolean;
    didFinishLoad: boolean;
    didFailLoad: boolean;
};

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

app.commandLine.appendSwitch(
    'js-flags',
    isDev
        ? '--max-old-space-size=1536 --max-semi-space-size=16'
        : '--max-old-space-size=768 --max-semi-space-size=8'
);
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('renderer-process-limit', isDev ? '6' : '3');
if (!isDev) {
    app.commandLine.appendSwitch('process-per-site');
}

// Graphics: Fix for EGL/OpenGL initialization errors on Windows
if (process.platform === 'win32' && process.env.TENGRA_SAFE_GPU_MODE === 'true') {
    app.commandLine.appendSwitch('use-gl', 'angle');
    app.commandLine.appendSwitch('use-angle', 'd3d11');
    app.commandLine.appendSwitch('disable-features', 'Vulkan');
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
    // 0. Initialize Logger IMMEDIATELY
    const debugLogsEnabled = process.env.TENGRA_DEBUG_LOGS !== 'false';
    const runtimeLogLevel = debugLogsEnabled ? LogLevel.DEBUG : LogLevel.INFO;
    appLogger.setShowDebugLogs(debugLogsEnabled);
    appLogger.setLevel(runtimeLogLevel);

    // Safety check for EPIPE on console redirect
    try {
        appLogger.installConsoleRedirect();
    } catch (e) {
        console.error('Failed to redirect console (EPIPE?):', e);
    }

    appLogger.info('Main', `Logger configured: level=${LogLevel[runtimeLogLevel]}, debug=${debugLogsEnabled}`);

    // 1. Initial Minimal Services (extremely fast <100ms)
    const minimal = await createMinimalServices();
    settingsService = minimal.settingsService;
    runtimeBootstrapService = minimal.runtimeBootstrapService;

    // Link services back to the early IPC handlers
    const { EarlyIpc } = await import('./startup/minimal-ipc');
    EarlyIpc.linkServices({ 
        settings: settingsService, 
        runtime: runtimeBootstrapService 
    });

    // Update global state for handlers
    runtimeBootstrapService.onScanFinished = (result: RuntimeBootstrapExecutionResult) => {
        GLOBAL_STATE.latestResult = result;
    };
    GLOBAL_STATE.latestResult = runtimeBootstrapService.getLatestExecutionResult();

    // Premium Memory & Power Management: Throttle resources when app is in background
    app.on('browser-window-blur', () => {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
            if (!win.isDestroyed() && win.webContents) {
                win.webContents.setFrameRate(5);
                win.webContents.setBackgroundThrottling(true);

                // Forces memory cleanup if usage is significant
                const memory = process.memoryUsage();
                if (memory.heapUsed > 256 * 1024 * 1024) {
                    // Try to trigger V8 to be more aggressive
                    win.webContents.invalidate();
                }
            }
        }
    });

    app.on('browser-window-focus', () => {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
            if (!win.isDestroyed() && win.webContents) {
                win.webContents.setFrameRate(60);
                win.webContents.setBackgroundThrottling(false);
            }
        }
    });

    const shouldShowSplash = shouldShowSplashWindow();
    if (shouldShowSplash) {
        showSplashWindow();
    }

    // Security: Filter allowed roots for file protocol
    const galleryPath = path.join(path.dirname(app.getPath('userData')), 'Gallery');
    const tengraRoaming = path.join(app.getPath('appData'), 'Tengra');
    const appRoot = path.resolve(__dirname, '../..');
    // 1. Initial Minimal Services (extremely fast <100ms)
    // Services were instantiated via createMinimalServices() above.

    // Update allowed roots now that app is ready
    allowedFileRoots.add(app.getPath('userData'));
    allowedFileRoots.add(app.getPath('home'));
    allowedFileRoots.add(galleryPath);
    allowedFileRoots.add(tengraRoaming);
    allowedFileRoots.add(appRoot);

    // Register Protocols
    registerProtocols(allowedFileRoots);
    let backgroundInitPromise: Promise<unknown> | null = null;
    const ipcModulePromise = import('@main/startup/ipc');
    let services: Services | null = null;
    const windowLifecycleFlags: WindowLifecycleFlags = {
        readyToShow: false,
        didFinishLoad: false,
        didFailLoad: false,
    };
    let deferredTasksStarted = false;
    let postInteractiveTasksStarted = false;

    const runDeferredStartupTasks = () => {
        if (deferredTasksStarted) { return; }
        deferredTasksStarted = true;
        void Promise.resolve(backgroundInitPromise).then(async () => {
            if (!services) {
                return;
            }
            recordStartupPhase(services, 'deferredStartTime');
            await initializeDeferredCoreFeatures(services);
            const { registerDeferredIpcHandlers, registerPostStartupIpcHandlers } = await ipcModulePromise;
            registerPostStartupIpcHandlers(services, getMainWindow);
            await registerDeferredIpcHandlers(services, getMainWindow);

            // Initialize deferred (non-critical) services (now includes runtime bootstrap)
            await startDeferredServices();
            recordStartupPhase(services, 'deferredServicesReadyTime');

            if (runtimeStartupDecisions.embeddedProxy.shouldStart) {
                void services.proxyService
                    .startEmbeddedProxy()
                    .catch((e: unknown) => appLogger.error('Main', `Proxy Init Failed: ${getErrorMessage(e)}`));
            }

            await services.localAIService.maybeStartOllama().catch((error: unknown) => {
                appLogger.warn('Main', `Headless Ollama auto-start failed: ${getErrorMessage(error)}`);
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
        if (postInteractiveTasksStarted) { return; }
        postInteractiveTasksStarted = true;
        void Promise.resolve(ipcModulePromise).then(({ registerPostInteractiveIpcHandlers }) => {
            if (!services) {
                return;
            }
            registerPostInteractiveIpcHandlers(services, getMainWindow);
        }).catch(error => {
            appLogger.error('Main', 'Post-interactive startup tasks failed', error as Error);
        });
    };

    const closeSplashOnce = (() => {
        let splashClosed = false;
        return (reason: 'ready-to-show' | 'did-finish-load' | 'did-fail-load') => {
            if (!shouldShowSplash || splashClosed) {
                return;
            }
            splashClosed = true;
            appLogger.info('Main', `Closing splash after ${reason}`);
            closeSplashWindow();
        };
    })();

    const attachEarlyWindowLifecycle = (win: BrowserWindow) => {
        win.once('ready-to-show', () => {
            windowLifecycleFlags.readyToShow = true;
            closeSplashOnce('ready-to-show');
        });

        win.webContents.once('did-finish-load', () => {
            windowLifecycleFlags.didFinishLoad = true;
            closeSplashOnce('did-finish-load');
        });

        win.webContents.once('did-fail-load', () => {
            windowLifecycleFlags.didFailLoad = true;
            appLogger.warn('Main', 'MainWindow failed to load, closing splash');
            closeSplashOnce('did-fail-load');
        });
    };

    // Create the window as early as possible and let minimal IPC handle boot-time requests.
    const earlyWindow = createWindow(settingsService);
    attachEarlyWindowLifecycle(earlyWindow);


    // 3. Complete full service initialization
    // PERF-010: Add a safety timeout to ensure we don't hang forever if a service init fails
    services = await Promise.race([
        createServices(allowedFileRoots),
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Startup Timeout: Services failed to initialize within 60s')), 60000)
        )
    ]).catch(err => {
        appLogger.error('Main', 'Service initialization failed or timed out', err);
        // We try to return the services map if it's available in the container
        try {
            return container.resolve<Services>('services');
        } catch {
            // If everything fails, we'll probably crash later, but let's try to not crash here
            return null;
        }
    }) as Services;

    if (!services) {
        appLogger.error('Main', 'Failed to obtain services map. App will likely be unstable.');
        closeSplashWindow();
    } else {
        recordStartupPhase(services, 'coreServicesReadyTime');
    }

    // 3. Parallel Background Initialization
    const runtimeBootstrapResult = services?.runtimeBootstrapService?.getLatestExecutionResult();
    const runtimeStartupDecisions = getRuntimeStartupDecisions(runtimeBootstrapResult);

    // 4. Setup Window Event Hooks (supports windows created before full service init)
    const setupWindowHooks = (win: BrowserWindow) => {
        appLogger.debug('Main', 'Attaching startup hooks to main window');

        win.once('ready-to-show', () => {
            windowLifecycleFlags.readyToShow = true;
            if (services) {
                recordStartupPhase(services, 'readyTime');
            }
            if (process.env.TENGRA_BENCHMARK) {
                appLogger.info('Benchmark', 'BENCHMARK_READY');
                setTimeout(() => app.exit(0), 100);
            }
            setTimeout(runDeferredStartupTasks, 0);
            setTimeout(runPostInteractiveTasks, OPERATION_TIMEOUTS.DEFERRED_STARTUP);
        });

        win.webContents.once('did-finish-load', () => {
            windowLifecycleFlags.didFinishLoad = true;
            services?.performanceService?.recordStartupEvent('loadTime');
            runDeferredStartupTasks();
            setTimeout(runPostInteractiveTasks, 0);
        });

        if (windowLifecycleFlags.readyToShow && services) {
            recordStartupPhase(services, 'readyTime');
        }
        if (windowLifecycleFlags.didFinishLoad) {
            services?.performanceService?.recordStartupEvent('loadTime');
            runDeferredStartupTasks();
            setTimeout(runPostInteractiveTasks, 0);
        }
    };

    // 4. Register IPC Handlers EARLY to prevent renderer hangs
    // We don't wait for the full database health check here
    const registerIpcTask = (async () => {
        if (!services) {
            return;
        }
        try {
            const [
                { McpDispatcher },
                { ToolExecutor },
                { ApiServerService },
                { registerIpcHandlers }
            ] = await Promise.all([
                import('@main/mcp/dispatcher'),
                import('@main/tools/tool-executor'),
                import('@main/api/api-server.service'),
                ipcModulePromise
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
            });
            services.apiServerService = apiServerService;
            container.registerInstance('apiServerService', apiServerService);

            // Register main IPC handlers - THIS ALLOWS RENDERER TO PROCEED
            if (!GLOBAL_STATE.ipcRegistered) {
                appLogger.info('Main', 'Starting full IPC registration...');
                
                // CLEANUP: Remove minimal handlers before registering real ones
                const { EarlyIpc } = await import('./startup/minimal-ipc');
                EarlyIpc.cleanup();
                
                registerIpcHandlers(services, toolExecutor, getMainWindow, allowedFileRoots, mcpDispatcher, () => GLOBAL_STATE.isReady);

                GLOBAL_STATE.ipcRegistered = true;
                appLogger.info('Main', 'IPC handlers registered successfully.');
            } else {
                appLogger.warn('Main', 'IPC handlers already registered, skipping.');
            }

            recordStartupPhase(services, 'ipcReadyTime');
            GLOBAL_STATE.isReady = true;
            const { EarlyIpc } = await import('./startup/minimal-ipc');
            EarlyIpc.setReady(true);
            appLogger.info('Main', 'System is fully ready. GLOBAL_STATE.isReady set to true.');

            const mainWindow = getMainWindow() ?? createWindow(settingsService);
            if (mainWindow) {
                // Attach the lifecycle hooks (metrics, deferred tasks)
                if (typeof setupWindowHooks === 'function') {
                    setupWindowHooks(mainWindow);
                }

                recordStartupPhase(services, 'windowCreatedTime');
            }
        } catch (error) {
            appLogger.error('Main', 'Failed to register IPC handlers', error as Error);
        }
    })();

    // Database initialization task (background)
    const scanWorkspacesForFileRoots = async (dbServices: Services) => {
        if (!runtimeStartupDecisions.scanWorkspaces) { return; }
        appLogger.info('Main', 'Scanning workspaces for allowed file roots...');
        const workspaces = await dbServices.databaseService.workspaces.getWorkspaces();
        workspaces.forEach((workspace: { path?: string }) => {
            if (workspace.path) {
                allowedFileRoots.add(path.resolve(workspace.path));
            }
        });
        appLogger.info('Main', `Database loaded ${workspaces.length} workspaces`);
    };

    const initDatabaseTask = (async () => {
        if (!services || !runtimeStartupDecisions.database.shouldStart) {
            return;
        }
        try {
            await Promise.race([
                services.databaseService.initialize(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('DB Init Timeout')), 25000))
            ]);

            const connectionStats = await services.databaseService.getConnectionHealth();
            appLogger.info('Main', `Database initialized background; latency: ${connectionStats.latencyMs}ms`);

            await scanWorkspacesForFileRoots(services);
        } catch (error) {
            appLogger.error('Main', 'Database init background failed', error as Error);
        }
    })();

    backgroundInitPromise = Promise.all([registerIpcTask, initDatabaseTask]);

    if (services) {
        registerLifecycleHandlers(services.settingsService);
    }

    // If window already exists (e.g. created during registerIpcTask), hook it now
    const currentWin = getMainWindow();
    if (currentWin) {
        setupWindowHooks(currentWin);
    } else {
        // Wait for it to be created (we could use a Proxy or EventBus, but checking in a loop or after create is easier)
        // Actually, the best place to hook is inside registerIpcTask right after createWindow(settingsService)
        // I'll add a callback to createWindow or similar.
        // For now, let's just make sure runDeferredStartupTasks still runs if window fails.
    }


    // Fallback timers for deferred tasks
    setTimeout(() => {
        runDeferredStartupTasks();
        // If the window is still not visible after 5s, ensure splash is gone
        closeSplashWindow();
    }, OPERATION_TIMEOUTS.DEFERRED_STARTUP);
    setTimeout(runPostInteractiveTasks, OPERATION_TIMEOUTS.DEFERRED_STARTUP * 2);

}).catch((e: unknown) => {
    closeSplashWindow();
    const normalizedError = e instanceof Error ? e : new Error(getErrorMessage(e));
    appLogger.error('Main', 'Critical failure on startup', normalizedError);
    app.exit(1);
});
