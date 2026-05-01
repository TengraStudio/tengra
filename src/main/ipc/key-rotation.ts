import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import type { KeyRotationService } from '@main/services/security/key-rotation.service';
import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';

/**
 * Registers IPC handlers for API key rotation management
 */
export function registerKeyRotationIpc(getMainWindow: () => BrowserWindow | null, keyRotationService: KeyRotationService) {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'key-rotation operation');
    appLogger.debug('KeyRotationIPC', 'Registering key rotation IPC handlers');

    /**
     * Get current key for a provider
     */
    ipcMain.handle('key-rotation:getCurrentKey', async (event, provider: unknown) => {
        try {
            validateSender(event);
            if (!provider || typeof provider !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(provider) || provider.length > 64) {
                return { success: true, data: null };
            }
            const key = keyRotationService.getCurrentKey(provider.trim());
            return { success: true, data: key };
        } catch (error) {
            return { success: false, error: { message: error instanceof Error ? error.message : 'Unauthorized' } };
        }
    });

    /**
     * Rotate to the next key for a provider
     */
    ipcMain.handle('key-rotation:rotate', async (event, provider: unknown) => {
        try {
            validateSender(event);
            if (!provider || typeof provider !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(provider)) {
                return { success: false, error: { message: 'Invalid provider name' } };
            }

            const success = keyRotationService.rotateKey(provider.trim());
            const currentKey = keyRotationService.getCurrentKey(provider.trim());
            return {
                success: true,
                data: { success, currentKey }
            };
        } catch (error) {
            return {
                success: false,
                error: { message: error instanceof Error ? error.message : 'Rotation failed' }
            };
        }
    });

    /**
     * Initialize provider keys (comma-separated)
     */
    ipcMain.handle('key-rotation:initialize', async (event, provider: unknown, keyString: unknown) => {
        try {
            validateSender(event);
            if (!provider || typeof provider !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(provider) ||
                !keyString || typeof keyString !== 'string' || keyString.length > 4096) {
                return { success: false, error: { message: 'Invalid input' } };
            }

            keyRotationService.initializeProviderKeys(provider.trim(), keyString.trim());
            const currentKey = keyRotationService.getCurrentKey(provider.trim());
            return {
                success: true,
                data: { success: true, currentKey }
            };
        } catch (error) {
            return {
                success: false,
                error: { message: error instanceof Error ? error.message : 'Initialization failed' }
            };
        }
    });

    /**
     * Get rotation status for a provider
     */
    ipcMain.handle('key-rotation:getStatus', async (event, provider: unknown) => {
        try {
            validateSender(event);
            const safeProvider = (typeof provider === 'string' && /^[a-zA-Z0-9_-]+$/.test(provider)) ? provider.trim() : '';
            
            if (!safeProvider) {
                return {
                    success: true,
                    data: { provider: '', hasKey: false, currentKey: null }
                };
            }

            const key = keyRotationService.getCurrentKey(safeProvider);
            const maskedKey = key ? (key.length > 8 ? `${key.substring(0, 8)}...` : key) : null;
            
            return {
                success: true,
                data: {
                    provider: safeProvider,
                    hasKey: key !== null,
                    currentKey: maskedKey
                }
            };
        } catch (error) {
            // Check if it's a validation error or a service error
            if (error instanceof Error && error.message.includes('Unauthorized')) {
                return { success: false, error: { message: error.message } };
            }
            return {
                success: true,
                data: { provider: '', hasKey: false, currentKey: null }
            };
        }
    });
}
