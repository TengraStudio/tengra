import { appLogger } from '@main/logging/logger';
import { chatQueueManager, OrchestrationPolicy } from '@main/services/chat-queue.service';
import { ContextRetrievalService } from '@main/services/llm/context-retrieval.service';
import { CopilotService } from '@main/services/llm/copilot.service';
import { LLMService } from '@main/services/llm/llm.service';
import { CodeIntelligenceService } from '@main/services/project/code-intelligence.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { SettingsService } from '@main/services/system/settings.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { parseAIResponseContent } from '@main/utils/response-parser';
import { StreamParser } from '@main/utils/stream-parser.util';
import { Message, ToolDefinition } from '@shared/types/chat';
import { JsonObject, JsonValue } from '@shared/types/common';
import { getErrorMessage } from '@shared/utils/error.util';
import { sanitizeObject, sanitizeString } from '@shared/utils/sanitize.util';
import { ipcMain, IpcMainInvokeEvent, WebContents } from 'electron';

/**
 * Safely send IPC message to renderer
 */
function safeSend(sender: WebContents, channel: string, ...args: unknown[]): boolean {
    try {
        if (sender.isDestroyed()) { return false; }
        sender.send(channel, ...args);
        return true;
    } catch (e) {
        const msg = getErrorMessage(e as Error);
        if (!msg.includes('EPIPE') && !msg.includes('destroyed')) {
            appLogger.error('IPC', `[IPC:safeSend] Failed to send to ${channel}: ${msg}`);
        }
        return false;
    }
}

const PROVIDER_INSTRUCTIONS: Record<string, string> = {
    'antigravity': "Ben, **Antigravity** tarafından **Orbit** platformu üzerinden sağlanan gelişmiş bir yapay zeka asistanıyım. Size en iyi şekilde yardımcı olmak için buradayım.",
    'copilot': "Ben GitHub Copilot tarafından sağlanan bir yapay zeka programlama asistanıyım.",
    'ollama': "Ben yerel olarak çalışan bir Ollama modeliyim."
};

class ChatUtils {
    static injectSystemPrompt(messages: Message[], provider: string, model: string, settingsService: SettingsService): Message[] {
        const settings = settingsService.getSettings();
        const customPrompt = this.getCustomPrompt(settings, provider);
        const branding = this.getBrandingInstruction(provider, model);
        const finalInstruction = branding + (customPrompt ? `\n\n${customPrompt}` : '');

        const systemMessage = messages.find(m => m.role === 'system');
        if (systemMessage) {
            systemMessage.content = (typeof systemMessage.content === 'string' ? systemMessage.content : '') + '\n\n' + finalInstruction;
            return messages;
        }

        return [{
            id: `system-${Date.now()}`,
            role: 'system',
            content: finalInstruction,
            timestamp: new Date()
        } as Message, ...messages];
    }

    private static getCustomPrompt(settings: JsonObject, provider: string): string | undefined {
        const providerPrompt = (settings[provider] as JsonObject | undefined)?.['systemPrompt'];
        if (typeof providerPrompt === 'string') { return providerPrompt; }
        const aiPrompt = (settings['ai'] as JsonObject | undefined)?.['systemPrompt'];
        if (typeof aiPrompt === 'string') { return aiPrompt; }
        return undefined;
    }

    private static getBrandingInstruction(provider: string, model: string): string {
        const isImage = model.toLowerCase().includes('image') || model.toLowerCase().includes('imagen');
        const base = PROVIDER_INSTRUCTIONS[provider.toLowerCase()] ?? PROVIDER_INSTRUCTIONS['antigravity'];

        if (provider === 'antigravity' && isImage) {
            return base + "\n\n**Önemli:** Sen bir görüntü oluşturma (Image Generation) modelisin. Kullanıcı senden bir şey çizmeni, oluşturmanı veya bir görsel yapmanı istediğinde, bunu doğrudan gerçekleştirebilirsin. Görseller otomatik olarak oluşturulup kullanıcıya gösterilecektir.";
        }
        return base;
    }

