/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { spawn } from 'child_process';
import * as path from 'path';

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { SettingsService } from '@main/services/system/settings.service';
import { createValidatedIpcHandler, safeHandle } from '@main/utils/ipc-wrapper.util';
import { createWindowsSpawnCommand } from '@main/utils/windows-command.util';
import { getErrorMessage } from '@shared/utils/error.util';
import { BrowserWindow, ipcMain, shell } from 'electron';
import { z } from 'zod';

import { commandSchema, cwdSchema, urlSchema } from './validation';

const COMPACT_WIDTH = 400;
const COMPACT_HEIGHT = 600;
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;
const MAX_TEXT_LENGTH = 512;
const WINDOW_ZOOM_STEP = 0.1;
const WINDOW_ZOOM_MIN = 0.5;
const WINDOW_ZOOM_MAX = 2;
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
const WINDOW_MESSAGE_KEY = {
    SHELL_OPEN_EXTERNAL_ACCESS_DENIED: 'mainProcess.window.shellOpenExternal.accessDenied',
    SHELL_OPEN_EXTERNAL_FORBIDDEN_PROTOCOL: 'mainProcess.window.shellOpenExternal.forbiddenProtocol',
    SHELL_OPEN_EXTERNAL_VALIDATION_FAILED: 'mainProcess.window.shellOpenExternal.validationFailed',
    SHELL_RUN_COMMAND_VALIDATION_FAILED: 'mainProcess.window.shellRunCommand.validationFailed',
    SHELL_RUN_COMMAND_COMMAND_TOO_LONG: 'mainProcess.window.shellRunCommand.commandTooLong',
    SHELL_RUN_COMMAND_TOO_MANY_ARGUMENTS: 'mainProcess.window.shellRunCommand.tooManyArguments',
    SHELL_RUN_COMMAND_ARGUMENT_TOO_LONG: 'mainProcess.window.shellRunCommand.argumentTooLong',
    SHELL_RUN_COMMAND_INVALID_ARGUMENT: 'mainProcess.window.shellRunCommand.invalidArgument',
    SHELL_RUN_COMMAND_EXECUTABLE_NOT_ALLOWED: 'mainProcess.window.shellRunCommand.executableNotAllowed',
    SHELL_RUN_COMMAND_WORKING_DIRECTORY_NOT_ALLOWED: 'mainProcess.window.shellRunCommand.workingDirectoryNotAllowed',
    SHELL_RUN_COMMAND_ARGUMENT_POLICY_VIOLATION: 'mainProcess.window.shellRunCommand.argumentPolicyViolation',
    SHELL_RUN_COMMAND_RATE_LIMIT_EXCEEDED: 'mainProcess.window.shellRunCommand.rateLimitExceeded'
} as const;
const WINDOW_ERROR_MESSAGE = {
    ACCESS_DENIED: 'Access denied',
    FORBIDDEN_PROTOCOL: 'Forbidden protocol',
    VALIDATION_FAILED: 'Validation failed',
    COMMAND_VALIDATION_FAILED: 'Command validation failed',
    COMMAND_TOO_LONG: 'Command too long',
    TOO_MANY_ARGUMENTS: 'Too many arguments',
    ARGUMENT_TOO_LONG: 'Argument too long',
    INVALID_ARGUMENT: 'Invalid argument',
    EXECUTABLE_NOT_ALLOWED: 'Executable is not allowed',
    WORKING_DIRECTORY_NOT_ALLOWED: 'Working directory is not allowed',
    ARGUMENT_POLICY_VIOLATION: 'Argument policy violation',
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded'
} as const;

/**
 * Registers all window-related IPC handlers including window controls, shell operations, and cookies.
 * @param getMainWindow - Factory function that returns the main BrowserWindow instance
 */
export function registerWindowIpc(
    getMainWindow: () => BrowserWindow | null,
    allowedRoots: Set<string>,
    settingsService?: SettingsService
) {
    registerWindowControlHandlers(getMainWindow, settingsService);
    registerShellHandlers(getMainWindow, allowedRoots);
    registerCookieHandlers(getMainWindow);
}

