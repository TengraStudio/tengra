import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { SettingsService } from '@main/services/system/settings.service';
import { getErrorMessage } from '@shared/utils/error.util';

/**
 * Service to detect if browser extension is installed and show warning
 */
export class ExtensionDetectorService extends BaseService {
    private extensionInstalled: boolean = false;
    private checkInterval: NodeJS.Timeout | null = null;

    constructor(
        private settingsService: SettingsService,
        private apiPort: number = 42069
    ) {
        super('ExtensionDetectorService');
    }

    async initialize(): Promise<void> {
        appLogger.info(this.name, 'Initializing extension detector...');

        // Check on startup
        await this.checkExtensionInstalled();

        // Check every minute
        this.checkInterval = setInterval(() => {
            void this.checkExtensionInstalled();
        }, 60000);
    }

    async cleanup(): Promise<void> {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        appLogger.info(this.name, 'Extension detector stopped');
    }

    /**
     * Check if extension is installed by pinging the health endpoint
     */
    private async checkExtensionInstalled(): Promise<void> {
        try {
            // Try to reach the API health endpoint
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            try {
                // If extension is installed, it should be listening on this port (if running)
                // Note: This assumes the extension includes a local server component or we are pinging the Tandem server provided TO the extension?
                // Actually, extension-detector usually checks if the extension has pinged US.
                // But the TODO said "via API endpoint ping count or handshake". 
                // If we are server, we check if we received pings.
                // If we are checking if *it* is listening (e.g. sidecar), we fetch.
                // Let's assume we check if we've received pings or if we can reach it.
                // Given "apiPort" argument, it implies WE are checking IT or WE are the server.
                // If we are the server, we should check a variable. "this.extensionInstalled" is already there.
                // But the init logic had a detailed check method.
                // Let's implement a simple fetch to the port, assuming the extension (or sidecar) opens it
                // OR we are checking our own port for connectivity from extension?
                // Re-reading: "pinging the health endpoint".

                const response = await fetch(`http://127.0.0.1:${this.apiPort}/health`, {
                    method: 'GET',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const prevStatus = this.extensionInstalled;
                this.extensionInstalled = response.ok;

                if (this.extensionInstalled !== prevStatus) {
                    appLogger.info(this.name, `Extension status changed: ${this.extensionInstalled ? 'Installed/Connected' : 'Disconnected'}`);
                }
            } catch {
                clearTimeout(timeoutId);
                // Connection refused = not running
                this.extensionInstalled = false;
            }
        } catch (error) {
            appLogger.error(
                this.name,
                `Extension detection failed: ${getErrorMessage(error as Error)}`
            );
        }
    }

    /**
     * Check if extension is installed
     */
    isExtensionInstalled(): boolean {
        return this.extensionInstalled;
    }

    /**
     * Mark extension as installed (can be called when extension connects)
     */
    setExtensionInstalled(installed: boolean): void {
        this.extensionInstalled = installed;
        appLogger.info(this.name, `Extension marked as ${installed ? 'installed' : 'not installed'}`);
    }

    /**
     * Check if user has dismissed the warning
     */
    shouldShowWarning(): boolean {
        const settings = this.settingsService.getSettings();
        const dismissed = settings.extensionWarningDismissed ?? false;
        return !this.extensionInstalled && !dismissed;
    }

    /**
     * Dismiss the warning
     */
    dismissWarning(): void {
        const settings = this.settingsService.getSettings();
        settings.extensionWarningDismissed = true;
        void this.settingsService.saveSettings(settings);
        appLogger.info(this.name, 'Extension warning dismissed');
    }

    /**
     * Get installation instructions URL
     */
    getInstallationInstructions(): string {
        // In development, point to local extension folder
        // In production, point to Chrome Web Store or GitHub releases
        return 'https://github.com/TengraStudio/tandem/wiki/Browser-Extension-Installation';
    }
}
