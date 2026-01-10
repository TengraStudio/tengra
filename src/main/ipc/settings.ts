import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { SettingsService } from '../services/settings.service'
import { LLMService } from '../services/llm/llm.service'
import { CopilotService } from '../services/llm/copilot.service'
import { AppSettings } from '../../shared/types/settings'
import { getErrorMessage } from '../../shared/utils/error.util'

export function registerSettingsIpc(options: {
    settingsService: SettingsService
    llmService: LLMService
    copilotService: CopilotService
    updateOpenAIConnection: () => void
    updateOllamaConnection: () => void
}) {
    const { settingsService, llmService, copilotService, updateOpenAIConnection, updateOllamaConnection } = options

    ipcMain.handle('settings:get', async () => {
        try {
            const settings = settingsService.getSettings()
            console.log(`[IPC] settings:get returning settings. GitHub token length: ${settings.github?.token?.length || 0}, Copilot token length: ${settings.copilot?.token?.length || 0}`);
            return settings
        } catch (error) {
            console.error('[IPC] settings:get failed:', getErrorMessage(error as Error))
            throw error
        }
    })

    ipcMain.handle('settings:save', async (_event: IpcMainInvokeEvent, newSettings: AppSettings) => {
        try {
            const saved = settingsService.saveSettings(newSettings)
            if (newSettings.ollama) updateOllamaConnection()
            if (newSettings.openai) llmService.setOpenAIApiKey(newSettings.openai.apiKey)
            if (newSettings.anthropic) llmService.setAnthropicApiKey(newSettings.anthropic.apiKey)

            if (newSettings.groq) llmService.setGroqApiKey(newSettings.groq.apiKey)

            // Update Copilot Service
            const copilotToken = newSettings.copilot?.token || newSettings.github?.token
            if (copilotToken) {
                copilotService.setGithubToken(copilotToken)
            }

            // Update Antigravity proxy settings in LLMService
            const proxyUrl = newSettings.proxy?.url || 'http://localhost:8317/v1'
            const proxyKey = newSettings.proxy?.key || 'connected'
            llmService.setProxySettings(proxyUrl, proxyKey)

            updateOpenAIConnection()
            return saved
        } catch (error) {
            console.error('[IPC] settings:save failed:', getErrorMessage(error as Error))
            throw error
        }
    })
}
