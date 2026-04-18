/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { lazyServiceRegistry } from '@main/core/lazy-services';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';

export function registerLazyServicesIpc(): void {
    ipcMain.handle('lazy:get-status', createIpcHandler('lazy:get-status', async () => {
        const status = lazyServiceRegistry.getStatus();
        return {
            registered: status.registered,
            loaded: status.loaded,
            loading: status.loading,
            totals: {
                registered: status.registered.length,
                loaded: status.loaded.length,
                loading: status.loading.length
            }
        };
    }));
}

