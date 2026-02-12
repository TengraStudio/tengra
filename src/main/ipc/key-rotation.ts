import { appLogger } from '@main/logging/logger';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain, IpcMainInvokeEvent } from 'electron';

/** Maximum provider name length */
const MAX_PROVIDER_LENGTH = 64;
/** Maximum keys string length */
const MAX_KEYS_LENGTH = 4096;

/**
 * Validates a provider name
 */
function validateProvider(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_PROVIDER_LENGTH) {
        return null;
    }
    // Provider names should be alphanumeric with underscores/hyphens
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        return null;
    }
    return trimmed;
}

/**
 * Validates a keys string (comma-separated)
 */
function validateKeysString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    if (!value.trim() || value.length > MAX_KEYS_LENGTH) {
        return null;
    }
    return value;
}

/**
 * Registers IPC handlers for API key rotation management
 */
export function registerKeyRotationIpc(keyRotationService: KeyRotationService) {
    appLogger.info('KeyRotationIPC', 'Registering key rotation IPC handlers');

    /**
     * Get current key for a provider
     */
    ipcMain.handle('key-rotation:getCurrentKey', createSafeIpcHandler('key-rotation:getCurrentKey',
        async (_event: IpcMainInvokeEvent, providerRaw: unknown) => {
            const provider = validateProvider(providerRaw);
            if (!provider) {
                throw new Error('Invalid provider name');
            }
            return keyRotationService.getCurrentKey(provider) ?? null;
        }, null
    ));

    /**
     * Rotate to the next key for a provider
     */
    ipcMain.handle('key-rotation:rotate', createIpcHandler('key-rotation:rotate',
        async (_event: IpcMainInvokeEvent, providerRaw: unknown) => {
            const provider = validateProvider(providerRaw);
            if (!provider) {
                throw new Error('Invalid provider name');
            }
            const success = keyRotationService.rotateKey(provider);
            return { success, currentKey: keyRotationService.getCurrentKey(provider) ?? null };
        }
    ));

    /**
     * Initialize provider keys (comma-separated)
     */
    ipcMain.handle('key-rotation:initialize', createIpcHandler('key-rotation:initialize',
        async (_event: IpcMainInvokeEvent, providerRaw: unknown, keysRaw: unknown) => {
            const provider = validateProvider(providerRaw);
            const keys = validateKeysString(keysRaw);
            if (!provider || !keys) {
                throw new Error('Invalid provider name or keys');
            }
            keyRotationService.initializeProviderKeys(provider, keys);
            appLogger.info('KeyRotationIPC', `Initialized keys for provider: ${provider}`);
            return { success: true, currentKey: keyRotationService.getCurrentKey(provider) ?? null };
        }
    ));

    /**
     * Get rotation status for a provider
     */
    ipcMain.handle('key-rotation:getStatus', createSafeIpcHandler('key-rotation:getStatus',
        async (_event: IpcMainInvokeEvent, providerRaw: unknown) => {
            const provider = validateProvider(providerRaw);
            if (!provider) {
                throw new Error('Invalid provider name');
            }
            const currentKey = keyRotationService.getCurrentKey(provider);
            // Note: KeyRotationService doesn't expose key count, so we return basic info
            return {
                provider,
                hasKey: !!currentKey,
                currentKey: currentKey ? `${currentKey.substring(0, 8)}...` : null // Masked for security
            };
        }, { provider: '', hasKey: false, currentKey: null }
    ));
}
