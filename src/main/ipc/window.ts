import { spawn } from 'child_process';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { resolveWindowsCommand } from '@main/utils/windows-command.util';
import { getErrorMessage } from '@shared/utils/error.util';
import { app, BrowserWindow, ipcMain, shell } from 'electron';

const COMPACT_WIDTH = 400;
const COMPACT_HEIGHT = 600;
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;
const DETACHED_TERMINAL_WIDTH = 1000;
const DETACHED_TERMINAL_HEIGHT = 420;
const MAX_TEXT_LENGTH = 512;
const detachedTerminalWindows = new Map<string, BrowserWindow>();

interface DetachedTerminalWindowOptions {
    sessionId: string;
    title?: string;
    shell?: string;
    cwd?: string;
}

/**
 * Registers all window-related IPC handlers including window controls, shell operations, and cookies.
 * @param getMainWindow - Factory function that returns the main BrowserWindow instance
 */
export function registerWindowIpc(getMainWindow: () => BrowserWindow | null) {
    registerWindowControlHandlers(getMainWindow);
    registerShellHandlers();
    registerCookieHandlers();
}

/**
 * Registers IPC handlers for window control operations (minimize, maximize, close, resize, fullscreen, detached terminal).
 * @param getMainWindow - Factory function that returns the main BrowserWindow instance
 */
function registerWindowControlHandlers(getMainWindow: () => BrowserWindow | null) {
    const validateSender = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => {
        const win = getMainWindow();
        // SEC-013-3: Auth check for window operations
        if (event.sender.id !== win?.webContents.id) {
            appLogger.warn(
                'Security',
                `Unauthorized window operation attempt from sender ${event.sender.id}`
            );
            throw new Error('Unauthorized window operation');
        }
        return win;
    };

    ipcMain.on('window:minimize', event => {
        try {
            validateSender(event).minimize();
        } catch {
            /* ignore */
        }
    });

    ipcMain.on('window:maximize', event => {
        try {
            const win = validateSender(event);
            if (win.isMaximized()) {
                win.unmaximize();
            } else {
                win.maximize();
            }
        } catch {
            /* ignore */
        }
    });

    ipcMain.on('window:close', event => {
        try {
            validateSender(event).close();
        } catch {
            /* ignore */
        }
    });

    ipcMain.on('window:toggle-compact', (event, enabled) => {
        try {
            const win = validateSender(event);
            if (enabled) {
                win.setSize(COMPACT_WIDTH, COMPACT_HEIGHT);
            } else {
                win.setSize(DEFAULT_WIDTH, DEFAULT_HEIGHT);
            }
        } catch {
            /* ignore */
        }
    });

    ipcMain.on('window:resize', (event, resolution: string) => {
        try {
            const win = validateSender(event);
            const [width, height] = resolution.split('x').map(Number);
            if (width && height) {
                win.setSize(width, height);
                win.center();
            }
        } catch {
            /* ignore */
        }
    });

    ipcMain.on('window:toggle-fullscreen', event => {
        try {
            const win = validateSender(event);
            win.setFullScreen(!win.isFullScreen());
        } catch {
            /* ignore */
        }
    });

    ipcMain.handle('window:openDetachedTerminal', async (event, optionsRaw: unknown) => {
        const win = validateSender(event);
        if (!win) {
            return false;
        }

        const options = parseDetachedTerminalOptions(optionsRaw);
        if (!options) {
            return false;
        }

        const existing = detachedTerminalWindows.get(options.sessionId);
        if (existing && !existing.isDestroyed()) {
            if (existing.isMinimized()) {
                existing.restore();
            }
            existing.focus();
            return true;
        }

        try {
            const detachedWindow = new BrowserWindow({
                width: DETACHED_TERMINAL_WIDTH,
                height: DETACHED_TERMINAL_HEIGHT,
                minWidth: 640,
                minHeight: 260,
                show: false,
                autoHideMenuBar: true,
                backgroundColor: '#000000',
                title: options.title ? `${options.title} - Terminal` : 'Detached Terminal',
                webPreferences: {
                    preload: path.join(__dirname, '../preload/preload.js'),
                    sandbox: true,
                    contextIsolation: true,
                    nodeIntegration: false,
                },
            });

            const query = {
                detachedTerminal: '1',
                sessionId: options.sessionId,
                title: options.title ?? options.sessionId,
                shell: options.shell ?? '',
                cwd: options.cwd ?? '',
            };

            if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
                const url = new URL(process.env['ELECTRON_RENDERER_URL']);
                Object.entries(query).forEach(([key, value]) => {
                    url.searchParams.set(key, value);
                });
                await detachedWindow.loadURL(url.toString());
            } else {
                await detachedWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
                    query,
                });
            }

            detachedWindow.on('ready-to-show', () => {
                detachedWindow.show();
                detachedWindow.focus();
            });

            detachedWindow.on('closed', () => {
                detachedTerminalWindows.delete(options.sessionId);
            });

            detachedTerminalWindows.set(options.sessionId, detachedWindow);
            return true;
        } catch (error) {
            appLogger.error(
                'WindowIPC',
                `Failed to open detached terminal: ${getErrorMessage(error)}`
            );
            return false;
        }
    });
}

/**
 * Parses and validates raw input into detached terminal window options.
 * @param value - Raw options object to parse
 * @returns Validated options or null if invalid
 */
