/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fs from 'fs';
import * as path from 'path';

import { ipc } from '@main/core/ipc-decorators';
import { BaseService } from '@main/services/base.service';
import { SettingsService } from '@main/services/system/settings.service';
import { IpcValue } from '@shared/types';
import { JsonObject } from '@shared/types/common';
import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater, UpdateCheckResult } from 'electron-updater';


export class UpdateService extends BaseService {
    private settingsService: SettingsService;
    private window: BrowserWindow | null = null;
    private isSupported: boolean = true;

    constructor(
        settingsService: SettingsService
    ) {
        super('UpdateService');
        this.settingsService = settingsService;

        // PRE-LAUNCH BYPASS: Disable update checks while repo is private
        // TODO: Remove this once the repository is public (expected in a few days)
        const isPreLaunch = process.env.NODE_ENV !== 'test';

        // CRITICAL: Always disable automatic behaviors immediately
        // These properties are on the autoUpdater singleton and must be set early
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = false;

        const updateConfigPath = this.resolveUpdateConfigPath();
        if (isPreLaunch) {
            this.isSupported = false;
            this.logInfo('Update check disabled: Pre-launch phase');
        } else if (!updateConfigPath) {
            this.isSupported = false;
            this.logInfo('Update check disabled: app-update.yml not found');
        } else {
            this.logDebug(`Update config found: ${updateConfigPath}`);
        }

        // Configure autoUpdater logger and basic settings
        autoUpdater.logger = {
            info: (msg: string) => this.logInfo(msg),
            warn: (msg: string) => this.logWarn(msg),
            error: (msg: string, err?: unknown) => {
                // Suppress GitHub 404 errors during pre-launch
                if (this.isReleaseFeedWarning(err ?? msg)) {
                    this.logDebug(`Suppressed update feed error: ${msg}`);
                    return;
                }
                this.logError(msg, err);
            },
            debug: (msg: string) => this.logDebug(msg),
        };


        // Ensure environment is cleared of sensitive tokens immediately
        this.clearGitHubAuthEnvironment();

        // Safety: If electron-updater has a background timer, try to stop it
        if ('removeAllListeners' in autoUpdater) {
            autoUpdater.removeAllListeners('error');
            autoUpdater.on('error', (err) => {
                if (!this.isReleaseFeedWarning(err)) {
                    this.logError('Background update error', err);
                }
            });
        }

        // Catch internal promise rejections that electron-updater might leak
        const updaterInternal = autoUpdater as unknown as { appUpdater?: { on: (event: string, cb: () => void) => void } };
        if (updaterInternal.appUpdater) {
            updaterInternal.appUpdater.on('error', () => {
                // Internal error suppression
            }); 
        }

    }

    override async cleanup(): Promise<void> {
        this.logInfo('Cleaning up update service, clearing window reference');
        this.window = null;
    }

    private resolveUpdateConfigPath(): string | null {
        const candidatePaths: string[] = [];
        if (typeof process.resourcesPath === 'string' && process.resourcesPath.length > 0) {
            candidatePaths.push(path.join(process.resourcesPath, 'app-update.yml'));
        }
        if (typeof process.execPath === 'string' && process.execPath.length > 0) {
            candidatePaths.push(path.join(path.dirname(process.execPath), 'app-update.yml'));
        }

        for (const candidatePath of candidatePaths) {
            if (fs.existsSync(candidatePath)) {
                return candidatePath;
            }
        }

        return null;
    }

