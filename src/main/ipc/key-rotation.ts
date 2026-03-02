import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { keyRotationKeysSchema, keyRotationProviderSchema } from '@main/ipc/validation';
import { appLogger } from '@main/logging/logger';
import { KeyRotationService } from '@main/services/security/key-rotation.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';

/**
 * Registers IPC handlers for API key rotation management
 */
export function registerKeyRotationIpc(getMainWindow: () => BrowserWindow | null, keyRotationService: KeyRotationService) {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'key-rotation operation');
    appLogger.info('KeyRotationIPC', 'Registering key rotation IPC handlers');

    /**
     * Get current key for a provider
     */
    ipcMain.handle('key-rotation:getCurrentKey', createValidatedIpcHandler('key-rotation:getCurrentKey',
        async (event: IpcMainInvokeEvent, provider: string) => {
            validateSender(event);
            return keyRotationService.getCurrentKey(provider) ?? null;
        }, {
        argsSchema: z.tuple([keyRotationProviderSchema]),
        defaultValue: null,
        schemaVersion: 1,
        wrapResponse: true
    }
    ));

    /**
     * Rotate to the next key for a provider
     */
    ipcMain.handle('key-rotation:rotate', createValidatedIpcHandler('key-rotation:rotate',
        async (event: IpcMainInvokeEvent, provider: string) => {
            validateSender(event);
            const success = keyRotationService.rotateKey(provider);
            return { success, currentKey: keyRotationService.getCurrentKey(provider) ?? null };
        }, {
        argsSchema: z.tuple([keyRotationProviderSchema]),
        schemaVersion: 1,
        wrapResponse: true
    }
    ));

    /**
     * Initialize provider keys (comma-separated)
     */
    ipcMain.handle('key-rotation:initialize', createValidatedIpcHandler('key-rotation:initialize',
        async (event: IpcMainInvokeEvent, provider: string, keys: string) => {
            validateSender(event);
            keyRotationService.initializeProviderKeys(provider, keys);
            appLogger.info('KeyRotationIPC', `Initialized keys for provider: ${provider}`);
            return { success: true, currentKey: keyRotationService.getCurrentKey(provider) ?? null };
        }, {
        argsSchema: z.tuple([keyRotationProviderSchema, keyRotationKeysSchema]),
        schemaVersion: 1,
        wrapResponse: true
    }
    ));

    /**
     * Get rotation status for a provider
     */
    ipcMain.handle('key-rotation:getStatus', createValidatedIpcHandler('key-rotation:getStatus',
        async (event: IpcMainInvokeEvent, provider: string) => {
            validateSender(event);
            const currentKey = keyRotationService.getCurrentKey(provider);
            return {
                provider,
                hasKey: !!currentKey,
                currentKey: currentKey ? `${currentKey.substring(0, 8)}...` : null
            };
        }, {
        argsSchema: z.tuple([keyRotationProviderSchema]),
        defaultValue: { provider: '', hasKey: false, currentKey: null },
        schemaVersion: 1,
        wrapResponse: true
    }
    ));
}
