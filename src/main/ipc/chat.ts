import { chatQueueManager } from '@main/services/chat-queue.manager'
import { ContextRetrievalService } from '@main/services/llm/context-retrieval.service'
import { CopilotService } from '@main/services/llm/copilot.service'
import { LLMService } from '@main/services/llm/llm.service'
import { CodeIntelligenceService } from '@main/services/project/code-intelligence.service'
import { ProxyService } from '@main/services/proxy/proxy.service'
import { SettingsService } from '@main/services/system/settings.service'
import { createIpcHandler } from '@main/utils/ipc-wrapper.util'
import { parseAIResponseContent } from '@main/utils/response-parser'
import { Message, ToolDefinition } from '@shared/types/chat'
import { JsonObject, JsonValue } from '@shared/types/common'
import { getErrorMessage } from '@shared/utils/error.util'
import { sanitizeObject, sanitizeString } from '@shared/utils/sanitize.util'
import { ipcMain, WebContents } from 'electron'
import { IpcMainInvokeEvent } from 'electron'

/**
 * Safely send IPC message to renderer, catching broken pipe errors
 * when the window/webContents has been destroyed
 */
function safeSend(sender: WebContents, channel: string, ...args: unknown[]): boolean {
    const senderId = sender.id;
    const senderURL = sender.getURL();
    try {
        if (sender.isDestroyed()) {
            console.warn(`[IPC:safeSend] Attempted to send to destroyed sender ${senderId}`);
            return false
        }
        console.log(`[IPC:safeSend] Sending to channel=${channel}, senderId=${senderId}, url=${senderURL}`);
        sender.send(channel, ...args)
        return true
    } catch (e) {
        const msg = getErrorMessage(e as Error)
        // Silently ignore broken pipe / destroyed errors
        if (!msg.includes('EPIPE') && !msg.includes('destroyed') && !msg.includes('broken pipe')) {
            console.error(`[IPC:safeSend] Failed to send to ${channel} (senderId=${senderId}):`, msg)
        }
        return false
    }
}

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
        // Validate inputs
        if (!Array.isArray(messages) || messages.length === 0) {
            throw new Error('Messages must be a non-empty array');
        }
        if (!model || typeof model !== 'string') {
            throw new Error('Model must be a non-empty string');
        }
        if (!provider || typeof provider !== 'string') {
            throw new Error('Provider must be a non-empty string');
        }

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

        // Sanitize tools if provided (tools is an array, not an object)
        const sanitizedTools: ToolDefinition[] | undefined = tools ? tools.map(tool => ({
            type: tool.type,
            function: {
                name: tool.function.name,
                description: tool.function.description,
                parameters: tool.function.parameters ? sanitizeObject(tool.function.parameters as Record<string, unknown>) as JsonObject : undefined
            }
        })) : undefined

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

        // 2. Opencode Routing
        if (sanitizedProvider === 'opencode') {
            console.log(`[Main] Routing ${sanitizedModel} via OpenCode`)
            const res = await llmService.chatOpenCode(finalMessages, sanitizedModel, sanitizedTools)
            const content = res.content || '';
            const reasoning = res.reasoning_content || '';
            const images = res.images || [];
            return { content, reasoning, images, role: 'assistant', sources };
        }

        // 3. Cliproxy Routing (Default for everything else)
        const proxyUrl = settings.proxy?.url || 'http://localhost:8317/v1'
        const proxyKey = await proxyService.getProxyKey()

        console.log(`[Main] Routing ${sanitizedModel} via Cliproxy/LLMService`)
        const res = await llmService.chatOpenAI(finalMessages, sanitizedModel, sanitizedTools, proxyUrl, proxyKey);
        const content = res.content || '';
        const reasoning = res.reasoning_content || '';
        const images = res.images || [];

        return { content, reasoning, images, role: 'assistant', sources };
    }))

    /**
     * Sanitizes and validates stream input parameters
     */
    function sanitizeStreamInputs(
        messages: Message[],
        model: string,
        provider: string,
        chatId: string,
        projectId?: string
    ): { sanitizedModel: string; sanitizedProvider: string; sanitizedChatId: string; sanitizedProjectId?: string; sanitizedMessages: Message[] } {
        if (!Array.isArray(messages) || messages.length === 0) {
            throw new Error('Messages must be a non-empty array');
        }
        if (!model || typeof model !== 'string') {
            throw new Error('Model must be a non-empty string');
        }
        if (!provider || typeof provider !== 'string') {
            throw new Error('Provider must be a non-empty string');
        }
        if (!chatId || typeof chatId !== 'string') {
            throw new Error('ChatId must be a non-empty string');
        }

        const sanitizedModel = sanitizeString(model, { maxLength: 200, allowNewlines: false });
        const sanitizedProvider = sanitizeString(provider, { maxLength: 50, allowNewlines: false });
        const sanitizedChatId = sanitizeString(chatId, { maxLength: 100, allowNewlines: false });
        const sanitizedProjectId = projectId ? sanitizeString(projectId, { maxLength: 100, allowNewlines: false }) : undefined;

        const sanitizedMessages = messages.map(msg => {
            if (typeof msg.content === 'string') {
                return { ...msg, content: sanitizeString(msg.content, { maxLength: 1000000, allowNewlines: true }) };
            } else if (Array.isArray(msg.content)) {
                return {
                    ...msg,
                    content: msg.content.map(item => {
                        if (item.type === 'text' && typeof item.text === 'string') {
                            return { ...item, text: sanitizeString(item.text, { maxLength: 1000000, allowNewlines: true }) };
                        }
                        return item;
                    })
                };
            }
            return msg;
        });

        return { sanitizedModel, sanitizedProvider, sanitizedChatId, sanitizedProjectId, sanitizedMessages };
    }

    /**
     * Injects RAG context into messages for streaming
     */
    async function injectRAGContextForStream(
        messages: Message[],
        projectId: string | undefined,
        chatId: string,
        event: IpcMainInvokeEvent
    ): Promise<Message[]> {
        if (!projectId || messages.length === 0) {
            return messages;
        }

        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role !== 'user') {
            return messages;
        }

        try {
            const query = typeof lastMessage.content === 'string'
                ? lastMessage.content
                : (Array.isArray(lastMessage.content) ? lastMessage.content.find(p => p.type === 'text')?.text || '' : '');

            if (!query) {
                return messages;
            }

            const { contextString, sources } = await contextRetrievalService.retrieveContext(query, projectId);

            if (!contextString) {
                return messages;
            }

            const ragPrompt = `\n\nRetrieved Context:\n${contextString}`;

            // Emit metadata to frontend
            safeSend(event.sender, 'ollama:streamChunk', {
                chatId,
                type: 'metadata',
                sources: sources.map(src => sanitizeString(src, { maxLength: 500, allowNewlines: false }))
            });

            const systemIdx = messages.findIndex((m) => m.role === 'system');
            if (systemIdx !== -1) {
                const currentContent = typeof messages[systemIdx].content === 'string' ? messages[systemIdx].content : '';
                messages[systemIdx].content = currentContent + ragPrompt;
            } else {
                messages.unshift({ id: 'rag-context', role: 'system', content: ragPrompt, timestamp: new Date() } as Message);
            }
        } catch (ragErr) {
            console.error('[RAG] Retrieval failed:', ragErr);
        }

        return messages;
    }

    /**
     * Handles Copilot streaming response
     */
    async function handleCopilotStream(
        streamBody: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>,
        chatId: string,
        event: IpcMainInvokeEvent
    ): Promise<void> {
        const MAX_STREAM_ITERATIONS = 10000;

        if ('getReader' in streamBody && typeof (streamBody as ReadableStream<Uint8Array>).getReader === 'function') {
            const reader = (streamBody as ReadableStream<Uint8Array>).getReader();
            const decoder = new TextDecoder();
            let iterations = 0;

            try {
                while (iterations < MAX_STREAM_ITERATIONS) {
                    const { done, value } = await reader.read();
                    if (done) { break; }
                    iterations++;

                    const decoded = decoder.decode(value, { stream: true });
                    const lines = decoded.split('\n');

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed?.startsWith('data:')) { continue; }

                        const data = trimmed.slice(5).trim();
                        if (data === '[DONE]') { continue; }

                        try {
                            const json = JSON.parse(data) as JsonObject;
                            const choices = Array.isArray(json['choices']) ? json['choices'] as JsonObject[] : [];
                            const delta = choices[0]?.['delta'] as JsonObject | undefined;

                            if (delta) {
                                const content = delta.content || '';
                                const reasoning = delta.reasoning_content || delta.reasoning || '';
                                if (content || reasoning) {
                                    safeSend(event.sender, 'ollama:streamChunk', { chatId, content, reasoning });
                                }
                            }
                        } catch (err) {
                            console.error('[CopilotStream] Parse error:', err);
                        }
                    }
                }

                if (iterations >= MAX_STREAM_ITERATIONS) {
                    throw new Error('Stream processing exceeded maximum iterations');
                }
            } finally {
                reader.releaseLock();
            }
        } else {
            // Handle AsyncIterable
            for await (const chunk of streamBody as AsyncIterable<Uint8Array>) {
                const decoded = chunk.toString();
                const lines = decoded.split('\n');

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed?.startsWith('data:')) { continue; }

                    const data = trimmed.slice(5).trim();
                    if (data === '[DONE]') { continue; }

                    try {
                        const json = JSON.parse(data) as JsonObject;
                        const choices = Array.isArray(json.choices) ? json.choices as JsonObject[] : [];
                        const delta = choices[0]?.delta as JsonObject | undefined;

                        if (delta) {
                            const content = delta.content || '';
                            const reasoning = delta.reasoning_content || delta.reasoning || '';
                            if (content || reasoning) {
                                safeSend(event.sender, 'ollama:streamChunk', { chatId, content, reasoning });
                            }
                        }
                    } catch (err) {
                        console.error('[CopilotStream] Buffer Parse error:', err);
                    }
                }
            }
        }
    }

    /**
     * Handles proxy/ollama streaming response
     */
    async function handleOpencodeStream(
        messages: Message[],
        model: string,
        tools: ToolDefinition[] | undefined,
        chatId: string,
        event: IpcMainInvokeEvent
    ): Promise<void> {
        const sanitizedTools: ToolDefinition[] | undefined = tools ? tools.map(tool => ({
            type: tool.type,
            function: {
                name: tool.function.name,
                description: tool.function.description,
                parameters: tool.function.parameters ? sanitizeObject(tool.function.parameters as Record<string, unknown>) as JsonObject : undefined
            }
        })) : undefined;

        for await (const chunk of llmService.chatOpenCodeStream(messages, model, sanitizedTools)) {
            if (!safeSend(event.sender, 'ollama:streamChunk', { ...chunk, chatId })) {
                break; // Stop streaming if window is destroyed
            }
        }
    }

    async function handleProxyStream(
        messages: Message[],
        model: string,
        tools: ToolDefinition[] | undefined,
        provider: string,
        chatId: string,
        event: IpcMainInvokeEvent
    ): Promise<void> {
        const settings = settingsService.getSettings();
        let proxyUrl = settings.proxy?.url || 'http://localhost:8317/v1';
        let proxyKey = await proxyService.getProxyKey();

        if (provider === 'ollama') {
            const ollamaUrl = settings.ollama?.url || 'http://localhost:11434';
            proxyUrl = `${ollamaUrl.replace(/\/$/, '')}/v1`;
            proxyKey = 'ollama';
        }

        const sanitizedTools: ToolDefinition[] | undefined = tools ? tools.map(tool => ({
            type: tool.type,
            function: {
                name: tool.function.name,
                description: tool.function.description,
                parameters: tool.function.parameters ? sanitizeObject(tool.function.parameters as Record<string, unknown>) as JsonObject : undefined
            }
        })) : undefined;

        for await (const chunk of llmService.chatOpenAIStream(messages, model, sanitizedTools, proxyUrl, proxyKey)) {
            console.log(`[Main:Chat:handleProxyStream] Sending chunk to ${chatId}:`, chunk);
            if (!safeSend(event.sender, 'ollama:streamChunk', { ...chunk, chatId })) {
                console.warn(`[Main:Chat:handleProxyStream] Failed to send chunk to ${chatId}, stopping stream`);
                break; // Stop streaming if window is destroyed
            }
        }
    }

    ipcMain.handle('chat:stream', async (event: IpcMainInvokeEvent, messages: Message[], model: string, tools: ToolDefinition[] | undefined, provider: string, _options: JsonObject | undefined, chatId: string, projectId?: string) => {
        const { sanitizedModel, sanitizedProvider, sanitizedChatId, sanitizedProjectId, sanitizedMessages } = sanitizeStreamInputs(messages, model, provider, chatId, projectId);

        const settings = settingsService.getSettings();
        chatQueueManager.setPolicy(settings.ollama?.orchestrationPolicy || 'auto');

        let finalMessages = await injectRAGContextForStream(sanitizedMessages, sanitizedProjectId, sanitizedChatId, event);
        finalMessages = injectSystemPrompt(finalMessages, sanitizedProvider, sanitizedModel);

        const executeGeneration = async (): Promise<void> => {
            try {
                console.log(`[Main:ChatStream] Request: Model=${sanitizedModel}, Provider=${sanitizedProvider}, ChatID=${sanitizedChatId}`);

                if (sanitizedProvider === 'copilot') {
                    const sanitizedTools: ToolDefinition[] | undefined = tools ? tools.map(tool => ({
                        type: tool.type,
                        function: {
                            name: tool.function.name,
                            description: tool.function.description,
                            parameters: tool.function.parameters ? sanitizeObject(tool.function.parameters as Record<string, unknown>) as JsonObject : undefined
                        }
                    })) : undefined;
                    const body = await copilotService.streamChat(finalMessages, sanitizedModel, sanitizedTools);
                    if (!body) { throw new Error('Failed to start Copilot stream'); }
                    await handleCopilotStream(body as ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>, sanitizedChatId, event);
                    return;
                } else if (sanitizedProvider === 'opencode') {
                    await handleOpencodeStream(finalMessages, sanitizedModel, tools, sanitizedChatId, event);
                    return;
                }

                await handleProxyStream(finalMessages, sanitizedModel, tools, sanitizedProvider, sanitizedChatId, event);
            } catch (error) {
                const message = getErrorMessage(error as Error);
                console.error('[Main:ChatStream] Error:', error);
                safeSend(event.sender, 'ollama:streamChunk', { chatId: sanitizedChatId, type: 'error', content: message });
            } finally {
                safeSend(event.sender, 'ollama:streamChunk', { chatId: sanitizedChatId, done: true });
            }
        };

        if (sanitizedChatId) {
            // Use enhanced multi-LLM orchestrator
            chatQueueManager.addTask(sanitizedChatId, executeGeneration, {
                provider: sanitizedProvider,
                model: sanitizedModel,
                priority: 5 // Default priority
            });
            return { success: true, queued: true };
        } else {
            executeGeneration();
            return { success: true };
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
