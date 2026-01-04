import { ipcMain } from 'electron'
import { SettingsService } from '../services/settings.service'
import { LLMService } from '../services/llm.service'

export function registerSettingsIpc(options: {
    settingsService: SettingsService
    llmService: LLMService
    updateOpenAIConnection: () => void
    updateOllamaConnection: () => void
}) {
    const { settingsService, llmService, updateOpenAIConnection, updateOllamaConnection } = options

    ipcMain.handle('settings:get', () => settingsService.getSettings())

    ipcMain.handle('settings:save', (_event, newSettings) => {
        const saved = settingsService.saveSettings(newSettings)
        if (newSettings.ollama) updateOllamaConnection()
        if (newSettings.openai) llmService.setOpenAIApiKey(newSettings.openai.apiKey)
        if (newSettings.anthropic) llmService.setAnthropicApiKey(newSettings.anthropic.apiKey)
        if (newSettings.gemini) llmService.setGeminiApiKey(newSettings.gemini.apiKey)
        if (newSettings.groq) llmService.setGroqApiKey(newSettings.groq.apiKey)
        updateOpenAIConnection()
        return saved
    })
}
