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

/**
 * Registers IPC handlers for chat share operations.
 * @param service - The ChatShareService instance.
 */
export function registerChatShareIpc(service: ChatShareService): void {
    void service;
}
