import { ipcMain, BrowserWindow } from 'electron'
import { LocalAIService } from '../services/llm/local-ai.service'
import { SettingsService } from '../services/settings.service'
import { LLMService } from '../services/llm/llm.service'
import { OllamaService } from '../services/llm/ollama.service'
import { LlamaService } from '../services/llm/llama.service'
import { OllamaHealthService } from '../services/llm/ollama-health.service'
import { ProxyService } from '../services/proxy/proxy.service'
import { CopilotService } from '../services/llm/copilot.service';
import { JsonValue } from '../../shared/types/common';
import { getErrorMessage } from '../../shared/utils/error.util';

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
    copilotService?: CopilotService
    llamaService?: LlamaService
}) {
    const { localAIService, ollamaService, ollamaHealthService, copilotService, proxyService, llamaService } = options

    ipcMain.handle('ollama:tags', async () => localAIService.getOllamaModels())

    const fetchLocalModels = async (service: LocalAIService): Promise<ModelDefinition[]> => {
        try {
            const models = await service.getOllamaModels()
            return models.map((m) => m.name ? { ...m, id: m.name, provider: 'ollama' } as ModelDefinition : null)
                .filter((m): m is ModelDefinition => m !== null)
        } catch { return [] }
    }

    const fetchCopilotModels = async (service?: CopilotService): Promise<ModelDefinition[]> => {
        if (!service?.isConfigured()) { return [] }
        try {
            const res = await service.getModels()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-condition
            const data: any[] = Array.isArray(res) ? res : (res.data || [])
            return data.map((m) => m.id ? { ...m, provider: 'copilot' } as ModelDefinition : null)
                .filter((m): m is ModelDefinition => m !== null)
        } catch { return [] }
    }

    const fetchAntigravityInfo = async (service?: ProxyService): Promise<{ codex: ModelDefinition[], antigravity: ModelDefinition[] }> => {
        const result = { codex: [] as ModelDefinition[], antigravity: [] as ModelDefinition[] }
        if (!service) { return result }
        try {
            const usage = await service.getCodexUsage() as { usageSource?: string } | null
            if (usage?.usageSource === 'chatgpt') {
                result.codex = [
                    { id: 'gpt-5-codex', name: 'GPT-5 Codex', provider: 'codex' },
                    { id: 'gpt-5-codex-mini', name: 'GPT-5 Codex Mini', provider: 'codex' },
                    { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', provider: 'codex' }
                ]
            }
            const ag = await service.getAntigravityAvailableModels()
            result.antigravity = ag.map(m => ({ ...m, provider: 'antigravity' } as ModelDefinition))
        } catch { /* empty */ }
        return result
    }

    const fetchLlamaModels = async (service?: LlamaService): Promise<ModelDefinition[]> => {
        if (!service) { return [] }
        try {
            const lm = await service.getModels()
            return lm.map(m => m.name ? { ...m, provider: 'llama-cpp' } as ModelDefinition : null)
                .filter((m): m is ModelDefinition => m !== null)
        } catch { return [] }
    }

    const getAllModels = async (
        localAIService: LocalAIService,
        copilotService: CopilotService | undefined,
        proxyService: ProxyService | undefined,
        llamaService: LlamaService | undefined
    ): Promise<ModelDefinition[]> => {
        const [local, copilot, agInfo, llama] = await Promise.all([
            fetchLocalModels(localAIService),
            fetchCopilotModels(copilotService),
            fetchAntigravityInfo(proxyService),
            fetchLlamaModels(llamaService)
        ])

        const openCodeModels: ModelDefinition[] = [
            { id: 'gpt-5-nano', name: 'GPT-5 Nano', provider: 'opencode' },
            { id: 'grok-code', name: 'Grok Code Fast 1', provider: 'opencode' },
            { id: 'glm-4.7-free', name: 'GLM 4.7', provider: 'opencode' },
            { id: 'minimax-m2.1-free', name: 'MiniMax M2.1', provider: 'opencode' },
            { id: 'big-pickle', name: 'Big Pickle', provider: 'opencode' },
        ]

        return [...local, ...copilot, ...agInfo.codex, ...agInfo.antigravity, ...llama, ...openCodeModels]
    }

    // ... inside registerOllamaIpc
    ipcMain.handle('ollama:getModels', async (): Promise<ModelDefinition[]> => {
        return getAllModels(localAIService, copilotService, proxyService, llamaService)
    })

    // Use health service for isRunning check
    ipcMain.handle('ollama:isRunning', async () => {
        if (ollamaHealthService) {
            const status = ollamaHealthService.getStatus()
            return status.online
        }
        return true // Fallback
    })

    // Get detailed health status
    ipcMain.handle('ollama:healthStatus', async () => {
        if (ollamaHealthService) {
            return ollamaHealthService.getStatus()
        }
        return { online: true, lastCheck: new Date() }
    })

    // Force health check
    ipcMain.handle('ollama:forceHealthCheck', async () => {
        if (ollamaHealthService) {
            return await ollamaHealthService.forceCheck()
        }
        return { online: true, lastCheck: new Date() }
    })

    // GPU Check
    ipcMain.handle('ollama:checkCuda', async () => localAIService.checkCudaSupport())

    // Forward health events to renderer
    if (ollamaHealthService) {
        ollamaHealthService.on('statusChange', (status) => {
            const windows = BrowserWindow.getAllWindows()
            windows.forEach(win => {
                win.webContents.send('ollama:statusChange', status)
            })
        })
    }

    ipcMain.handle('ollama:chat', async (_event, messages, model) => {
        return await localAIService.ollamaChat(model, messages)
    })

    ipcMain.handle('ollama:chatStream', async (event, messages, model) => {
        try {
            const res = await localAIService.ollamaChat(model, messages)
            if (res.message.content) {
                event.sender.send('ollama:streamChunk', { content: res.message.content, reasoning: '' })
            }
            return { content: res.message.content || '', role: 'assistant' }
        } catch (err) {
            const message = getErrorMessage(err as Error)
            console.error('[Main:Ollama] Chat Error:', message)
            return { error: message }
        }
    })

    ipcMain.handle('ollama:getLibraryModels', async () => {
        try {
            if (ollamaService) {
                return await ollamaService.getLibraryModels()
            }
            return []
        } catch (err) {
            console.error('[Main:Ollama] getLibraryModels Error:', getErrorMessage(err as Error))
            return []
        }
    })
}
