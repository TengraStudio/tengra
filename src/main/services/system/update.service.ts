/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { BaseService } from '@main/services/base.service';
import { SettingsService } from '@main/services/system/settings.service';
import { IpcValue } from '@shared/types';
import { JsonObject } from '@shared/types/common';
import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';

export class UpdateService extends BaseService {
    private settingsService: SettingsService;
    private window: BrowserWindow | null = null;

    constructor(
        settingsService: SettingsService
    ) {
        super('UpdateService');
        this.settingsService = settingsService;

        // Configure autoUpdater logger to use our appLogger via BaseService methods
        autoUpdater.logger = {
            info: (msg: string) => this.logInfo(msg),
            warn: (msg: string) => this.logWarn(msg),
            error: (msg: string, err?: Error) => this.logError(msg, err),
            debug: (msg: string) => this.logDebug(msg),
        };

        // Disable auto-download if configured (we'll handle it manually based on settings)
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = true;
    }

    override async cleanup(): Promise<void> {
        this.logInfo('Cleaning up update service, clearing window reference');
        this.window = null;
    }

    init(window: BrowserWindow) {
        this.window = window;

        // Don't run in development unless forced
        if (!app.isPackaged && !process.env.FORCE_UPDATE_TEST) {
            this.logDebug('Skipping auto-updater in development mode');
            return;
        }

        this.registerEvents();
        this.registerIpcHandlers();

        const settings = this.settingsService.getSettings();
        if (settings.autoUpdate?.enabled && settings.autoUpdate.checkOnStartup) {
            // Delay check slightly to not slow down startup
            setTimeout(() => {
                void this.checkForUpdates();
            }, 5000);
        }
    }

    private registerEvents() {
        autoUpdater.on('checking-for-update', () => {
            this.sendToWindow('update:status', { state: 'checking' });
        });

        autoUpdater.on('update-available', (info) => {
            this.logInfo('Update available', info as RuntimeValue as JsonObject);
            this.sendToWindow('update:status', { state: 'available', version: info.version });

            const settings = this.settingsService.getSettings();
            if (settings.autoUpdate?.downloadAutomatically && !settings.autoUpdate.notifyOnly) {
                void this.downloadUpdate();
            }
        });

        autoUpdater.on('update-not-available', (info) => {
            this.logInfo('Update not available', info as RuntimeValue as JsonObject);
            this.sendToWindow('update:status', { state: 'not-available' });
        });

        autoUpdater.on('error', (err) => {
            this.logError('Update error', err);
            this.sendToWindow('update:status', { state: 'error', error: err.message });
        });

        autoUpdater.on('download-progress', (progressObj) => {
            // log.info('Download speed: ' + progressObj.bytesPerSecond + ...)

            this.sendToWindow('update:status', {
                state: 'downloading',
                progress: progressObj.percent,
                bytesPerSecond: progressObj.bytesPerSecond,
                total: progressObj.total,
                transferred: progressObj.transferred
            });
        });

        autoUpdater.on('update-downloaded', (info) => {
            this.logInfo('Update downloaded');
            this.sendToWindow('update:status', { state: 'downloaded', version: info.version });
        });
    }

    private registerIpcHandlers() {
        ipcMain.handle('update:check', async () => {
            return await this.checkForUpdates();
        });

        ipcMain.handle('update:download', async () => {
            return await this.downloadUpdate();
        });

        ipcMain.handle('update:install', () => {
            this.quitAndInstall();
        });
    }

    async checkForUpdates() {
        try {
            await autoUpdater.checkForUpdates();
        } catch (error) {
            this.logError('Failed to check for updates', error);
            throw error;
        }
    }

    async downloadUpdate() {
        try {
            await autoUpdater.downloadUpdate();
        } catch (error) {
            this.logError('Failed to download update', error);
            throw error;
        }
    }

    quitAndInstall() {
        autoUpdater.quitAndInstall();
    }

    private sendToWindow(channel: string, ...args: IpcValue[]) {
        if (this.window && !this.window.isDestroyed()) {
            this.window.webContents.send(channel, ...args);
        }
    }
}
