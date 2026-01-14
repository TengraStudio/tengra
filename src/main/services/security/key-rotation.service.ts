import { BaseService } from '@main/services/base.service';
import { SettingsService } from '@main/services/settings.service';
import { appLogger } from '@main/logging/logger';

export class KeyRotationService extends BaseService {
    private keyStates: Map<string, { keys: string[], currentIndex: number }> = new Map();

    constructor(private settingsService: SettingsService) {
        super('KeyRotationService');
        this.settingsService.getSettings(); // Suppress unused error
    }

    /**
     * Initializes keys for a provider from settings.
     * Supports comma-separated keys in the settings string.
     */
    initializeProviderKeys(provider: string, keyString: string) {
        if (!keyString) return;

        const keys = keyString.split(',').map(k => k.trim()).filter(k => k.length > 0);
        if (keys.length > 0) {
            this.keyStates.set(provider, { keys, currentIndex: 0 });
            if (keys.length > 1) {
                appLogger.info('KeyRotation', `Initialized ${keys.length} keys for ${provider}`);
            }
        }
    }

    /**
     * Gets the current active key for a provider.
     */
    getCurrentKey(provider: string): string | null {
        const state = this.keyStates.get(provider);
        if (!state || state.keys.length === 0) return null;
        return state.keys[state.currentIndex];
    }

    /**
     * Rotates to the next available key for the provider.
     * Returns true if rotation was successful (i.e., there was another key to switch to).
     */
    rotateKey(provider: string): boolean {
        const state = this.keyStates.get(provider);
        if (!state || state.keys.length <= 1) {
            appLogger.warn('KeyRotation', `Cannot rotate key for ${provider}: No alternative keys available.`);
            return false;
        }

        const prevIndex = state.currentIndex;
        state.currentIndex = (state.currentIndex + 1) % state.keys.length;

        appLogger.warn('KeyRotation', `Rotating key for ${provider} (Index ${prevIndex} -> ${state.currentIndex})`);
        return true;
    }
}
