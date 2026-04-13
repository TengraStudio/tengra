import * as path from 'path';

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import {
    createSessionEvidenceState,
    recordContentAsEvidence,
} from '@main/ipc/session-conversation-evidence.util';
import {
    persistConversationAssistantMessage,
    recordConversationTokens,
} from '@main/ipc/session-conversation-persistence.util';
import { injectConversationSystemPrompt } from '@main/ipc/session-conversation-prompt.util';
import {
    extractConversationQuery,
    handleConversationRagContext,
    injectConversationContext,
} from '@main/ipc/session-conversation-rag.util';
import {
    buildConversationAssistantMetadata,
    createConversationCompleteResult,
} from '@main/ipc/session-conversation-runtime.util';
import {
    applySessionStreamChunk,
    createSessionStreamEvidenceState,
} from '@main/ipc/session-conversation-stream-evidence.util';
import { safeSendConversationChunk } from '@main/ipc/session-conversation-stream-ipc.util';
import {
    extractConversationAccountId,
    extractConversationReasoningEffort,
    sanitizeConversationRequestParams,
    sanitizeConversationStreamInputs,
} from '@main/ipc/session-conversation-validation.util';
import { appLogger } from '@main/logging/logger';
import { chatQueueManager, OrchestrationPolicy } from '@main/services/chat-queue.service';
import { DatabaseService } from '@main/services/data/database.service';
import { ContextRetrievalService } from '@main/services/llm/context-retrieval.service';
import { LLMService } from '@main/services/llm/llm.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { ChatSessionRegistryService } from '@main/services/session/chat-session-registry.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { LocaleService } from '@main/services/system/locale.service';
import { SettingsService } from '@main/services/system/settings.service';
import { CodeIntelligenceService } from '@main/services/workspace/code-intelligence.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import {
    SESSION_CONVERSATION_CHANNELS,
} from '@shared/constants/ipc-channels';
import {
    sessionConversationCompleteRequestSchema,
    sessionConversationCompleteResponseSchema,
    sessionConversationRetryRequestSchema,
    sessionConversationRetryResponseSchema,
    sessionConversationStreamRequestSchema,
    sessionConversationStreamResponseSchema,
} from '@shared/schemas/session-conversation-ipc.schema';
import { Message, SystemMode, ToolCall, ToolDefinition, ToolResult } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { SessionCapability, SessionMessageEnvelope, SessionStartOptions } from '@shared/types/session-engine';
import { getErrorMessage } from '@shared/utils/error.util';
import { sanitizeString } from '@shared/utils/sanitize.util';
import { estimateTokens } from '@shared/utils/token.util';
import { app, BrowserWindow, ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';

type SessionConversationCompleteRequest = z.infer<typeof sessionConversationCompleteRequestSchema>;
type SessionConversationStreamRequest = z.infer<typeof sessionConversationStreamRequestSchema>;
type SessionConversationRetryRequest = z.infer<typeof sessionConversationRetryRequestSchema>;

interface ConversationCompleteParams { 
    messages: Message[]; 
    model: string; 
    tools?: ToolDefinition[]; 
    provider: string; 
    workspaceId?: string; 
    systemMode?: SystemMode; 
    chatId?: string; 
}

interface ConversationStreamParams { 
    messages: Message[]; 
    model: string; 
    tools?: ToolDefinition[]; 
    provider: string; 
    optionsJson: JsonObject | undefined; 
    chatId: string; 
    assistantId?: string;
    streamId?: string;
    workspaceId?: string; 
    systemMode?: SystemMode; 
}

interface ConversationRetryParams { 
    chatId: string; 
    messageId: string; 
    model: string; 
    provider: string; 
}

interface SessionConversationIpcOptions {

    getMainWindow: () => BrowserWindow | null;
    settingsService: SettingsService;
    localeService: LocaleService;
    llmService: LLMService;
    proxyService: ProxyService;
    codeIntelligenceService: CodeIntelligenceService;
    contextRetrievalService: ContextRetrievalService;
    databaseService: DatabaseService;
    chatSessionRegistryService?: ChatSessionRegistryService;
}

class SessionConversationIpcManager {
    private readonly chatSessionRegistryService: ChatSessionRegistryService;

    constructor(private options: SessionConversationIpcOptions) {
        this.chatSessionRegistryService =
            options.chatSessionRegistryService ??
            new ChatSessionRegistryService(new EventBusService());
    }

    async handleConversationComplete(_event: IpcMainInvokeEvent, params: ConversationCompleteParams) {
        const { messages, model, provider, tools, workspaceId, systemMode, chatId } = params;
        const sanitized = sanitizeConversationRequestParams({ messages, model, provider, tools, workspaceId, systemMode, chatId });
        let sources: string[] = [];
        const sessionId = `session-conversation-complete-${Date.now()}`;
        
        await this.prepareChatSession(sessionId, sanitized);

        if (sanitized.workspaceId && sanitized.messages.length > 0) {
            sources = await handleConversationRagContext(sanitized.messages, sanitized.workspaceId, this.options.contextRetrievalService);
        }

        const permissionPolicy = await this.getPermissionPolicy(params.chatId);
        const finalMessages = injectConversationSystemPrompt({
            messages: sanitized.messages,
            provider: sanitized.provider,
            model: sanitized.model,
            settingsService: this.options.settingsService,
            localeService: this.options.localeService,
            permissionPolicy,
            evidenceContext: '',
        });

        try {
            const result = await this.executeGeneralChat(sanitized, finalMessages, sources);
            const evidenceState = createSessionEvidenceState();
            
            // Record results as evidence
            if (result.toolCalls && result.toolCalls.length > 0) {
                // Since this is Main process, we'd normally execute tools here if it was a deep-orchestrator.
                // For now, we normalize the metadata based on the LLM's direct response.
            }

            const assistantMetadata = buildConversationAssistantMetadata({
                messages: sanitized.messages,
                settingsService: this.options.settingsService,
                systemMode: sanitized.systemMode,
                content: result.content,
                reasoning: result.reasoning,
                toolCalls: result.toolCalls,
                sources: result.sources,
                images: result.images,
            });

            // Update evidence based on what we just got
            recordContentAsEvidence(evidenceState, result.content);
            
            await this.chatSessionRegistryService.appendMessage(
                sessionId,
                this.createAssistantEnvelope(result.content, {
                    ...assistantMetadata,
                    model: sanitized.model,
                    provider: sanitized.provider,
                })
            );
            await this.chatSessionRegistryService.markCompleted(sessionId);
            return createConversationCompleteResult({
                messages: sanitized.messages,
                settingsService: this.options.settingsService,
                systemMode: sanitized.systemMode,
                content: result.content,
                reasoning: result.reasoning,
                toolCalls: result.toolCalls,
                sources: result.sources,
                images: result.images,
                role: 'assistant',
            });
        } catch (error) {
            const message = getErrorMessage(error as Error);
            await this.chatSessionRegistryService.markFailed(sessionId, message);
            throw error;
        }
    }

    private async executeGeneralChat(
        sanitized: { model: string, tools?: ToolDefinition[], provider: string, workspaceId?: string, chatId?: string },
        finalMessages: Message[],
        sources: string[]
    ) {
        if (sanitized.provider === 'opencode') {
            const res = await this.options.llmService.chatOpenCode(finalMessages, sanitized.model, sanitized.tools);
            await this.recordTokens(sanitized, res, finalMessages);
            return {
                content: res.content,
                reasoning: res.reasoning_content,
                images: res.images,
                toolCalls: res.tool_calls,
                role: 'assistant' as const,
                sources,
            };
        }

        const res = await this.options.llmService.chat(finalMessages, sanitized.model, sanitized.tools, sanitized.provider, {
            workspaceRoot: sanitized.workspaceId ? undefined : path.join(app.getPath('userData'), 'runtime', 'sessions', sanitized.chatId ?? 'default')
        });

        await this.recordTokens(sanitized, res, finalMessages);

        return {
            content: res.content,
            reasoning: res.reasoning_content,
            images: res.images,
            toolCalls: res.tool_calls,
            role: 'assistant',
            sources,
        } as const;
    }

    private async recordTokens(sanitized: { model: string, provider: string, workspaceId?: string, chatId?: string }, res: { promptTokens?: number; completionTokens?: number }, messages: Message[]) {
        await recordConversationTokens({
            databaseService: this.options.databaseService,
            model: sanitized.model,
            provider: sanitized.provider,
            workspaceId: sanitized.workspaceId,
            chatId: sanitized.chatId,
            promptTokens: res.promptTokens,
            completionTokens: res.completionTokens,
            messages,
        });
    }

    async handleChatStream(event: IpcMainInvokeEvent, params: ConversationStreamParams) {
        const sanitized = sanitizeConversationStreamInputs(params);
        appLogger.info(
            'Chat',
            `[ChatStream] start chatId=${sanitized.chatId} provider=${sanitized.provider} model=${sanitized.model} messages=${sanitized.messages.length} tools=${sanitized.tools?.length ?? 0}`
        );
        await this.startChatSession({
            sessionId: sanitized.chatId,
            mode: sanitized.workspaceId ? 'workspace' : 'chat',
            capabilities: this.getCapabilitiesForRequest(sanitized.workspaceId, sanitized.tools),
            model: {
                provider: sanitized.provider,
                model: sanitized.model,
                reasoningLevel: extractConversationReasoningEffort(params.optionsJson),
            },
            metadata: {
                workspaceId: sanitized.workspaceId,
                chatId: sanitized.chatId,
                sourceSurface: SESSION_CONVERSATION_CHANNELS.STREAM,
            },
            initialMessages: sanitized.messages.map(message => this.toSessionMessage(message)),
        });
        await this.chatSessionRegistryService.markPreparing(sanitized.chatId);
        const reasoningEffort = extractConversationReasoningEffort(params.optionsJson);
        const accountId = extractConversationAccountId(params.optionsJson);
        const settings = this.options.settingsService.getSettings();
        const ollamaSettings = settings['ollama'] as JsonObject | undefined;
        const orchestrationPolicy = (ollamaSettings?.['orchestrationPolicy'] as OrchestrationPolicy | undefined) ?? 'auto';
        chatQueueManager.setPolicy(orchestrationPolicy);

        let finalMessages = await this.injectRAGContextForStream({
            messages: sanitized.messages,
            workspaceId: sanitized.workspaceId,
            chatId: sanitized.chatId,
            provider: sanitized.provider,
            event,
            streamId: sanitized.streamId,
        });
        finalMessages = injectConversationSystemPrompt({
            messages: finalMessages,
            provider: sanitized.provider,
            model: sanitized.model,
            settingsService: this.options.settingsService,
            localeService: this.options.localeService,
            permissionPolicy: undefined, // No permission policy in stream yet
            evidenceContext: '',
        });

        const controller = new AbortController();
        const { signal } = controller;

        const cancelHandler = (_event: IpcMainEvent, { chatId }: { chatId: string }) => {
            if (chatId === params.chatId) {
                appLogger.warn('Chat', `[ChatStream] cancel event received chatId=${chatId}`);
                controller.abort();
            }
        };
        const cancelChannels = [SESSION_CONVERSATION_CHANNELS.CANCEL] as const;
        for (const cancelChannel of cancelChannels) {
            ipcMain.on(cancelChannel, cancelHandler);
        }

        try {
            await this.chatSessionRegistryService.markStreaming(sanitized.chatId);
            if (sanitized.provider === 'opencode') {
                await this.handleOpencodeStream({
                    messages: finalMessages,
                    originalMessages: sanitized.messages,
                    model: sanitized.model,
                    tools: sanitized.tools,
                    chatId: sanitized.chatId,
                    event,
                    signal,
                    systemMode: sanitized.systemMode,
                    assistantId: sanitized.assistantId,
                    streamId: sanitized.streamId,
                });
            } else {
                await this.handleProxyStream({
                    messages: finalMessages,
                    originalMessages: sanitized.messages,
                    model: sanitized.model,
                    tools: sanitized.tools,
                    provider: sanitized.provider,
                    chatId: sanitized.chatId,
                    event,
                    systemMode: sanitized.systemMode,
                    workspaceId: sanitized.workspaceId,
                    signal,
                    reasoningEffort,
                    accountId,
                    assistantId: sanitized.assistantId,
                    streamId: sanitized.streamId,
                });
            }
        } catch (error) {
            if ((error as Error).name === 'AbortError') {
                appLogger.info('Chat', `[ChatStream] Stream aborted by user: ${sanitized.chatId}`);
                await this.chatSessionRegistryService.markInterrupted(sanitized.chatId, 'aborted');
            } else {
                const msg = getErrorMessage(error as Error);
                appLogger.error('Chat', `[ChatStream] Error: ${msg}`);
                await this.chatSessionRegistryService.markFailed(sanitized.chatId, msg);
                safeSendConversationChunk(event.sender, { chatId: sanitized.chatId, streamId: sanitized.streamId, type: 'error', content: msg });
            }
        } finally {
            appLogger.info('Chat', `[ChatStream] finalize chatId=${sanitized.chatId}`);
            for (const cancelChannel of cancelChannels) {
                ipcMain.removeListener(cancelChannel, cancelHandler);
            }
            const snapshot = this.chatSessionRegistryService.getSnapshot(sanitized.chatId);
            if (snapshot?.status === 'streaming') {
                await this.chatSessionRegistryService.markCompleted(sanitized.chatId);
            }
            safeSendConversationChunk(event.sender, { chatId: sanitized.chatId, streamId: sanitized.streamId, done: true });
        }
    }

    private async startChatSession(options: SessionStartOptions): Promise<void> {
        await this.chatSessionRegistryService.startSession(options);
    }

    private getCapabilitiesForRequest(
        workspaceId: string | undefined,
        tools: ToolDefinition[] | undefined
    ): SessionCapability[] {
        const capabilities: SessionCapability[] = ['recovery'];
        if (workspaceId) {
            capabilities.push('workspace_context', 'rag');
        }
        if (tools && tools.length > 0) {
            capabilities.push('tools');
        }
        return capabilities;
    }

    private toSessionMessage(message: Message): SessionMessageEnvelope {
        const metadata: JsonObject = {};
        if (typeof message.provider === 'string' && message.provider.trim().length > 0) {
            metadata.provider = sanitizeString(message.provider, { maxLength: 50, allowNewlines: false });
        }
        if (typeof message.model === 'string' && message.model.trim().length > 0) {
            metadata.model = sanitizeString(message.model, { maxLength: 200, allowNewlines: false });
        }
        return {
            id: String(message.id),
            role: message.role === 'tool' ? 'tool' : message.role,
            content: typeof message.content === 'string'
                ? message.content
                : message.content
                    .map(item => item.type === 'text' ? item.text : item.image_url.url)
                    .join('\n'),
            createdAt: message.timestamp instanceof Date ? message.timestamp.getTime() : Date.now(),
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        };
    }

    private async persistStreamedAssistantMessage(params: {
        chatId: string;
        messages: Message[];
        content: string;
        reasoning: string;
        toolCalls: ToolCall[];
        toolResults?: ToolResult[];
        model: string;
        provider: string;
        systemMode?: SystemMode;
        assistantId?: string;
    }): Promise<void> {
        const {
            chatId,
            messages,
            content,
            reasoning,
            toolCalls,
            toolResults,
            model,
            provider,
            systemMode,
            assistantId,
        } = params;

        await persistConversationAssistantMessage({
            databaseService: this.options.databaseService,
            chatSessionRegistryService: this.chatSessionRegistryService,
            settingsService: this.options.settingsService,
            chatId,
            messages,
            content,
            reasoning,
            toolCalls,
            toolResults,
            model,
            provider,
            systemMode,
            assistantId,
        });
    }

    private async injectRAGContextForStream(params: {
        messages: Message[];
        workspaceId?: string;
        chatId: string;
        provider: string;
        event: IpcMainInvokeEvent;
        streamId?: string;
    }): Promise<Message[]> {
        const { messages, workspaceId, chatId, provider, event, streamId } = params;
        if (!workspaceId || messages.length === 0) { return messages; }
        if (!this.shouldInjectRAGContext(provider)) { return messages; }

        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role !== 'user') { return messages; }

        try {
            const query = extractConversationQuery(lastMessage);
            if (!query) { return messages; }

            const { contextString, sources } = await this.options.contextRetrievalService.retrieveContext(query, workspaceId);
            if (!contextString) { return messages; }

            safeSendConversationChunk(event.sender, {
                chatId, streamId, type: 'metadata', sources: sources.map(src => sanitizeString(src, { maxLength: 500, allowNewlines: false }))
            });

            injectConversationContext(messages, contextString);
        } catch (ragErr) {
            appLogger.error('RAG', `[RAG] Retrieval failed: ${getErrorMessage(ragErr as Error)}`);
        }
        return messages;
    }

    private shouldInjectRAGContext(provider: string): boolean {
        const normalized = provider.trim().toLowerCase();
        return normalized === 'ollama' || normalized === 'opencode' || normalized === 'local-ai';
    }

    private async handleOpencodeStream(params: {
        messages: Message[],
        originalMessages: Message[],
        model: string,
        tools: ToolDefinition[] | undefined,
        chatId: string,
        event: IpcMainInvokeEvent,
        signal?: AbortSignal,
        systemMode?: SystemMode,
        assistantId?: string,
        streamId?: string,
    }) {
        const { messages, originalMessages, model, tools, chatId, event, signal, systemMode, assistantId, streamId } = params;
        const evidence = createSessionStreamEvidenceState();
        let streamChunkCount = 0;
        let forwardedChunkCount = 0;

        try {
            appLogger.info(
                'Chat',
                `[ChatStream:OpenCode] stream-start chatId=${chatId} model=${model} messages=${messages.length} tools=${tools?.length ?? 0}`
            );
            for await (const chunk of this.options.llmService.chatOpenCodeStream(messages, model, tools, signal)) {
                streamChunkCount++;
                applySessionStreamChunk(evidence, chunk);
                if (!safeSendConversationChunk(event.sender, { ...chunk, chatId, streamId, provider: 'opencode', model })) {
                    appLogger.warn(
                        'Chat',
                        `[ChatStream:OpenCode] sender dropped chunk chatId=${chatId} chunk=${streamChunkCount}`
                    );
                    break;
                }
                forwardedChunkCount++;
            }
        } finally {
            appLogger.info(
                'Chat',
                `[ChatStream:OpenCode] stream-end chatId=${chatId} chunks=${streamChunkCount} forwarded=${forwardedChunkCount} contentLen=${evidence.fullContent.length} reasoningLen=${evidence.fullReasoning.length} toolCalls=${evidence.toolCalls.length}`
            );
            // Save partial response if aborted or finished
            if (evidence.fullContent || evidence.fullReasoning) {
                await this.persistStreamedAssistantMessage({
                    chatId,
                    messages: originalMessages,
                    systemMode,
                    content: evidence.fullContent,
                    reasoning: evidence.fullReasoning,
                    toolCalls: evidence.toolCalls,
                    toolResults: undefined, // Tools not yet executed in stream finally
                    model,
                    provider: 'opencode',
                    assistantId,
                });
            }

            // Fallback estimation
            if (evidence.totalCompletion === 0 && evidence.fullContent.length > 0) {
                evidence.totalCompletion = estimateTokens(evidence.fullContent);
            }

            if (evidence.totalPrompt > 0 || evidence.totalCompletion > 0) {
                await recordConversationTokens({
                    databaseService: this.options.databaseService,
                    chatId,
                    provider: 'opencode',
                    model,
                    promptTokens: evidence.totalPrompt,
                    completionTokens: evidence.totalCompletion,
                    messages: originalMessages,
                });
            }
        }
    }

    private async handleProxyStream(params: {
        messages: Message[],
        originalMessages: Message[],
        model: string,
        tools?: ToolDefinition[],
        provider: string,
        chatId: string,
        event: IpcMainInvokeEvent,
        systemMode?: SystemMode,
        workspaceId?: string,
        signal?: AbortSignal,
        reasoningEffort?: string,
        accountId?: string,
        assistantId?: string,
        streamId?: string,
    }) {
        const { messages, originalMessages, model, tools: providedTools, provider, chatId, event, systemMode, workspaceId, signal, reasoningEffort, accountId, assistantId, streamId } = params;

        let runtimeWorkspaceRoot: string | undefined;
        if (!workspaceId) {
            runtimeWorkspaceRoot = path.join(app.getPath('userData'), 'runtime', 'sessions', chatId);
        }

        const evidence = createSessionStreamEvidenceState();
        let streamChunkCount = 0;
        let forwardedChunkCount = 0;

        try {
            appLogger.info(
                'Chat',
                `[ChatStream:Proxy] stream-start chatId=${chatId} provider=${provider} model=${model} messages=${messages.length} tools=${providedTools?.length ?? 0}`
            );
            for await (const chunk of this.options.llmService.chatStream(messages, model, providedTools, provider, {
                systemMode,
                workspaceRoot: runtimeWorkspaceRoot,
                signal,
                reasoningEffort,
                accountId,
            })) {
                streamChunkCount++;
                applySessionStreamChunk(evidence, chunk);
                if (!safeSendConversationChunk(event.sender, { ...chunk, chatId, streamId, provider, model })) {
                    appLogger.warn(
                        'Chat',
                        `[ChatStream:Proxy] sender dropped chunk chatId=${chatId} chunk=${streamChunkCount}`
                    );
                    break;
                }
                forwardedChunkCount++;
            }
        } finally {
            appLogger.info(
                'Chat',
                `[ChatStream:Proxy] stream-end chatId=${chatId} provider=${provider} chunks=${streamChunkCount} forwarded=${forwardedChunkCount} contentLen=${evidence.fullContent.length} reasoningLen=${evidence.fullReasoning.length} toolCalls=${evidence.toolCalls.length}`
            );
            // Save partial response if aborted or finished
            if (evidence.fullContent || evidence.fullReasoning) {
                await this.persistStreamedAssistantMessage({
                    chatId,
                    messages: originalMessages,
                    systemMode,
                    content: evidence.fullContent,
                    reasoning: evidence.fullReasoning,
                    toolCalls: evidence.toolCalls,
                    toolResults: undefined, // Tools not yet executed in stream finally
                    model,
                    provider,
                    assistantId,
                });
            }

            if (evidence.totalPrompt > 0 || evidence.totalCompletion > 0) {
                await recordConversationTokens({
                    databaseService: this.options.databaseService,
                    chatId,
                    provider,
                    model,
                    promptTokens: evidence.totalPrompt,
                    completionTokens: evidence.totalCompletion,
                    messages: originalMessages,
                });
            }
        }
    }

    /**
     * Replays the last user message before a given assistant message using a different model.
     * Enables "regenerate with different model" functionality.
     */
    async handleRetryWithModel(event: IpcMainInvokeEvent, params: { chatId: string, messageId: string, model: string, provider: string }) {
        const { chatId, messageId, model, provider } = params;

        const dbMessages = await this.options.databaseService.chats.getMessages(chatId);
        if (!dbMessages || dbMessages.length === 0) {
            throw new Error('error.chat.no_messages');
        }

        const assistantIdx = dbMessages.findIndex(m => String(m.id) === messageId);
        if (assistantIdx < 0) {
            throw new Error(`Message ${messageId} not found in chat ${chatId}`);
        }

        const precedingMessages = dbMessages.slice(0, assistantIdx);
        const lastUserMsg = [...precedingMessages].reverse().find(m => m.role === 'user');
        if (!lastUserMsg) {
            throw new Error('error.chat.no_user_message_to_retry');
        }

        const contextMessages: Message[] = precedingMessages.map(m => ({
            id: String(m.id),
            role: m.role as Message['role'],
            content: String(m.content),
            timestamp: new Date(Number(m.timestamp)),
        }));

        appLogger.info('Chat', `[RetryWithModel] Retrying chat ${chatId} message ${messageId} with ${provider}/${model}`);

        await this.handleChatStream(event, {
            messages: contextMessages,
            model: sanitizeString(model, { maxLength: 200, allowNewlines: false }),
            provider: sanitizeString(provider, { maxLength: 50, allowNewlines: false }),
            chatId,
            optionsJson: undefined,
            tools: undefined,
        });
    }

    private createAssistantEnvelope(content: string, metadata: JsonObject): SessionMessageEnvelope {
        return {
            id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            role: 'assistant',
            content,
            createdAt: Date.now(),
            metadata,
        };
    }
    private async prepareChatSession(sessionId: string, sanitized: ConversationCompleteParams): Promise<void> {
        await this.startChatSession({
            sessionId,
            mode: 'chat',
            capabilities: this.getCapabilitiesForRequest(sanitized.workspaceId, sanitized.tools),
            model: {
                provider: sanitized.provider,
                model: sanitized.model,
            },
            metadata: {
                workspaceId: sanitized.workspaceId,
                sourceSurface: SESSION_CONVERSATION_CHANNELS.COMPLETE,
            },
            initialMessages: sanitized.messages.map((message: Message) => this.toSessionMessage(message)),
        });
        await this.chatSessionRegistryService.markPreparing(sessionId);
    }

    private async getPermissionPolicy(chatId?: string): Promise<string | undefined> {
        if (!chatId) {return undefined;}
        const chat = await this.options.databaseService.chats.getChat(chatId);
        const chatMetadata = chat?.metadata && typeof chat.metadata === 'object'
            ? chat.metadata as JsonObject
            : undefined;
        const workspaceAgentSession = chatMetadata?.['workspaceAgentSession'];
        const policy = typeof workspaceAgentSession === 'object' && workspaceAgentSession !== null
            ? (workspaceAgentSession as JsonObject)['permissionPolicy']
            : undefined;
        return typeof policy === 'string' ? policy : undefined;
    }
}


