/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 */

import { RuntimeBootstrapService } from '@main/services/system/runtime-bootstrap.service';
import { SettingsService } from '@main/services/system/settings.service';
import { BrowserWindow, ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';

import { appLogger } from '../logging/logger';

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
        
        console.warn('[BOOT] Initializing EarlyIpcManager...');

        const register = (channel: string, handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> | unknown) => {
            try {
                ipcMain.removeHandler(channel);
            } catch { /* ignore */ }

            this.registeredHandlers.add(channel);
            ipcMain.handle(channel, async (event, ...args) => {
                try {
                    return await handler(event, ...args);
                } catch (e) {
                    console.error(`[BOOT] Early IPC Error [${channel}]:`, e);
                    throw e;
                }
            });
        };

        const listen = (channel: string, listener: (event: IpcMainEvent, ...args: unknown[]) => void) => {
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
        listen('log:write', (_: IpcMainEvent, arg1: unknown, arg2?: unknown) => {
            const message = typeof arg1 === 'string' ? ((arg2 as string) || arg1) : (typeof arg1 === 'object' && arg1 !== null && 'message' in arg1 ? (arg1 as {message: string}).message : '');
            appLogger.info('renderer', message);
        });

        // Global Silent Fallback for heavy modules
        const silentChannels = [
            'ipc:contract:get', 'extension:get-all', 'model-registry:get-all', 'model-downloader:history', 
            'marketplace:check-live-updates', 'db:getPrompts', 'db:getAllChats', 'db:getFolders', 
            'auth:get-linked-accounts', 'ollama:forceHealthCheck', 'proxy:getModels', 
            'theme:runtime:getAll', 'code-language:runtime:getAll'
        ];
        
        for (const channel of silentChannels) {
            register(channel, async () => ({ data: [], installed: [], enabled: [], domains: {}, success: true }));
        }

        console.warn('[BOOT] EarlyIpcManager initialized.');
    }

    /**
     * Cleans up all early IPC handlers to allow real services to take over.
     */
    public cleanup(): void {
        console.warn('[BOOT] Cleaning up early IPC handlers...');
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
        
        console.warn('[BOOT] Early IPC handlers cleaned up.');
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
