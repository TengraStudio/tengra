import { appLogger } from '@main/logging/logger';
import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import { BrowserWindow, desktopCapturer, ipcMain } from 'electron';

/**
 * Registers IPC handlers for screenshot capture operations
 */
export function registerScreenshotIpc(getMainWindow: () => BrowserWindow | null): void {
    appLogger.info('ScreenshotIPC', 'Registering screenshot IPC handlers');
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'screenshot operation');

    ipcMain.handle(
        'screenshot:capture',
        createSafeIpcHandler(
            'screenshot:capture',
            async (event) => {
                validateSender(event);
                return await withRateLimit('screenshot', async () => {
                    const sources = await desktopCapturer.getSources({
                        types: ['screen'],
                        thumbnailSize: { width: 1920, height: 1080 }
                    });

                    const primarySource = sources[0] as Electron.DesktopCapturerSource | undefined;
                    if (primarySource === undefined) {
                        throw new Error('No screen sources available');
                    }

                    return primarySource.thumbnail.toDataURL();
                });
            },
            ''
        )
    );
}
