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
import { ContextRetrievalService } from '../services/llm/context-retrieval.service'
import { chatQueueManager } from '../services/chat-queue.manager'
import { getErrorMessage } from '../../shared/utils/error.util'
import { createIpcHandler } from '../utils/ipc-wrapper.util'
import { sanitizeString, sanitizeObject } from '../../shared/utils/sanitize.util'

export function registerChatIpc(options: {
    settingsService: SettingsService
    copilotService: CopilotService
    llmService: LLMService
    proxyService: ProxyService
    codeIntelligenceService: CodeIntelligenceService
    contextRetrievalService: ContextRetrievalService
}) {
    const { settingsService, copilotService, llmService, proxyService, contextRetrievalService } = options

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
        // Sanitize inputs
        const sanitizedModel = sanitizeString(model, { maxLength: 200, allowNewlines: false })
        const sanitizedProvider = sanitizeString(provider, { maxLength: 50, allowNewlines: false })
        const sanitizedProjectId = projectId ? sanitizeString(projectId, { maxLength: 100, allowNewlines: false }) : undefined

        // Sanitize messages
        const sanitizedMessages = messages.map(msg => {
            if (typeof msg.content === 'string') {
                return { ...msg, content: sanitizeString(msg.content, { maxLength: 1000000, allowNewlines: true }) }
            } else if (Array.isArray(msg.content)) {
                return {
                    ...msg,
                    content: msg.content.map(item => {
                        if (item.type === 'text' && typeof item.text === 'string') {
                            return { ...item, text: sanitizeString(item.text, { maxLength: 1000000, allowNewlines: true }) }
                        }
                        return item
                    })
                }
            }
            return msg
        })

        let sources: string[] = [];

        // --- RAG: Context retrieval ---
        // --- RAG: Context retrieval ---
        if (sanitizedProjectId && sanitizedMessages.length > 0) {
            const lastMessage = sanitizedMessages[sanitizedMessages.length - 1];
            if (lastMessage.role === 'user') {
                try {
                    console.log(`[RAG] Querying context for projectId: ${sanitizedProjectId}`);
                    const query = typeof lastMessage.content === 'string'
                        ? lastMessage.content
                        : (Array.isArray(lastMessage.content) ? lastMessage.content.find(p => p.type === 'text')?.text || '' : '');

                    if (query) {
                        const { contextString, sources: ragSources } = await contextRetrievalService.retrieveContext(query, sanitizedProjectId);

                        if (contextString) {
                            sources = ragSources.map(src => sanitizeString(src, { maxLength: 500, allowNewlines: false }));
                            const ragPrompt = `\n\nBu soruyu cevaplamana yardımcı olabilecek ilgili kod parçacıkları:\n\n${contextString}`;

                            // Inject into system prompt or as a new context message
                            const systemIdx = sanitizedMessages.findIndex((m) => m.role === 'system');
                            if (systemIdx !== -1) {
                                const currentContent = typeof sanitizedMessages[systemIdx].content === 'string' ? sanitizedMessages[systemIdx].content : '';
                                sanitizedMessages[systemIdx].content = currentContent + ragPrompt;
                            } else {
                                sanitizedMessages.unshift({ id: 'rag-context', role: 'system', content: ragPrompt, timestamp: new Date() } as Message);
                            }
                            console.log(`[RAG] Injected context with ${ragSources.length} sources.`);
                        }
                    }
                } catch (ragErr) {
                    console.error('[RAG] Retrieval failed:', ragErr);
                }
            }
        }

        const finalMessages = injectSystemPrompt(sanitizedMessages, sanitizedProvider, sanitizedModel);

        const settings = settingsService.getSettings()

        console.log(`[Main] Chat Request: Model=${sanitizedModel}, Provider=${sanitizedProvider}`)

        // Sanitize tools if provided
        const sanitizedTools = tools ? sanitizeObject(tools) : undefined

        // 1. Copilot Routing
        if (sanitizedProvider === 'copilot') {
            console.log(`[Main] Routing ${sanitizedModel} via CopilotService`)
            // CopilotService expects shared Message[]
            const res = await copilotService.chat(finalMessages, sanitizedModel, sanitizedTools)
            // Extract content safely to avoid Date type mismatch with JsonValue
            const contentVal = res ? (Array.isArray(res.content) ? res.content : res.content) as JsonValue : ''
            const content = parseAIResponseContent(contentVal)
            return { content, role: 'assistant' }
        }

        // 2. Cliproxy Routing (Default for everything else)
        const proxyUrl = settings.proxy?.url || 'http://localhost:8317/v1'
        const proxyKey = proxyService.getProxyKey()

        console.log(`[Main] Routing ${sanitizedModel} via Cliproxy/LLMService`)
        const res = await llmService.chatOpenAI(finalMessages, sanitizedModel, sanitizedTools, proxyUrl, proxyKey);
        const content = res.content || '';
        const reasoning = res.reasoning_content || '';
        const images = res.images || [];

        return { content, reasoning, images, role: 'assistant', sources };
    }))

    ipcMain.handle('chat:stream', async (event: IpcMainInvokeEvent, messages: Message[], model: string, tools: ToolDefinition[] | undefined, provider: string, _options: JsonObject | undefined, chatId: string, projectId?: string) => {
        // Sanitize inputs
        const sanitizedModel = sanitizeString(model, { maxLength: 200, allowNewlines: false })
        const sanitizedProvider = sanitizeString(provider, { maxLength: 50, allowNewlines: false })
        const sanitizedChatId = sanitizeString(chatId, { maxLength: 100, allowNewlines: false })
        const sanitizedProjectId = projectId ? sanitizeString(projectId, { maxLength: 100, allowNewlines: false }) : undefined

        // Sanitize messages
        const sanitizedMessages = messages.map(msg => {
            if (typeof msg.content === 'string') {
                return { ...msg, content: sanitizeString(msg.content, { maxLength: 1000000, allowNewlines: true }) }
            } else if (Array.isArray(msg.content)) {
                return {
                    ...msg,
                    content: msg.content.map(item => {
                        if (item.type === 'text' && typeof item.text === 'string') {
                            return { ...item, text: sanitizeString(item.text, { maxLength: 1000000, allowNewlines: true }) }
                        }
                        return item
                    })
                }
            }
            return msg
        })

        const settings = settingsService.getSettings()
        chatQueueManager.setPolicy(settings.ollama?.orchestrationPolicy || 'auto')

        // --- RAG: Context retrieval ---
        // --- RAG: Context retrieval ---
        if (sanitizedProjectId && sanitizedMessages.length > 0) {
            const lastMessage = sanitizedMessages[sanitizedMessages.length - 1];
            if (lastMessage.role === 'user') {
                try {
                    const query = typeof lastMessage.content === 'string'
                        ? lastMessage.content
                        : (Array.isArray(lastMessage.content) ? lastMessage.content.find(p => p.type === 'text')?.text || '' : '');

                    if (query) {
                        const { contextString, sources } = await contextRetrievalService.retrieveContext(query, sanitizedProjectId);

                        if (contextString) {
                            const ragPrompt = `\n\nRetrieved Context:\n${contextString}`;

                            // Emit metadata to frontend
                            event.sender.send('chat:stream-chunk', { chatId: sanitizedChatId, type: 'metadata', sources: sources.map(src => sanitizeString(src, { maxLength: 500, allowNewlines: false })) });

                            const systemIdx = sanitizedMessages.findIndex((m) => m.role === 'system');
                            if (systemIdx !== -1) {
                                const currentContent = typeof sanitizedMessages[systemIdx].content === 'string' ? sanitizedMessages[systemIdx].content : '';
                                sanitizedMessages[systemIdx].content = currentContent + ragPrompt;
                            } else {
                                sanitizedMessages.unshift({ id: 'rag-context', role: 'system', content: ragPrompt, timestamp: new Date() } as Message);
                            }
                        }
                    }
                } catch (ragErr) { console.error('[RAG] Retrieval failed:', ragErr); }
            }
        }

        const finalMessages = injectSystemPrompt(sanitizedMessages, sanitizedProvider, sanitizedModel);

        const executeGeneration = async () => {
            try {
                console.log(`[Main:ChatStream] Request: Model=${sanitizedModel}, Provider=${sanitizedProvider}, ChatID=${sanitizedChatId}`);

                // Sanitize tools if provided
                const sanitizedTools = tools ? sanitizeObject(tools) : undefined

                // 1. Copilot Routing
                if (sanitizedProvider === 'copilot') {
                    // CopilotService expects shared Message[]
                    const body = await copilotService.streamChat(finalMessages, sanitizedModel, sanitizedTools);
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
                                                event.sender.send('ollama:streamChunk', { chatId: sanitizedChatId, content, reasoning });
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
                                            event.sender.send('ollama:streamChunk', { chatId: sanitizedChatId, content, reasoning });
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

                if (sanitizedProvider === 'ollama') {
                    const ollamaUrl = settings.ollama?.url || 'http://localhost:11434'
                    proxyUrl = `${ollamaUrl.replace(/\/$/, '')}/v1`
                    proxyKey = 'ollama'
                }

                // 3. LLMService (Cliproxy) for all others
                for await (const chunk of llmService.chatOpenAIStream(finalMessages, sanitizedModel, sanitizedTools, proxyUrl, proxyKey)) {
                    event.sender.send('ollama:streamChunk', { ...chunk, chatId: sanitizedChatId });
                }
            } catch (error) {
                const message = getErrorMessage(error as Error)
                console.error('[Main:ChatStream] Error:', error);
                event.sender.send('ollama:streamChunk', { chatId: sanitizedChatId, type: 'error', content: message });
            }
        }

        if (sanitizedChatId) {
            chatQueueManager.addTask(sanitizedChatId, executeGeneration)
            return { success: true, queued: true }
        } else {
            executeGeneration()
            return { success: true }
        }
    })

    // Legacy handler
    ipcMain.handle('chat:copilot', createIpcHandler('chat:copilot', async (_event: IpcMainInvokeEvent, messages: Message[], model: string) => {
        // Sanitize inputs
        const sanitizedModel = sanitizeString(model, { maxLength: 200, allowNewlines: false })
        const sanitizedMessages = messages.map(msg => {
            if (typeof msg.content === 'string') {
                return { ...msg, content: sanitizeString(msg.content, { maxLength: 1000000, allowNewlines: true }) }
            } else if (Array.isArray(msg.content)) {
                return {
                    ...msg,
                    content: msg.content.map(item => {
                        if (item.type === 'text' && typeof item.text === 'string') {
                            return { ...item, text: sanitizeString(item.text, { maxLength: 1000000, allowNewlines: true }) }
                        }
                        return item
                    })
                }
            }
            return msg
        })

        // CopilotService expects shared Message[]
        const res = await copilotService.chat(sanitizedMessages, sanitizedModel)
        // Extract content safely
        const contentVal = res ? (Array.isArray(res.content) ? res.content : res.content) as JsonValue : ''
        const content = parseAIResponseContent(contentVal)
        return { content, role: 'assistant' }
    }))
}
