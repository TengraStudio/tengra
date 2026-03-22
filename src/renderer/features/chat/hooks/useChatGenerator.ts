import { safeJsonParse } from '@shared/utils/sanitize.util';
import { useCallback, useState } from 'react';

import { chatStream } from '@/lib/chat-stream';
import { getSystemPrompt } from '@/lib/identity';
import { generateId } from '@/lib/utils';
import { AppSettings, Chat, ChatError, Message, ToolDefinition, ToolResult } from '@/types';
import { CatchError } from '@/types/common';
import { appLogger } from '@/utils/renderer-logger';

import { processChatStream, StreamStreamingState } from './process-stream';
import { categorizeError, formatMessageContent, getPresetOptions } from './utils';


interface SelectedModelInfo {
    provider: string;
    model: string;
}

interface UseChatGeneratorProps {
    chats: Chat[];
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
    appSettings?: AppSettings | undefined;
    selectedModel: string;
    selectedProvider: string;
    selectedModels?: SelectedModelInfo[];
    language: string;
    activeWorkspacePath?: string | undefined;
    workspaceId?: string | undefined;
    t: (key: string) => string;
    handleSpeak: (id: string, content: string) => void;
    autoReadEnabled: boolean;
    formatChatError: (err: CatchError) => string;
}

interface PrepareMessagesOptions {
    chatId: string;
    chats: Chat[];
    userMessage: Message;
    appSettings: AppSettings | undefined;
    selectedModel: string;
    selectedProvider: string;
    language: string;
    selectedPersona?:
    | { id: string; name: string; description: string; prompt: string }
    | null
    | undefined;
    systemMode: 'thinking' | 'agent' | 'fast';
}

interface ModelStreamResult {
    model: string;
    provider: string;
    content: string;
    reasoning?: string;
    responseTime?: number;
    error?: string;
}

interface ChatStreamChunk {
    content?: string;
    reasoning?: string;
}

const IMAGE_REQUEST_COUNT_MAX = 5;
const IMAGE_ACTION_PATTERN = /\b(create|draw|generate|make|render|olu[sş]tur|u[̈u]ret|yarat|ciz|[çc]iz)\b/i;
const IMAGE_SUBJECT_PATTERN = /\b(avatar|drawing|g[oö]rsel|icon|illustration|image|logo|picture|poster|render|resim|sketch|wallpaper|foto(?:g(?:raf)?)?)\b/i;
const DIRECT_IMAGE_RESULT_KEYS = ['images', 'paths', 'files'] as const;
const IMAGE_ONLY_MODEL_PATTERNS = [
    'gemini-3.1-flash-image',
    'gemini-3.1-flash-image-preview',
    'gemini-3-pro-image',
    'gemini-3-pro-image-preview',
    'gemini-2.5-flash-image',
    'gemini-2.5-flash-image-preview',
    'imagen-3.0-generate-001'
] as const;

const getReasoningEffort = (modelId: string, appSettings: AppSettings | undefined) => {
    return appSettings?.modelSettings?.[modelId]?.reasoningLevel;
};

const getMessageTextContent = (message: Message): string => {
    if (typeof message.content === 'string') {
        return message.content;
    }
    return message.content
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('\n')
        .trim();
};

const isExplicitImageRequest = (message: Message): boolean => {
    const text = getMessageTextContent(message).toLowerCase();
    if (text.trim().length === 0) {
        return false;
    }
    const hasImageSubject = IMAGE_SUBJECT_PATTERN.test(text);
    const hasImageAction = IMAGE_ACTION_PATTERN.test(text);
    return hasImageSubject && hasImageAction;
};

const extractImageRequestCount = (message: Message): number => {
    const metadataCount = message.metadata?.imageRequestCount;
    if (typeof metadataCount === 'number' && Number.isFinite(metadataCount)) {
        return Math.max(1, Math.min(metadataCount, IMAGE_REQUEST_COUNT_MAX));
    }
    const text = getMessageTextContent(message);
    const match = text.match(/(\d+)\s*(?:adet|image(?:s)?|photo(?:s)?|picture(?:s)?|tane|g[oö]rsel|resim|foto(?:g(?:raf)?)?)/i);
    if (!match?.[1]) {
        return 1;
    }
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isFinite(parsed)) {
        return 1;
    }
    return Math.max(1, Math.min(parsed, IMAGE_REQUEST_COUNT_MAX));
};

