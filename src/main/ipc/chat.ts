import { ipcMain } from 'electron'
import { CopilotService } from '../services/copilot.service'
import { SettingsService } from '../services/settings.service'
import { OpenAIService } from '../services/openai.service'
import { AnthropicService } from '../services/anthropic.service'
import { GeminiService } from '../services/gemini.service'
import { GroqService } from '../services/groq.service'

export function registerChatIpc(options: {
    settingsService: SettingsService
    copilotService: CopilotService
    openaiService: OpenAIService
    anthropicService: AnthropicService
    geminiService: GeminiService
    groqService: GroqService
}) {
    const {
        settingsService,
        copilotService,
        openaiService,
        anthropicService,
        geminiService,
        groqService
    } = options

    ipcMain.handle('chat:copilot', async (_event, messages, model) => {
        try {
            // Intercept Proxy Models designated as Copilot but served by Local Proxy
            const isProxyModel = model === 'gpt-5-codex' || model === 'gpt-5.1-codex';
            if (isProxyModel) {
                const settings = settingsService.getSettings()
                const proxyUrl = settings.proxy?.url || 'http://localhost:8317/v1'
                console.log('[Main] Redirecting Copilot Request to Proxy for:', model)
                return await openaiService.chat(messages, model, undefined, proxyUrl)
            }

            return await copilotService.chat(messages, model)
        } catch (error: any) {
            return { error: error.message }
        }
    })

    ipcMain.handle('chat:openai', async (_event, messages, model, tools, provider) => {
        console.log(`[Main] IPC chat:openai TRIGGERED for model: ${model}, provider: ${provider}`)
        try {
            // 1. Check for Proxy-Specific Models (gpt-5, codex, etc.)
            // We route ANY model containing 'codex' or 'gpt-5' to the proxy
            const isProxyModel = model?.includes('codex') || model?.includes('gpt-5');
            console.log(`[Main] Model: ${model}, isProxyModel: ${isProxyModel}`)

            if (isProxyModel) {
                const settings = settingsService.getSettings()
                const proxyUrl = settings.proxy?.url || 'http://localhost:8317/v1'
                console.log('[Main] Routing specific model to Proxy:', model)
                return await openaiService.chat(messages, model, tools, proxyUrl)
            }

            // 2. Check for Native Copilot Routing
            const isCopilotParams = provider === 'copilot' ||
                model?.startsWith('copilot-') ||
                model?.startsWith('github-') ||
                ['gpt-4o', 'claude-3.5-sonnet'].includes(model);

            if (isCopilotParams) {
                console.log('[Main] Routing to Native Copilot Service (Strict Guard)')
                return await copilotService.chat(messages, model)
            }

            return await openaiService.chat(messages, model, tools)
        } catch (error: any) {
            console.error('[Main] Chat Error:', error)
            return { error: error.message }
        }
    })

    ipcMain.handle('chat:anthropic', async (_event, messages, model) => {
        try {
            const settings = settingsService.getSettings()
            if (settings.proxy?.enabled) {
                console.log(`Routing Anthropic request via proxy to ${model}`)
                const response = await openaiService.chat(messages, model)
                return {
                    success: true,
                    result: response.content
                }
            }
            return await anthropicService.chat(messages, model)
        } catch (error: any) {
            return { error: error.message }
        }
    })

    ipcMain.handle('chat:gemini', async (_event, messages, model) => {
        try {
            const settings = settingsService.getSettings()
            if (settings.proxy?.enabled) {
                console.log(`Routing Gemini request via proxy to ${model}`)
                const response = await openaiService.chat(messages, model)
                return {
                    success: true,
                    result: response.content
                }
            }
            return await geminiService.chat(messages, model)
        } catch (error: any) {
            return { error: error.message }
        }
    })

    ipcMain.handle('chat:groq', async (_event, messages, model) => {
        try {
            return await groqService.chat(messages, model)
        } catch (error: any) {
            return { error: error.message }
        }
    })
}
