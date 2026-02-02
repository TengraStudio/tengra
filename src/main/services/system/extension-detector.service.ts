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
            // If extension is making requests, we'll see activity
            // This is a simple approach - in production you might use a specific handshake

            // For now, we'll just assume extension is NOT installed by default
            // and user will need to manually install it

            // TODO: Implement actual detection via API endpoint ping count or handshake
            // For now, always mark as not installed
            this.extensionInstalled = false;

            appLogger.info(
                this.name,
                'Extension status: not installed'
            );
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
