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
 * Shared Prompts IPC Handlers
 * Exposes shared prompt library functionality to the renderer process.
 */

import { SharedPromptFilter, SharedPromptInput, SharedPromptsService } from '@main/services/data/shared-prompts.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain, IpcMainInvokeEvent } from 'electron';

/**
 * Registers IPC handlers for shared prompt library operations.
 * @param service - The SharedPromptsService instance.
 */
export function registerSharedPromptsIpc(service: SharedPromptsService): void {
    ipcMain.handle('prompts:shared-list', createIpcHandler('prompts:shared-list',
        async (_event: IpcMainInvokeEvent, filter?: SharedPromptFilter) => {
            return service.list(filter);
        }
    ));

    ipcMain.handle('prompts:shared-create', createIpcHandler('prompts:shared-create',
        async (_event: IpcMainInvokeEvent, input: SharedPromptInput) => {
            return service.create(input);
        }
    ));

    ipcMain.handle('prompts:shared-update', createIpcHandler('prompts:shared-update',
        async (_event: IpcMainInvokeEvent, id: string, input: Partial<SharedPromptInput>) => {
            return service.update(id, input);
        }
    ));

    ipcMain.handle('prompts:shared-delete', createIpcHandler('prompts:shared-delete',
        async (_event: IpcMainInvokeEvent, id: string) => {
            return service.delete(id);
        }
    ));

    ipcMain.handle('prompts:shared-export', createIpcHandler('prompts:shared-export',
        async (_event: IpcMainInvokeEvent, filePath?: string) => {
            if (filePath) {
                await service.exportToFile(filePath);
                return { success: true, path: filePath };
            }
            return { success: true, data: await service.exportToJson() };
        }
    ));

    ipcMain.handle('prompts:shared-import', createIpcHandler('prompts:shared-import',
        async (_event: IpcMainInvokeEvent, filePathOrJson: string, isFilePath?: boolean) => {
            const count = isFilePath
                ? await service.importFromFile(filePathOrJson)
                : await service.importFromJson(filePathOrJson);
            return { success: true, imported: count };
        }
    ));
}