    init(window: BrowserWindow) {
        this.window = window;

        if (!this.isSupported) {
            return;
        }

        // Don't run in development unless forced
        if (!app.isPackaged && !process.env.FORCE_UPDATE_TEST) {
            this.logDebug('Skipping auto-updater in development mode');
            return;
        }

        try {
            this.registerEvents();

            const settings = this.settingsService.getSettings();
            if (settings.autoUpdate?.enabled && settings.autoUpdate.checkOnStartup) {
                // Delay check to ensure it doesn't interfere with critical startup
                setTimeout(() => {
                    this.checkForUpdates().catch(err => {
                        // Silent suppression for expected feed errors
                        if (!this.isReleaseFeedWarning(err)) {
                            this.logDebug(`Deferred update check failed (safe): ${err.message}`);
                        }
                    });
                }, 15000); // 15 seconds delay
            }
        } catch (error) {
            this.logError('Failed to initialize update service events', error);
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
                void autoUpdater.downloadUpdate().catch(error => {
                    this.handleUpdateError(error);
                });
            }
        });

        autoUpdater.on('update-not-available', (info) => {
            this.logInfo('Update not available', info as RuntimeValue as JsonObject);
            this.sendToWindow('update:status', { state: 'not-available' });
        });

        autoUpdater.on('error', (err) => {
            const msg = err?.message || String(err);
            if (msg.includes('ENOENT') || msg.includes('app-update.yml')) {
                this.logDebug('Update check skipped (config missing)');
                return;
            }
            if (this.isReleaseFeedWarning(err)) {
                this.logWarn('Update feed unavailable for this repository');
                this.sendUpdateWarning('Update feed unavailable for this repository');
                return;
            }
            this.logError('Update error', err);
            this.sendToWindow('update:status', { state: 'error', error: err.message });
        });

        autoUpdater.on('download-progress', (progressObj) => {
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

    @ipc('update:check')
    async checkForUpdatesIpc(): Promise<UpdateCheckResult | null | { error: string }> {
        if (!this.isSupported) {
            return { error: 'Updates not supported in this version' };
        }
        return await this.checkForUpdates();
    }

    @ipc('update:download')
    async downloadUpdateIpc(): Promise<{ success: boolean } | { error: string }> {
        if (!this.isSupported) {
            return { error: 'Updates not supported in this version' };
        }
        await this.downloadUpdate();
        return { success: true };
    }

    @ipc('update:install')
    quitAndInstallIpc(): void {
        if (this.isSupported) {
            this.quitAndInstall();
        }
    }

    async checkForUpdates(): Promise<UpdateCheckResult | null> {
        if (!this.isSupported) {
            return null;
        }

        try {
            return await autoUpdater.checkForUpdates();
        } catch (error) {
            this.handleUpdateError(error);
            return null;
        }
    }

    async downloadUpdate() {
        try {
            await autoUpdater.downloadUpdate();
        } catch (error) {
            this.handleUpdateError(error);
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

    private handleUpdateError(error: unknown): void {
        const msg = error instanceof Error ? error.message : String(error);
        if (this.isReleaseFeedWarning(error)) {
            this.logWarn(`Update feed unavailable: ${msg}`);
            this.sendUpdateWarning('Update feed unavailable for this repository');
            return;
        }

        this.logError('Update check failed', error);
        this.sendUpdateError(msg);
    }

    private isReleaseFeedWarning(error: unknown): boolean {
        if (!error) { return false; }

        const message = error instanceof Error ? error.message : String(error);
        const lowerMessage = message.toLowerCase();
        const stack = error instanceof Error ? (error.stack || '').toLowerCase() : '';

        // Comprehensive list of strings that indicate GitHub feed/release missing or inaccessible
        const commonFeedErrors = [
            'releases.atom',
            'authentication token',
            'http_error_404',
            'status code 404',
            'not found',
            'github.com/tengrastudio/tengra/releases',
            'failed to fetch',
            'http error 404',
            'httperror: 404'
        ];

        if (commonFeedErrors.some(err => lowerMessage.includes(err) || stack.includes(err))) {
            return true;
        }

        if (typeof error !== 'object') {
            return false;
        }

        const statusCode = 'statusCode' in error ? (error as { statusCode?: number }).statusCode : undefined;
        const errProp = 'error' in error ? String((error as { error?: unknown }).error).toLowerCase() : '';

        return statusCode === 404 || errProp.includes('404');
    }

    private clearGitHubAuthEnvironment(): void {
        delete process.env.GH_TOKEN;
        delete process.env.GITHUB_TOKEN;
    }

    private sendUpdateError(message: string): void {
        this.sendToWindow('update:status', { state: 'error', error: message });
    }

    private sendUpdateWarning(message: string): void {
        this.sendToWindow('update:status', { state: 'warning', warning: message });
    }
}
