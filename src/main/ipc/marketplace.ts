import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { MarketplaceService } from '@main/services/external/marketplace.service';
import { ThemeService } from '@main/services/theme/theme.service';
import { createIpcHandler as baseCreateIpcHandler } from '@main/utils/ipc-wrapper.util';
import { InstallRequest, MarketplaceItem } from '@shared/types/marketplace';

/**
 * Registers IPC handlers for Marketplace operations
 */
export function registerMarketplaceIpc(
    marketplaceService: MarketplaceService,
    themeService: ThemeService,
    getMainWindow: () => BrowserWindow | null
) {
    appLogger.debug('MarketplaceIPC', 'Registering Marketplace IPC handlers');
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'marketplace operation');

    const createIpcHandler = <T = RuntimeValue, Args extends RuntimeValue[] = RuntimeValue[]>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T>
    ) => baseCreateIpcHandler<T, Args>(channel, async (event, ...args) => {
        validateSender(event);
        return await handler(event, ...args);
    });

    // GitHub'dan registry dosyasını çek
    ipcMain.handle('marketplace:fetch', createIpcHandler('marketplace:fetch',
        async () => {
            return await marketplaceService.fetchRegistry();
        }
    ));

    // Tema veya eklenti yükle
    ipcMain.handle('marketplace:install', createIpcHandler('marketplace:install',
        async (_event: IpcMainInvokeEvent, request: InstallRequest) => {
            if (!request || !request.downloadUrl) {
                throw new Error('Invalid install request');
            }

            // Installation logic via service
            const result = await marketplaceService.installItem({
                id: request.id,
                name: request.id,
                itemType: request.type,
                downloadUrl: request.downloadUrl,
            } as MarketplaceItem);

            if (result.success && request.type === 'theme') {
                appLogger.info('MarketplaceIPC', 'Theme installed, triggering reload...');
                await themeService.initialize();
                
                const mainWindow = getMainWindow();
                if (mainWindow) {
                    mainWindow.webContents.send('theme:runtime:updated');
                }
            }
            
            return result;
        }
    ));
}
