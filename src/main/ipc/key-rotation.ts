import { KeyRotationService } from '@main/services/security/key-rotation.service'
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util'
import { ipcMain, IpcMainInvokeEvent } from 'electron'

/**
 * Registers IPC handlers for API key rotation management
 */
export function registerKeyRotationIpc(keyRotationService: KeyRotationService) {
    /**
     * Get current key for a provider
     */
    ipcMain.handle('key-rotation:getCurrentKey', createSafeIpcHandler('key-rotation:getCurrentKey', async (_event: IpcMainInvokeEvent, provider: string) => {
        if (typeof provider !== 'string') {
            throw new Error('Provider must be a string')
        }
        return keyRotationService.getCurrentKey(provider) ?? null
    }, null))

    /**
     * Rotate to the next key for a provider
     */
    ipcMain.handle('key-rotation:rotate', createIpcHandler('key-rotation:rotate', async (_event: IpcMainInvokeEvent, provider: string) => {
        if (typeof provider !== 'string') {
            throw new Error('Provider must be a string')
        }
        const success = keyRotationService.rotateKey(provider)
        return { success, currentKey: keyRotationService.getCurrentKey(provider) ?? null }
    }))

    /**
     * Initialize provider keys (comma-separated)
     */
    ipcMain.handle('key-rotation:initialize', createIpcHandler('key-rotation:initialize', async (_event: IpcMainInvokeEvent, provider: string, keys: string) => {
        if (typeof provider !== 'string') {
            throw new Error('Provider must be a string')
        }
        if (typeof keys !== 'string') {
            throw new Error('Keys must be a string (comma-separated)')
        }
        keyRotationService.initializeProviderKeys(provider, keys)
        return { success: true, currentKey: keyRotationService.getCurrentKey(provider) ?? null }
    }))

    /**
     * Get rotation status for a provider
     */
    ipcMain.handle('key-rotation:getStatus', createSafeIpcHandler('key-rotation:getStatus', async (_event: IpcMainInvokeEvent, provider: string) => {
        if (typeof provider !== 'string') {
            throw new Error('Provider must be a string')
        }
        const currentKey = keyRotationService.getCurrentKey(provider)
        // Note: KeyRotationService doesn't expose key count, so we return basic info
        return {
            provider,
            hasKey: !!currentKey,
            currentKey: currentKey ? `${currentKey.substring(0, 8)}...` : null // Masked for security
        }
    }, { provider: '', hasKey: false, currentKey: null }))
}
