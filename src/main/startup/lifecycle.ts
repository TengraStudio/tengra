import { appLogger } from '@main/logging/logger';
import { SettingsService } from '@main/services/system/settings.service';
import { app, BrowserWindow } from 'electron';

import { container } from './services';
import { createWindow, destroyTray, getMainWindow, setMainWindow } from './window';

export function registerLifecycleHandlers(settingsService: SettingsService) {
    app.on('activate', () => {
        const mainWindow = getMainWindow();
        if (BrowserWindow.getAllWindows().length === 0) {
            setMainWindow(createWindow(settingsService));
        } else if (mainWindow) {
            mainWindow.show();
        }
    });

    app.on('window-all-closed', () => {
        const settings = settingsService.getSettings();
        if (settings.window?.workAtBackground) {
            const mainWindow = getMainWindow();
            if (mainWindow) {
                mainWindow.hide();
            }
            return;
        }

        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    app.on('before-quit', async (event) => {
        appLogger.info('Lifecycle', 'Application shutdown initiated');
        event.preventDefault();

        try {
            const mainWindow = getMainWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.removeAllListeners('close');
                mainWindow.close();
            }

            appLogger.info('Lifecycle', 'Disposing service container...');
            await container.dispose();

            destroyTray();
            appLogger.info('Lifecycle', 'Cleanup completed, quitting application');
            app.exit(0);
        } catch (e) {
            appLogger.error('Lifecycle', `Cleanup error: ${e}`);
            app.exit(1);
        }
    }) as unknown as (event: Event) => void;
}
