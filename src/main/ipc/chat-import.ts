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
 * Chat Import IPC Handlers
 * Exposes chat import functionality for external AI tool formats.
 */

import { ChatImportService } from '@main/services/data/chat-import.service';
import { BrowserWindow } from 'electron';

/**
 * Registers IPC handlers for chat import operations.
 * @param getMainWindow - Getter for the main BrowserWindow.
 * @param chatImportService - The chat import service instance.
 */
export function registerChatImportIpc(
    getMainWindow: () => BrowserWindow | null,
    chatImportService: ChatImportService
): void {
    void getMainWindow;
    void chatImportService;
}
