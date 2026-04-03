import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { MarketplaceService } from '@main/services/external/marketplace.service';
import { LocaleService } from '@main/services/system/locale.service';
import { ThemeService } from '@main/services/theme/theme.service';
import { createIpcHandler as baseCreateIpcHandler } from '@main/utils/ipc-wrapper.util';
import { marketplaceInstallRequestSchema } from '@shared/schemas/marketplace.schema';
import { InstallRequest, MarketplaceItem, MarketplaceModel } from '@shared/types/marketplace';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

/**
 * Registers IPC handlers for Marketplace operations
 */
export function registerMarketplaceIpc(
    marketplaceService: MarketplaceService,
    themeService: ThemeService,
    localeService: LocaleService,
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
            const validatedRequest = marketplaceInstallRequestSchema.parse(request);
            const baseInstallItem = {
                id: validatedRequest.id,
                name: validatedRequest.name ?? validatedRequest.id,
                description: validatedRequest.description ?? `${validatedRequest.type} item installed from marketplace.`,
                author: validatedRequest.author ?? 'Marketplace',
                version: validatedRequest.version ?? 'latest',
                itemType: validatedRequest.type,
                downloadUrl: validatedRequest.downloadUrl,
            } satisfies MarketplaceItem;

            // Installation logic via service
            const itemToInstall = validatedRequest.type === 'model'
                ? {
                    ...baseInstallItem,
                    provider: validatedRequest.provider ?? 'custom',
                    source: validatedRequest.provider ?? 'custom',
                    sourceUrl: validatedRequest.sourceUrl,
                    category: validatedRequest.category,
                    pipelineTag: validatedRequest.pipelineTag,
                } satisfies MarketplaceModel
                : baseInstallItem;
            const result = await marketplaceService.installItem(itemToInstall);

            if (result.success) {
                const mainWindow = getMainWindow();
                if (validatedRequest.type === 'theme') {
                    appLogger.info('MarketplaceIPC', 'Theme installed, triggering reload...');
                    await themeService.initialize();
                    if (mainWindow) {
                        mainWindow.webContents.send('theme:runtime:updated');
                    }
                }
                if (validatedRequest.type === 'language') {
                    appLogger.info('MarketplaceIPC', 'Language pack installed, triggering reload...');
                    await localeService.reload();
                    if (mainWindow) {
                        mainWindow.webContents.send('locale:runtime:updated');
                    }
                }
            }
            
            return result;
        }
    ));
}
