import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { SettingsService } from '@main/services/system/settings.service';
import { app, BrowserWindow, HandlerDetails, Menu, nativeImage, shell, Tray } from 'electron';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

export function getMainWindow(): BrowserWindow | null {
    return mainWindow;
}

export function setMainWindow(win: BrowserWindow | null) {
    mainWindow = win;
}

export function getTray(): Tray | null {
    return tray;
}

export function createWindow(settingsService?: SettingsService): BrowserWindow {
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
                    "default-src 'self' safe-file: https: http://localhost:* ws://localhost:*; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: safe-file: https: http://localhost:*; media-src 'self' safe-file: https:; font-src 'self' data: https:;"
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

    setupWindowStatePersistence(win, settingsService, defaultWidth, defaultHeight);

    win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
        const levels = ['debug', 'info', 'warn', 'error'];
        const lvl = levels[level] as 'debug' | 'info' | 'warn' | 'error';
        const context = `renderer:${path.basename(sourceId)}:${line} `;
        appLogger[lvl](context, message);
    });

    win.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
        appLogger.warn('Security', `Permission request denied for: ${permission}`);
        return callback(false);
    });

    win.webContents.session.setPermissionCheckHandler((_webContents, permission) => {
        appLogger.debug('Security', `Permission check for: ${permission}`);
        return false;
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

    mainWindow = win;
    return win;
}

function setupWindowStatePersistence(win: BrowserWindow, settingsService?: SettingsService, defaultWidth: number = 1280, defaultHeight: number = 800) {
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
                    ...currentWindow,
                    width: currentWindow?.width ?? defaultWidth,
                    height: currentWindow?.height ?? defaultHeight,
                    x: currentWindow?.x ?? 0,
                    y: currentWindow?.y ?? 0,
                    fullscreen: false
                }
            });
        }
    });
}

export function setupTray(settingsService?: SettingsService) {
    if (tray) { return; }

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
                    } else if (settingsService) {
                        mainWindow = createWindow(settingsService);
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
