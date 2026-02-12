import { appLogger } from '@main/logging/logger';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import { desktopCapturer, ipcMain } from 'electron';

/**
 * Registers IPC handlers for screenshot capture operations
 */
export function registerScreenshotIpc(): void {
    appLogger.info('ScreenshotIPC', 'Registering screenshot IPC handlers');

    ipcMain.handle(
        'screenshot:capture',
        createSafeIpcHandler(
            'screenshot:capture',
            async () => {
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
