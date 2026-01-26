import { desktopCapturer, ipcMain } from 'electron';

export function registerScreenshotIpc() {
    ipcMain.handle('screenshot:capture', async () => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 1920, height: 1080 }
            });
            const primarySource = sources[0] as Electron.DesktopCapturerSource | undefined;
            if (primarySource === undefined) {
                throw new Error('No screen sources available');
            }
            return primarySource.thumbnail.toDataURL();
        } catch (error) {
            console.error('Screenshot error:', error);
            throw error;
        }
    });
}
