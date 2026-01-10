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

    ipcMain.handle('ollama:getModels', async (): Promise<ModelDefinition[]> => {
        let copilotModels: ModelDefinition[] = []
        let codexModels: ModelDefinition[] = []
        let localModels: ModelDefinition[] = []
        let antigravityModels: ModelDefinition[] = []
        let llamaModels: ModelDefinition[] = []

        // 1. LOCAL MODELS (Ollama)
        try {
            const modelsArray = await localAIService.getOllamaModels()
            localModels = modelsArray.map((m) => {
                const name = m?.name
                if (!name) return null
                return {
                    ...m,
                    id: name,
                    provider: 'ollama',
                    name,
                    digest: m.digest,
                    size: m.size,
                    modified_at: m.modified_at
                } as ModelDefinition
            }).filter((m): m is ModelDefinition => m !== null)
        } catch (err) {
            console.error('Failed to fetch local models', getErrorMessage(err as Error))
        }

        // 2. COPILOT MODELS
        if (copilotService && copilotService.isConfigured()) {
            try {
                const res = await copilotService.getModels()
                const data = Array.isArray(res) ? res : (res?.data || [])
                copilotModels = data.map((m) => {
                    const id = m?.id
                    if (!id) return null
                    const name = m.name || id
                    return { ...m, id, provider: 'copilot', name }
                }).filter((m): m is ModelDefinition => m !== null)
            } catch (err) {
                console.error('Failed to fetch copilot models', getErrorMessage(err as Error))
            }
        }

        // 3. CODEX MODELS
        if (proxyService) {
            try {
                const usage = await proxyService.getCodexUsage() as { usageSource?: string }
                if (usage && usage.usageSource === 'chatgpt') {
                    codexModels = [
                        { id: 'gpt-5-codex', name: 'GPT-5 Codex', provider: 'codex' },
                        { id: 'gpt-5-codex-mini', name: 'GPT-5 Codex Mini', provider: 'codex' },
                        { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', provider: 'codex' },
                        { id: 'gpt-5.1-codex-mini', name: 'GPT-5.1 Codex Mini', provider: 'codex' },
                        { id: 'gpt-5.1-codex-max', name: 'GPT-5.1 Codex Max', provider: 'codex' },
                        { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex', provider: 'codex' },
                    ];
                }
            } catch (err) {
                console.warn('Failed to check Codex usage', err)
            }
        }



        // 4. ANTIGRAVITY MODELS (via ProxyService)
        if (proxyService) {
            try {
                const ag = await proxyService.getAntigravityAvailableModels()

                // Track existing IDs to prevent duplicates/collisions
                const existingIds = new Set([
                    ...localModels.map(m => m.id),
                    ...copilotModels.map(m => m.id),
                    ...codexModels.map(m => m.id),
                    ...codexModels.map(m => m.id)
                ])

                antigravityModels = (ag || []).map((m) => {
                    if (!m || typeof m !== 'object') return null
                    let id = m.id
                    let name = m.name || m.id

                    // If ID collides (e.g. gemini-1.5-pro exists in Gemini AND Antigravity), rename the Antigravity one
                    if (existingIds.has(id)) {
                        id = `${id}-antigravity`
                        name = `${name} (Antigravity)`
                    }

                    return { ...m, id, name, provider: 'antigravity' } as ModelDefinition
                }).filter((m): m is ModelDefinition => m !== null)
            } catch (err) {
                console.error('Failed to fetch Antigravity models', getErrorMessage(err as Error))
            }
        }

        // 5. LLAMA.CPP MODELS
        if (llamaService) {
            try {
                const lm = await llamaService.getModels()
                llamaModels = (lm || []).map((m) => {
                    const name = m?.name
                    if (!name) return null
                    const path = (m as { path?: string }).path || ''
                    const id = (m as { id?: string }).id || ''
                    return { ...m, id: path || id || 'llama-cpp-unknown', name, provider: 'llama-cpp' } as ModelDefinition
                }).filter((m): m is ModelDefinition => m !== null)
            } catch (err) {
                console.error('Failed to fetch Llama models', getErrorMessage(err as Error))
            }
        }

        return [...localModels, ...copilotModels, ...codexModels, ...antigravityModels, ...llamaModels];
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
            if (res.message?.content) {
                event.sender.send('ollama:streamChunk', { content: res.message.content, reasoning: '' })
            }
            return { content: res.message?.content || '', role: 'assistant' }
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