    static sanitizeTools(tools: ToolDefinition[] | undefined): ToolDefinition[] | undefined {
        return tools?.map(tool => ({
            type: tool.type,
            function: {
                name: tool.function.name,
                description: tool.function.description,
                parameters: tool.function.parameters ? sanitizeObject(tool.function.parameters as Record<string, unknown>) as JsonObject : undefined
            }
        }));
    }

    static async getProxySettings(provider: string, settingsService: SettingsService, proxyService: ProxyService) {
        const settings = settingsService.getSettings();
        if (provider === 'ollama') {
            const ollamaSettings = settings['ollama'] as JsonObject | undefined;
            const ollamaUrl = (ollamaSettings?.['url'] as string | undefined) ?? 'http://localhost:11434';
            return { url: `${ollamaUrl.replace(/\/$/, '')}/v1`, key: 'ollama' };
        }
        const proxySettings = settings['proxy'] as JsonObject | undefined;
        const proxyUrl = (proxySettings?.['url'] as string | undefined) ?? 'http://localhost:8317/v1';
        return {
            url: proxyUrl,
            key: await proxyService.getProxyKey()
        };
    }
}

class RAGUtils {
    static async handleRAGContext(messages: Message[], projectId: string, contextService: ContextRetrievalService): Promise<string[]> {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role !== 'user') { return []; }

        try {
            const query = this.extractQuery(lastMessage);
            if (!query) { return []; }

            const { contextString, sources } = await contextService.retrieveContext(query, projectId);
            if (!contextString) { return []; }

            this.injectContext(messages, contextString);
            return sources.map(src => sanitizeString(src, { maxLength: 500, allowNewlines: false }));
        } catch (e) {
            appLogger.error('RAG', `[RAG] Retrieval failed: ${getErrorMessage(e as Error)}`);
            return [];
        }
    }

    static extractQuery(message: Message): string {
        if (typeof message.content === 'string') { return message.content; }
        if (Array.isArray(message.content)) {
            return message.content.find(p => p.type === 'text')?.text ?? '';
        }
        return '';
    }

    static injectContext(messages: Message[], context: string) {
        const ragPrompt = `\n\nBu soruyu cevaplamana yardımcı olabilecek ilgili kod parçacıkları:\n\n${context}`;
        const systemMessage = messages.find(m => m.role === 'system');

        if (systemMessage) {
            systemMessage.content = (typeof systemMessage.content === 'string' ? systemMessage.content : '') + ragPrompt;
        } else {
            messages.unshift({ id: `rag-${Date.now()}`, role: 'system', content: ragPrompt, timestamp: new Date() } as Message);
        }
    }
}

interface ChatIpcOptions {
    settingsService: SettingsService;
    copilotService: CopilotService;
    llmService: LLMService;
    proxyService: ProxyService;
    codeIntelligenceService: CodeIntelligenceService;
    contextRetrievalService: ContextRetrievalService;
}

class ChatIpcManager {
    constructor(private options: ChatIpcOptions) { }

    async handleOpenAIChat(event: IpcMainInvokeEvent, params: { messages: Message[], model: string, tools?: ToolDefinition[], provider: string, projectId?: string }) {
        const { messages, model, provider, tools, projectId } = params;
        const sanitized = this.sanitizeRequestParams(messages, model, provider, tools, projectId);
        let sources: string[] = [];

        if (sanitized.projectId && sanitized.messages.length > 0) {
            sources = await RAGUtils.handleRAGContext(sanitized.messages, sanitized.projectId, this.options.contextRetrievalService);
        }

        const finalMessages = ChatUtils.injectSystemPrompt(sanitized.messages, sanitized.provider, sanitized.model, this.options.settingsService);

        if (sanitized.provider === 'copilot') {
            const res = await this.options.copilotService.chat(finalMessages, sanitized.model, sanitized.tools);
            return { content: parseAIResponseContent(res?.content as JsonValue), role: 'assistant' };
        }

        return this.executeGeneralChat(sanitized, finalMessages, sources);
    }

