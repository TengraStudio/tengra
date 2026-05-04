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

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { SettingsService } from '@main/services/system/settings.service';
import { createWindowsSpawnCommand } from '@main/utils/windows-command.util';
import { getErrorMessage } from '@shared/utils/error.util';
import { BrowserWindow, shell } from 'electron';
import { z } from 'zod';

const COMPACT_WIDTH = 400;
const COMPACT_HEIGHT = 600;
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;
const WINDOW_ZOOM_STEP = 0.1;
const WINDOW_ZOOM_MIN = 0.5;
const WINDOW_ZOOM_MAX = 2;

const SENSITIVE_QUERY_KEYS = new Set([
    'token', 'access_token', 'refresh_token', 'code', 'state', 'sessionkey', 'session_key',
    'apikey', 'api_key', 'authorization', 'password', 'passphrase'
]);

const COOKIE_CAPTURE_ALLOWED_HOSTS = new Set([
    'accounts.google.com',
    'claude.ai',
    'api.anthropic.com',
    'github.com'
]);

const RUN_COMMAND_ALLOWED_EXECUTABLES = new Set([
    'git', 'npm', 'npx', 'node', 'pnpm', 'yarn', 'python', 'python3', 'pip', 'pip3', 'cargo', 'rustc', 'go', 'docker', 'kubectl'
]);

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
} as const;

export class WindowService extends BaseService {
    constructor(
        private readonly getMainWindow: () => BrowserWindow | null,
        private readonly allowedRoots: Set<string>,
        private readonly settingsService: SettingsService
    ) {
        super('WindowService');
    }

    @ipc('window:minimize')
    minimize(): void {
        this.getMainWindow()?.minimize();
    }

    @ipc('window:maximize')
    maximize(): void {
        const win = this.getMainWindow();
        if (!win) {return;}
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    }

    @ipc('window:toggle-fullscreen')
    toggleFullscreen(): void {
        const win = this.getMainWindow();
        if (!win) {return;}
        win.setFullScreen(!win.isFullScreen());
    }

    @ipc('window:close')
    close(): void {
        this.getMainWindow()?.close();
    }

    @ipc('window:toggle-compact')
    toggleCompact(enabled: boolean): void {
        const win = this.getMainWindow();
        if (!win) {return;}
        if (enabled) {
            win.setSize(COMPACT_WIDTH, COMPACT_HEIGHT);
        } else {
            win.setSize(DEFAULT_WIDTH, DEFAULT_HEIGHT);
        }
    }

    @ipc('window:resize')
    resize(resolution: string): void {
        const win = this.getMainWindow();
        if (!win) {return;}
        const [width, height] = resolution.split('x').map(Number);
        if (width && height) {
            win.setSize(width, height);
            win.center();
        }
    }

    @ipc('window:get-zoom-factor')
    async getZoomFactor(): Promise<{ zoomFactor: number }> {
        const win = this.getMainWindow();
        return { zoomFactor: win?.webContents.getZoomFactor() ?? 1 };
    }

    @ipc('window:set-zoom-factor')
    async setZoomFactor(zoomFactor: number): Promise<{ zoomFactor: number }> {
        const win = this.getMainWindow();
        const nextZoomFactor = this.clampZoomFactor(zoomFactor);
        win?.webContents.setZoomFactor(nextZoomFactor);
        await this.persistZoomFactor(nextZoomFactor);
        return { zoomFactor: nextZoomFactor };
    }

    @ipc('window:step-zoom-factor')
    async stepZoomFactor(direction: number): Promise<{ zoomFactor: number }> {
        const win = this.getMainWindow();
        const currentZoomFactor = win?.webContents.getZoomFactor() ?? 1;
        const nextZoomFactor = this.clampZoomFactor(currentZoomFactor + (direction * WINDOW_ZOOM_STEP));
        win?.webContents.setZoomFactor(nextZoomFactor);
        await this.persistZoomFactor(nextZoomFactor);
        return { zoomFactor: nextZoomFactor };
    }

    @ipc('window:reset-zoom-factor')
    async resetZoomFactor(): Promise<{ zoomFactor: number }> {
        const win = this.getMainWindow();
        win?.webContents.setZoomFactor(1);
        await this.persistZoomFactor(1);
        return { zoomFactor: 1 };
    }

