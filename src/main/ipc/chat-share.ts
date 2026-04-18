/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Chat Share IPC Handlers
 * Exposes chat sharing functionality to the renderer process.
 */

import { ChatShareService } from '@main/services/data/chat-share.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain, IpcMainInvokeEvent } from 'electron';

/**
 * Registers IPC handlers for chat share operations.
 * @param service - The ChatShareService instance.
 */
export function registerChatShareIpc(service: ChatShareService): void {
    ipcMain.handle('chat:share-create', createIpcHandler('chat:share-create',
        async (_event: IpcMainInvokeEvent, chatId: string) => {
            const entry = await service.createShare(chatId);
            const deepLink = service.generateDeepLink(entry.id);
            return { ...entry, deepLink };
        }
    ));

    ipcMain.handle('chat:share-get', createIpcHandler('chat:share-get',
        async (_event: IpcMainInvokeEvent, shareId: string) => {
            return await service.getShare(shareId) ?? null;
        }
    ));

    ipcMain.handle('chat:share-delete', createIpcHandler('chat:share-delete',
        async (_event: IpcMainInvokeEvent, shareId: string) => {
            return { success: await service.deleteShare(shareId) };
        }
    ));

    ipcMain.handle('chat:share-list', createIpcHandler('chat:share-list',
        async () => {
            return await service.listShares();
        }
    ));
}
