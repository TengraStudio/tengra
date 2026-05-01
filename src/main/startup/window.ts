/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { randomBytes } from 'crypto';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { SettingsService } from '@main/services/system/settings.service';
import { t } from '@main/utils/i18n.util';
import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

export function getMainWindow(): BrowserWindow | null {
    return mainWindow;
}

export function setMainWindow(win: BrowserWindow | null): void {
    mainWindow = win;
}

export function getTray(): Tray | null {
    return tray;
}

export function createWindow(settingsService?: SettingsService): BrowserWindow {
    if (mainWindow && !mainWindow.isDestroyed()) {
        return mainWindow;
    }

    const { width, height, x, y, zoomFactor } = getWindowInitialSettings(settingsService);
    const iconPath = getWindowIconPath();

    const win = new BrowserWindow({
        width,
        height,
        x,
        y,
        show: false,
        frame: false,
        backgroundColor: '#f5f5f5', // Matches splash screen background
        autoHideMenuBar: true,
        icon: nativeImage.createFromPath(iconPath),
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            backgroundThrottling: true,
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    mainWindow = win;

    // Setup Security & Event Handlers
    setupWebContentsSecurity(win);
    setupConsoleRedirect(win);
    win.on('close', () => {
        appLogger.info('Window', 'Main window close event');
    });
    win.on('closed', () => {
        appLogger.info('Window', 'Main window closed');
    });
    win.webContents.on('render-process-gone', (_event, details) => {
        appLogger.error('Window', `Renderer process gone: reason=${details.reason}; exitCode=${details.exitCode}`);
    });
    win.webContents.setZoomFactor(zoomFactor);
    setupWindowStatePersistence(win, settingsService, 1280, 800);
    setupWindowReadyState(win, settingsService);


    const devServerUrl = process.env['VITE_DEV_SERVER_URL'] || process.env['ELECTRON_RENDERER_URL'];

    if (!app.isPackaged && devServerUrl) {
        appLogger.info('Window', `Loading development URL: ${devServerUrl}`);
        void win.loadURL(devServerUrl);
    } else {
        const indexPath = path.join(__dirname, '../renderer/index.html');
        appLogger.info('Window', `Loading production file: ${indexPath}`);
        void win.loadFile(indexPath).catch(err => {
            appLogger.error('Window', `Failed to load index.html: ${err.message}`);
        });
    }


    return win;
}

/**
 * Resolves the appropriate icon path for the application.
 */
function getWindowIconPath(): string {
    return app.isPackaged
        ? path.join(process.resourcesPath, 'assets/icon.ico')
        : path.join(__dirname, '../../assets/icon.ico');
}

/**
 * Retrieves initial window dimensions and position from settings.
 */
function getWindowInitialSettings(settingsService?: SettingsService): {
    width: number;
    height: number;
    x: number | undefined;
    y: number | undefined;
    zoomFactor: number;
    fullscreen: boolean;
    maximized: boolean;
} {
    const settings = settingsService?.getSettings();
    const win = settings?.window;
    const fullscreen = win?.fullscreen === true;
    const maximized = win?.maximized === true;
    return {
        width: win?.width ?? 1280,
        height: win?.height ?? 800,
        x: (fullscreen || maximized) ? undefined : win?.x,
        y: (fullscreen || maximized) ? undefined : win?.y,
        zoomFactor: win?.zoomFactor ?? 1,
        fullscreen,
        maximized,
    };
}

/**
 * Handles the 'ready-to-show' event and initial visibility logic.
 */
function setupWindowReadyState(win: BrowserWindow, settingsService?: SettingsService) {
    let revealed = false;
    const revealWindow = () => {
        if (revealed || win.isDestroyed()) {
            return;
        }

        const settings = settingsService?.getSettings();
        const shouldStartFullscreen = settings?.window?.fullscreen === true;
        const shouldStartMaximized = settings?.window?.maximized === true;
        const isHidden =
            process.argv.includes('--hidden') ||
            process.argv.includes('/hidden') ||
            (settings?.window?.workAtBackground === true &&
                app.getLoginItemSettings().wasOpenedAtLogin);

        if (!isHidden) {
            revealed = true;
            win.show();
            if (shouldStartFullscreen && !win.isFullScreen()) {
                win.setFullScreen(true);
            } else if (shouldStartMaximized && !win.isMaximized()) {
                win.maximize();
            }
            if (shouldStartFullscreen) {
                setTimeout(() => {
                    if (!win.isDestroyed() && !win.isFullScreen()) {
                        win.setFullScreen(true);
                    }
                }, 100);
            } else if (shouldStartMaximized) {
                setTimeout(() => {
                    if (!win.isDestroyed() && !win.isMaximized()) {
                        win.maximize();
                    }
                }, 100);
            }
        }
        win.setTitle('TENGRA');
    };

    win.on('ready-to-show', () => {
        revealWindow();
    });

    win.webContents.once('did-finish-load', () => {
        setTimeout(() => {
            revealWindow();
        }, 75);
    });
}

/**
 * Hardens WebContents security with CSP and permission restrictions.
 * AUD-SEC-012: Robust CSP and Security headers
 */
function setupWebContentsSecurity(win: BrowserWindow) {
    const isDev = !app.isPackaged;

    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        const nonce = randomBytes(16).toString('base64');

        const scriptSources = [
            `'self'`,
            'blob:',
            ...(isDev ? [`'unsafe-inline'`] : [`'nonce-${nonce}'`]),
        ];

        const connectSources = [
            `'self'`,
            'https:',
            ...(isDev
                ? [
                    'http://localhost:*',
                    'http://127.0.0.1:*',
                    'ws://localhost:*',
                    'ws://127.0.0.1:*',
                    'wss://localhost:*',
                    'wss://127.0.0.1:*',
                ]
                : []),
        ];

        const csp = [
            `default-src 'self'`,
            `script-src ${scriptSources.join(' ')}`,
            `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
            `img-src 'self' data: blob: safe-file: https:`,
            `media-src 'self' safe-file: https:`,
            `font-src 'self' data: https://fonts.gstatic.com`,
            `connect-src ${connectSources.join(' ')}`,
            `object-src 'none'`,
            `base-uri 'self'`,
            `frame-src 'none'`,
            `frame-ancestors 'none'`,
            `form-action 'self'`,
            `worker-src 'self' blob:`,
            `manifest-src 'self'`,
            ...(isDev ? [] : [`upgrade-insecure-requests`]),
        ].join('; ');

        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [csp],
                'IconX-Content-Type-Options': ['nosniff'],
                'IconX-Frame-Options': ['DENY'],
                'IconX-XSS-Protection': ['1; mode=block'],
                'Referrer-Policy': ['no-referrer-when-downgrade'],
                ...(app.isPackaged ? { 'Strict-Transport-Security': ['max-age=31536000; includeSubDomains'] } : {}),
            },
        });
    });

    win.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
        const allowedPermissions = new Set(['notifications', 'fullscreen']);
        if (allowedPermissions.has(permission)) {
            return callback(true);
        }
        return callback(false);
    });

    win.webContents.session.setPermissionCheckHandler((_webContents, permission) => {
        const allowedPermissions = new Set(['notifications', 'fullscreen']);
        return allowedPermissions.has(permission);
    });
}

