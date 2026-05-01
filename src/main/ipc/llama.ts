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

/**
 * Registers IPC handlers for Llama model operations
 */
export function registerLlamaIpc(getMainWindow: () => BrowserWindow | null, llamaService: LlamaService): void {
    appLogger.debug('LlamaIPC', 'Registering Llama IPC handlers');
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'llama operation');

    ipcMain.handle(
        'llama:loadModel',
        createIpcHandler(
            'llama:loadModel',
            async (event: IpcMainInvokeEvent, modelPathRaw: RuntimeValue, configRaw?: RuntimeValue) => {
                validateSender(event);
                const modelPath = validatePath(modelPathRaw);
                if (!modelPath) {
                    throw new Error('Invalid model path');
                }
                const config = (configRaw && typeof configRaw === 'object') ? configRaw : {};
                return await llamaService.loadModel(modelPath, config);
            }
        )
    );

    ipcMain.handle(
        'llama:unloadModel',
        createSafeIpcHandler(
            'llama:unloadModel',
            async (event: IpcMainInvokeEvent) => {
                validateSender(event);
                await llamaService.stopServer();
                return { success: true };
            },
            { success: false }
        )
    );

    ipcMain.handle(
        'llama:chat',
        createSafeIpcHandler(
            'llama:chat',
            async (event: IpcMainInvokeEvent, messageRaw: RuntimeValue, systemPromptRaw?: RuntimeValue) => {
                validateSender(event);
                const message = validateMessage(messageRaw);
                if (!message) {
                    return { success: false, response: { success: false } };
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
        'llama:resetSession',
        createSafeIpcHandler(
            'llama:resetSession',
            async (event: IpcMainInvokeEvent) => {
                validateSender(event);
                await llamaService.resetSession();
                return { success: true };
            },
            { success: false }
        )
    );

    ipcMain.handle(
        'llama:getModelsDir',
        createSafeIpcHandler(
            'llama:getModelsDir',
            async (event: IpcMainInvokeEvent) => {
                validateSender(event);
                try {
                    return await llamaService.getModelsDir();
                } catch (e) {
                    return '';
                }
            },
            ''
        )
    );

    ipcMain.handle(
        'llama:setModelsDir',
        createSafeIpcHandler(
            'llama:setModelsDir',
            async (event: IpcMainInvokeEvent, dirRaw: RuntimeValue) => {
                validateSender(event);
                const dir = validatePath(dirRaw);
                if (!dir) {
                    throw new Error('Invalid directory path');
                }
                return await llamaService.setModelsDir(dir);
            },
            false
        )
    );

    ipcMain.handle(
        'llama:getModels',
        createSafeIpcHandler(
            'llama:getModels',
            async (event: IpcMainInvokeEvent) => {
                validateSender(event);
                return await llamaService.getModels();
            },
            []
        )
    );

    ipcMain.handle(
        'llama:downloadModel',
        createIpcHandler(
            'llama:downloadModel',
            async (event: IpcMainInvokeEvent, urlRaw: RuntimeValue, filenameRaw: RuntimeValue) => {
                validateSender(event);
                const url = typeof urlRaw === 'string' ? urlRaw : '';
                const filename = typeof filenameRaw === 'string' ? filenameRaw : '';
                
                if (!url || !filename || !url.startsWith('http') || filename.length > 255) {
                    throw new Error('Invalid URL or filename');
                }
                
                return await llamaService.downloadModel(url, filename);
            }
        )
    );

    ipcMain.handle(
        'llama:abortDownload',
        createSafeIpcHandler(
            'llama:abortDownload',
            async (event: IpcMainInvokeEvent, modelIdRaw: RuntimeValue) => {
                validateSender(event);
                if (typeof modelIdRaw !== 'string') {
                    throw new Error('Invalid model ID');
                }
                return await llamaService.abortDownload(modelIdRaw);
            },
            false
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

    ipcMain.handle(
        'llama:getConfig',
        createSafeIpcHandler(
            'llama:getConfig',
            async (event: IpcMainInvokeEvent) => {
                validateSender(event);
                try {
                    return llamaService.getConfig();
                } catch (e) {
                    return {};
                }
            },
            {}
        )
    );

    ipcMain.handle(
        'llama:setConfig',
        createSafeIpcHandler(
            'llama:setConfig',
            async (event: IpcMainInvokeEvent, configRaw: RuntimeValue) => {
                validateSender(event);
                const config = (configRaw && typeof configRaw === 'object') ? configRaw : {};
                try {
                    llamaService.setConfig(config);
                    return { success: true };
                } catch (e) {
                    return { success: false };
                }
            },
            { success: false }
        )
    );

    ipcMain.handle(
        'llama:getGpuInfo',
        createSafeIpcHandler(
            'llama:getGpuInfo',
            async (event: IpcMainInvokeEvent) => {
                validateSender(event);
                return await llamaService.getGpuInfo();
            },
            null
        )
    );
}