const isImageOnlyModel = (modelId: string): boolean => {
    const normalizedModelId = modelId.trim().toLowerCase();
    return IMAGE_ONLY_MODEL_PATTERNS.some(pattern => normalizedModelId.includes(pattern));
};

const createModelToolList = (provider: string, allTools: ToolDefinition[]): ToolDefinition[] => {
    return allTools.filter(toolDefinition => {
        const toolName = toolDefinition?.function?.name;
        if (!toolName || toolName === 'generate_image') {
            return false;
        }
        return provider === 'opencode' || provider === 'antigravity';
    });
};

const readToolResultImages = (toolResult: ToolResult): string[] => {
    if (typeof toolResult.result === 'string') {
        return [toolResult.result];
    }
    if (!toolResult.result || Array.isArray(toolResult.result) || typeof toolResult.result !== 'object') {
        return [];
    }
    for (const key of DIRECT_IMAGE_RESULT_KEYS) {
        const value = toolResult.result[key];
        if (!Array.isArray(value)) {
            continue;
        }
        return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    }
    return [];
};

const getMessageStringContent = (content: Message['content']): string => {
    if (typeof content === 'string') {
        return content;
    }
    return content
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('\n')
        .trim();
};

const buildStoredToolResults = (
    toolCalls: Message['toolCalls'],
    toolMessages: Message[]
): ToolResult[] => {
    if (!toolCalls || toolCalls.length === 0) {
        return [];
    }

    return toolCalls.map(toolCall => {
        const matchingToolMessage = toolMessages.find(message => message.toolCallId === toolCall.id);
        return {
            toolCallId: toolCall.id,
            name: toolCall.function.name,
            result: matchingToolMessage
                ? safeJsonParse(getMessageStringContent(matchingToolMessage.content), {})
                : {},
            success: true,
            isImage: toolCall.function.name === 'generate_image',
        };
    });
};

const executeToolCall = async (
    toolCall: NonNullable<Message['toolCalls']>[number],
    t: (key: string) => string
): Promise<{
    toolMessage: Message;
    generatedImages: string[];
}> => {
    const toolArgs = typeof toolCall.function.arguments === 'string'
        ? toolCall.function.arguments.length > 100000
            ? (() => { throw new Error(t('chat.toolArgumentsTooLarge')); })()
            : safeJsonParse(toolCall.function.arguments, {})
        : toolCall.function.arguments;

    const toolExecResult = await window.electron.executeTools(toolCall.function.name, toolArgs, toolCall.id);
    const generatedImages = toolCall.function.name === 'generate_image'
        ? readToolResultImages(toolExecResult)
        : [];
    return {
        toolMessage: {
            id: generateId(),
            role: 'tool',
            content: JSON.stringify(toolExecResult),
            toolCallId: toolCall.id,
            timestamp: new Date()
        },
        generatedImages,
    };
};

const logRendererError = (message: string, error: Error): void => {
    appLogger.error('useChatGenerator', message, error);
};

const prepareMessages = (options: PrepareMessagesOptions): { allMessages: Message[]; presetOptions: Record<string, RendererDataValue> } => {
    const {
        chatId,
        chats,
        userMessage,
        appSettings,
        selectedModel,
        selectedProvider,
        language,
        selectedPersona,
    } = options;
    const dbRefChat = chats.find(c => c.id === chatId);
    const contextMessages = (dbRefChat?.messages ?? []).slice(-15);

    const chatMessages = [...contextMessages, userMessage].map((msg: Message) => ({
        ...msg,
        content: formatMessageContent(msg),
    }));

    const modelSettings = appSettings?.modelSettings ?? {};
    const modelConfig = modelSettings[selectedModel] ?? {};
    const systemPrompt =
        modelConfig.systemPrompt ??
        getSystemPrompt(
            language as 'tr' | 'en',
            selectedPersona?.prompt,
            selectedProvider,
            selectedModel
        );
    const systemMessage: Message = {
        role: 'system',
        content: systemPrompt,
        id: generateId(),
        timestamp: new Date(),
    };

    const presetOptions = getPresetOptions(appSettings, modelConfig);

    return { allMessages: [systemMessage, ...chatMessages], presetOptions };
};

