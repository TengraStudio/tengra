import { appLogger } from '@main/logging/logger';
import { LLMService } from '@main/services/llm/llm.service';
import { LocalAIService } from '@main/services/llm/local-ai.service';
import { OllamaService } from '@main/services/llm/ollama.service';
import { OllamaHealthService } from '@main/services/llm/ollama-health.service';
import { OllamaScraperService } from '@main/services/llm/ollama-scraper.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { RateLimitService } from '@main/services/security/rate-limit.service';
import { SettingsService } from '@main/services/system/settings.service';
import { createSafeIpcHandler, createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { JsonValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';

/** Maximum model name length */
const MAX_MODEL_LENGTH = 256;

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
function validateModel(value: unknown): string | null {
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
function validateMessages(value: unknown): Array<{ role: MessageRole; content: string }> {
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
    localAIService: LocalAIService
    settingsService: SettingsService
    llmService: LLMService
    ollamaService?: OllamaService
    ollamaHealthService?: OllamaHealthService
    ollamaScraperService?: OllamaScraperService
    proxyService?: ProxyService
    rateLimitService?: RateLimitService
}) {
    appLogger.info('OllamaIPC', 'Registering Ollama IPC handlers');
    const { localAIService, ollamaService, ollamaHealthService, ollamaScraperService, rateLimitService } = options;

    ipcMain.handle('ollama:tags', createSafeIpcHandler('ollama:tags',
        async () => [], []
    )); // Moved to ModelRegistryService via Rust

    // deleted unused functions
    ipcMain.handle('ollama:getModels', createSafeIpcHandler('ollama:getModels',
        async (): Promise<ModelDefinition[]> => {
            return []; // Moved to ModelRegistryService via Rust
        }, []
    ));

    // Use health service for isRunning check
    ipcMain.handle('ollama:isRunning', createSafeIpcHandler('ollama:isRunning',
        async () => {
            if (ollamaHealthService) {
                const status = ollamaHealthService.getStatus();
                return status.online;
            }
            return true; // Fallback
        }, false
    ));

    // Get detailed health status
    ipcMain.handle('ollama:healthStatus', createSafeIpcHandler('ollama:healthStatus',
        async () => {
            if (ollamaHealthService) {
                return ollamaHealthService.getStatus();
            }
            return { online: true, lastCheck: new Date() };
        }, { online: false, lastCheck: new Date() }
    ));

    // Force health check
    ipcMain.handle('ollama:forceHealthCheck', createSafeIpcHandler('ollama:forceHealthCheck',
        async () => {
            if (ollamaHealthService) {
                return await ollamaHealthService.forceCheck();
            }
            return { online: true, lastCheck: new Date() };
        }, { online: false, lastCheck: new Date() }
    ));

    // GPU Check
    ipcMain.handle('ollama:checkCuda', createSafeIpcHandler('ollama:checkCuda',
        async () => localAIService.checkCudaSupport(),
        { hasCuda: false }
    ));

    // Forward health events to renderer
    if (ollamaHealthService) {
        ollamaHealthService.on('statusChange', (status) => {
            const windows = BrowserWindow.getAllWindows();
            windows.forEach(win => {
                win.webContents.send('ollama:statusChange', status);
            });
        });
    }

    ipcMain.handle('ollama:chat', createSafeIpcHandler('ollama:chat',
        async (_event: IpcMainInvokeEvent, messagesRaw: unknown, modelRaw: unknown) => {
            const messages = validateMessages(messagesRaw);
            const model = validateModel(modelRaw);
            if (!model || messages.length === 0) {
                throw new Error('Invalid model or messages');
            }
            // SEC-011: Rate limit LLM chat calls
            if (rateLimitService) {
                await rateLimitService.waitForToken('ollama:chat');
            }
            return await localAIService.ollamaChat(model, messages);
        }, { message: { content: '', role: 'assistant' } }
    ));

    ipcMain.handle('ollama:chatStream', createSafeIpcHandler('ollama:chatStream',
        async (event: IpcMainInvokeEvent, messagesRaw: unknown, modelRaw: unknown) => {
            const messages = validateMessages(messagesRaw);
            const model = validateModel(modelRaw);
            if (!model || messages.length === 0) {
                throw new Error('Invalid model or messages');
            }
            // SEC-011: Rate limit LLM chat stream calls
            if (rateLimitService) {
                await rateLimitService.waitForToken('ollama:chat');
            }
            try {
                const res = await localAIService.ollamaChat(model, messages);
                if (res.message.content) {
                    event.sender.send('ollama:streamChunk', { content: res.message.content, reasoning: '' });
                }
                return { content: res.message.content, role: 'assistant' };
            } catch (err) {
                const message = getErrorMessage(err as Error);
                appLogger.error('OllamaIPC', 'Chat Error', err as Error);
                return { error: message };
            }
        }, { error: 'Service unavailable' }
    ));

    ipcMain.handle('ollama:pull', createSafeIpcHandler('ollama:pull',
        async (_event: IpcMainInvokeEvent, modelNameRaw: unknown) => {
            const modelName = validateModel(modelNameRaw);
            if (!modelName) {
                throw new Error('Invalid model name');
            }
            if (rateLimitService) {
                await rateLimitService.waitForToken('ollama:operation');
            }
            if (!ollamaService) {
                throw new Error('Ollama service unavailable');
            }

            const result = await ollamaService.pullModel(modelName, (progress: { status: string; completed?: number; total?: number }) => {
                const windows = BrowserWindow.getAllWindows();
                windows.forEach(win => {
                    win.webContents.send('ollama:pullProgress', {
                        ...progress,
                        modelName
                    });
                });
            });

            return result;
        }, { success: false, error: 'Service unavailable' }
    ));

    ipcMain.handle('ollama:abortPull', createSafeIpcHandler('ollama:abortPull',
        async () => {
            if (ollamaService) {
                ollamaService.abort();
                return { success: true };
            }
            return { success: false };
        }, { success: false }
    ));

    ipcMain.handle('ollama:getLibraryModels', createSafeIpcHandler('ollama:getLibraryModels',
        async () => {
            // SEC-011: Rate limit model listing operations
            if (rateLimitService) {
                await rateLimitService.waitForToken('ollama:operation');
            }
            if (ollamaService) {
                return await ollamaService.getLibraryModels();
            }
            return [];
        }, []
    ));

    ipcMain.handle('ollama:start', createSafeIpcHandler('ollama:start',
        async () => {
            const { startOllama } = await import('@main/startup/ollama');
            // Get primary window
            const win = BrowserWindow.getAllWindows()[0];
            const getWin = () => win as (BrowserWindow | null);
            return await startOllama(getWin, true);
        }, { success: false, message: 'Service unavailable' }
    ));

    // Scraper endpoints for marketplace
    ipcMain.handle('ollama:scrapeLibrary', createSafeIpcHandler('ollama:scrapeLibrary',
        async (_event: IpcMainInvokeEvent, bypassCacheRaw: unknown) => {
            if (!ollamaScraperService) {
                return [];
            }
            const bypassCache = bypassCacheRaw === true;
            if (rateLimitService) {
                await rateLimitService.waitForToken('ollama:operation');
            }
            return await ollamaScraperService.getLibraryModels(bypassCache);
        }, []
    ));

    ipcMain.handle('ollama:scrapeModelDetails', createSafeIpcHandler('ollama:scrapeModelDetails',
        async (_event: IpcMainInvokeEvent, modelNameRaw: unknown, bypassCacheRaw: unknown) => {
            if (!ollamaScraperService) {
                return null;
            }
            const modelName = validateModel(modelNameRaw);
            if (!modelName) {
                throw new Error('Invalid model name');
            }
            const bypassCache = bypassCacheRaw === true;
            if (rateLimitService) {
                await rateLimitService.waitForToken('ollama:operation');
            }
            return await ollamaScraperService.getModelDetails(modelName, bypassCache);
        }, null
    ));

    ipcMain.handle('ollama:clearScraperCache', createSafeIpcHandler('ollama:clearScraperCache',
        async () => {
            if (ollamaScraperService) {
                ollamaScraperService.clearCache();
            }
            return { success: true };
        }, { success: false }
    ));

    // ========================================
    // OLLAMA-01: Model Health & Recommendations
    // ========================================

    ipcMain.handle('ollama:checkModelHealth', createValidatedIpcHandler('ollama:checkModelHealth',
        async (_event: IpcMainInvokeEvent, modelName: string) => {
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
        async () => {
            if (!ollamaService) {
                throw new Error('Ollama service unavailable');
            }
            return await ollamaService.checkAllModelsHealth();
        }, []
    ));

    ipcMain.handle('ollama:getModelRecommendations', createSafeIpcHandler('ollama:getModelRecommendations',
        async (_event: IpcMainInvokeEvent, categoryRaw: unknown) => {
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
        async (_event: IpcMainInvokeEvent, taskRaw: unknown) => {
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
        async () => {
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
        async () => {
            if (!ollamaService) {
                throw new Error('Ollama service unavailable');
            }
            return await ollamaService.testConnection();
        }, { success: false, latency: 0, error: 'Service unavailable' }
    ));

    ipcMain.handle('ollama:reconnect', createSafeIpcHandler('ollama:reconnect',
        async () => {
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
        async () => {
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
        async (_event: IpcMainInvokeEvent, intervalMs: number = 10000) => {
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
        async () => {
            if (!ollamaService) {
                throw new Error('Ollama service unavailable');
            }
            ollamaService.stopGPUMonitoring();
            return { success: true };
        }, { success: false }
    ));

    ipcMain.handle('ollama:setGPUAlertThresholds', createValidatedIpcHandler('ollama:setGPUAlertThresholds',
        async (_event: IpcMainInvokeEvent, thresholds: {
            highMemoryPercent?: number;
            highTemperatureC?: number;
            lowMemoryMB?: number;
        }) => {
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
        async () => {
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
                win.webContents.send('ollama:gpuAlert', alert);
            });
        });

        ollamaService.onGPUStatus((status) => {
            const windows = BrowserWindow.getAllWindows();
            windows.forEach(win => {
                win.webContents.send('ollama:gpuStatus', status);
            });
        });
    }
}
