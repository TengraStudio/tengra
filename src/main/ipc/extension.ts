import { appLogger } from '@main/logging/logger';
import { ExtensionDetectorService } from '@main/services/system/extension-detector.service';
import { ipcMain } from 'electron';

/**
 * Register IPC handlers for browser extension management
 */
export function registerExtensionIpc(extensionDetectorService: ExtensionDetectorService) {
    // Check if extension should show warning
    ipcMain.handle('extension:shouldShowWarning', () => {
        return extensionDetectorService.shouldShowWarning();
    });

    // Dismiss extension warning
    ipcMain.handle('extension:dismissWarning', () => {
        extensionDetectorService.dismissWarning();
        appLogger.info('ExtensionIPC', 'Extension warning dismissed by user');
        return { success: true };
    });

    // Get extension installation status
    ipcMain.handle('extension:getStatus', () => {
        return {
            installed: extensionDetectorService.isExtensionInstalled(),
            shouldShowWarning: extensionDetectorService.shouldShowWarning()
        };
    });

    // Mark extension as installed (can be called when extension pings API)
    ipcMain.handle('extension:setInstalled', (_event, installed: boolean) => {
        extensionDetectorService.setExtensionInstalled(installed);
        return { success: true };
    });

    appLogger.info('ExtensionIPC', 'Extension IPC handlers registered');
}