const buildModelConversation = (
    messages: Message[],
    assistantMessage: Message,
    toolResults: Message[]
): Message[] => {
    return [...messages, assistantMessage, ...toolResults];
};

const upsertMessageInChat = (
    messages: Message[],
    messageId: string,
    buildMessage: (existing?: Message) => Message
): Message[] => {
    const messageIndex = messages.findIndex(message => message.id === messageId);
    if (messageIndex === -1) {
        return [...messages, buildMessage()];
    }

    const nextMessages = [...messages];
    nextMessages[messageIndex] = buildMessage(nextMessages[messageIndex]);
    return nextMessages;
};

const persistAssistantMessage = async (
    assistantId: string,
    chatId: string,
    updates: Partial<Message>
): Promise<void> => {
    const updateResult = await window.electron.db.updateMessage(assistantId, updates);
    if (updateResult.success) {
        return;
    }

    await window.electron.db.addMessage({
        id: assistantId,
        chatId,
        role: 'assistant',
        content: typeof updates.content === 'string' ? updates.content : '',
        timestamp: new Date(),
        ...updates,
    });
};

const completeDirectImageMessage = async (options: {
    assistantId: string;
    chatId: string;
    userMessage: Message;
    activeModel: string;
    selectedProvider: string;
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
    t: (key: string) => string;
}): Promise<void> => {
    const { assistantId, chatId, userMessage, activeModel, selectedProvider, setChats, t } = options;
    const prompt = getMessageTextContent(userMessage);
    const requestedCount = extractImageRequestCount(userMessage);
    const startedAt = performance.now();
    const toolResult = await window.electron.executeTools(
        'generate_image',
        { prompt, count: requestedCount },
        generateId()
    );

    if (!toolResult || typeof toolResult !== 'object') {
        throw new Error(t('chat.error'));
    }

    if (!toolResult.success) {
        throw new Error(toolResult.error ?? t('chat.error'));
    }

    const images = readToolResultImages(toolResult);
    if (images.length === 0) {
        throw new Error(t('chat.imageGenerationNoImages'));
    }

    const responseTime = Math.round(performance.now() - startedAt);
    const updates: Partial<Message> = {
        content: '',
        images,
        responseTime,
        toolResults: [toolResult],
    };

    setChats(prev => prev.map(chat => (
        chat.id === chatId
            ? {
                ...chat,
                isGenerating: false,
                messages: upsertMessageInChat(chat.messages, assistantId, existing => ({
                    id: assistantId,
                    role: 'assistant',
                    content: '',
                    timestamp: existing?.timestamp ?? new Date(),
                    ...existing,
                    ...updates,
                    provider: selectedProvider,
                    model: activeModel,
                })),
            }
            : chat
    )));

    await persistAssistantMessage(assistantId, chatId, updates);
};