function clampZoomFactor(value: number): number {
    return Math.max(WINDOW_ZOOM_MIN, Math.min(WINDOW_ZOOM_MAX, Math.round(value * 100) / 100));
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
void COOKIE_CAPTURE_ALLOWED_HOSTS;

/**
 * Registers IPC handlers for window control operations (minimize, maximize, close, resize, fullscreen, detached terminal).
 * @param getMainWindow - Factory function that returns the main BrowserWindow instance
 */
async function persistZoomFactor(
    settingsService: SettingsService | undefined,
    zoomFactor: number
): Promise<void> {
    if (!settingsService) {
        return;
    }
    const currentSettings = settingsService.getSettings();
    const currentWindowSettings = currentSettings.window ?? {
        width: 1280,
        height: 800,
        x: 0,
        y: 0,
        zoomFactor: 1,
    };
    await settingsService.saveSettings({
        ...currentSettings,
        window: {
            ...currentWindowSettings,
            zoomFactor,
        },
    });
}


function registerWindowControlHandlers(
    getMainWindow: () => BrowserWindow | null,
    settingsService?: SettingsService
) {
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


    const zoomResponseSchema = z.object({ zoomFactor: z.number().min(WINDOW_ZOOM_MIN).max(WINDOW_ZOOM_MAX) });

    safeHandle(
        'window:get-zoom-factor',
        createValidatedIpcHandler('window:get-zoom-factor', async event => {
            validateSender(event);
            const win = getMainWindow();
            return { zoomFactor: win?.webContents.getZoomFactor() ?? 1 };
        }, {
            argsSchema: z.tuple([]),
            responseSchema: zoomResponseSchema,
        })
    );

    safeHandle(
        'window:set-zoom-factor',
        createValidatedIpcHandler('window:set-zoom-factor', async (event, zoomFactor: number) => {
            validateSender(event);
            const win = getMainWindow();
            const nextZoomFactor = clampZoomFactor(zoomFactor);
            win?.webContents.setZoomFactor(nextZoomFactor);
            await persistZoomFactor(settingsService, nextZoomFactor);
            return { zoomFactor: nextZoomFactor };
        }, {
            argsSchema: z.tuple([z.number()]),
            responseSchema: zoomResponseSchema,
        })
    );

    safeHandle(
        'window:step-zoom-factor',
        createValidatedIpcHandler('window:step-zoom-factor', async (event, direction: number) => {
            validateSender(event);
            const win = getMainWindow();
            const currentZoomFactor = win?.webContents.getZoomFactor() ?? 1;
            const nextZoomFactor = clampZoomFactor(currentZoomFactor + (direction * WINDOW_ZOOM_STEP));
            win?.webContents.setZoomFactor(nextZoomFactor);
            await persistZoomFactor(settingsService, nextZoomFactor);
            return { zoomFactor: nextZoomFactor };
        }, {
            argsSchema: z.tuple([z.number().min(-1).max(1)]),
            responseSchema: zoomResponseSchema,
        })
    );

    safeHandle(
        'window:reset-zoom-factor',
        createValidatedIpcHandler('window:reset-zoom-factor', async event => {
            validateSender(event);
            const win = getMainWindow();
            win?.webContents.setZoomFactor(1);
            await persistZoomFactor(settingsService, 1);
            return { zoomFactor: 1 };
        }, {
            argsSchema: z.tuple([]),
            responseSchema: zoomResponseSchema,
        })
    );


}

/**
 * Parses and validates raw input into detached terminal window options.
 * @param value - Raw options object to parse
 * @returns Validated options or null if invalid
 */
void MAX_TEXT_LENGTH;

type ShellOpenExternalFailure = {
    success: false;
    error: string;
    messageKey?: string;
};

function createShellOpenExternalFailure(
    error: string,
    messageKey?: string
): ShellOpenExternalFailure {
    return { success: false, error, messageKey };
}

type RunCommandResult = {
    stdout: string;
    stderr: string;
    code: number;
    error: string;
    messageKey?: string;
};

function createRunCommandFailure(
    stderr: string,
    messageKey: string
): RunCommandResult {
    return {
        stdout: '',
        stderr,
        code: 1,
        error: WINDOW_ERROR_MESSAGE.COMMAND_VALIDATION_FAILED,
        messageKey
    };
}

/**
 * Registers IPC handlers for shell operations (open external URLs, open terminal, run commands).
 */
function registerShellHandlers(getMainWindow: () => BrowserWindow | null, allowedRoots: Set<string>) {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'window operation');
    safeHandle('shell:openExternal', createValidatedIpcHandler('shell:openExternal', async (event, url: string) => {
        validateSender(event);
        appLogger.info('WindowIPC', `shell:openExternal handle called with URL: ${redactUrlForLogs(url)}`);

        // Handle safe-file:// protocol for local images
        if (url.startsWith('safe-file://')) {
            const filePath = url.replace('safe-file://', '');
            appLogger.info('WindowIPC', `Opening local file path: ${filePath}`);
            try {
                const decodedPath = decodeURIComponent(filePath);
                if (!isPathAllowed(decodedPath, allowedRoots)) {
                    return createShellOpenExternalFailure(
                        WINDOW_ERROR_MESSAGE.ACCESS_DENIED,
                        WINDOW_MESSAGE_KEY.SHELL_OPEN_EXTERNAL_ACCESS_DENIED
                    );
                }
                const error = await shell.openPath(decodedPath);
                if (error) {
                    appLogger.error('WindowIPC', `shell.openPath failed: ${error}`);
                    return createShellOpenExternalFailure(error);
                }
                return { success: true };
            } catch (e) {
                appLogger.error('WindowIPC', `Safe file open catch: ${e}`);
                return createShellOpenExternalFailure(String(e));
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
                    return createShellOpenExternalFailure(String(e));
                }
            } else {
                return createShellOpenExternalFailure(
                    WINDOW_ERROR_MESSAGE.FORBIDDEN_PROTOCOL,
                    WINDOW_MESSAGE_KEY.SHELL_OPEN_EXTERNAL_FORBIDDEN_PROTOCOL
                );
            }
        } catch (e) {
            appLogger.error('WindowIPC', `openExternal catch: ${e}`);
            return createShellOpenExternalFailure(String(e));
        }
    }, {
        argsSchema: z.tuple([urlSchema]),
        wrapResponse: true,
        defaultValue: createShellOpenExternalFailure(
            WINDOW_ERROR_MESSAGE.VALIDATION_FAILED,
            WINDOW_MESSAGE_KEY.SHELL_OPEN_EXTERNAL_VALIDATION_FAILED
        )
    }));


    safeHandle('shell:runCommand', createValidatedIpcHandler<RunCommandResult, [string, string[], string | undefined]>('shell:runCommand', async (event, command: string, args: string[], cwd?: string) => {
        validateSender(event);

        // AUD-SEC-037: Hardened command validation
        const MAX_COMMAND_LENGTH = 256;
        const MAX_ARGS_COUNT = 50;
        const MAX_ARG_LENGTH = 1024;

        if (command.length > MAX_COMMAND_LENGTH) {
            appLogger.warn('WindowIPC', 'Command exceeds maximum length');
            return createRunCommandFailure(
                WINDOW_ERROR_MESSAGE.COMMAND_TOO_LONG,
                WINDOW_MESSAGE_KEY.SHELL_RUN_COMMAND_COMMAND_TOO_LONG
            );
        }

        if (args.length > MAX_ARGS_COUNT) {
            appLogger.warn('WindowIPC', 'Too many arguments');
            return createRunCommandFailure(
                WINDOW_ERROR_MESSAGE.TOO_MANY_ARGUMENTS,
                WINDOW_MESSAGE_KEY.SHELL_RUN_COMMAND_TOO_MANY_ARGUMENTS
            );
        }

        for (const arg of args) {
            if (arg.length > MAX_ARG_LENGTH) {
                appLogger.warn('WindowIPC', 'Argument exceeds maximum length');
                return createRunCommandFailure(
                    WINDOW_ERROR_MESSAGE.ARGUMENT_TOO_LONG,
                    WINDOW_MESSAGE_KEY.SHELL_RUN_COMMAND_ARGUMENT_TOO_LONG
                );
            }
            if (/[\r\n\0]/.test(arg)) {
                appLogger.warn('WindowIPC', 'Argument contains forbidden control characters');
                return createRunCommandFailure(
                    WINDOW_ERROR_MESSAGE.INVALID_ARGUMENT,
                    WINDOW_MESSAGE_KEY.SHELL_RUN_COMMAND_INVALID_ARGUMENT
                );
            }
        }

        const executable = normalizeExecutableName(command);
        if (!RUN_COMMAND_ALLOWED_EXECUTABLES.has(executable)) {
            appLogger.warn('WindowIPC', `Blocked shell:runCommand executable: ${executable}`);
            return createRunCommandFailure(
                WINDOW_ERROR_MESSAGE.EXECUTABLE_NOT_ALLOWED,
                WINDOW_MESSAGE_KEY.SHELL_RUN_COMMAND_EXECUTABLE_NOT_ALLOWED
            );
        }

        if (cwd && !isPathAllowed(cwd, allowedRoots)) {
            appLogger.warn('WindowIPC', `Blocked shell:runCommand cwd outside allowed roots: ${cwd}`);
            return createRunCommandFailure(
                WINDOW_ERROR_MESSAGE.WORKING_DIRECTORY_NOT_ALLOWED,
                WINDOW_MESSAGE_KEY.SHELL_RUN_COMMAND_WORKING_DIRECTORY_NOT_ALLOWED
            );
        }
 
        return new Promise(resolve => {
            const spawnCommand = createWindowsSpawnCommand(command, args);
            appLogger.info(
                'WindowIPC',
                `Running command: ${spawnCommand.command} ${spawnCommand.args.join(' ')}`
            );
            const child = spawn(spawnCommand.command, spawnCommand.args, {
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
        defaultValue: {
            stdout: '',
            stderr: '',
            code: 1,
            error: WINDOW_ERROR_MESSAGE.VALIDATION_FAILED,
            messageKey: WINDOW_MESSAGE_KEY.SHELL_RUN_COMMAND_VALIDATION_FAILED
        }
    }));

}

/**
 * Registers IPC handlers for cookie capture operations via hidden browser windows.
 */
function registerCookieHandlers(getMainWindow: () => BrowserWindow | null) {
    const _validateSender = createMainWindowSenderValidator(getMainWindow, 'window operation');
    void _validateSender;
    /**
     * Opens a hidden BrowserWindow to capture cookies from a URL.
     * Useful for capturing session cookies after OAuth completes in an external browser.
     */
}
