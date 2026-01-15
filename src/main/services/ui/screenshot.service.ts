// Screenshot service - uses Electron desktopCapturer in main process
// Note: This service requires the main process to pass screenshot data

interface ScreenshotResult {
    success: boolean
    image?: string
    error?: string
}

export class ScreenshotService {
    // This will be called from main.ts which has access to desktopCapturer
    // The actual capture is done in main.ts IPC handler

    async captureScreen(): Promise<ScreenshotResult> {
        // This is a placeholder - actual capture happens in main.ts
        // using desktopCapturer directly
        return { success: true }
    }

    async captureWindow(_windowName?: string): Promise<ScreenshotResult> {
        return { success: true }
    }

    async listWindows(): Promise<{ success: boolean; windows?: string[]; error?: string }> {
        return { success: true, windows: [] }
    }
}