export const useChatGenerator = (
    props: UseChatGeneratorProps & {
        selectedPersona?:
        | { id: string; name: string; description: string; prompt: string }
        | null
        | undefined;
        systemMode: 'thinking' | 'agent' | 'fast';
    }
): {
    streamingStates: Record<string, StreamStreamingState>;
    lastChatError: ChatError | null;
    clearChatError: () => void;
    generateResponse: (chatId: string, userMessage: Message, retryModel?: string) => Promise<void>;
    stopGeneration: () => Promise<void>;
} => {
    const {
        chats,
        setChats,
        appSettings,
        selectedModel,
        selectedProvider,
        selectedModels,
        language,
        selectedPersona,
        activeWorkspacePath,
        workspaceId,
        t,
        handleSpeak,
        autoReadEnabled,
        formatChatError,
        systemMode,
    } = props;

    const [streamingStates, setStreamingStates] = useState<Record<string, StreamStreamingState>>({});
    const [lastChatError, setLastChatError] = useState<ChatError | null>(null);
    const clearChatError = useCallback(() => setLastChatError(null), []);

    const generateResponse = async (chatId: string, userMessage: Message, retryModel?: string): Promise<void> => {
        setLastChatError(null);
        setStreamingStates(prev => ({
            ...prev,
            [chatId]: { content: '', reasoning: '', speed: null, error: null },
        }));
        const assistantId = generateId();
        const activeModel = retryModel ?? selectedModel;

        const modelsToUse: SelectedModelInfo[] =
            !retryModel && selectedModels && selectedModels.length > 1
                ? selectedModels
                : [{ provider: selectedProvider, model: activeModel }];

        const isMultiModel = modelsToUse.length > 1;
        const shouldUseDirectImageFlow = isImageOnlyModel(activeModel) || isExplicitImageRequest(userMessage);

        try {
            const allTools: ToolDefinition[] = shouldUseDirectImageFlow
                ? []
                : (await window.electron.getToolDefinitions()) ?? [];

            const tempMsg: Message = {
                id: assistantId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
                provider: modelsToUse[0].provider,
                model: modelsToUse[0].model,
                variants: isMultiModel
                    ? modelsToUse.map((m, idx) => ({
                        id: `${assistantId}-v${idx}`,
                        content: '',
                        model: m.model,
                        provider: m.provider,
                        timestamp: new Date(),
                        label: m.model,
                        isSelected: false,
                    }))
                    : undefined,
            };
            setChats(prev =>
                prev.map(c => (c.id === chatId ? { ...c, messages: [...c.messages, tempMsg] } : c))
            );
            await window.electron.db.addMessage({ ...tempMsg, chatId, timestamp: Date.now() });

            if (shouldUseDirectImageFlow) {
                await completeDirectImageMessage({
                    assistantId,
                    chatId,
                    userMessage,
                    activeModel,
                    selectedProvider,
                    setChats,
                    t,
                });
            } else if (isMultiModel) {
                await generateMultiModelResponse({
                    chatId, assistantId, userMessage, models: modelsToUse, allTools, chats, setChats,
                    appSettings, language, selectedPersona, activeWorkspacePath, workspaceId, setStreamingStates,
                    autoReadEnabled, handleSpeak, t, formatChatError, systemMode
                });
            } else {
                const tools = systemMode === 'agent' ? createModelToolList(selectedProvider, allTools ?? []) : [];

                const { allMessages, presetOptions } = prepareMessages({
                    chatId, chats, userMessage, appSettings, selectedModel: activeModel,
                    selectedProvider, language, selectedPersona, systemMode
                });

                const reasoningEffort = getReasoningEffort(activeModel, appSettings);
                const fullOptions = {
                    ...presetOptions, workspaceRoot: activeWorkspacePath, systemMode, thinking: systemMode === 'thinking',
                    agentToolsEnabled: systemMode === 'agent', reasoningEffort
                };
                await executeToolTurnLoop({
                    initialMessages: allMessages,
                    chatId, assistantId, activeModel, selectedProvider, tools, fullOptions, workspaceId,
                    autoReadEnabled, handleSpeak, t, setStreamingStates, setChats, activeWorkspacePath, systemMode
                });
            }
        } catch (e) {
            logRendererError('[generateResponse] Error', e as Error);
            const errText = formatChatError(e as CatchError);
            setLastChatError(categorizeError(errText, activeModel));
            const partialContent = await new Promise<string>(resolve => {
                setChats(prev => {
                    const existingMessage = prev.find(c => c.id === chatId)?.messages.find(m => m.id === assistantId);
                    resolve(typeof existingMessage?.content === 'string' ? existingMessage.content : '');
                    return prev;
                });
            });
            const finalErrorText = partialContent.trim().length > 0
                ? `${partialContent}\n\n[Generation interrupted: ${errText}]`
                : `${t('chat.error')}: ${errText}`;
            setChats(prev =>
                prev.map(c => c.id === chatId ? {
                    ...c,
                    messages: c.messages.map(m => m.id === assistantId ? { ...m, content: finalErrorText } : m),
                    isGenerating: false
                } : c)
            );
            void window.electron.db.updateMessage(assistantId, { content: finalErrorText });
        } finally {
            setStreamingStates(prev => {
                const stateForChat = prev[chatId];
                if (stateForChat?.error) {
                    setLastChatError(stateForChat.error);
                }
                const s = { ...prev };
                delete s[chatId];
                return s;
            });
        }
    };

    const stopGeneration = async (): Promise<void> => {
        try {
            for (const activeChatId of Object.keys(streamingStates)) {
                window.electron.session.conversation.abort(activeChatId);
            }
            setStreamingStates({});
        } catch (e) {
            logRendererError('Failed to stop generation', e as Error);
        }
    };

    return { streamingStates, lastChatError, clearChatError, generateResponse, stopGeneration };
};

