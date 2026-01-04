import { ipcMain } from 'electron'
import { LocalAIService } from '../services/local-ai.service'
import { SettingsService } from '../services/settings.service'
import { LLMService } from '../services/llm.service'
import { OllamaService } from '../services/ollama.service'

export function registerOllamaIpc(options: {
    localAIService: LocalAIService
    settingsService: SettingsService
    llmService: LLMService
    ollamaService?: OllamaService
}) {
    const { localAIService, ollamaService } = options

    ipcMain.handle('ollama:tags', async () => localAIService.getOllamaModels())
    ipcMain.handle('ollama:getModels', async () => localAIService.getAllModels())
    ipcMain.handle('ollama:isRunning', async () => true)

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
                event.sender.send('ollama:streamChunk', res.message.content)
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
