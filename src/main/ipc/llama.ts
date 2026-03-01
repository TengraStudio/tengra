import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { LlamaService } from '@main/services/llm/llama.service';
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import { IpcValue } from '@shared/types/common';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

/** Maximum model path length */
const MAX_PATH_LENGTH = 4096;
/** Maximum message length (100KB) */
const MAX_MESSAGE_LENGTH = 100 * 1024;
/** Maximum system prompt length (50KB) */
const MAX_SYSTEM_PROMPT_LENGTH = 50 * 1024;
/** Maximum URL length */
const MAX_URL_LENGTH = 2048;
/** Maximum filename length */
const MAX_FILENAME_LENGTH = 255;

/**
 * Validates a path string
 */
function validatePath(value: unknown, maxLength: number = MAX_PATH_LENGTH): string | null {
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
function validateMessage(value: unknown): string | null {
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
function validateSystemPrompt(value: unknown): string | undefined {
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
 * Validates a URL
 */
function validateUrl(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
        return null;
    }
    // Basic URL validation
    try {
        new URL(trimmed);
        return trimmed;
    } catch {
        return null;
    }
}

/**
 * Validates a config object
 */
function validateConfig(value: unknown): Record<string, IpcValue> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, IpcValue>;
}

/**
 * Registers IPC handlers for Llama model operations
 */
export function registerLlamaIpc(getMainWindow: () => BrowserWindow | null, llamaService: LlamaService): void {
    appLogger.info('LlamaIPC', 'Registering Llama IPC handlers');
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'llama operation');

    ipcMain.handle(
        'llama:loadModel',
        createIpcHandler(
            'llama:loadModel',
            async (event: IpcMainInvokeEvent, modelPathRaw: unknown, configRaw: unknown) => {
                validateSender(event);
                const modelPath = validatePath(modelPathRaw);
                if (!modelPath) {
                    throw new Error('Invalid model path');
                }
                const config = validateConfig(configRaw);
                appLogger.info('LlamaIPC', `Loading model from ${modelPath}`);
                return await llamaService.loadModel(modelPath, config);
            }
        )
    );

    ipcMain.handle(
        'llama:unloadModel',
        createSafeIpcHandler(
            'llama:unloadModel',
            async (event) => {
                validateSender(event);
                appLogger.info('LlamaIPC', 'Unloading model');
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
            async (event: IpcMainInvokeEvent, messageRaw: unknown, systemPromptRaw?: unknown) => {
                validateSender(event);
                const message = validateMessage(messageRaw);
                if (!message) {
                    throw new Error('Invalid or empty message');
                }
                const systemPrompt = validateSystemPrompt(systemPromptRaw);

                const response = await withRateLimit('llama', async () =>
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
            async (event) => {
                validateSender(event);
                await llamaService.resetSession();
                return { success: true };
            },
            { success: false }
        )
    );

    ipcMain.handle(
        'llama:getModels',
        createSafeIpcHandler(
            'llama:getModels',
            async (event) => {
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
            async (event: IpcMainInvokeEvent, urlRaw: unknown, filenameRaw: unknown) => {
                validateSender(event);
                const url = validateUrl(urlRaw);
                const filename = validatePath(filenameRaw, MAX_FILENAME_LENGTH);
                if (!url || !filename) {
                    throw new Error('Invalid URL or filename');
                }
                appLogger.info('LlamaIPC', `Downloading model to ${filename}`);
                return await llamaService.downloadModel(url, filename);
            }
        )
    );

    ipcMain.handle(
        'llama:deleteModel',
        createIpcHandler(
            'llama:deleteModel',
            async (event: IpcMainInvokeEvent, modelPathRaw: unknown) => {
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
            async (event) => {
                validateSender(event);
                return llamaService.getConfig();
            },
            {}
        )
    );

    ipcMain.handle(
        'llama:setConfig',
        createSafeIpcHandler(
            'llama:setConfig',
            async (event: IpcMainInvokeEvent, configRaw: unknown) => {
                validateSender(event);
                const config = validateConfig(configRaw);
                llamaService.setConfig(config);
                return { success: true };
            },
            { success: false }
        )
    );

    ipcMain.handle(
        'llama:getGpuInfo',
        createSafeIpcHandler(
            'llama:getGpuInfo',
            async (event) => {
                validateSender(event);
                return await llamaService.getGpuInfo();
            },
            null
        )
    );

    ipcMain.handle(
        'llama:getModelsDir',
        createSafeIpcHandler(
            'llama:getModelsDir',
            async (event) => {
                validateSender(event);
                return llamaService.getModelsDir();
            },
            ''
        )
    );
}