const executeToolTurnLoop = async (params: {
    initialMessages: Message[];
    chatId: string; assistantId: string; activeModel: string; selectedProvider: string; tools: ToolDefinition[];
    fullOptions: Record<string, RendererDataValue>; workspaceId: string | undefined; autoReadEnabled: boolean;
    handleSpeak: (id: string, content: string) => void; t: (key: string) => string;
    setStreamingStates: React.Dispatch<React.SetStateAction<Record<string, StreamStreamingState>>>;
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>; activeWorkspacePath: string | undefined;
    systemMode: 'thinking' | 'agent' | 'fast';
}) => {
    const {
        initialMessages, chatId, assistantId, activeModel, selectedProvider, tools, fullOptions, workspaceId,
        autoReadEnabled, handleSpeak, t, setStreamingStates, setChats, activeWorkspacePath, systemMode
    } = params;

    let currentAssistantId = assistantId;
    let toolIterations = 0;
    const MAX_TOOL_ITERATIONS = 5;
    let currentMessages: Message[] = initialMessages;

    while (toolIterations < MAX_TOOL_ITERATIONS) {
        if (currentMessages.length === 0) { break; }

        const stream = chatStream({
            messages: currentMessages, model: activeModel, tools, provider: selectedProvider,
            options: { ...fullOptions, workspaceRoot: activeWorkspacePath, systemMode },
            chatId, workspaceId, systemMode
        });
        const streamStartTime = performance.now();

        const result = await processChatStream({
            stream, chatId, assistantId: currentAssistantId, setStreamingStates, setChats,
            streamStartTime, activeModel, selectedProvider, t, autoReadEnabled, handleSpeak
        });

        if (result.finalToolCalls.length > 0) {
            const assistantMsg: Message = {
                id: currentAssistantId, role: 'assistant', content: result.finalContent, timestamp: new Date(),
                provider: selectedProvider, model: activeModel, toolCalls: result.finalToolCalls
            };

            const toolResults: Message[] = [];
            const generatedImages: string[] = [];
            for (const tc of result.finalToolCalls) {
                try {
                    const executedTool = await executeToolCall(tc, t);
                    generatedImages.push(...executedTool.generatedImages);
                    toolResults.push(executedTool.toolMessage);
                    void window.electron.db.addMessage({ ...executedTool.toolMessage, chatId, timestamp: Date.now() });
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : t('chat.error');
                    appLogger.error('useChatGenerator', `Tool execution error: ${errorMsg}`, error as Error);
                }
            }

            if (generatedImages.length > 0) {
                const assistantContent = getMessageStringContent(result.finalContent);
                const finalContent = assistantContent.length > 0
                    ? assistantContent
                    : '';
                const updates: Partial<Message> = {
                    content: finalContent,
                    images: generatedImages,
                    toolCalls: result.finalToolCalls,
                    toolResults: buildStoredToolResults(result.finalToolCalls, toolResults),
                };

                setChats(prev => prev.map(chat => (
                    chat.id === chatId
                        ? {
                            ...chat,
                            isGenerating: false,
                            messages: upsertMessageInChat(chat.messages, currentAssistantId, existing => ({
                                id: currentAssistantId,
                                role: 'assistant',
                                content: '',
                                timestamp: existing?.timestamp ?? new Date(),
                                ...existing,
                                ...updates,
                                provider: selectedProvider,
                                model: activeModel,
                            })),
                        }
                        : chat
                )));

                await persistAssistantMessage(currentAssistantId, chatId, updates);
                break;
            }

            const nextAssistantId = generateId();
            const nextAssistantPlaceholder: Message = {
                id: nextAssistantId, role: 'assistant', content: '', timestamp: new Date(),
                provider: selectedProvider, model: activeModel
            };

            const messagesWithToolResults = buildModelConversation(
                currentMessages,
                assistantMsg,
                toolResults
            );
            const nextMessages = [...messagesWithToolResults, nextAssistantPlaceholder];
            currentMessages = messagesWithToolResults;
            setChats(prev => prev.map(chat => (chat.id === chatId ? { ...chat, messages: nextMessages } : chat)));
            currentAssistantId = nextAssistantId;
            void window.electron.db.addMessage({ ...nextAssistantPlaceholder, chatId, timestamp: Date.now() });
            toolIterations++;
        } else {
            break;
        }
    }
    return currentAssistantId;
};

