/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { SettingsService } from '@main/services/system/settings.service';
import { app, BrowserWindow } from 'electron';

import { container } from './services';
import { createWindow, destroyTray, getMainWindow, setMainWindow } from './window';

let isQuitting = false;

export function registerLifecycleHandlers(settingsService: SettingsService, isIpcRegistered: () => boolean) {
    app.on('activate', () => {
        if (isQuitting) { return; }
        
        // --- RACE CONDITION GUARD ---
        // Ensure we don't create the window if IPC handlers aren't ready yet.
        // The main boot flow in app.ts will handle window creation once ready.
        if (!isIpcRegistered()) {
            appLogger.info('Lifecycle', 'App activate event deferred: IPC handlers not registered yet');
            return;
        }

        appLogger.debug('Lifecycle', 'App activate event');
        const mainWindow = getMainWindow();
        if (BrowserWindow.getAllWindows().length === 0) {
            setMainWindow(createWindow(settingsService));
        } else if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
        }
    });

    app.on('window-all-closed', () => {
        if (isQuitting) { return; }
        const settings = settingsService.getSettings();
        appLogger.info('Lifecycle', `window-all-closed; workAtBackground=${String(settings.window?.workAtBackground === true)}`);
        if (settings.window?.workAtBackground) {
            const mainWindow = getMainWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.hide();
            }
            return;
        }

        if (process.platform !== 'darwin') {
            appLogger.info('Lifecycle', 'Quitting app (window-all-closed)');
            app.quit();
        }
    });

    app.on('before-quit', (event) => {
        appLogger.info('Lifecycle', 'before-quit event received');
        void handleBeforeQuit(event);
    });

    async function handleBeforeQuit(event: Electron.Event): Promise<void> {
        // Prevent re-entry if already quitting
        if (isQuitting) { return; }
        isQuitting = true;

        appLogger.info('Lifecycle', 'Application shutdown initiated');
        event.preventDefault();

        // 5s Safety Watchdog: Force exit if cleanup hangs
        const watchdog = setTimeout(() => {
            appLogger.warn('Lifecycle', 'Shutdown watchdog triggered - forcing exit');
            app.exit(0);
        }, 5000);
        watchdog.unref();

        try {
            const mainWindow = getMainWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.removeAllListeners('close');
                mainWindow.removeAllListeners('closed');
                mainWindow.destroy();
            }
            setMainWindow(null);

            appLogger.debug('Lifecycle', 'Disposing service container...');
            const start = Date.now();
            await container.dispose();
            appLogger.debug('Lifecycle', `Service container disposed in ${Date.now() - start}ms`);

            appLogger.info('Lifecycle', 'Destroying tray...');
            destroyTray();

            clearTimeout(watchdog);
            appLogger.info('Lifecycle', 'App cleanup completed, exiting...');
            // Give logger a moment to flush to disk
            setTimeout(() => {
                app.exit(0);
            }, 500);
        } catch (e) {
            clearTimeout(watchdog);
            appLogger.error('Lifecycle', `Cleanup error: ${e}`);
            app.exit(1);
        }
    }
}

