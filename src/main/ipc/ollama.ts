import { ipcMain, BrowserWindow } from 'electron'
import { LocalAIService } from '../services/local-ai.service'
import { SettingsService } from '../services/settings.service'
import { LLMService } from '../services/llm.service'
import { OllamaService } from '../services/ollama.service'
import { LlamaService } from '../services/llama.service'
import { OllamaHealthService } from '../services/ollama-health.service'
import { ProxyService } from '../services/proxy.service'
import { CopilotService } from '../services/copilot.service';

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

    ipcMain.handle('ollama:getModels', async () => {
        let copilotModels: any[] = []
        let codexModels: any[] = []
        let localModels: any[] = []
        let antigravityModels: any[] = []
        let llamaModels: any[] = []

        // 1. LOCAL MODELS (Ollama)
        try {
            const res = await localAIService.getOllamaModels();
            localModels = (Array.isArray(res) ? res : ((res as any)?.models || [])).map((m: any) => ({
                ...m,
                id: m.name,
                provider: 'ollama',
                name: m.name
            }));
        } catch (e) {
            console.error('Failed to fetch local models', e);
        }

        // 2. COPILOT MODELS
        if (copilotService) {
            try {
                const res = await copilotService.getModels();
                copilotModels = Array.isArray(res) ? res : (res?.data || []);
            } catch (e) {
                console.error('Failed to fetch copilot models', e)
            }
        }

        // 3. CODEX MODELS
        const CODEX_MODELS = [
            { id: 'gpt-5-codex', name: 'GPT-5 Codex', provider: 'codex' },
            { id: 'gpt-5-codex-mini', name: 'GPT-5 Codex Mini', provider: 'codex' },
            { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', provider: 'codex' },
            { id: 'gpt-5.1-codex-mini', name: 'GPT-5.1 Codex Mini', provider: 'codex' },
            { id: 'gpt-5.1-codex-max', name: 'GPT-5.1 Codex Max', provider: 'codex' },
            { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex', provider: 'codex' },
        ];
        codexModels = CODEX_MODELS;



        // 4. ANTIGRAVITY MODELS (via ProxyService)
        if (proxyService) {
            try {
                const ag = await (proxyService as any).getAntigravityAvailableModels();
                antigravityModels = Array.isArray(ag) ? ag : [];
            } catch (e) {
                console.error('Failed to fetch Antigravity models', e);
            }
        }

        // 5. LLAMA.CPP MODELS
        if (llamaService) {
            try {
                const lm = await llamaService.getModels();
                llamaModels = Array.isArray(lm) ? lm : [];
            } catch (e) {
                console.error('Failed to fetch Llama models', e);
            }
        }

        // Format: Keep raw names, just add provider
        const formattedCopilot = copilotModels.map(m => ({
            ...m,
            id: m.id,
            provider: 'copilot',
            name: m.name || m.id
        }));

        const formattedCodex = codexModels.map(m => ({
            ...m,
            provider: 'codex' // This will be mapped to 'openai' group in UI but routed as 'copilot' if needed, 
            // though ModelSelector now handles the 'copilot' routing for proxy sources.
        }));

        const formattedAntigravity = antigravityModels.map(m => ({
            ...m,
            provider: 'antigravity'
        }));

        const formattedLlama = llamaModels.map(m => ({
            ...m,
            id: m.path, // Use path as unique ID for llama.cpp models
            name: m.name,
            provider: 'llama-cpp'
        }));

        // Return all models
        return [...localModels, ...formattedCopilot, ...formattedCodex, ...formattedAntigravity, ...formattedLlama];
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
        // Simple non-streaming fallback for now as LocalAIService is sync-heavy
        // This handler is specifically for local models (Ollama/Llama.cpp)
        try {
            const res = await localAIService.ollamaChat(model, messages)
            // Even if not truly streaming from the backend yet, we send the full response to keep renderer logic happy
            if (res.message?.content) {
                event.sender.send('ollama:streamChunk', { content: res.message.content, reasoning: '' })
            }
            return { content: res.message?.content || '', role: 'assistant' }
        } catch (error: any) {
            console.error('[Main:Ollama] Chat Error:', error)
            return { error: error.message }
        }
    })

    // Library models (available for download)
    ipcMain.handle('ollama:getLibraryModels', async () => {
        try {
            if (ollamaService) {
                return await ollamaService.getLibraryModels()
            }
            // Fallback: return empty array if service not available
            return []
        } catch (error: any) {
            console.error('[Main:Ollama] getLibraryModels Error:', error)
            return []
        }
    })
}
