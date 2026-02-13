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

