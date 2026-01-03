import { ipcMain } from 'electron'
import { AnthropicService } from '../services/anthropic.service'
import { GeminiService } from '../services/gemini.service'
import { GroqService } from '../services/groq.service'
import { OpenAIService } from '../services/openai.service'
import { SettingsService } from '../services/settings.service'
import { OllamaService } from '../services/ollama.service'

export function registerSettingsIpc(options: {
    settingsService: SettingsService
    ollamaService: OllamaService
    openaiService: OpenAIService
    anthropicService: AnthropicService
    geminiService: GeminiService
    groqService: GroqService
    updateOpenAIConnection: () => void
    updateOllamaConnection: () => void
}) {
    const {
        settingsService,
        openaiService,
        anthropicService,
        geminiService,
        groqService,
        updateOpenAIConnection,
        updateOllamaConnection
    } = options

    ipcMain.handle('settings:get', () => {
        return settingsService.getSettings()
    })

    ipcMain.handle('settings:save', (_event, newSettings) => {
        const saved = settingsService.saveSettings(newSettings)

        // Apply side effects
        if (newSettings.ollama) {
            updateOllamaConnection()
        }
        if (newSettings.openai) {
            openaiService.setApiKey(newSettings.openai.apiKey)
        }
        if (newSettings.anthropic) {
            anthropicService.setApiKey(newSettings.anthropic.apiKey)
        }
        if (newSettings.gemini) {
            geminiService.setApiKey(newSettings.gemini.apiKey)
        }
        if (newSettings.groq) {
            groqService.setApiKey(newSettings.groq.apiKey)
        }

        // Update OpenAIService for Proxy settings changes
        updateOpenAIConnection()

        return saved
    })
}