function parseDetachedTerminalOptions(value: unknown): DetachedTerminalWindowOptions | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const raw = value as Record<string, unknown>;
    const sessionId = typeof raw.sessionId === 'string' ? raw.sessionId.trim() : '';
    if (!sessionId) {
        return null;
    }

    const normalize = (input: unknown): string | undefined => {
        if (typeof input !== 'string') {
            return undefined;
        }
        const trimmed = input.trim();
        if (!trimmed) {
            return undefined;
        }
        return trimmed.slice(0, MAX_TEXT_LENGTH);
    };

    return {
        sessionId: sessionId.slice(0, MAX_TEXT_LENGTH),
        title: normalize(raw.title),
        shell: normalize(raw.shell),
        cwd: normalize(raw.cwd),
    };
}

/**
 * Registers IPC handlers for shell operations (open external URLs, open terminal, run commands).
 */
function registerShellHandlers() {
    ipcMain.handle('shell:openExternal', async (_event, url) => {
        appLogger.info('WindowIPC', `shell:openExternal handle called with URL: ${url}`);

        // Handle safe-file:// protocol for local images
        if (url.startsWith('safe-file://')) {
            const filePath = url.replace('safe-file://', '');
            appLogger.info('WindowIPC', `Opening local file path: ${filePath}`);
            try {
                const error = await shell.openPath(decodeURIComponent(filePath));
                if (error) {
                    appLogger.error('WindowIPC', `shell.openPath failed: ${error}`);
                    return { success: false, error };
                }
                return { success: true };
            } catch (e) {
                appLogger.error('WindowIPC', `Safe file open catch: ${e}`);
                return { success: false, error: String(e) };
            }
        }

        try {
            const parsed = new URL(url);
            const urlString = parsed.toString();

            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                appLogger.info('WindowIPC', `Opening URL with shell.openExternal: ${urlString}`);
                try {
                    await shell.openExternal(urlString);
                    return { success: true };
                } catch (e) {
                    appLogger.error(
                        'WindowIPC',
                        `shell.openExternal failed: ${getErrorMessage(e as Error)}`
                    );
                    return { success: false, error: String(e) };
                }
            } else {
                return { success: false, error: 'Forbidden protocol' };
            }
        } catch (e) {
            appLogger.error('WindowIPC', `openExternal catch: ${e}`);
            return { success: false, error: String(e) };
        }
    });

    ipcMain.handle('shell:openTerminal', async (_event, command) => {
        if (process.platform === 'win32') {
            // Sanitize command - remove shell metacharacters to prevent injection
            // Block: pipes, redirects, semicolons, backticks, $(), newlines
            const sanitized = command
                .replace(/[&|><;`$(){}[\]\n\r]/g, '')
                .replace(/\$\([^)]*\)/g, '') // Remove $(...) substitution
                .trim();

            if (!sanitized) {
                appLogger.warn('WindowIPC', 'Command was empty after sanitization');
                return false;
            }

            spawn('cmd', ['/k', sanitized], { shell: false });
        } else {
            // Basic fallback for Linux/Mac
            appLogger.warn(
                'WindowIPC',
                `Open terminal not fully supported on non-windows yet: ${command}`
            );
        }
        return true;
    });

    ipcMain.handle('shell:runCommand', async (_event, command, args, cwd) => {
        return new Promise(resolve => {
            const resolvedCommand = resolveWindowsCommand(command);
            appLogger.info('WindowIPC', `Running command: ${resolvedCommand} ${args.join(' ')}`);
            const child = spawn(resolvedCommand, args, {
                cwd: cwd ?? process.cwd(),
                shell: false, // Disable shell for security
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            child.on('close', (code: number | null) => {
                resolve({ stdout, stderr, code: code ?? 0 });
            });

            child.on('error', (err: Error) => {
                resolve({ stdout, stderr, code: 1, error: err.message });
            });
        });
    });
}

/**
 * Registers IPC handlers for cookie capture operations via hidden browser windows.
 */
function registerCookieHandlers() {
    /**
     * Opens a hidden BrowserWindow to capture cookies from a URL.
     * Useful for capturing session cookies after OAuth completes in an external browser.
     */
    ipcMain.handle('window:captureCookies', async (_event, url: string, timeoutMs = 5000) => {
        return new Promise<{ success: boolean }>(resolve => {
            try {
                appLogger.info(
                    'WindowIPC',
                    `Creating hidden window to capture cookies from: ${url}`
                );

                const hiddenWin = new BrowserWindow({
                    width: 1,
                    height: 1,
                    show: false,
                    webPreferences: {
                        partition: 'default', // Use default session for cookie sharing
                        nodeIntegration: false,
                        contextIsolation: true,
                    },
                });

                let resolved = false;

                // Close window after timeout
                const timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        if (!hiddenWin.isDestroyed()) {
                            hiddenWin.close();
                        }
                        appLogger.info('WindowIPC', 'Cookie capture window closed after timeout');
                        resolve({ success: true });
                    }
                }, timeoutMs);

                // Close window once page loads (cookies should be set by then)
                hiddenWin.webContents.once('did-finish-load', () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        // Wait a bit for cookies to be set
                        setTimeout(() => {
                            if (!hiddenWin.isDestroyed()) {
                                hiddenWin.close();
                            }
                            appLogger.info(
                                'WindowIPC',
                                'Cookie capture window closed after page load'
                            );
                            resolve({ success: true });
                        }, 1000);
                    }
                });

                hiddenWin.on('closed', () => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        resolve({ success: true });
                    }
                });

                void hiddenWin.loadURL(url);
            } catch (error) {
                appLogger.error(
                    'WindowIPC',
                    `Failed to create cookie capture window: ${getErrorMessage(error)}`
                );
                resolve({ success: false });
            }
        });
    });
}
