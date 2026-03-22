import { appLogger } from '@main/logging/logger';
import { SettingsService } from '@main/services/system/settings.service';
import { app, BrowserWindow } from 'electron';

import { container } from './services';
import { createWindow, destroyTray, getMainWindow, setMainWindow } from './window';

let isQuitting = false;

export function registerLifecycleHandlers(settingsService: SettingsService) {
    app.on('activate', () => {
        if (isQuitting) { return; }
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
        if (settings.window?.workAtBackground) {
            const mainWindow = getMainWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.hide();
            }
            return;
        }

        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('before-quit', (event) => {
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
