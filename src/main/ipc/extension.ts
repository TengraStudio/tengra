import { appLogger } from '@main/logging/logger';
import { ExtensionDetectorService } from '@main/services/system/extension-detector.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain, IpcMainInvokeEvent } from 'electron';

/**
 * Registers IPC handlers for browser extension management
 */
export function registerExtensionIpc(extensionDetectorService: ExtensionDetectorService): void {
    appLogger.info('ExtensionIPC', 'Registering extension IPC handlers');

    ipcMain.handle(
        'extension:shouldShowWarning',
        createSafeIpcHandler(
            'extension:shouldShowWarning',
            async () => {
                return extensionDetectorService.shouldShowWarning();
            },
            false
        )
    );

    ipcMain.handle(
        'extension:dismissWarning',
        createSafeIpcHandler(
            'extension:dismissWarning',
            async () => {
                extensionDetectorService.dismissWarning();
                appLogger.info('ExtensionIPC', 'Extension warning dismissed by user');
                return { success: true };
            },
            { success: false }
        )
    );

    ipcMain.handle(
        'extension:getStatus',
        createSafeIpcHandler(
            'extension:getStatus',
            async () => {
                return {
                    installed: extensionDetectorService.isExtensionInstalled(),
                    shouldShowWarning: extensionDetectorService.shouldShowWarning()
                };
            },
            { installed: false, shouldShowWarning: false }
        )
    );

    ipcMain.handle(
        'extension:setInstalled',
        createSafeIpcHandler(
            'extension:setInstalled',
            async (_event: IpcMainInvokeEvent, installedRaw: unknown) => {
                const installed = installedRaw === true;
                extensionDetectorService.setExtensionInstalled(installed);
                return { success: true };
            },
            { success: false }
        )
    );
}