    private async executeGeneralChat(sanitized: { model: string, tools?: ToolDefinition[], provider: string }, finalMessages: Message[], sources: string[]) {
        if (sanitized.provider === 'opencode') {
            const res = await this.options.llmService.chatOpenCode(finalMessages, sanitized.model, sanitized.tools);
            return { content: res.content, reasoning: res.reasoning_content, images: res.images, role: 'assistant', sources };
        }

        const { url: proxyUrl, key: proxyKey } = await ChatUtils.getProxySettings(sanitized.provider, this.options.settingsService, this.options.proxyService);
        const res = await this.options.llmService.chatOpenAI(finalMessages, {
            model: sanitized.model, tools: sanitized.tools, baseUrl: proxyUrl, apiKey: proxyKey, provider: sanitized.provider
        });

        return {
            content: res.content, reasoning: res.reasoning_content, images: res.images, role: 'assistant', sources
        };
    }

    async handleChatStream(event: IpcMainInvokeEvent, params: { messages: Message[], model: string, tools?: ToolDefinition[], provider: string, optionsJson: JsonObject | undefined, chatId: string, projectId?: string }) {
        const sanitized = this.sanitizeStreamInputs(params);
        const settings = this.options.settingsService.getSettings();
        const ollamaSettings = settings['ollama'] as JsonObject | undefined;
        const orchestrationPolicy = (ollamaSettings?.['orchestrationPolicy'] as OrchestrationPolicy | undefined) ?? 'auto';
        chatQueueManager.setPolicy(orchestrationPolicy);

        let finalMessages = await this.injectRAGContextForStream(sanitized.messages, sanitized.projectId, sanitized.chatId, event);
        finalMessages = ChatUtils.injectSystemPrompt(finalMessages, sanitized.provider, sanitized.model, this.options.settingsService);

        try {
            if (sanitized.provider === 'copilot') {
                const body = await this.options.copilotService.streamChat(finalMessages, sanitized.model, sanitized.tools);
                if (!body) { throw new Error('Failed to start Copilot stream'); }
                await this.handleCopilotStream(body as ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>, sanitized.chatId, event);
            } else if (sanitized.provider === 'opencode') {
                await this.handleOpencodeStream(finalMessages, sanitized.model, sanitized.tools, sanitized.chatId, event);
            } else {
                await this.handleProxyStream({ messages: finalMessages, model: sanitized.model, tools: sanitized.tools, provider: sanitized.provider, chatId: sanitized.chatId, event });
            }
        } catch (error) {
            const msg = getErrorMessage(error as Error);
            appLogger.error('Chat', `[ChatStream] Error: ${msg}`);
            safeSend(event.sender, 'ollama:streamChunk', { chatId: sanitized.chatId, type: 'error', content: msg });
        } finally {
            safeSend(event.sender, 'ollama:streamChunk', { chatId: sanitized.chatId, done: true });
        }
    }

    private sanitizeRequestParams(messages: Message[], model: string, provider: string, tools?: ToolDefinition[], projectId?: string) {
        if (!Array.isArray(messages) || messages.length === 0) { throw new Error('Messages must be a non-empty array'); }
        if (!model) { throw new Error('Model must be a non-empty string'); }
        if (!provider) { throw new Error('Provider must be a non-empty string'); }

        return {
            messages: messages.map(m => this.sanitizeChatMessage(m)),
            model: sanitizeString(model, { maxLength: 200, allowNewlines: false }),
            provider: sanitizeString(provider, { maxLength: 50, allowNewlines: false }),
            projectId: projectId ? sanitizeString(projectId, { maxLength: 100, allowNewlines: false }) : undefined,
            tools: ChatUtils.sanitizeTools(tools)
        };
    }

