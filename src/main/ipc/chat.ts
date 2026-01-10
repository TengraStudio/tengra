import { ipcMain } from 'electron'
import { CopilotService } from '../services/llm/copilot.service'
import { SettingsService } from '../services/settings.service'
import { LLMService } from '../services/llm/llm.service'
import { ProxyService } from '../services/proxy/proxy.service'
import { parseAIResponseContent } from '../utils/response-parser'
import { Message, ToolDefinition } from '../../shared/types/chat'
import { IpcMainInvokeEvent } from 'electron'
import { JsonObject, JsonValue } from '../../shared/types/common'

import { CodeIntelligenceService } from '../services/code-intelligence.service'
import { chatQueueManager } from '../services/chat-queue.manager'
import { getErrorMessage } from '../../shared/utils/error.util'
import { createIpcHandler } from '../utils/ipc-wrapper.util'

export function registerChatIpc(options: {
    settingsService: SettingsService
    copilotService: CopilotService
    llmService: LLMService
    proxyService: ProxyService
    codeIntelligenceService: CodeIntelligenceService
}) {
    const { settingsService, copilotService, llmService, proxyService, codeIntelligenceService } = options

    const PROVIDER_INSTRUCTIONS: Record<string, string> = {
        'antigravity': "Ben, **Antigravity** tarafından **Orbit** platformu üzerinden sağlanan gelişmiş bir yapay zeka asistanıyım. Size en iyi şekilde yardımcı olmak için buradayım.",
        'copilot': "Ben GitHub Copilot tarafından sağlanan bir yapay zeka programlama asistanıyım.",
        'ollama': "Ben yerel olarak çalışan bir Ollama modeliyim."
    };

    function injectSystemPrompt(messages: Message[], provider: string, model?: string): Message[] {
        let instruction = PROVIDER_INSTRUCTIONS[provider?.toLowerCase()] || PROVIDER_INSTRUCTIONS['antigravity'];

        // If it's an image model, add specific instructions
        const isImageModel = model?.toLowerCase().includes('image') || model?.toLowerCase().includes('imagen');
        if (isImageModel && provider === 'antigravity') {
            instruction += "\n\n**Önemli:** Sen bir görüntü oluşturma (Image Generation) modelisin. Kullanıcı senden bir şey çizmeni, oluşturmanı veya bir görsel yapmanı istediğinde, bunu doğrudan gerçekleştirebilirsin. Görseller otomatik olarak oluşturulup kullanıcıya gösterilecektir.";
        }

        if (instruction && (provider === 'antigravity' || provider === 'copilot' || provider === 'ollama')) {
            const hasSystem = messages.some((m) => m.role === 'system');
            if (hasSystem) {
                return messages.map((m) => {
                    if (m.role === 'system') {
                        const content = typeof m.content === 'string' ? m.content : '';
                        return { ...m, content: content + '\n\n' + instruction };
                    }
                    return m;
                });
            } else {
                return [{ id: 'system-instruction', role: 'system', content: instruction, timestamp: new Date() } as Message, ...messages];
            }
        }
        return messages;
    }

    /**
     * OpenAI-compatible chat handler
     */
    /**
     * OpenAI-compatible chat handler
     */
    ipcMain.handle('chat:openai', createIpcHandler('chat:openai', async (_event: IpcMainInvokeEvent, messages: Message[], model: string, tools: ToolDefinition[] | undefined, provider: string, projectId?: string) => {
        let sources: string[] = [];

        // --- RAG: Context retrieval ---
        if (projectId && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.role === 'user') {
                try {
                    console.log(`[RAG] Querying context for projectId: ${projectId}`);
                    const query = typeof lastMessage.content === 'string'
                        ? lastMessage.content
                        : (Array.isArray(lastMessage.content) ? lastMessage.content.find(p => p.type === 'text')?.text || '' : '');

                    if (query) {
                        const results = await codeIntelligenceService.queryIndexedSymbols(query);
                        if (results && results.length > 0) {
                            const contextLimit = 5;
                            const contextString = results.slice(0, contextLimit).map(r =>
                                `--- FILE: ${r.file} ---\n${r.text}\n\`\`\`\n${r.name || ''}\n\`\`\``
                            ).join('\n\n');

                            const ragPrompt = `\n\nBu soruyu cevaplamana yardımcı olabilecek ilgili kod parçacıkları:\n\n${contextString}`;

                            // Assign sources to the outer scoped variable
                            sources = results.map(r => r.file);

                            // Inject into system prompt or as a new context message
                            const systemIdx = messages.findIndex((m) => m.role === 'system');
                            if (systemIdx !== -1) {
                                const currentContent = typeof messages[systemIdx].content === 'string' ? messages[systemIdx].content : '';
                                messages[systemIdx].content = currentContent + ragPrompt;
                            } else {
                                messages.unshift({ id: 'rag-context', role: 'system', content: ragPrompt, timestamp: new Date() } as Message);
                            }
                            console.log(`[RAG] Injected ${results.length} context items.`);
                        }
                    }
                } catch (ragErr) {
                    console.error('[RAG] Retrieval failed:', ragErr);
                }
            }
        }

        messages = injectSystemPrompt(messages, provider, model);

        const settings = settingsService.getSettings()

        console.log(`[Main] Chat Request: Model=${model}, Provider=${provider}`)

        // 1. Copilot Routing
        if (provider === 'copilot') {
            console.log(`[Main] Routing ${model} via CopilotService`)
            // CopilotService expects shared Message[]
            const res = await copilotService.chat(messages, model, tools)
            // Extract content safely to avoid Date type mismatch with JsonValue
            const contentVal = res ? (Array.isArray(res.content) ? res.content : res.content) as JsonValue : ''
            const content = parseAIResponseContent(contentVal)
            return { content, role: 'assistant' }
        }

        // 2. Cliproxy Routing (Default for everything else)
        const proxyUrl = settings.proxy?.url || 'http://localhost:8317/v1'
        const proxyKey = proxyService.getProxyKey()

        console.log(`[Main] Routing ${model} via Cliproxy/LLMService`)
        const res = await llmService.chatOpenAI(messages, model, tools, proxyUrl, proxyKey);
        const content = res.content || '';
        const reasoning = res.reasoning_content || '';
        const images = res.images || [];

        return { content, reasoning, images, role: 'assistant', sources };
    }))

    ipcMain.handle('chat:stream', async (event: IpcMainInvokeEvent, messages: Message[], model: string, tools: ToolDefinition[] | undefined, provider: string, _options: JsonObject | undefined, chatId: string, projectId?: string) => {
        const settings = settingsService.getSettings()
        chatQueueManager.setPolicy(settings.ollama?.orchestrationPolicy || 'auto')

        // --- RAG: Context retrieval ---
        if (projectId && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.role === 'user') {
                try {
                    const query = typeof lastMessage.content === 'string'
                        ? lastMessage.content
                        : (Array.isArray(lastMessage.content) ? lastMessage.content.find(p => p.type === 'text')?.text || '' : '');

                    if (query) {
                        const results = await codeIntelligenceService.queryIndexedSymbols(query);
                        if (results && results.length > 0) {
                            const contextString = results.slice(0, 5).map(r =>
                                `--- FILE: ${r.file} ---\n${r.text}\n\`\`\`\n${r.name || ''}\n\`\`\``
                            ).join('\n\n');
                            const ragPrompt = `\n\nRetrieved Context:\n${contextString}`;

                            // Emit metadata to frontend
                            const sources = results.map(r => r.file);
                            event.sender.send('chat:stream-chunk', { chatId, type: 'metadata', sources });
                            const systemIdx = messages.findIndex((m) => m.role === 'system');
                            if (systemIdx !== -1) {
                                const currentContent = typeof messages[systemIdx].content === 'string' ? messages[systemIdx].content : '';
                                messages[systemIdx].content = currentContent + ragPrompt;
                            } else {
                                messages.unshift({ id: 'rag-context', role: 'system', content: ragPrompt, timestamp: new Date() } as Message);
                            }
                        }
                    }
                } catch (ragErr) { console.error('[RAG] Retrieval failed:', ragErr); }
            }
        }

        messages = injectSystemPrompt(messages, provider, model);

        const executeGeneration = async () => {
            try {
                console.log(`[Main:ChatStream] Request: Model=${model}, Provider=${provider}, ChatID=${chatId}`);

                // 1. Copilot Routing
                if (provider === 'copilot') {
                    // CopilotService expects shared Message[]
                    const body = await copilotService.streamChat(messages, model, tools);
                    if (!body) throw new Error('Failed to start Copilot stream');
                    const streamBody = body as ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>;
                    if ('getReader' in streamBody && typeof (streamBody as ReadableStream<Uint8Array>).getReader === 'function') {
                        const reader = (streamBody as ReadableStream<Uint8Array>).getReader();
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
                                        const json = JSON.parse(data) as JsonObject;
                                        const choices = Array.isArray(json['choices']) ? json['choices'] as JsonObject[] : [];
                                        const delta = choices[0]?.['delta'] as JsonObject | undefined;
                                        if (delta) {
                                            const content = delta.content || '';
                                            const reasoning = delta.reasoning_content || delta.reasoning || '';
                                            if (content || reasoning) {
                                                event.sender.send('ollama:streamChunk', { chatId, content, reasoning });
                                            }
                                        }
                                    } catch (err) {
                                        console.error('[CopilotStream] Parse error:', err);
                                    }
                                }
                            }
                        } finally { reader.releaseLock(); }
                    } else {
                        // Assume AsyncIterable if getReader is not present
                        for await (const chunk of streamBody as AsyncIterable<Uint8Array>) {
                            const decoded = chunk.toString();
                            const lines = decoded.split('\n');
                            for (const line of lines) {
                                const trimmed = line.trim();
                                if (!trimmed || !trimmed.startsWith('data:')) continue;
                                const data = trimmed.slice(5).trim();
                                if (data === '[DONE]') continue;
                                try {
                                    const json = JSON.parse(data);
                                    const choices = Array.isArray(json.choices) ? json.choices : [];
                                    const delta = choices[0]?.delta;
                                    if (delta) {
                                        const content = delta.content || '';
                                        const reasoning = delta.reasoning_content || delta.reasoning || '';
                                        if (content || reasoning) {
                                            event.sender.send('ollama:streamChunk', { chatId, content, reasoning });
                                        }
                                    }
                                } catch (err) {
                                    console.error('[CopilotStream] Buffer Parse error:', err);
                                }
                            }
                        }
                    }
                    return;
                }

                // 2. Ollama & Cliproxy Routing
                let proxyUrl = settings.proxy?.url || 'http://localhost:8317/v1'
                let proxyKey = proxyService.getProxyKey()

                if (provider === 'ollama') {
                    const ollamaUrl = settings.ollama?.url || 'http://localhost:11434'
                    proxyUrl = `${ollamaUrl.replace(/\/$/, '')}/v1`
                    proxyKey = 'ollama'
                }

                // 3. LLMService (Cliproxy) for all others
                for await (const chunk of llmService.chatOpenAIStream(messages, model, tools, proxyUrl, proxyKey)) {
                    event.sender.send('ollama:streamChunk', { ...chunk, chatId });
                }
            } catch (error) {
                const message = getErrorMessage(error as Error)
                console.error('[Main:ChatStream] Error:', error);
                event.sender.send('ollama:streamChunk', { chatId, type: 'error', content: message });
            }
        }

        if (chatId) {
            chatQueueManager.addTask(chatId, executeGeneration)
            return { success: true, queued: true }
        } else {
            executeGeneration()
            return { success: true }
        }
    })

    // Legacy handler
    ipcMain.handle('chat:copilot', async (_event: IpcMainInvokeEvent, messages: Message[], model: string) => {
        try {
            // CopilotService expects shared Message[]
            const res = await copilotService.chat(messages, model)
            // Extract content safely
            const contentVal = res ? (Array.isArray(res.content) ? res.content : res.content) as JsonValue : ''
            const content = parseAIResponseContent(contentVal)
            return { content, role: 'assistant' }
        } catch (error) {
            return { error: getErrorMessage(error as Error) }
        }
    })
}
