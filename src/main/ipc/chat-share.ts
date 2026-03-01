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
            return service.getShare(shareId) ?? null;
        }
    ));

    ipcMain.handle('chat:share-delete', createIpcHandler('chat:share-delete',
        async (_event: IpcMainInvokeEvent, shareId: string) => {
            return { success: service.deleteShare(shareId) };
        }
    ));

    ipcMain.handle('chat:share-list', createIpcHandler('chat:share-list',
        async () => {
            return service.listShares();
        }
    ));
}
