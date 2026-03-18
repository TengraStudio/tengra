import { randomBytes } from 'crypto';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { SettingsService } from '@main/services/system/settings.service';
import { enforceNavigationRestrictions } from '@main/utils/navigation-security.util';
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
    const { width, height, x, y } = getWindowInitialSettings(settingsService);
    const iconPath = getWindowIconPath();

    const win = new BrowserWindow({
        width,
        height,
        x,
        y,
        show: false,
        frame: false,
        backgroundColor: '#000000',
        autoHideMenuBar: true,
        icon: nativeImage.createFromPath(iconPath),
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Setup Security & Event Handlers
    setupWebContentsSecurity(win);
    setupConsoleRedirect(win);
    setupWindowStatePersistence(win, settingsService, 1280, 800);
    setupWindowReadyState(win, settingsService);

    // SEC-H-001: Enforce navigation restrictions via shared utility
    enforceNavigationRestrictions(win, 'MainWindow');

    const devServerUrl = process.env['VITE_DEV_SERVER_URL'] || process.env['ELECTRON_RENDERER_URL'];

    if (!app.isPackaged && devServerUrl) {
        void win.loadURL(devServerUrl);
    } else {
        void win.loadFile(path.join(__dirname, '../renderer/index.html'));
    }


    mainWindow = win;
    return win;
}

/**
 * Resolves the appropriate icon path for the application.
 */
function getWindowIconPath(): string {
    return app.isPackaged
        ? path.join(process.resourcesPath, 'icon.ico')
        : path.join(__dirname, '../../resources/icon.ico');
}

/**
 * Retrieves initial window dimensions and position from settings.
 */
function getWindowInitialSettings(settingsService?: SettingsService): {
    width: number;
    height: number;
    x: number | undefined;
    y: number | undefined;
} {
    const settings = settingsService?.getSettings();
    const win = settings?.window;
    return {
        width: win?.width ?? 1280,
        height: win?.height ?? 800,
        x: win?.x,
        y: win?.y,
    };
}

/**
 * Handles the 'ready-to-show' event and initial visibility logic.
 */
function setupWindowReadyState(win: BrowserWindow, settingsService?: SettingsService) {
    win.on('ready-to-show', () => {
        const settings = settingsService?.getSettings();
        const isHidden =
            process.argv.includes('--hidden') ||
            process.argv.includes('/hidden') ||
            (settings?.window?.workAtBackground === true &&
                app.getLoginItemSettings().wasOpenedAtLogin);

        if (!isHidden) {
            win.show();
        }
        win.setTitle('TENGRA');
    });
}

/**
 * Hardens WebContents security with CSP and permission restrictions.
 * AUD-SEC-012: Robust CSP and Security headers
 */
function setupWebContentsSecurity(win: BrowserWindow) {
    const isDev = !app.isPackaged;

    // Security: Filter headers to ensure strong CSP and prevent information disclosure
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        const nonce = randomBytes(16).toString('base64');

        // Build CSP sources based on environment
        const scriptSources = [
            `'self'`,
            'blob:',
            ...(isDev ? [`'unsafe-inline'`, `'unsafe-eval'`] : [`'nonce-${nonce}'`]),
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
                'X-Content-Type-Options': ['nosniff'],
                'X-Frame-Options': ['DENY'],
                'X-XSS-Protection': ['1; mode=block'],
                'Referrer-Policy': ['no-referrer-when-downgrade'],
                ...(app.isPackaged ? { 'Strict-Transport-Security': ['max-age=31536000; includeSubDomains'] } : {}),
            },
        });
    });
    win.webContents.on('console-message', event => {
        if (event.message.includes('Content Security Policy')) {
            appLogger.warn('Security', `CSP violation observed: ${event.message}`);
        }
    });

    // Hardened permission handlers
    win.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
        const allowedPermissions = new Set(['notifications', 'fullscreen']);
        if (allowedPermissions.has(permission)) {
            appLogger.debug('Security', `Permission allowed: ${permission}`);
            return callback(true);
        }
        appLogger.warn('Security', `Permission request denied: ${permission}`);
        return callback(false);
    });

    win.webContents.session.setPermissionCheckHandler((_webContents, permission) => {
        const allowedPermissions = new Set(['notifications', 'fullscreen']);
        return allowedPermissions.has(permission);
    });

}

/**
 * Redirects renderer console messages to application logger.
 * Uses new Event<WebContentsConsoleMessageEventParams> API (Electron 29+)
 */
function setupConsoleRedirect(win: BrowserWindow) {
    win.webContents.on('console-message', event => {
        const { level, message, lineNumber, sourceId } = event;
        if (
            message.includes('[DEP0180]') &&
            message.includes('fs.Stats constructor is deprecated')
        ) {
            return;
        }
        // level is now a string: 'info' | 'warning' | 'error' | 'debug'
        const levelMap: Record<string, 'debug' | 'info' | 'warn' | 'error'> = {
            debug: 'debug',
            info: 'info',
            warning: 'warn',
            error: 'error',
        };
        const lvl = levelMap[level] ?? 'info';

        // In production, the renderer IPC bridge already forwards warn/error.
        // Only capture debug/info here in dev to avoid double-logging.
        if (app.isPackaged && (lvl === 'warn' || lvl === 'error')) {
            return;
        }

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
                        fullscreen: isFullscreen,
                    },
                });
            }
        }, 500);
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
                    ...currentWindow,
                    width: currentWindow?.width ?? defaultWidth,
                    height: currentWindow?.height ?? defaultHeight,
                    x: currentWindow?.x ?? 0,
                    y: currentWindow?.y ?? 0,
                    fullscreen: true,
                },
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
                    ...currentWindow,
                    width: currentWindow?.width ?? defaultWidth,
                    height: currentWindow?.height ?? defaultHeight,
                    x: currentWindow?.x ?? 0,
                    y: currentWindow?.y ?? 0,
                    fullscreen: false,
                },
            });
        }
    });
}

export function setupTray(settingsService?: SettingsService) {
    if (tray) {
        return;
    }

    try {
        const iconPath = app.isPackaged
            ? path.join(process.resourcesPath, 'icon.ico')
            : path.join(__dirname, '../../resources/icon.ico');
        const icon = nativeImage.createFromPath(iconPath);

        tray = new Tray(icon);

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show Tengra',
                click: () => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.show();
                        mainWindow.focus();
                    } else if (settingsService) {
                        mainWindow = createWindow(settingsService);
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
                mainWindow = createWindow(settingsService);
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


