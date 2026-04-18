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
 * Chat Export IPC Handlers
 * Exposes chat export functionality with format selection to the renderer.
 */

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { ChatExportResult, ChatExportService } from '@main/services/data/chat-export.service';
import { ExportFormat } from '@main/services/data/export.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

/**
 * Registers IPC handlers for chat export operations.
 * @param getMainWindow - Getter for the main BrowserWindow.
 * @param chatExportService - The chat export service instance.
 */
export function registerChatExportIpc(
    getMainWindow: () => BrowserWindow | null,
    chatExportService: ChatExportService
): void {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'chat export');

    ipcMain.handle('chat:export', createIpcHandler(
        'chat:export',
        async (
            event: IpcMainInvokeEvent,
            chatId: string,
            format: ExportFormat
        ): Promise<ChatExportResult> => {
            validateSender(event);
            if (!chatId || typeof chatId !== 'string') {
                throw new Error('chatId must be a non-empty string');
            }
            const validFormats: ExportFormat[] = ['markdown', 'html', 'json', 'txt'];
            if (!validFormats.includes(format)) {
                throw new Error(`Invalid format: ${format}`);
            }
            return chatExportService.exportChat(chatId, format);
        }
    ));

    ipcMain.handle('chat:export-to-file', createIpcHandler(
        'chat:export-to-file',
        async (
            event: IpcMainInvokeEvent,
            chatId: string,
            format: ExportFormat
        ): Promise<{ success: boolean; path?: string; error?: string }> => {
            validateSender(event);
            if (!chatId || typeof chatId !== 'string') {
                throw new Error('chatId must be a non-empty string');
            }
            return chatExportService.exportChatToFile(chatId, format);
        }
    ));
}
