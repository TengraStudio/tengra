import { spawn } from 'child_process';
import * as path from 'path';

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { createIpcHandler, createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { RateLimiter } from '@main/utils/rate-limiter.util';
import { validateCommandArgs } from '@main/utils/shell-command-policy.util';
import { resolveWindowsCommand } from '@main/utils/windows-command.util';
import { getErrorMessage } from '@shared/utils/error.util';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { z } from 'zod';

import { commandSchema, cwdSchema, urlSchema } from './validation';

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
// AUD-SEC-034: Enforce HTTPS-only policy for cookie-capture URL allowlist
// Only HTTPS is allowed for remote hosts; HTTP only for localhost
const COOKIE_CAPTURE_ALLOWED_HOSTS = new Set([
    'accounts.google.com',
    'claude.ai',
    'api.anthropic.com',
    'github.com'
]);
const RUN_COMMAND_ALLOWED_EXECUTABLES = new Set([
    'git',
    'npm',
    'npx',
    'node',
    'pnpm',
    'yarn',
    'python',
    'python3',
    'pip',
    'pip3',
    'cargo',
    'rustc',
    'go',
    'docker',
    'kubectl'
]);

/** AUD-2026-02-27-03: Rate limiter for shell:runCommand — 30 executions per minute */
const runCommandRateLimiter = new RateLimiter({
    maxTokens: 30,
    refillRate: 30,
    refillIntervalMs: 60_000,
});

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

function normalizeExecutableName(command: string): string {
    const trimmed = command.trim();
    const normalized = process.platform === 'win32' ? trimmed.toLowerCase() : trimmed;
    const base = path.basename(normalized);
    return base.replace(/\.(exe|cmd|bat)$/i, '');
}

/**
 * AUD-SEC-034: Enforce HTTPS-only policy for cookie-capture URL allowlist
 * Only HTTPS is allowed for remote hosts; HTTP only for localhost
 */
function isCookieCaptureUrlAllowed(rawUrl: string): boolean {
    try {
        const parsed = new URL(rawUrl);
        const host = parsed.hostname.toLowerCase();

        // Check for localhost with HTTP or HTTPS
        if (host === 'localhost' || host === '127.0.0.1') {
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        }

        // All other hosts must use HTTPS only
        if (parsed.protocol !== 'https:') {
            return false;
        }

        // Check against allowed hosts list
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
        wrapResponse: true,
        defaultValue: { success: false, error: 'Validation failed' }
    }));

    ipcMain.handle('shell:openTerminal', createValidatedIpcHandler('shell:openTerminal', async (event, command: string) => {
        validateSender(event);
        if (process.platform === 'win32') {
            // AUD-SEC-037: Hardened shell command validation
            // Strict allowlist of safe characters only
            const MAX_COMMAND_LENGTH = 1024;

            if (command.length > MAX_COMMAND_LENGTH) {
                appLogger.warn('WindowIPC', 'Command exceeds maximum length');
                return false;
            }

            // Only allow alphanumeric, spaces, dashes, underscores, forward/back slashes, colons, and dots
            // This is a very restrictive allowlist
            const allowedPattern = /^[a-zA-Z0-9\s\-_./\\:]+$/;
            if (!allowedPattern.test(command)) {
                appLogger.warn('WindowIPC', `Command contains forbidden characters: ${command}`);
                return false;
            }

            // Block dangerous patterns even if they pass the allowlist
            const dangerousPatterns = [
                /\b(rm|del|format|fdisk|mkfs|dd|shutdown|reboot|halt|poweroff)\b/i,
                /\b(reg|registry|regedit|regsvr32)\b/i,
                /\b(net|netsh|ipconfig|route|arp)\b/i,
                /\b(taskkill|tasklist|wmic|powershell|pwsh|cmd|command)\b/i,
                /\b(curl|wget|nc|netcat|telnet|ftp|tftp)\b/i,
                /\b(python|perl|ruby|node|npm|npx|yarn|pnpm)\b/i,
                /\b(git\s+push|git\s+reset|git\s+clean|git\s+checkout)\b/i,
            ];

            for (const pattern of dangerousPatterns) {
                if (pattern.test(command)) {
                    appLogger.warn('WindowIPC', `Command contains dangerous pattern: ${command}`);
                    return false;
                }
            }

            spawn('cmd', ['/k', command], { shell: false });
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
        wrapResponse: true,
        defaultValue: false
    }));

    ipcMain.handle('shell:runCommand', createValidatedIpcHandler('shell:runCommand', async (event, command: string, args: string[], cwd?: string) => {
        validateSender(event);

        // AUD-SEC-037: Hardened command validation
        const MAX_COMMAND_LENGTH = 256;
        const MAX_ARGS_COUNT = 50;
        const MAX_ARG_LENGTH = 1024;

        if (command.length > MAX_COMMAND_LENGTH) {
            appLogger.warn('WindowIPC', 'Command exceeds maximum length');
            return { stdout: '', stderr: 'Command too long', code: 1, error: 'Command validation failed' };
        }

        if (args.length > MAX_ARGS_COUNT) {
            appLogger.warn('WindowIPC', 'Too many arguments');
            return { stdout: '', stderr: 'Too many arguments', code: 1, error: 'Command validation failed' };
        }

        for (const arg of args) {
            if (arg.length > MAX_ARG_LENGTH) {
                appLogger.warn('WindowIPC', 'Argument exceeds maximum length');
                return { stdout: '', stderr: 'Argument too long', code: 1, error: 'Command validation failed' };
            }
            if (/[\r\n\0]/.test(arg)) {
                appLogger.warn('WindowIPC', 'Argument contains forbidden control characters');
                return { stdout: '', stderr: 'Invalid argument', code: 1, error: 'Command validation failed' };
            }
        }

        const executable = normalizeExecutableName(command);
        if (!RUN_COMMAND_ALLOWED_EXECUTABLES.has(executable)) {
            appLogger.warn('WindowIPC', `Blocked shell:runCommand executable: ${executable}`);
            return { stdout: '', stderr: 'Executable is not allowed', code: 1, error: 'Command validation failed' };
        }

        if (cwd && !isPathAllowed(cwd, allowedRoots)) {
            appLogger.warn('WindowIPC', `Blocked shell:runCommand cwd outside allowed roots: ${cwd}`);
            return { stdout: '', stderr: 'Working directory is not allowed', code: 1, error: 'Command validation failed' };
        }

        // AUD-2026-02-27-03: Per-command argument validation (path traversal, injection)
        const argPolicy = validateCommandArgs(executable, args);
        if (!argPolicy.allowed) {
            appLogger.warn('WindowIPC', `Blocked shell:runCommand args: ${argPolicy.reason}`);
            return { stdout: '', stderr: argPolicy.reason ?? 'Argument policy violation', code: 1, error: 'Command validation failed' };
        }

        // AUD-2026-02-27-03: Rate limiting for execution attempts
        if (!runCommandRateLimiter.tryAcquire()) {
            appLogger.warn('WindowIPC', 'shell:runCommand rate limit exceeded');
            return { stdout: '', stderr: 'Rate limit exceeded', code: 1, error: 'Rate limit exceeded' };
        }

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
        wrapResponse: true,
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
    ipcMain.handle('window:captureCookies', createIpcHandler('window:captureCookies', async (event, url: string, timeoutMs = 5000) => {
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
                        sandbox: true,
                        contextIsolation: true,
                        nodeIntegration: false,
                    },
                });

                let resolved = false;

                const timeoutDuration = typeof timeoutMs === 'number' ? timeoutMs : 5000;
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
                }, timeoutDuration);

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
    }, { wrapResponse: true }));
}
