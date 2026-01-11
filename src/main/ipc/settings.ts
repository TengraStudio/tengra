import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { SettingsService } from '../services/settings.service'
import { LLMService } from '../services/llm/llm.service'
import { CopilotService } from '../services/llm/copilot.service'
import { AppSettings } from '../../shared/types/settings'
import { createIpcHandler } from '../utils/ipc-wrapper.util'

export function registerSettingsIpc(options: {
    settingsService: SettingsService
    llmService: LLMService
    copilotService: CopilotService
    updateOpenAIConnection: () => void
    updateOllamaConnection: () => void | Promise<void>
}) {
    const { settingsService, llmService, copilotService, updateOpenAIConnection, updateOllamaConnection } = options

    ipcMain.handle('settings:get', createIpcHandler('settings:get', async () => {
        const settings = settingsService.getSettings()
        console.log(`[IPC] settings:get returning settings. GitHub token length: ${settings.github?.token?.length || 0}, Copilot token length: ${settings.copilot?.token?.length || 0}`);
        return settings
    }))

    ipcMain.handle('settings:save', createIpcHandler('settings:save', async (_event: IpcMainInvokeEvent, newSettings: AppSettings) => {
        const saved = settingsService.saveSettings(newSettings)
        if (newSettings.ollama) {
            const result = updateOllamaConnection()
            if (result instanceof Promise) {
                result.catch(error => console.error('[IPC] updateOllamaConnection failed:', error))
            }
        }
        if (newSettings.openai) llmService.setOpenAIApiKey(newSettings.openai.apiKey)
        if (newSettings.anthropic) llmService.setAnthropicApiKey(newSettings.anthropic.apiKey)

        if (newSettings.groq) llmService.setGroqApiKey(newSettings.groq.apiKey)

        // Update Copilot Service - ONLY use copilot_token, no fallback
        const copilotToken = newSettings.copilot?.token
        if (copilotToken) {
            copilotService.setGithubToken(copilotToken)
        }

        // Update Antigravity proxy settings in LLMService
        const proxyUrl = newSettings.proxy?.url || 'http://localhost:8317/v1'
        const proxyKey = newSettings.proxy?.key || 'connected'
        llmService.setProxySettings(proxyUrl, proxyKey)

        updateOpenAIConnection()
        return saved
    }))
}
