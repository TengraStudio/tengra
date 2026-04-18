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
import { LLMService } from '@main/services/llm/llm.service';
import { LocalAIService } from '@main/services/llm/local-ai.service';
import { OllamaService } from '@main/services/llm/ollama.service';
import { OllamaHealthService } from '@main/services/llm/ollama-health.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { SettingsService } from '@main/services/system/settings.service';
import { createSafeIpcHandler, createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { SESSION_CONVERSATION_CHANNELS } from '@shared/constants/ipc-channels';
import { JsonValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';

/** Maximum model name length */
const MAX_MODEL_LENGTH = 256;
const OLLAMA_MESSAGE_KEY = {
    SERVICE_UNAVAILABLE: 'images.ollamaMessages.serviceUnavailable',
} as const;

interface ModelDefinition {
    id: string;
    name: string;
    provider: string;
    digest?: string;
    size?: number;
    modified_at?: string;
    path?: string;
    loaded?: boolean;
    object?: string;
    owned_by?: string;
    percentage?: number;
    reset?: string;
    permission?: JsonValue[];
    quotaInfo?: Record<string, JsonValue>;
    [key: string]: JsonValue | undefined;
}

/**
 * Validates a model name
 */
function validateModel(value: RuntimeValue): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_MODEL_LENGTH) {
        return null;
    }
    return trimmed;
}

type MessageRole = 'system' | 'user' | 'assistant';

/**
 * Validates a messages array
 */
function validateMessages(value: RuntimeValue): Array<{ role: MessageRole; content: string }> {
    if (!Array.isArray(value)) {
        return [];
    }
    const validRoles: MessageRole[] = ['system', 'user', 'assistant'];
    return value.filter((msg): msg is { role: MessageRole; content: string } =>
        msg && typeof msg === 'object' &&
        typeof msg.role === 'string' &&
        validRoles.includes(msg.role as MessageRole) &&
        typeof msg.content === 'string'
    );
}

/**
 * Registers IPC handlers for Ollama operations
 */
