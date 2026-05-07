/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 */

import { appLogger } from '@main/logging/logger';
import { RuntimeBootstrapService } from '@main/services/system/runtime-bootstrap.service';
import { SettingsService } from '@main/services/system/settings.service';
import { RuntimeValue } from '@shared/types/common';
import { BrowserWindow, ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';

/**
 * Early Boot IPC State Manager
 * Handles IPC requests before the full application is initialized.
 */
class EarlyIpcManager {
    private settingsService?: SettingsService;
    private runtimeService?: RuntimeBootstrapService;
    private getMainWindow?: () => BrowserWindow | null;
    private isReady = false;
    private registeredHandlers = new Set<string>();
    private registeredListeners = new Set<string>();

    /**
     * Initializes the minimal IPC handlers.
     * Should be called as early as possible in the boot process.
     */
    public initialize(getMainWindow: () => BrowserWindow | null): void {
        this.getMainWindow = getMainWindow;

        const register = (
            channel: string,
            handler: (event: IpcMainInvokeEvent, ...args: RuntimeValue[]) => Promise<RuntimeValue | object> | RuntimeValue | object
        ) => {
            try {
                ipcMain.removeHandler(channel);
            } catch { /* ignore */ }

            this.registeredHandlers.add(channel);
            ipcMain.handle(channel, async (event, ...args) => {
                try {
                    return await handler(event, ...args);
                } catch (e) {
                    appLogger.error('BOOT', `Early IPC Error [${channel}]`, e);
                    throw e;
                }
            });
        };

        const listen = (channel: string, listener: (event: IpcMainEvent, ...args: RuntimeValue[]) => void) => {
            this.registeredListeners.add(channel);
            ipcMain.on(channel, listener);
        };

        // --- HANDLERS ---

        register('settings:get', () => {
            return this.settingsService?.getSettings() || {};
        });

        register('runtime:get-status', () => {
            if (this.runtimeService) {
                const result = this.runtimeService.getLatestExecutionResult();
                if (result) {
                    result.mainProcessReady = this.isReady;
                    return result;
                }
            }
            return {
                status: 'pending',
                mainProcessReady: this.isReady,
                summary: { blockingFailures: 0, totalFailures: 0, totalWarnings: 0 },
                entries: [],
                health: { online: true, entries: [], lastCheck: Date.now() }
            };
        });

        register('runtime:refresh-status', () => {
            return this.runtimeService?.scanManagedRuntime() || { success: false, error: 'Service not ready' };
        });

        // Window Controls
        listen('window:minimize', () => this.getMainWindow?.()?.minimize());
        listen('window:maximize', () => {
            const win = this.getMainWindow?.();
            if (win) {
                if (win.isMaximized()) {
                    win.unmaximize();
                } else {
                    win.maximize();
                }
            }
        });
        listen('window:toggle-fullscreen', () => {
            const win = this.getMainWindow?.();
            if (win) {
                win.setFullScreen(!win.isFullScreen());
            }
        });
        listen('window:close', () => this.getMainWindow?.()?.close());

        // Logging Fallback
        listen('log:write', (_: IpcMainEvent, arg1: RuntimeValue, arg2?: RuntimeValue) => {
            const message = typeof arg1 === 'string' ? ((arg2 as string) || arg1) : (typeof arg1 === 'object' && arg1 !== null && 'message' in arg1 ? (arg1 as { message: string }).message : '');
            appLogger.info('renderer', message);
        });

        const fallbackResultsByChannel: Record<string, RuntimeValue> = {
            'ipc:contract:get': { version: 'boot', channels: [] },
            'extension:get-all': [],
            'model-registry:getAllModels': [],
            'model-registry:get-installed': [],
            'model-registry:get-remote': [],
            'model-downloader:history': { success: true, items: [] },
            'marketplace:check-live-updates': { success: true, data: [], installed: [], enabled: [], domains: {} },
            'db:getPrompts': [],
            'db:getAllChats': [],
            'db:getWorkspaces': [],
            'db:getFolders': [],
            'db:getStats': { chatCount: 0, messageCount: 0, dbSize: 0 },
            'db:getDetailedStats': null,
            'auth:get-linked-accounts': [],
            'auth:get-active-linked-account': null,
            'auth:has-linked-account': false,
            'ollama:forceHealthCheck': { success: true, data: { status: 'unknown' } },
            'proxy:getModels': { data: [] },
            'proxy:getQuota': { accounts: [] },
            'proxy:getCopilotQuota': { accounts: [] },
            'proxy:getCodexUsage': { accounts: [] },
            'proxy:getClaudeQuota': { accounts: [] },
            'getSettings': {},
            'getQuota': { accounts: [] },
            'getCopilotQuota': { accounts: [] },
            'getCodexUsage': { accounts: [] },
            'getClaudeQuota': { accounts: [] },
            'theme:runtime:getAll': [],
            'locale:runtime:getAll': [],
            'code-language:runtime:getAll': [],
        };

        register('batch:invoke', async (_event, requests) => {
            const startTime = Date.now();
            const normalizedRequests = Array.isArray(requests) ? requests : [];
            const results = normalizedRequests.map((request) => {
                const channel = typeof request === 'object'
                    && request !== null
                    && 'channel' in request
                    && typeof request.channel === 'string'
                    ? request.channel
                    : '';
                const data = fallbackResultsByChannel[channel] ?? null;
                return {
                    channel,
                    success: true,
                    data,
                };
            });

            const endTime = Date.now();
            return {
                results,
                timing: {
                    startTime,
                    endTime,
                    totalMs: endTime - startTime,
                },
            };
        });

        register('batch:invokeSequential', async (_event, requests) => {
            const startTime = Date.now();
            const normalizedRequests = Array.isArray(requests) ? requests : [];
            const results = normalizedRequests.map((request) => {
                const channel = typeof request === 'object'
                    && request !== null
                    && 'channel' in request
                    && typeof request.channel === 'string'
                    ? request.channel
                    : '';
                const data = fallbackResultsByChannel[channel] ?? null;
                return {
                    channel,
                    success: true,
                    data,
                };
            });

            const endTime = Date.now();
            return {
                results,
                timing: {
                    startTime,
                    endTime,
                    totalMs: endTime - startTime,
                },
            };
        });

        register('batch:getChannels', async () => Object.keys(fallbackResultsByChannel));

        for (const [channel, fallback] of Object.entries(fallbackResultsByChannel)) {
            register(channel, async () => fallback);
        }
    }

    /**
     * Cleans up all early IPC handlers to allow real services to take over.
     */
    public cleanup(): void {
        for (const channel of this.registeredHandlers) {
            try {
                ipcMain.removeHandler(channel);
            } catch { /* ignore */ }
        }
        this.registeredHandlers.clear();

        for (const channel of this.registeredListeners) {
            try {
                ipcMain.removeAllListeners(channel);
            } catch { /* ignore */ }
        }
        this.registeredListeners.clear();
    }

    /**
     * Links real service instances once they are ready.
     */
    public linkServices(services: { settings: SettingsService; runtime: RuntimeBootstrapService; isReady?: boolean }): void {
        this.settingsService = services.settings;
        this.runtimeService = services.runtime;
        if (services.isReady !== undefined) {
            this.isReady = services.isReady;
        }
    }

    public setReady(ready: boolean): void {
        this.isReady = ready;
    }
}

export const EarlyIpc = new EarlyIpcManager();

