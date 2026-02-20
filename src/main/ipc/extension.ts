/**
 * Extension IPC Handlers
 * MKT-DEV-01: Extension SDK/templates/CLI
 */

import { appLogger } from '@main/logging/logger';
import { getExtensionService } from '@main/services/extension/extension.service';

let isExtensionIpcRegistered = false;

/**
 * Registers extension IPC channels through ExtensionService initialization.
 */
export const registerExtensionIpc = (): void => {
    if (isExtensionIpcRegistered) {
        return;
    }
    isExtensionIpcRegistered = true;

    const extensionService = getExtensionService();
    void extensionService.initialize().catch(error => {
        appLogger.error('ExtensionIPC', 'Failed to initialize extension IPC handlers', error as Error);
        isExtensionIpcRegistered = false;
    });
};

export const registerExtensionHandlers = registerExtensionIpc;