export function registerOllamaIpc(options: {
    getMainWindow: () => BrowserWindow | null
    localAIService: LocalAIService
    settingsService: SettingsService
    llmService: LLMService
    ollamaService?: OllamaService
    ollamaHealthService?: OllamaHealthService
    proxyService?: ProxyService
}) {
    appLogger.info('OllamaIPC', 'Registering Ollama IPC handlers');
    const { localAIService, ollamaService, ollamaHealthService } = options;
    const validateSender = createMainWindowSenderValidator(options.getMainWindow, 'ollama operation');

    ipcMain.handle('ollama:tags', createSafeIpcHandler('ollama:tags',
        async (event) => { validateSender(event); return []; }, []
    )); // Moved to ModelRegistryService via Rust

    // deleted unused functions
    ipcMain.handle('ollama:getModels', createSafeIpcHandler('ollama:getModels',
        async (event): Promise<ModelDefinition[]> => {
            validateSender(event);
            return []; // Moved to ModelRegistryService via Rust
        }, []
    ));

    // Use health service for isRunning check
    ipcMain.handle('ollama:isRunning', createSafeIpcHandler('ollama:isRunning',
        async (event) => {
            validateSender(event);
            if (ollamaHealthService) {
                const status = ollamaHealthService.getStatus();
                return status.online;
            }
            return true; // Fallback
        }, false
    ));

    // Get detailed health status
    ipcMain.handle('ollama:healthStatus', createSafeIpcHandler('ollama:healthStatus',
        async (event) => {
            validateSender(event);
            if (ollamaHealthService) {
                return ollamaHealthService.getStatus();
            }
            return { online: true, lastCheck: new Date() };
        }, { online: false, lastCheck: new Date() }
    ));

    // Force health check
    ipcMain.handle('ollama:forceHealthCheck', createSafeIpcHandler('ollama:forceHealthCheck',
        async (event) => {
            validateSender(event);
            if (ollamaHealthService) {
                return await ollamaHealthService.forceCheck();
            }
            return { online: true, lastCheck: new Date() };
        }, { online: false, lastCheck: new Date() }
    ));

    // GPU Check
    ipcMain.handle('ollama:checkCuda', createSafeIpcHandler('ollama:checkCuda',
        async (event) => { validateSender(event); return localAIService.checkCudaSupport(); },
        { hasCuda: false }
    ));

    // Forward health events to renderer
    if (ollamaHealthService) {
        ollamaHealthService.on('statusChange', (status) => {
            const windows = BrowserWindow.getAllWindows();
            windows.forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send('ollama:statusChange', status);
                }
            });
        });
    }

    ipcMain.handle('ollama:chat', createSafeIpcHandler('ollama:chat',
        async (event: IpcMainInvokeEvent, messagesRaw: RuntimeValue, modelRaw: RuntimeValue) => {
            validateSender(event);
            const messages = validateMessages(messagesRaw);
            const model = validateModel(modelRaw);
            if (!model || messages.length === 0) {
                throw new Error('Invalid model or messages');
            }
            if (ollamaService) {
                // Use robust OllamaService with abort support
                return await ollamaService.chat(messages, model);
            } else {
                // Fallback to simple LocalAIService
                return await localAIService.ollamaChat(model, messages);
            }
        }, { message: { content: '', role: 'assistant' } }
    ));

    ipcMain.handle('ollama:chatStream', createSafeIpcHandler('ollama:chatStream',
        async (event: IpcMainInvokeEvent, messagesRaw: RuntimeValue, modelRaw: RuntimeValue) => {
            validateSender(event);
            const messages = validateMessages(messagesRaw);
            const model = validateModel(modelRaw);
            if (!model || messages.length === 0) {
                throw new Error('Invalid model or messages');
            }
            try {
                if (ollamaService) {
                    // Use robust OllamaService with true streaming and abort support
                    const response = await ollamaService.chatStream(
                        messages,
                        model,
                        undefined, // tools
                        (chunk) => {
                            event.sender.send(SESSION_CONVERSATION_CHANNELS.STREAM_CHUNK, { content: chunk, reasoning: '' });
                        }
                    );
                    return { content: response.content, role: 'assistant' };
                } else {
                    // Fallback to LocalAIService (fake streaming)
                    const res = await localAIService.ollamaChat(model, messages);
                    if (res.message.content) {
                        event.sender.send(SESSION_CONVERSATION_CHANNELS.STREAM_CHUNK, { content: res.message.content, reasoning: '' });
                    }
                    return { content: res.message.content, role: 'assistant' };
                }
            } catch (err) {
                const message = getErrorMessage(err as Error);
                appLogger.error('OllamaIPC', 'Chat Error', err as Error);
                return { error: message };
            }
        }, { error: 'Service unavailable' }
    ));

    ipcMain.handle('ollama:abort', createSafeIpcHandler('ollama:abort',
        async (event) => {
            validateSender(event);
            if (ollamaService) {
                ollamaService.abort();
                return { success: true };
            }
            return { success: false };
        }, { success: false }
    ));

    ipcMain.handle('ollama:pull', createSafeIpcHandler('ollama:pull',
        async (event: IpcMainInvokeEvent, modelNameRaw: RuntimeValue) => {
            validateSender(event);
            const modelName = validateModel(modelNameRaw);
            if (!modelName) {
                throw new Error('Invalid model name');
            }
            if (!ollamaService) {
                throw new Error('Ollama service unavailable');
            }

            const result = await ollamaService.pullModel(modelName, (progress: { status: string; completed?: number; total?: number }) => {
                const windows = BrowserWindow.getAllWindows();
                windows.forEach(win => {
                    if (!win.isDestroyed()) {
                        win.webContents.send('ollama:pullProgress', {
                            ...progress,
                            modelName
                        });
                    }
                });
            });

            return result;
        }, { success: false, error: 'Service unavailable' }
    ));

    ipcMain.handle('ollama:abortPull', createSafeIpcHandler('ollama:abortPull',
        async (event) => {
            validateSender(event);
            if (ollamaService) {
                ollamaService.abort();
                return { success: true };
            }
            return { success: false };
        }, { success: false }
    ));

    ipcMain.handle('ollama:getLibraryModels', createSafeIpcHandler('ollama:getLibraryModels',
        async (event) => {
            validateSender(event);
            if (ollamaService) {
                return await ollamaService.getLibraryModels();
            }
            return [];
        }, []
    ));

    ipcMain.handle('ollama:start', createSafeIpcHandler('ollama:start',
        async (event) => {
            validateSender(event);
            const { startOllama } = await import('@main/startup/ollama');
            // Get primary window
            const win = BrowserWindow.getAllWindows()[0];
            const getWin = () => win as (BrowserWindow | null);
            return await startOllama(getWin, true);
        }, { success: false, message: 'Service unavailable', messageKey: OLLAMA_MESSAGE_KEY.SERVICE_UNAVAILABLE }
    ));

    // ========================================
    // OLLAMA-01: Model Health & Recommendations
    // ========================================

    ipcMain.handle('ollama:checkModelHealth', createValidatedIpcHandler('ollama:checkModelHealth',
        async (event: IpcMainInvokeEvent, modelName: string) => {
            validateSender(event);
            if (!ollamaService) {
                throw new Error('Ollama service unavailable');
            }
            return await ollamaService.checkModelHealth(modelName);
        }, {
        argsSchema: z.tuple([z.string().trim().min(1).max(MAX_MODEL_LENGTH)]),
        responseSchema: z.object({
            name: z.string(),
            isHealthy: z.boolean(),
            lastChecked: z.date(),
            responseTimeMs: z.number(),
            error: z.string().optional(),
            size: z.number(),
            digest: z.string()
        })
    }
    ));

    ipcMain.handle('ollama:checkAllModelsHealth', createSafeIpcHandler('ollama:checkAllModelsHealth',
        async (event) => {
            validateSender(event);
            if (!ollamaService) {
                throw new Error('Ollama service unavailable');
            }
            return await ollamaService.checkAllModelsHealth();
        }, []
    ));

    ipcMain.handle('ollama:getModelRecommendations', createSafeIpcHandler('ollama:getModelRecommendations',
        async (event: IpcMainInvokeEvent, categoryRaw: RuntimeValue) => {
            validateSender(event);
            if (!ollamaService) {
                throw new Error('Ollama service unavailable');
            }
            const category = typeof categoryRaw === 'string'
                ? categoryRaw as 'coding' | 'creative' | 'reasoning' | 'general' | 'multimodal'
                : undefined;
            return await ollamaService.getModelRecommendations(category);
        }, []
    ));

    ipcMain.handle('ollama:getRecommendedModelForTask', createSafeIpcHandler('ollama:getRecommendedModelForTask',
        async (event: IpcMainInvokeEvent, taskRaw: RuntimeValue) => {
            validateSender(event);
            if (!ollamaService) {
                throw new Error('Ollama service unavailable');
            }
            const task = typeof taskRaw === 'string' ? taskRaw : '';
            return await ollamaService.getRecommendedModelForTask(task);
        }, null
    ));

    // ========================================
    // OLLAMA-02: Connection Handling
    // ========================================

    ipcMain.handle('ollama:getConnectionStatus', createSafeIpcHandler('ollama:getConnectionStatus',
        async (event) => {
            validateSender(event);
            if (!ollamaService) {
                throw new Error('Ollama service unavailable');
            }
            return await ollamaService.getConnectionStatus();
        }, {
        isConnected: false,
        host: '127.0.0.1',
        port: 11434,
        latency: 0,
        lastChecked: new Date(),
        reconnectAttempts: 0,
        poolSize: 0,
        activeConnections: 0
    }
    ));

    ipcMain.handle('ollama:testConnection', createSafeIpcHandler('ollama:testConnection',
        async (event) => {
            validateSender(event);
            if (!ollamaService) {
                throw new Error('Ollama service unavailable');
            }
            return await ollamaService.testConnection();
        }, { success: false, latency: 0, error: 'Service unavailable' }
    ));

    ipcMain.handle('ollama:reconnect', createSafeIpcHandler('ollama:reconnect',
        async (event) => {
            validateSender(event);
            if (!ollamaService) {
                throw new Error('Ollama service unavailable');
            }
            return await ollamaService.reconnect();
        }, false
    ));

    // ========================================
    // OLLAMA-03: GPU Monitoring
    // ========================================

    ipcMain.handle('ollama:getGPUInfo', createSafeIpcHandler('ollama:getGPUInfo',
        async (event) => {
            validateSender(event);
            if (!ollamaService) {
                throw new Error('Ollama service unavailable');
            }
            return await ollamaService.getGPUInfo();
        }, {
        available: false,
        gpus: [],
        lastChecked: new Date(),
        warnings: ['Service unavailable']
    }
    ));

    ipcMain.handle('ollama:startGPUMonitoring', createValidatedIpcHandler('ollama:startGPUMonitoring',
        async (event: IpcMainInvokeEvent, intervalMs: number = 10000) => {
            validateSender(event);
            if (!ollamaService) {
                throw new Error('Ollama service unavailable');
            }
            ollamaService.startGPUMonitoring(intervalMs);
            return { success: true, intervalMs };
        }, {
        argsSchema: z.tuple([z.number().int().min(1000).max(60000).optional()]),
        responseSchema: z.object({ success: z.boolean(), intervalMs: z.number().int() })
    }
    ));

    ipcMain.handle('ollama:stopGPUMonitoring', createSafeIpcHandler('ollama:stopGPUMonitoring',
        async (event) => {
            validateSender(event);
            if (!ollamaService) {
                throw new Error('Ollama service unavailable');
            }
            ollamaService.stopGPUMonitoring();
            return { success: true };
        }, { success: false }
    ));

    ipcMain.handle('ollama:setGPUAlertThresholds', createValidatedIpcHandler('ollama:setGPUAlertThresholds',
        async (event: IpcMainInvokeEvent, thresholds: {
            highMemoryPercent?: number;
            highTemperatureC?: number;
            lowMemoryMB?: number;
        }) => {
            validateSender(event);
            if (!ollamaService) {
                throw new Error('Ollama service unavailable');
            }
            ollamaService.setGPUAlertThresholds(thresholds);
            return { success: true };
        }, {
        argsSchema: z.tuple([z.object({
            highMemoryPercent: z.number().min(1).max(100).optional(),
            highTemperatureC: z.number().min(20).max(120).optional(),
            lowMemoryMB: z.number().min(1).max(1024 * 256).optional()
        }).default({})]),
        responseSchema: z.object({ success: z.boolean() })
    }
    ));

    ipcMain.handle('ollama:getGPUAlertThresholds', createSafeIpcHandler('ollama:getGPUAlertThresholds',
        async (event) => {
            validateSender(event);
            if (!ollamaService) {
                throw new Error('Ollama service unavailable');
            }
            return ollamaService.getGPUAlertThresholds();
        }, { highMemoryPercent: 90, highTemperatureC: 85, lowMemoryMB: 500 }
    ));

    // Forward GPU alerts to renderer
    if (ollamaService) {
        ollamaService.onGPUAlert((alert) => {
            const windows = BrowserWindow.getAllWindows();
            windows.forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send('ollama:gpuAlert', alert);
                }
            });
        });

        ollamaService.onGPUStatus((status) => {
            const windows = BrowserWindow.getAllWindows();
            windows.forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send('ollama:gpuStatus', status);
                }
            });
        });
    }

    ipcMain.handle('ollama:deleteModel', createSafeIpcHandler('ollama:deleteModel',
        async (event: IpcMainInvokeEvent, modelNameRaw: RuntimeValue) => {
            validateSender(event);
            const modelName = validateModel(modelNameRaw);
            if (!modelName) {
                throw new Error('Invalid model name');
            }
            if (ollamaService) {
                return await ollamaService.deleteModel(modelName);
            }
            return { success: false, error: 'Ollama service unavailable' };
        }, { success: false, error: 'delete failed' }
    ));
}
