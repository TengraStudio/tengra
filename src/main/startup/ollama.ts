/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { exec } from 'child_process';
import * as http from 'http';
import { promisify } from 'util';

import { appLogger } from '@main/logging/logger';
import { t } from '@main/utils/i18n.util';
import { OPERATION_TIMEOUTS, REQUEST_TIMEOUTS } from '@shared/constants/timeouts';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { BrowserWindow, dialog } from 'electron';


const execAsync = promisify(exec);
const OLLAMA_START_MESSAGE_KEY = {
    ALREADY_RUNNING: 'images.ollamaStartup.alreadyRunning',
    NOT_INSTALLED: 'images.ollamaStartup.notInstalled',
    USER_DECLINED: 'images.ollamaStartup.userDeclined',
    START_FAILED: 'images.ollamaStartup.startFailed',
    STARTED: 'images.ollamaStartup.started',
    MANUAL_START_REQUIRED: 'images.ollamaStartup.manualStartRequired',
    UNEXPECTED: 'images.ollamaStartup.unexpected',
} as const;

interface StartOllamaResponse {
    success: boolean;
    message: string;
    messageKey?: string;
    messageParams?: Record<string, string | number>;
}

// Force IPv4 fetch helper
function fetchIPv4(url: string, options?: RequestInit): Promise<Response> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const headers = options?.headers
            ? Object.fromEntries(new Headers(options.headers).entries())
            : undefined;
        const reqOptions: http.RequestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port ? parseInt(urlObj.port) : 80,
            path: urlObj.pathname + urlObj.search,
            method: options?.method ?? 'GET',
            headers,
            family: 4 // Force IPv4
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const statusCode = res.statusCode ?? 0;
                resolve({
                    ok: statusCode >= 200 && statusCode < 300,
                    status: statusCode,
                    json: () => Promise.resolve(safeJsonParse(data, {})),
                    text: () => Promise.resolve(data)
                } as RuntimeValue as Response);
            });
        });

        req.on('error', reject);
        req.setTimeout(REQUEST_TIMEOUTS.HEALTH_CHECK, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (options?.body) {
            req.write(options.body as string);
        }
        req.end();
    });
}

export async function isOllamaRunning(): Promise<boolean> {
    try {
        const response = await fetchIPv4('http://127.0.0.1:11434/api/tags');
        return response.ok;
    } catch {
        return false;
    }
}

async function isOllamaInstalled(): Promise<boolean> {
    try {
        // Try native check first (clean command)
        await execAsync('where ollama', { shell: 'powershell.exe' });
        return true;
    } catch {
        try {
            // Check formatted path
            const checkCommand = 'Test-Path "$env:LOCALAPPDATA\\Programs\\Ollama\\ollama.exe"';
            const result = await execAsync(checkCommand, { shell: 'powershell.exe' });
            return result.stdout.trim().toLowerCase() === 'true';
        } catch {
            return false;
        }
    }
}

export async function startOllama(
    getMainWindow: () => BrowserWindow | null,
    askPermission: boolean = false
): Promise<StartOllamaResponse> {
    try {
        if (await isOllamaRunning()) {
            return {
                success: true,
                message: t('backend.ollamaIsAlreadyRunning'),
                messageKey: OLLAMA_START_MESSAGE_KEY.ALREADY_RUNNING
            };
        }

        const installed = await isOllamaInstalled();
        if (!installed) {
            return {
                success: false,
                message: t('backend.ollamaIsNotInstalledPleaseDownloadItFrom'),
                messageKey: OLLAMA_START_MESSAGE_KEY.NOT_INSTALLED
            };
        }

        if (askPermission) {
            const allowed = await askUserPermission(getMainWindow);
            if (!allowed) {
                return {
                    success: false,
                    message: t('backend.userRefusedToStartOllama'),
                    messageKey: OLLAMA_START_MESSAGE_KEY.USER_DECLINED
                };
            }
        }

        appLogger.debug('Ollama', 'Attempting to start Ollama...');
        const commandSuccess = await executeStartCommand();
        if (!commandSuccess) {
            return {
                success: false,
                message: t('backend.failedToStartOllama'),
                messageKey: OLLAMA_START_MESSAGE_KEY.START_FAILED
            };
        }

        const ready = await waitForReady();
        if (ready) {
            appLogger.info('Ollama', 'Ollama started successfully');
            return {
                success: true,
                message: t('backend.ollamaStarted'),
                messageKey: OLLAMA_START_MESSAGE_KEY.STARTED
            };
        }

        return {
            success: false,
            message: t('backend.failedToStartOllamaPleaseStartItManually'),
            messageKey: OLLAMA_START_MESSAGE_KEY.MANUAL_START_REQUIRED
        };
    } catch (error) {
        const message = getErrorMessage(error as Error);
        appLogger.error('Ollama', `Unexpected error starting Ollama: ${message}`);
        return {
            success: false,
            message: `Ollama startup error: ${message}`,
            messageKey: OLLAMA_START_MESSAGE_KEY.UNEXPECTED,
            messageParams: { reason: message }
        };
    }
}

async function askUserPermission(getMainWindow: () => BrowserWindow | null): Promise<boolean> {
    const win = getMainWindow();
    if (!win) { return true; } // Implicit permission if no window? Or fail? Originally logic permitted if win exists

    const result = await dialog.showMessageBox(win, {
        type: 'question',
        buttons: ['Yes', 'No'],
        defaultId: 0,
        title: t('backend.startOllama'),
        message: t('backend.shouldOllamaBeStarted'),
        detail: 'Ollama must be running to use local AI models.'
    });

    return result.response === 0;
}

async function executeStartCommand(): Promise<boolean> {
    try {
        await execAsync(
            'Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden',
            { shell: 'powershell.exe' }
        );
        return true;
    } catch (e) {
        appLogger.warn('Ollama', `Failed to start via command: ${getErrorMessage(e as Error)}. Trying direct path...`);

        const localAppData = process.env.LOCALAPPDATA;
        const potentialPath = localAppData
            ? `${localAppData}\\Programs\\Ollama\\ollama.exe`
            : null;

        try {
            const command = potentialPath
                ? `Start-Process -FilePath "${potentialPath}" -ArgumentList "serve" -WindowStyle Hidden`
                : 'Start-Process -FilePath "$env:LOCALAPPDATA\\Programs\\Ollama\\ollama.exe" -ArgumentList "serve" -WindowStyle Hidden';

            await execAsync(command, { shell: 'powershell.exe' });
            return true;
        } catch (e2) {
            appLogger.error('Ollama', `Failed to start via path: ${getErrorMessage(e2 as Error)}`);
            return false;
        }
    }
}

async function waitForReady(): Promise<boolean> {
    for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, OPERATION_TIMEOUTS.POLL_INTERVAL));
        if (await isOllamaRunning()) {
            return true;
        }
    }
    return false;
}