    @ipc('shell:openExternal')
    async openExternal(url: string): Promise<{ success: boolean; error?: string }> {
        this.logInfo(`shell:openExternal called with URL: ${this.redactUrlForLogs(url)}`);

        if (url.startsWith('safe-file://')) {
            const filePath = url.replace('safe-file://', '');
            try {
                const decodedPath = decodeURIComponent(filePath);
                if (!this.isPathAllowed(decodedPath)) {
                    return { success: false, error: WINDOW_ERROR_MESSAGE.ACCESS_DENIED };
                }
                const error = await shell.openPath(decodedPath);
                if (error) {
                    this.logError(`shell.openPath failed: ${error}`);
                    return { success: false, error };
                }
                return { success: true };
            } catch (e) {
                this.logError(`Safe file open catch: ${e}`);
                return { success: false, error: String(e) };
            }
        }

        try {
            const parsed = new URL(url);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                await shell.openExternal(parsed.toString());
                return { success: true };
            } else {
                return { success: false, error: WINDOW_ERROR_MESSAGE.FORBIDDEN_PROTOCOL };
            }
        } catch (e) {
            this.logError(`openExternal catch: ${e}`);
            return { success: false, error: String(e) };
        }
    }

    @ipc('shell:runCommand')
    async runCommand(command: string, args: string[], cwd?: string): Promise<{ stdout: string; stderr: string; code: number; error: string }> {
        const MAX_COMMAND_LENGTH = 256;
        const MAX_ARGS_COUNT = 50;
        const MAX_ARG_LENGTH = 1024;

        if (command.length > MAX_COMMAND_LENGTH) {return this.createRunCommandFailure(WINDOW_ERROR_MESSAGE.COMMAND_TOO_LONG);}
        if (args.length > MAX_ARGS_COUNT) {return this.createRunCommandFailure(WINDOW_ERROR_MESSAGE.TOO_MANY_ARGUMENTS);}

        for (const arg of args) {
            if (arg.length > MAX_ARG_LENGTH) {return this.createRunCommandFailure(WINDOW_ERROR_MESSAGE.ARGUMENT_TOO_LONG);}
            if (/[\r\n\0]/.test(arg)) {return this.createRunCommandFailure(WINDOW_ERROR_MESSAGE.INVALID_ARGUMENT);}
        }

        const executable = this.normalizeExecutableName(command);
        if (!RUN_COMMAND_ALLOWED_EXECUTABLES.has(executable)) {
            return this.createRunCommandFailure(WINDOW_ERROR_MESSAGE.EXECUTABLE_NOT_ALLOWED);
        }

        if (cwd && !this.isPathAllowed(cwd)) {
            return this.createRunCommandFailure(WINDOW_ERROR_MESSAGE.WORKING_DIRECTORY_NOT_ALLOWED);
        }

        return new Promise(resolve => {
            const spawnCommand = createWindowsSpawnCommand(command, args);
            const child = spawn(spawnCommand.command, spawnCommand.args, {
                cwd: cwd ?? process.cwd(),
                shell: false,
            });

            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (data) => stdout += data.toString());
            child.stderr.on('data', (data) => stderr += data.toString());
            child.on('close', (code) => resolve({ stdout, stderr, code: code ?? 0, error: '' }));
            child.on('error', (err) => resolve({ stdout, stderr, code: 1, error: err.message }));
        });
    }

    @ipc('shell:openTerminal')
    async openTerminal(_command: string): Promise<boolean> {
        return true; // Placeholder
    }

    @ipc('window:captureCookies')
    async captureCookies(url: string): Promise<{ success: boolean; cookies: unknown[]; error?: string }> {
        try {
            const parsedUrl = new URL(url);
            if (!COOKIE_CAPTURE_ALLOWED_HOSTS.has(parsedUrl.hostname)) {
                return { success: false, cookies: [], error: 'Host not allowed' };
            }
        } catch (e) {
            return { success: false, cookies: [], error: 'Invalid URL' };
        }
        return { success: true, cookies: [] }; // Placeholder
    }

    private clampZoomFactor(value: number): number {
        return Math.max(WINDOW_ZOOM_MIN, Math.min(WINDOW_ZOOM_MAX, Math.round(value * 100) / 100));
    }

    private async persistZoomFactor(zoomFactor: number): Promise<void> {
        const currentSettings = this.settingsService.getSettings();
        await this.settingsService.saveSettings({
            ...currentSettings,
            window: {
                width: DEFAULT_WIDTH,
                height: DEFAULT_HEIGHT,
                x: 0,
                y: 0,
                ...(currentSettings.window ?? {}),
                zoomFactor,
            },
        });
    }

    private isPathAllowed(filePath: string): boolean {
        const absolutePath = path.resolve(filePath);
        const isWin = process.platform === 'win32';
        const normalizedPath = isWin ? absolutePath.toLowerCase() : absolutePath;
        return Array.from(this.allowedRoots).some((root) => {
            const resolvedRoot = path.resolve(root);
            const normalizedRoot = isWin ? resolvedRoot.toLowerCase() : resolvedRoot;
            const sep = isWin ? '\\' : path.sep;
            return normalizedPath === normalizedRoot || normalizedPath.startsWith(normalizedRoot.endsWith(sep) ? normalizedRoot : `${normalizedRoot}${sep}`);
        });
    }

    private redactUrlForLogs(rawUrl: string): string {
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

    private normalizeExecutableName(command: string): string {
        const trimmed = command.trim();
        const normalized = process.platform === 'win32' ? trimmed.toLowerCase() : trimmed;
        const base = path.basename(normalized);
        return base.replace(/\.(exe|cmd|bat)$/i, '');
    }

    private createRunCommandFailure(error: string): { stdout: string; stderr: string; code: number; error: string } {
        return { stdout: '', stderr: error, code: 1, error: WINDOW_ERROR_MESSAGE.COMMAND_VALIDATION_FAILED };
    }
}
