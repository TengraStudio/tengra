/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { MarketplaceService } from '@main/services/external/marketplace.service';
import { CodeLanguageService } from '@main/services/system/code-language.service';
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
    codeLanguageService: CodeLanguageService,
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

    ipcMain.handle('marketplace:getRuntimeProfile', createIpcHandler('marketplace:getRuntimeProfile',
        async () => {
            return await marketplaceService.getRuntimeProfile();
        }
    ));

    ipcMain.handle('marketplace:get-update-count', createIpcHandler('marketplace:get-update-count',
        async () => {
            return await marketplaceService.getUpdateCount();
        }
    ));

    ipcMain.handle('marketplace:check-live-updates', createIpcHandler('marketplace:check-live-updates',
        async () => {
            return await marketplaceService.checkLiveExtensionUpdates();
        }
    ));

    ipcMain.handle('marketplace:fetch-readme', createIpcHandler('marketplace:fetch-readme',
        async (_event: IpcMainInvokeEvent, extensionId: string, repository?: string) => {
            return await marketplaceService.fetchExtensionReadme(extensionId, repository);
        }
    ));

    // Tema veya eklenti yükle
    ipcMain.handle('marketplace:install', createIpcHandler('marketplace:install',
        async (_event: IpcMainInvokeEvent, request: InstallRequest) => {
            try {
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
                    if (validatedRequest.type === 'code-language-pack') {
                        appLogger.info('MarketplaceIPC', 'Code language pack installed, triggering reload...');
                        await codeLanguageService.reload();
                        if (mainWindow) {
                            mainWindow.webContents.send('code-language:runtime:updated');
                        }
                    }
                }
                return result;
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Installation failed';
                const [code, humanMessage] = message.includes(':')
                    ? [message.split(':', 1)[0], message.slice(message.indexOf(':') + 1).trim()]
                    : ['INSTALL_FAILED', message];
                return {
                    success: false,
                    code,
                    message: humanMessage,
                    path: '',
                    queuedDownloads: 0,
                    downloadIds: [],
                };
            }
        }
    ));

    ipcMain.handle('marketplace:uninstall', createIpcHandler('marketplace:uninstall',
        async (_event: IpcMainInvokeEvent, itemId: string, itemType: MarketplaceItem['itemType']) => {
            const result = await marketplaceService.uninstallItem(itemId, itemType);
            if (result.success && itemType === 'code-language-pack') {
                await codeLanguageService.reload();
                const mainWindow = getMainWindow();
                if (mainWindow) {
                    mainWindow.webContents.send('code-language:runtime:updated');
                }
            }
            return result;
        }
    ));
}
