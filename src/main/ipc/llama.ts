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
import { LlamaService } from '@main/services/llm/llama.service';
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withOperationGuard } from '@main/utils/operation-wrapper.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

/** Maximum model path length */
const MAX_PATH_LENGTH = 4096;
/** Maximum message length (100KB) */
const MAX_MESSAGE_LENGTH = 100 * 1024;
/** Maximum system prompt length (50KB) */
const MAX_SYSTEM_PROMPT_LENGTH = 50 * 1024;
/** Maximum URL length */
const MAX_URL_LENGTH = 2048;

/**
 * Validates a path string
 */
function validatePath(value: RuntimeValue, maxLength: number = MAX_PATH_LENGTH): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > maxLength) {
        return null;
    }
    return trimmed;
}

/**
 * Validates a message string
 */
function validateMessage(value: RuntimeValue): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    if (value.length > MAX_MESSAGE_LENGTH) {
        return null;
    }
    return value;
}

/**
 * Validates an optional system prompt
 */
function validateSystemPrompt(value: RuntimeValue): string | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== 'string') {
        return undefined;
    }
    if (value.length > MAX_SYSTEM_PROMPT_LENGTH) {
        return value.slice(0, MAX_SYSTEM_PROMPT_LENGTH);
    }
    return value;
}

void MAX_URL_LENGTH;

/**
 * Registers IPC handlers for Llama model operations
 */
export function registerLlamaIpc(getMainWindow: () => BrowserWindow | null, llamaService: LlamaService): void {
    appLogger.debug('LlamaIPC', 'Registering Llama IPC handlers');
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'llama operation');



    ipcMain.handle(
        'llama:chat',
        createSafeIpcHandler(
            'llama:chat',
            async (event: IpcMainInvokeEvent, messageRaw: RuntimeValue, systemPromptRaw?: RuntimeValue) => {
                validateSender(event);
                const message = validateMessage(messageRaw);
                if (!message) {
                    throw new Error('Invalid or empty message');
                }
                const systemPrompt = validateSystemPrompt(systemPromptRaw);

                const response = await withOperationGuard('llama', async () =>
                    llamaService.chat(message, systemPrompt)
                );
                return { success: true, response };
            },
            { success: false, response: { success: false } }
        )
    );




    ipcMain.handle(
        'llama:deleteModel',
        createIpcHandler(
            'llama:deleteModel',
            async (event: IpcMainInvokeEvent, modelPathRaw: RuntimeValue) => {
                validateSender(event);
                const modelPath = validatePath(modelPathRaw);
                if (!modelPath) {
                    throw new Error('Invalid model path');
                }
                return await llamaService.deleteModel(modelPath);
            }
        )
    );




}