const generateMultiModelResponse = async (params: {
    chatId: string; assistantId: string; userMessage: Message; models: SelectedModelInfo[]; allTools: ToolDefinition[];
    chats: Chat[]; setChats: React.Dispatch<React.SetStateAction<Chat[]>>; appSettings: AppSettings | undefined;
    language: string; selectedPersona: { id: string; name: string; description: string; prompt: string } | null | undefined;
    activeWorkspacePath: string | undefined; workspaceId: string | undefined;
    setStreamingStates: React.Dispatch<React.SetStateAction<Record<string, StreamStreamingState>>>;
    autoReadEnabled: boolean; handleSpeak: (id: string, content: string) => void; t: (key: string) => string;
    formatChatError: (err: CatchError) => string; systemMode: 'thinking' | 'agent' | 'fast';
}) => {
    const {
        chatId, assistantId, userMessage, models, allTools, chats, setChats, appSettings, language,
        selectedPersona, activeWorkspacePath, workspaceId, setStreamingStates, autoReadEnabled, handleSpeak,
        t, formatChatError, systemMode
    } = params;
    const streamStartTime = performance.now();
    await orchestrationMultiModelStreams({
        chatId, assistantId, userMessage, models, allTools, chats, setChats, appSettings, language,
        selectedPersona, activeWorkspacePath, workspaceId, setStreamingStates, streamStartTime,
        autoReadEnabled, handleSpeak, t, formatChatError, systemMode
    });
};

interface OrchestrationParams {
    chatId: string; assistantId: string; userMessage: Message; models: SelectedModelInfo[]; allTools: ToolDefinition[];
    chats: Chat[]; setChats: React.Dispatch<React.SetStateAction<Chat[]>>; appSettings: AppSettings | undefined;
    language: string; selectedPersona: { id: string; name: string; description: string; prompt: string } | null | undefined;
    activeWorkspacePath: string | undefined; workspaceId: string | undefined;
    setStreamingStates: React.Dispatch<React.SetStateAction<Record<string, StreamStreamingState>>>;
    streamStartTime: number; autoReadEnabled: boolean; handleSpeak: (id: string, content: string) => void;
    t: (key: string) => string; formatChatError: (err: CatchError) => string; systemMode: 'thinking' | 'agent' | 'fast';
}

async function orchestrationMultiModelStreams(params: OrchestrationParams) {
    const {
        chatId, assistantId, userMessage, models, allTools, chats, setChats, appSettings, language,
        selectedPersona, activeWorkspacePath, workspaceId, setStreamingStates, streamStartTime,
        autoReadEnabled, handleSpeak, t, formatChatError, systemMode
    } = params;

    const promises = models.map(async (modelInfo: SelectedModelInfo, index: number) => {
        const streamId = `${chatId}-model-${index}-${Date.now()}`;
        try {
            const { allMessages, presetOptions } = prepareMessages({
                chatId, chats, userMessage, appSettings, selectedModel: modelInfo.model,
                selectedProvider: modelInfo.provider, language, selectedPersona, systemMode
            });
            const reasoningEffort = getReasoningEffort(modelInfo.model, appSettings);
            const tools = systemMode === 'agent' ? createModelToolList(modelInfo.provider, allTools ?? []) : [];

            const stream = chatStream({
                messages: allMessages, model: modelInfo.model, tools, provider: modelInfo.provider,
                options: { ...presetOptions, workspaceRoot: activeWorkspacePath, systemMode, thinking: systemMode === 'thinking', agentToolsEnabled: systemMode === 'agent', reasoningEffort },
                chatId: streamId, workspaceId, systemMode
            });

            return await handleModelStreamIteration({
                stream, chatId, assistantId, index, modelInfo, setStreamingStates, setChats, streamStartTime, t, formatChatError
            });
        } catch (e) {
            const errText = `${t('chat.error')}: ${formatChatError(e as CatchError)}`;
            return { model: modelInfo.model, provider: modelInfo.provider, content: errText, error: errText };
        }
    });

    const results = await Promise.all(promises);
    await finalizeMultiModelResponse({ results, chatId, assistantId, t, setChats, streamStartTime, autoReadEnabled, handleSpeak });
}

