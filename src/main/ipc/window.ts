import { spawn } from 'child_process';
import * as path from 'path';

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { resolveWindowsCommand } from '@main/utils/windows-command.util';
import { getErrorMessage } from '@shared/utils/error.util';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { z } from 'zod';

import { commandSchema, cwdSchema,urlSchema } from './validation';

const COMPACT_WIDTH = 400;
const COMPACT_HEIGHT = 600;
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;
const DETACHED_TERMINAL_WIDTH = 1000;
const DETACHED_TERMINAL_HEIGHT = 420;
const MAX_TEXT_LENGTH = 512;
const detachedTerminalWindows = new Map<string, BrowserWindow>();
const SENSITIVE_QUERY_KEYS = new Set([
    'token', 'access_token', 'refresh_token', 'code', 'state', 'sessionkey', 'session_key',
    'apikey', 'api_key', 'authorization', 'password', 'passphrase'
]);
const COOKIE_CAPTURE_ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);
const COOKIE_CAPTURE_ALLOWED_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    'accounts.google.com',
    'claude.ai',
    'api.anthropic.com',
    'github.com'
]);

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
export function registerWindowIpc(getMainWindow: () => BrowserWindow | null, allowedRoots: Set<string>) {
    registerWindowControlHandlers(getMainWindow);
    registerShellHandlers(getMainWindow, allowedRoots);
    registerCookieHandlers(getMainWindow);
}

function isPathAllowed(filePath: string, allowedRoots: Set<string>): boolean {
    const absolutePath = path.resolve(filePath);
    const isWin = process.platform === 'win32';
    const normalizedPath = isWin ? absolutePath.toLowerCase() : absolutePath;
    return Array.from(allowedRoots).some((root) => {
        const resolvedRoot = path.resolve(root);
        const normalizedRoot = isWin ? resolvedRoot.toLowerCase() : resolvedRoot;
        const sep = isWin ? '\\' : path.sep;
        return normalizedPath === normalizedRoot || normalizedPath.startsWith(normalizedRoot.endsWith(sep) ? normalizedRoot : `${normalizedRoot}${sep}`);
    });
}

function redactUrlForLogs(rawUrl: string): string {
    try {
        const parsed = new URL(rawUrl);
        for (const key of parsed.searchParams.keys()) {
            if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
                parsed.searchParams.set(key, '[REDACTED]');
            }
        }
        return parsed.toString();
    } catch {
        return rawUrl;
    }
}

function isCookieCaptureUrlAllowed(rawUrl: string): boolean {
    try {
        const parsed = new URL(rawUrl);
        if (!COOKIE_CAPTURE_ALLOWED_PROTOCOLS.has(parsed.protocol)) {
            return false;
        }
        const host = parsed.hostname.toLowerCase();
        return COOKIE_CAPTURE_ALLOWED_HOSTS.has(host)
            || host.endsWith('.claude.ai')
            || host.endsWith('.anthropic.com')
            || host.endsWith('.github.com')
            || host.endsWith('.google.com');
    } catch {
        return false;
    }
}

/**
 * Registers IPC handlers for window control operations (minimize, maximize, close, resize, fullscreen, detached terminal).
 * @param getMainWindow - Factory function that returns the main BrowserWindow instance
 */
function registerWindowControlHandlers(getMainWindow: () => BrowserWindow | null) {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'window operation');

    ipcMain.on('window:minimize', event => {
        try {
            const win = getMainWindow();
            validateSender(event);
            win?.minimize();
        } catch {
            /* ignore */
        }
    });

    ipcMain.on('window:maximize', event => {
        try {
            const win = getMainWindow();
            validateSender(event);
            if (!win) {
                return;
            }
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
            const win = getMainWindow();
            validateSender(event);
            win?.close();
        } catch {
            /* ignore */
        }
    });

    ipcMain.on('window:toggle-compact', (event, enabled) => {
        try {
            const win = getMainWindow();
            validateSender(event);
            if (!win) {
                return;
            }
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
            const win = getMainWindow();
            validateSender(event);
            if (!win) {
                return;
            }
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
            const win = getMainWindow();
            validateSender(event);
            if (!win) {
                return;
            }
            win.setFullScreen(!win.isFullScreen());
        } catch {
            /* ignore */
        }
    });

    ipcMain.handle('window:openDetachedTerminal', async (event, optionsRaw: unknown) => {
        validateSender(event);
        const win = getMainWindow();
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
function registerShellHandlers(getMainWindow: () => BrowserWindow | null, allowedRoots: Set<string>) {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'window operation');
    ipcMain.handle('shell:openExternal', createValidatedIpcHandler('shell:openExternal', async (event, url: string) => {
        validateSender(event);
        appLogger.info('WindowIPC', `shell:openExternal handle called with URL: ${redactUrlForLogs(url)}`);

        // Handle safe-file:// protocol for local images
        if (url.startsWith('safe-file://')) {
            const filePath = url.replace('safe-file://', '');
            appLogger.info('WindowIPC', `Opening local file path: ${filePath}`);
            try {
                const decodedPath = decodeURIComponent(filePath);
                if (!isPathAllowed(decodedPath, allowedRoots)) {
                    return { success: false, error: 'Access denied' };
                }
                const error = await shell.openPath(decodedPath);
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
                appLogger.info('WindowIPC', `Opening URL with shell.openExternal: ${redactUrlForLogs(urlString)}`);
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
    }, {
        argsSchema: z.tuple([urlSchema]),
        defaultValue: { success: false, error: 'Validation failed' }
    }));

    ipcMain.handle('shell:openTerminal', createValidatedIpcHandler('shell:openTerminal', async (event, command: string) => {
        validateSender(event);
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
    }, {
        argsSchema: z.tuple([commandSchema]),
        defaultValue: false
    }));

    ipcMain.handle('shell:runCommand', createValidatedIpcHandler('shell:runCommand', async (event, command: string, args: string[], cwd?: string) => {
        validateSender(event);
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
                resolve({ stdout, stderr, code: code ?? 0, error: '' });
            });

            child.on('error', (err: Error) => {
                resolve({ stdout, stderr, code: 1, error: err.message });
            });
        });
    }, {
        argsSchema: z.tuple([commandSchema, z.array(z.string()), cwdSchema]),
        defaultValue: { stdout: '', stderr: '', code: 1, error: 'Validation failed' }
    }));
}

/**
 * Registers IPC handlers for cookie capture operations via hidden browser windows.
 */
function registerCookieHandlers(getMainWindow: () => BrowserWindow | null) {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'window operation');
    /**
     * Opens a hidden BrowserWindow to capture cookies from a URL.
     * Useful for capturing session cookies after OAuth completes in an external browser.
     */
    ipcMain.handle('window:captureCookies', async (event, url: string, timeoutMs = 5000) => {
        validateSender(event);
        return new Promise<{ success: boolean }>(resolve => {
            try {
                if (!isCookieCaptureUrlAllowed(url)) {
                    appLogger.warn('Security', `Denied cookie capture URL: ${redactUrlForLogs(url)}`);
                    resolve({ success: false });
                    return;
                }
                appLogger.info(
                    'WindowIPC',
                    `Creating hidden window to capture cookies from: ${redactUrlForLogs(url)}`
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
