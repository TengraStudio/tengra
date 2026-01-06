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

    const PROVIDER_INSTRUCTIONS: Record<string, string> = {
        'antigravity': "Ben, **Antigravity** tarafından **Orbit** platformu üzerinden sağlanan gelişmiş bir yapay zeka asistanıyım. Size en iyi şekilde yardımcı olmak için buradayım.",
        'copilot': "Ben GitHub Copilot tarafından sağlanan bir yapay zeka programlama asistanıyım.",
        'ollama': "Ben yerel olarak çalışan bir Ollama modeliyim."
    };

    function injectSystemPrompt(messages: any[], provider: string, model?: string) {
        let instruction = PROVIDER_INSTRUCTIONS[provider?.toLowerCase()] || PROVIDER_INSTRUCTIONS['antigravity'];

        // If it's an image model, add specific instructions
        const isImageModel = model?.toLowerCase().includes('image') || model?.toLowerCase().includes('imagen');
        if (isImageModel && provider === 'antigravity') {
            instruction += "\n\n**Önemli:** Sen bir görüntü oluşturma (Image Generation) modelisin. Kullanıcı senden bir şey çizmeni, oluşturmanı veya bir görsel yapmanı istediğinde, bunu doğrudan gerçekleştirebilirsin. Görseller otomatik olarak oluşturulup kullanıcıya gösterilecektir.";
        }

        if (instruction && (provider === 'antigravity' || provider === 'copilot' || provider === 'ollama')) {
            const hasSystem = messages.some((m: any) => m.role === 'system');
            if (hasSystem) {
                return messages.map((m: any) => m.role === 'system' ? { ...m, content: m.content + '\n\n' + instruction } : m);
            } else {
                return [{ role: 'system', content: instruction }, ...messages];
            }
        }
        return messages;
    }

    /**
     * OpenAI-compatible chat handler
     */
    ipcMain.handle('chat:openai', async (_event, messages, model, tools, provider) => {

        messages = injectSystemPrompt(messages, provider, model);
        try {
            const settings = settingsService.getSettings()

            console.log(`[Main] Chat Request: Model=${model}, Provider=${provider}`)

            // 1. Copilot Routing
            if (provider === 'copilot') {
                console.log(`[Main] Routing ${model} via CopilotService`)
                const res = await copilotService.chat(messages, model, tools)
                const content = parseAIResponseContent(res)
                return { content, role: 'assistant' }
            }

            // 2. Cliproxy Routing (Default for everything else)
            const proxyUrl = settings.proxy?.url || 'http://localhost:8317/v1'
            const proxyKey = proxyService.getProxyKey()

            console.log(`[Main] Routing ${model} via Cliproxy/LLMService`)
            const res = await llmService.openaiChat(messages, model, undefined, proxyUrl, proxyKey);
            const content = res.content || '';
            const reasoning = res.reasoning_content || '';
            const images = res.images || [];

            return { content, reasoning, images, role: 'assistant' };

        } catch (error: any) {
            console.error('[Main:Chat] IPC Error:', error)
        }
    })

    ipcMain.handle('chat:stream', async (event, messages, model, tools, provider) => {

        messages = injectSystemPrompt(messages, provider, model);
        try {
            const settings = settingsService.getSettings()

            console.log(`[Main:ChatStream] Request: Model=${model}, Provider=${provider}`);

            // 1. Copilot Routing
            if (provider === 'copilot') {
                const body = await copilotService.streamChat(messages, model, tools);
                if (!body) throw new Error('Failed to start Copilot stream');

                if (typeof (body as any).getReader === 'function') {
                    // Web Standard ReadableStream
                    const reader = body.getReader();
                    const decoder = new TextDecoder();

                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            const decoded = decoder.decode(value, { stream: true });
                            const lines = decoded.split('\n');
                            for (const line of lines) {
                                const trimmed = line.trim();
                                if (!trimmed || !trimmed.startsWith('data:')) continue;
                                const data = trimmed.slice(5).trim();
                                if (data === '[DONE]') continue;
                                try {
                                    const json = JSON.parse(data);
                                    const choices = json.choices || [];
                                    const delta = choices[0]?.delta;
                                    if (delta) {
                                        const content = delta.content || '';
                                        const reasoning = delta.reasoning_content || delta.reasoning || '';
                                        if (content || reasoning) {
                                            event.sender.send('ollama:streamChunk', { content, reasoning });
                                        }
                                    }
                                } catch (e) { console.error('Error parsing chunk:', e); }
                            }
                        }
                    } finally {
                        reader.releaseLock();
                    }
                } else {
                    // Node.js Readable Stream (Async Iterable)
                    for await (const chunk of body as any) {
                        const decoded = chunk.toString();
                        const lines = decoded.split('\n');
                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || !trimmed.startsWith('data:')) continue;
                            const data = trimmed.slice(5).trim();
                            if (data === '[DONE]') continue;
                            try {
                                const json = JSON.parse(data);
                                const choices = json.choices || [];
                                const delta = choices[0]?.delta;
                                if (delta) {
                                    const content = delta.content || '';
                                    const reasoning = delta.reasoning_content || delta.reasoning || '';
                                    if (content || reasoning) {
                                        event.sender.send('ollama:streamChunk', { content, reasoning });
                                    }
                                }
                            } catch (e) { console.error('Error parsing chunk:', e); }
                        }
                    }
                }
                return { success: true };
            }

            // 2. Ollama & Cliproxy Routing
            let proxyUrl = settings.proxy?.url || 'http://localhost:8317/v1'
            let proxyKey = proxyService.getProxyKey()

            if (provider === 'ollama') {
                const ollamaUrl = settings.ollama?.url || 'http://localhost:11434'
                proxyUrl = `${ollamaUrl.replace(/\/$/, '')}/v1`
                proxyKey = 'ollama'
                console.log(`[Main:ChatStream] Routing to local Ollama: ${proxyUrl}`)
            } else {
                console.log(`[Main:ChatStream] Routing ${model} via Cliproxy/LLMService`)
            }

            // 3. LLMService (Cliproxy) for all others
            for await (const chunk of llmService.openaiStreamChat(messages, model, tools, proxyUrl, proxyKey)) {
                event.sender.send('ollama:streamChunk', chunk);
            }
            return { success: true };

        } catch (error: any) {
            console.error('[Main:ChatStream] Error:', error);
            return { error: error.message };
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