function setupConsoleRedirect(win: BrowserWindow) {
    win.webContents.on('console-message', event => {
        const { level, message, lineNumber, sourceId } = event;
        const levelMap: Record<string, 'debug' | 'info' | 'warn' | 'error'> = {
            debug: 'debug',
            info: 'info',
            warning: 'warn',
            error: 'error',
        };
        const lvl = levelMap[level] ?? 'info';
        const context = `renderer:${path.basename(sourceId)}:${lineNumber} `;
        appLogger[lvl](context, message);
    });
}

function setupWindowStatePersistence(
    win: BrowserWindow,
    settingsService?: SettingsService,
    defaultWidth: number = 1280,
    defaultHeight: number = 800
) {
    let saveTimeout: NodeJS.Timeout | null = null;
    const saveWindowState = () => {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        saveTimeout = setTimeout(() => {
            if (settingsService && !win.isDestroyed()) {
                const isFullscreen = win.isFullScreen();
                const isMaximized = win.isMaximized();
                const currentSettings = settingsService.getSettings();
                const currentWindow = currentSettings.window;
                
                // Only get normal bounds if not maximized/fullscreen
                const bounds = (!isFullscreen && !isMaximized)
                    ? win.getBounds()
                    : {
                        width: currentWindow?.width ?? defaultWidth,
                        height: currentWindow?.height ?? defaultHeight,
                        x: currentWindow?.x ?? 0,
                        y: currentWindow?.y ?? 0,
                    };

                void settingsService.saveSettings({
                    ...currentSettings,
                    window: {
                        ...currentWindow,
                        width: bounds.width,
                        height: bounds.height,
                        x: bounds.x,
                        y: bounds.y,
                        fullscreen: isFullscreen,
                        maximized: isMaximized,
                    },
                });
            }
        }, 500);
    };

    win.on('moved', saveWindowState);
    win.on('resized', saveWindowState);
    win.on('maximize', saveWindowState);
    win.on('unmaximize', saveWindowState);
    win.on('enter-full-screen', saveWindowState);
    win.on('leave-full-screen', saveWindowState);
}

export function setupTray(settingsService?: SettingsService) {
    if (tray) {return;}

    const createWindowIfIpcReady = async () => {
        if (!settingsService) {
            return;
        }
        const { isIpcRegistered } = await import('../app');
        if (isIpcRegistered()) {
            mainWindow = createWindow(settingsService);
        } else {
            appLogger.info('Tray', 'Window creation deferred: IPC not registered');
        }
    };

    try {
        const iconPath = app.isPackaged
            ? path.join(process.resourcesPath, 'icon.ico')
            : path.join(__dirname, '../../resources/icon.ico');
        const icon = nativeImage.createFromPath(iconPath);

        tray = new Tray(icon);

        const contextMenu = Menu.buildFromTemplate([
            {
                label: t('auto.showTengra'),
                click: () => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.show();
                        mainWindow.focus();
                    } else if (settingsService) {
                        void createWindowIfIpcReady();
                    }
                },
            },
            {
                label: 'Quit',
                click: () => {
                    app.quit();
                },
            },
        ]);

        tray.setToolTip('Tengra');
        tray.setContextMenu(contextMenu);

        tray.on('click', () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.show();
                    mainWindow.focus();
                }
            } else if (settingsService) {
                void createWindowIfIpcReady();
            }
        });
    } catch (error) {
        appLogger.error('Main', `Failed to setup tray: ${error} `);
    }
}

export function destroyTray() {
    if (tray) {
        tray.destroy();
        tray = null;
    }
}