    private sanitizeChatMessage(msg: Message): Message {
        if (typeof msg.content === 'string') {
            return { ...msg, content: sanitizeString(msg.content, { maxLength: 1000000, allowNewlines: true }) };
        }
        // msg.content is guaranteed to be an array here by type definition
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

    private sanitizeStreamInputs(params: { messages: Message[], model: string, provider: string, chatId: string, tools?: ToolDefinition[], projectId?: string }) {
        const { messages, model, provider, chatId, tools, projectId } = params;
        if (!chatId) { throw new Error('Chat ID must be a non-empty string'); }

        const sanitized = this.sanitizeRequestParams(messages, model, provider, tools, projectId);
        return {
            ...sanitized,
            chatId: sanitizeString(chatId, { maxLength: 100, allowNewlines: false })
        };
    }

    private async injectRAGContextForStream(messages: Message[], projectId: string | undefined, chatId: string, event: IpcMainInvokeEvent): Promise<Message[]> {
        if (!projectId || messages.length === 0) { return messages; }

        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role !== 'user') { return messages; }

        try {
            const query = RAGUtils.extractQuery(lastMessage);
            if (!query) { return messages; }

            const { contextString, sources } = await this.options.contextRetrievalService.retrieveContext(query, projectId);
            if (!contextString) { return messages; }

            safeSend(event.sender, 'ollama:streamChunk', {
                chatId, type: 'metadata', sources: sources.map(src => sanitizeString(src, { maxLength: 500, allowNewlines: false }))
            });

            RAGUtils.injectContext(messages, contextString);
        } catch (ragErr) {
            appLogger.error('RAG', `[RAG] Retrieval failed: ${getErrorMessage(ragErr as Error)}`);
        }
        return messages;
    }

    private async handleCopilotStream(streamBody: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>, chatId: string, event: IpcMainInvokeEvent) {
        try {
            for await (const chunk of StreamParser.parseChatStream(streamBody)) {
                if (chunk.content || chunk.reasoning) {
                    safeSend(event.sender, 'ollama:streamChunk', {
                        chatId,
                        content: chunk.content,
                        reasoning: chunk.reasoning
                    });
                }
            }
        } catch (error) {
            appLogger.error('Chat', `[CopilotStream] Error: ${getErrorMessage(error as Error)}`);
            throw error;
        }
    }

    private async handleOpencodeStream(messages: Message[], model: string, tools: ToolDefinition[] | undefined, chatId: string, event: IpcMainInvokeEvent) {
        for await (const chunk of this.options.llmService.chatOpenAIStream(messages, {
            model, tools, baseUrl: 'https://api.opencode.com/v1', apiKey: 'opencode', provider: 'opencode'
        })) {
            if (!safeSend(event.sender, 'ollama:streamChunk', { ...chunk, chatId })) { break; }
        }
    }

    private async handleProxyStream(params: { messages: Message[], model: string, tools?: ToolDefinition[], provider: string, chatId: string, event: IpcMainInvokeEvent }) {
        const { messages, model, tools, provider, chatId, event } = params;
        const { url, key } = await ChatUtils.getProxySettings(provider, this.options.settingsService, this.options.proxyService);
        for await (const chunk of this.options.llmService.chatOpenAIStream(messages, {
            model, tools, baseUrl: url, apiKey: key, provider
        })) {
            if (!safeSend(event.sender, 'ollama:streamChunk', { ...chunk, chatId })) { break; }
        }
    }
}

export function registerChatIpc(options: ChatIpcOptions) {
    const manager = new ChatIpcManager(options);

    ipcMain.handle('chat:openai', createIpcHandler('chat:openai', (event, ...args: unknown[]) =>
        manager.handleOpenAIChat(event, { messages: args[0] as Message[], model: args[1] as string, tools: args[2] as ToolDefinition[], provider: args[3] as string, projectId: args[4] as string })
    ));

    ipcMain.handle('chat:stream', (event, ...args: unknown[]) =>
        manager.handleChatStream(event, { messages: args[0] as Message[], model: args[1] as string, tools: args[2] as ToolDefinition[], provider: args[3] as string, optionsJson: args[4] as JsonObject, chatId: args[5] as string, projectId: args[6] as string })
    );

    ipcMain.handle('chat:copilot', createIpcHandler('chat:copilot', async (_event, messages: Message[], model: string) => {
        const res = await options.copilotService.chat(messages, model);
        return { content: parseAIResponseContent(res?.content as JsonValue), role: 'assistant' };
    }));
}
