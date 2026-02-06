import { appLogger } from '@main/logging/logger';
import { LLMService } from '@main/services/llm/llm.service';
import { LocalAIService } from '@main/services/llm/local-ai.service';
import { OllamaService } from '@main/services/llm/ollama.service';
import { OllamaHealthService } from '@main/services/llm/ollama-health.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { RateLimitService } from '@main/services/security/rate-limit.service';
import { SettingsService } from '@main/services/system/settings.service';
import { JsonValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { BrowserWindow, ipcMain } from 'electron';

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



export function registerOllamaIpc(options: {
    localAIService: LocalAIService
    settingsService: SettingsService
    llmService: LLMService
    ollamaService?: OllamaService
    ollamaHealthService?: OllamaHealthService
    proxyService?: ProxyService
    rateLimitService?: RateLimitService
}) {
    const { localAIService, ollamaService, ollamaHealthService, rateLimitService } = options;

    ipcMain.handle('ollama:tags', async () => []); // Moved to ModelRegistryService via Rust

    // deleted unused functions
    ipcMain.handle('ollama:getModels', async (): Promise<ModelDefinition[]> => {
        return []; // Moved to ModelRegistryService via Rust
    });

    // Use health service for isRunning check
    ipcMain.handle('ollama:isRunning', async () => {
        if (ollamaHealthService) {
            const status = ollamaHealthService.getStatus();
            return status.online;
        }
        return true; // Fallback
    });

    // Get detailed health status
    ipcMain.handle('ollama:healthStatus', async () => {
        if (ollamaHealthService) {
            return ollamaHealthService.getStatus();
        }
        return { online: true, lastCheck: new Date() };
    });

    // Force health check
    ipcMain.handle('ollama:forceHealthCheck', async () => {
        if (ollamaHealthService) {
            return await ollamaHealthService.forceCheck();
        }
        return { online: true, lastCheck: new Date() };
    });

    // GPU Check
    ipcMain.handle('ollama:checkCuda', async () => localAIService.checkCudaSupport());

    // Forward health events to renderer
    if (ollamaHealthService) {
        ollamaHealthService.on('statusChange', (status) => {
            const windows = BrowserWindow.getAllWindows();
            windows.forEach(win => {
                win.webContents.send('ollama:statusChange', status);
            });
        });
    }

    ipcMain.handle('ollama:chat', async (_event, messages, model) => {
        // SEC-011: Rate limit LLM chat calls
        if (rateLimitService) {
            await rateLimitService.waitForToken('ollama:chat');
        }
        return await localAIService.ollamaChat(model, messages);
    });

    ipcMain.handle('ollama:chatStream', async (event, messages, model) => {
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
    });

    ipcMain.handle('ollama:getLibraryModels', async () => {
        // SEC-011: Rate limit model listing operations
        if (rateLimitService) {
            await rateLimitService.waitForToken('ollama:operation');
        }
        try {
            if (ollamaService) {
                return await ollamaService.getLibraryModels();
            }
            return [];
        } catch (err) {
            appLogger.error('OllamaIPC', 'getLibraryModels Error', err as Error);
            return [];
        }
    });

    ipcMain.handle('ollama:start', async () => {
        const { startOllama } = await import('@main/startup/ollama');
        // Get primary window
        const win = BrowserWindow.getAllWindows()[0];
        const getWin = () => win as (BrowserWindow | null);
        return await startOllama(getWin, true);
    });
}