/** Converts Zod-validated chat args to typed handler params */
function toConversationCompleteParams(args: SessionConversationCompleteRequest): ConversationCompleteParams {
    return args as ConversationCompleteParams;
}

/** Converts Zod-validated stream args to typed handler params */
function toConversationStreamParams(args: SessionConversationStreamRequest): ConversationStreamParams {
    return args as ConversationStreamParams;
}

/** Converts Zod-validated retry args to typed handler params */
function toConversationRetryParams(args: SessionConversationRetryRequest): ConversationRetryParams {
    return args as ConversationRetryParams;
}

export function registerSessionConversationIpc(options: SessionConversationIpcOptions) {
    const manager = new SessionConversationIpcManager(options);
    const validateSender = createMainWindowSenderValidator(options.getMainWindow, 'session conversation operation');

    ipcMain.handle(SESSION_CONVERSATION_CHANNELS.COMPLETE, createValidatedIpcHandler(
        SESSION_CONVERSATION_CHANNELS.COMPLETE,
        (event, args: SessionConversationCompleteRequest) => { validateSender(event); return manager.handleConversationComplete(event, toConversationCompleteParams(args)); },
        {
            argsSchema: z.tuple([sessionConversationCompleteRequestSchema]),
            responseSchema: sessionConversationCompleteResponseSchema,
            wrapResponse: true
        }
    ));

    ipcMain.handle(SESSION_CONVERSATION_CHANNELS.STREAM, createValidatedIpcHandler(
        SESSION_CONVERSATION_CHANNELS.STREAM,
        (event, args: SessionConversationStreamRequest) => { validateSender(event); return manager.handleChatStream(event, toConversationStreamParams(args)); },
        {
            argsSchema: z.tuple([sessionConversationStreamRequestSchema]),
            responseSchema: sessionConversationStreamResponseSchema,
            wrapResponse: true
        }
    ));

    ipcMain.handle(SESSION_CONVERSATION_CHANNELS.RETRY_WITH_MODEL, createValidatedIpcHandler(
        SESSION_CONVERSATION_CHANNELS.RETRY_WITH_MODEL,
        (event, args: SessionConversationRetryRequest) => { validateSender(event); return manager.handleRetryWithModel(event, toConversationRetryParams(args)); },
        {
            argsSchema: z.tuple([sessionConversationRetryRequestSchema]),
            responseSchema: sessionConversationRetryResponseSchema,
            wrapResponse: true
        }
    ));
}