async function handleModelStreamIteration(params: {
    stream: AsyncIterable<ChatStreamChunk>; chatId: string; assistantId: string; index: number; modelInfo: SelectedModelInfo;
    setStreamingStates: React.Dispatch<React.SetStateAction<Record<string, StreamStreamingState>>>;
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>; streamStartTime: number; t: (key: string) => string;
    formatChatError: (err: CatchError) => string;
}) {
    const { stream, chatId, assistantId, index, modelInfo, setStreamingStates, setChats, streamStartTime } = params;
    let variantContent = '';
    let variantReasoning = '';
    let lastUpdate = 0;
    let lastStreamingStateUpdate = 0;

    for await (const chunk of stream) {
        if (chunk.content) { variantContent += chunk.content; }
        if (chunk.reasoning) { variantReasoning += chunk.reasoning; }

        const now = Date.now();
        const isMain = index === 0;
        if (now - lastStreamingStateUpdate >= 80 || !chunk.content) {
            lastStreamingStateUpdate = now;
            setStreamingStates((prev: Record<string, StreamStreamingState>) => {
                const state = prev[chatId] ?? { content: '', reasoning: '', speed: null, variants: {} };
                const variants = { ...state.variants };
                variants[index] = { content: variantContent, reasoning: variantReasoning };
                return {
                    ...prev,
                    [chatId]: {
                        ...state,
                        content: isMain ? variantContent : state.content,
                        reasoning: isMain ? variantReasoning : state.reasoning,
                        variants,
                    },
                };
            });
        }
        if (now - lastUpdate > 200 || !chunk.content) {
            lastUpdate = now;
            setChats((prev: Chat[]) => prev.map(c => {
                if (c.id !== chatId) { return c; }
                return {
                    ...c,
                    messages: c.messages.map(m => {
                        if (m.id !== assistantId) { return m; }
                        const currentVariants = [...(m.variants ?? [])];
                        if (!currentVariants[index]) {
                            currentVariants[index] = {
                                id: `${assistantId}-v${index}`, content: '', model: modelInfo.model, provider: modelInfo.provider,
                                timestamp: new Date(), label: modelInfo.model, isSelected: isMain
                            };
                        }
                        currentVariants[index] = { ...currentVariants[index], content: variantContent };
                        return {
                            ...m,
                            content: isMain ? variantContent : m.content,
                            reasoning: isMain ? variantReasoning : m.reasoning,
                            variants: currentVariants,
                        };
                    })
                };
            }));
        }
    }

    return {
        model: modelInfo.model, provider: modelInfo.provider, content: variantContent,
        reasoning: variantReasoning, responseTime: Math.round(performance.now() - streamStartTime)
    };
}

async function finalizeMultiModelResponse(params: {
    results: ModelStreamResult[]; chatId: string; assistantId: string; t: (key: string) => string;
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>; streamStartTime: number; autoReadEnabled: boolean;
    handleSpeak: (id: string, content: string) => void;
}) {
    const { results, chatId, assistantId, t, setChats, streamStartTime, autoReadEnabled, handleSpeak } = params;
    const finalResponseTime = Math.round(performance.now() - streamStartTime);
    const finalVariants = results.map((r, idx) => ({
        id: `${assistantId}-v${idx}`, content: r.content, model: r.model, provider: r.provider,
        timestamp: new Date(), label: r.model, isSelected: idx === 0, error: r.error
    }));

    const finalContent = results[0]?.content ?? '';
    const finalReasoning = results[0]?.reasoning;

    setChats((prev: Chat[]) => prev.map(c => {
        if (c.id !== chatId) { return c; }
        let title = c.title;
        if (c.messages.length <= 2 && finalContent) {
            title = finalContent.split('\n')[0].replace(/[#*`]/g, '').trim().slice(0, 50) || t('sidebar.newChat');
        }
        return {
            ...c, title, isGenerating: false,
            messages: c.messages.map(m => m.id === assistantId ? {
                ...m, content: finalContent, reasoning: finalReasoning, responseTime: finalResponseTime,
                variants: finalVariants.length > 1 ? finalVariants : undefined
            } : m)
        };
    }));

    await window.electron.db.updateMessage(assistantId, {
        content: finalContent, reasoning: finalReasoning, responseTime: finalResponseTime,
        variants: finalVariants.length > 1 ? finalVariants : undefined
    });

    if (autoReadEnabled && finalContent) { handleSpeak(assistantId, finalContent); }
}
