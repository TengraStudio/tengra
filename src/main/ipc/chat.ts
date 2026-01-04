import { ipcMain } from 'electron'
import { CopilotService } from '../services/copilot.service'
import { SettingsService } from '../services/settings.service'
import { LLMService } from '../services/llm.service'
import { ProxyService } from '../services/proxy.service'
import { parseAIResponseContent } from '../utils/response-parser'

export function registerChatIpc(options: {
    settingsService: SettingsService
    copilotService: CopilotService
    llmService: LLMService
    proxyService: ProxyService
}) {
    const { settingsService, copilotService, llmService, proxyService } = options

    /**
     * Unified Chat Handler
     * Routes to Copilot, Local AI, or Cliproxy (for all others)
     */
    ipcMain.handle('chat:openai', async (_event, messages, model, tools, provider) => {
        try {
            const settings = settingsService.getSettings()

            // Normalize provider if missing (infer from model name)
            let effectiveProvider = provider;
            if (!effectiveProvider || model.toLowerCase().includes('codex') || model.toLowerCase().includes('gpt-5')) {
                const lowerModel = model.toLowerCase();
                // Route GitHub/Copilot specific models to native service
                if (lowerModel.includes('codex') || lowerModel.includes('gpt-5') || lowerModel.startsWith('github-') || lowerModel.startsWith('copilot-')) {
                    effectiveProvider = 'copilot';
                }
            }

            console.log(`[Main] Chat Request: Model=${model}, Provider=${effectiveProvider} (Derived from ${provider})`)

            // 1. Copilot Routing (Native)
            // If the provider is copilot, we use the dedicated CopilotService
            if (effectiveProvider === 'copilot') {
                console.log(`[Main] Routing ${model} via Native Copilot Pathway`)
                const res = await copilotService.chat(messages, model, tools)
                const content = parseAIResponseContent(res)
                return { content, role: 'assistant' }
            }

            // 2. Cliproxy Routing (Default for everything else: OpenAI, Anthropic, Gemini, Groq, Antigravity)
            // Cliproxy handles these using its pooled keys or user-provided keys.
            const proxyUrl = settings.proxy?.url || 'http://localhost:8317/v1'
            const proxyKey = proxyService.getProxyKey()

            console.log(`[Main] Routing ${model} via Cliproxy`)
            return await llmService.openaiChat(messages, model, tools, proxyUrl, proxyKey)

        } catch (error: any) {
            console.error('[Main:Chat] IPC Error:', error)
            return { error: error.message }
        }
    })

    // Legacy handler
    ipcMain.handle('chat:copilot', async (_event, messages, model) => {
        try {
            const res = await copilotService.chat(messages, model)
            const content = parseAIResponseContent(res)
            return { content, role: 'assistant' }
        } catch (error: any) { return { error: error.message } }
    })
}
