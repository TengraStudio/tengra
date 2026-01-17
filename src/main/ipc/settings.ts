import { AuditLogService } from '@main/services/analysis/audit-log.service'
import { CopilotService } from '@main/services/llm/copilot.service'
import { LLMService } from '@main/services/llm/llm.service'
import { SettingsService } from '@main/services/system/settings.service'
import { createIpcHandler } from '@main/utils/ipc-wrapper.util'
import { AppSettings } from '@shared/types/settings'
import { ipcMain, IpcMainInvokeEvent } from 'electron'

export function registerSettingsIpc(options: {
    settingsService: SettingsService
    llmService: LLMService
    copilotService: CopilotService
    auditLogService?: AuditLogService
    updateOpenAIConnection: () => void
    updateOllamaConnection: () => void | Promise<void>
}) {
    const { settingsService, llmService, copilotService, auditLogService, updateOpenAIConnection, updateOllamaConnection } = options

    ipcMain.handle('settings:get', createIpcHandler('settings:get', async () => {
        const settings = settingsService.getSettings()
        return settings
    }))

    ipcMain.handle('settings:save', createIpcHandler('settings:save', async (_event: IpcMainInvokeEvent, newSettings: AppSettings) => {
        const oldSettings = settingsService.getSettings()
        // Await the save to get the final merged settings (with preserved secrets)
        const finalSettings = await settingsService.saveSettings(newSettings)

        // Audit log for sensitive settings changes
        if (auditLogService) {
            const sensitiveChanges: string[] = []
            if (newSettings.openai?.apiKey && newSettings.openai.apiKey !== oldSettings.openai?.apiKey) {
                sensitiveChanges.push('OpenAI API key updated')
            }
            if (newSettings.anthropic?.apiKey && newSettings.anthropic.apiKey !== oldSettings.anthropic?.apiKey) {
                sensitiveChanges.push('Anthropic API key updated')
            }
            if (newSettings.groq?.apiKey && newSettings.groq.apiKey !== oldSettings.groq?.apiKey) {
                sensitiveChanges.push('Groq API key updated')
            }
            if (newSettings.proxy?.key && newSettings.proxy.key !== oldSettings.proxy?.key) {
                sensitiveChanges.push('Proxy key updated')
            }

            if (sensitiveChanges.length > 0) {
                await auditLogService.log({
                    action: 'Settings updated',
                    category: 'settings',
                    success: true,
                    details: {
                        changes: sensitiveChanges,
                        changedFields: Object.keys(newSettings)
                    }
                })
            }
        }

        if (newSettings.ollama) {
            const result = updateOllamaConnection()
            if (result instanceof Promise) {
                result.catch(error => console.error('[IPC] updateOllamaConnection failed:', error))
            }
        }
        if (finalSettings.openai?.apiKey) { llmService.setOpenAIApiKey(finalSettings.openai.apiKey) }
        if (finalSettings.anthropic?.apiKey) { llmService.setAnthropicApiKey(finalSettings.anthropic.apiKey) }

        // Update Copilot Service with split tokens
        if (finalSettings.copilot?.token) {
            copilotService.setCopilotToken(finalSettings.copilot.token)
        }
        if (finalSettings.github?.token) {
            copilotService.setGithubToken(finalSettings.github.token)
        }

        if (newSettings.groq) { llmService.setGroqApiKey(newSettings.groq.apiKey) }

        // Update Antigravity proxy settings in LLMService
        const proxyUrl = newSettings.proxy?.url || 'http://localhost:8317/v1'
        const proxyKey = newSettings.proxy?.key || 'connected'
        llmService.setProxySettings(proxyUrl, proxyKey)

        updateOpenAIConnection()
        return finalSettings
    }))
}
