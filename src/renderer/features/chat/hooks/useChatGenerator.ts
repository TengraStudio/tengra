import { safeJsonParse } from '@shared/utils/sanitize.util';
import { useCallback, useState } from 'react';

import { chatStream } from '@/lib/chat-stream';
import { getSystemPrompt } from '@/lib/identity';
import { generateId } from '@/lib/utils';
import { AppSettings, Chat, ChatError, Message, ToolDefinition } from '@/types';
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
    projectId?: string | undefined;
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

const getReasoningEffort = (modelId: string, appSettings: AppSettings | undefined) => {
    return appSettings?.modelSettings?.[modelId]?.reasoningLevel;
};

const prepareMessages = (options: PrepareMessagesOptions) => {
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

export const useChatGenerator = (
    props: UseChatGeneratorProps & {
        selectedPersona?:
        | { id: string; name: string; description: string; prompt: string }
        | null
        | undefined;
        systemMode: 'thinking' | 'agent' | 'fast';
    }
) => {
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
        projectId,
        t,
        handleSpeak,
        autoReadEnabled,
        formatChatError,
        systemMode,
    } = props;

    const [streamingStates, setStreamingStates] = useState<Record<string, StreamStreamingState>>({});
    const [lastChatError, setLastChatError] = useState<ChatError | null>(null);
    const clearChatError = useCallback(() => setLastChatError(null), []);

    const generateResponse = async (chatId: string, userMessage: Message, retryModel?: string) => {
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

        try {
            const allTools: ToolDefinition[] = await window.electron.getToolDefinitions();

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
            void window.electron.db.addMessage({ ...tempMsg, chatId, timestamp: Date.now() });

            if (isMultiModel) {
                await generateMultiModelResponse({
                    chatId, assistantId, userMessage, models: modelsToUse, allTools, chats, setChats,
                    appSettings, language, selectedPersona, activeWorkspacePath, projectId, setStreamingStates,
                    autoReadEnabled, handleSpeak, t, formatChatError, systemMode
                });
            } else {
                const tools = systemMode === 'agent' ? allTools.filter(tDefinition => {
                    if (!tDefinition.function.name) { return false; }
                    if (selectedProvider === 'opencode') { return true; }
                    if (selectedProvider === 'antigravity') { return true; }
                    return tDefinition.function.name === 'generate_image';
                }) : [];

                const { presetOptions } = prepareMessages({
                    chatId, chats, userMessage, appSettings, selectedModel: activeModel,
                    selectedProvider, language, selectedPersona, systemMode
                });

                const reasoningEffort = getReasoningEffort(activeModel, appSettings);
                const fullOptions = {
                    ...presetOptions, projectRoot: activeWorkspacePath, systemMode, thinking: systemMode === 'thinking',
                    agentToolsEnabled: systemMode === 'agent', reasoningEffort
                };
                await executeToolTurnLoop({
                    chatId, assistantId, activeModel, selectedProvider, tools, fullOptions, projectId,
                    autoReadEnabled, handleSpeak, t, setStreamingStates, setChats, activeWorkspacePath, systemMode, chats
                });
            }
        } catch (e) {
            window.electron.log.error('[generateResponse] Error', e as Error);
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

    const stopGeneration = async () => {
        try {
            window.electron.abortChat();
            setStreamingStates({});
        } catch (e) {
            window.electron.log.error('Failed to stop generation', e as Error);
        }
    };

    return { streamingStates, lastChatError, clearChatError, generateResponse, stopGeneration };
};

const executeToolTurnLoop = async (params: {
    chatId: string; assistantId: string; activeModel: string; selectedProvider: string; tools: ToolDefinition[];
    fullOptions: Record<string, unknown>; projectId: string | undefined; autoReadEnabled: boolean;
    handleSpeak: (id: string, content: string) => void; t: (key: string) => string;
    setStreamingStates: React.Dispatch<React.SetStateAction<Record<string, StreamStreamingState>>>;
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>; activeWorkspacePath: string | undefined;
    systemMode: 'thinking' | 'agent' | 'fast'; chats: Chat[];
}) => {
    const {
        chatId, assistantId, activeModel, selectedProvider, tools, fullOptions, projectId,
        autoReadEnabled, handleSpeak, t, setStreamingStates, setChats, activeWorkspacePath, systemMode, chats
    } = params;

    let currentAssistantId = assistantId;
    let toolIterations = 0;
    const MAX_TOOL_ITERATIONS = 5;
    let currentMessages: Message[] = chats.find(c => c.id === chatId)?.messages ?? [];

    while (toolIterations < MAX_TOOL_ITERATIONS) {
        if (currentMessages.length === 0) { break; }

        const stream = chatStream({
            messages: currentMessages, model: activeModel, tools, provider: selectedProvider,
            options: { ...fullOptions, projectRoot: activeWorkspacePath, systemMode },
            chatId, projectId, systemMode
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
            for (const tc of result.finalToolCalls) {
                try {
                    const toolArgs = typeof tc.function.arguments === 'string'
                        ? tc.function.arguments.length > 100000 ? (() => { throw new Error('Tool arguments exceed maximum size limit'); })()
                            : safeJsonParse(tc.function.arguments, {})
                        : tc.function.arguments;

                    const toolExecResult = await window.electron.executeTools(tc.function.name, toolArgs, tc.id);
                    const toolMsg: Message = {
                        id: generateId(), role: 'tool' as const, content: JSON.stringify(toolExecResult),
                        toolCallId: tc.id, timestamp: new Date()
                    };
                    toolResults.push(toolMsg);
                    void window.electron.db.addMessage({ ...toolMsg, chatId, timestamp: Date.now() });
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Tool execution failed';
                    appLogger.error('useChatGenerator', `Tool execution error: ${errorMsg}`, error as Error);
                }
            }

            const nextAssistantId = generateId();
            const nextAssistantPlaceholder: Message = {
                id: nextAssistantId, role: 'assistant', content: '', timestamp: new Date(),
                provider: selectedProvider, model: activeModel
            };

            const messagesWithToolResults = currentMessages
                .map(message => (message.id === currentAssistantId ? assistantMsg : message))
                .concat(toolResults);
            const nextMessages = [...messagesWithToolResults, nextAssistantPlaceholder];
            currentMessages = nextMessages;
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
    activeWorkspacePath: string | undefined; projectId: string | undefined;
    setStreamingStates: React.Dispatch<React.SetStateAction<Record<string, StreamStreamingState>>>;
    autoReadEnabled: boolean; handleSpeak: (id: string, content: string) => void; t: (key: string) => string;
    formatChatError: (err: CatchError) => string; systemMode: 'thinking' | 'agent' | 'fast';
}) => {
    const {
        chatId, assistantId, userMessage, models, allTools, chats, setChats, appSettings, language,
        selectedPersona, activeWorkspacePath, projectId, setStreamingStates, autoReadEnabled, handleSpeak,
        t, formatChatError, systemMode
    } = params;
    const streamStartTime = performance.now();
    await orchestrationMultiModelStreams({
        chatId, assistantId, userMessage, models, allTools, chats, setChats, appSettings, language,
        selectedPersona, activeWorkspacePath, projectId, setStreamingStates, streamStartTime,
        autoReadEnabled, handleSpeak, t, formatChatError, systemMode
    });
};

interface OrchestrationParams {
    chatId: string; assistantId: string; userMessage: Message; models: SelectedModelInfo[]; allTools: ToolDefinition[];
    chats: Chat[]; setChats: React.Dispatch<React.SetStateAction<Chat[]>>; appSettings: AppSettings | undefined;
    language: string; selectedPersona: { id: string; name: string; description: string; prompt: string } | null | undefined;
    activeWorkspacePath: string | undefined; projectId: string | undefined;
    setStreamingStates: React.Dispatch<React.SetStateAction<Record<string, StreamStreamingState>>>;
    streamStartTime: number; autoReadEnabled: boolean; handleSpeak: (id: string, content: string) => void;
    t: (key: string) => string; formatChatError: (err: CatchError) => string; systemMode: 'thinking' | 'agent' | 'fast';
}

async function orchestrationMultiModelStreams(params: OrchestrationParams) {
    const {
        chatId, assistantId, userMessage, models, allTools, chats, setChats, appSettings, language,
        selectedPersona, activeWorkspacePath, projectId, setStreamingStates, streamStartTime,
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
            const tools = systemMode === 'agent' ? allTools.filter((tDefinition: ToolDefinition) => {
                if (!tDefinition.function.name) { return false; }
                if (modelInfo.provider === 'opencode') { return true; }
                return tDefinition.function.name === 'generate_image' && modelInfo.provider === 'antigravity';
            }) : [];

            const stream = chatStream({
                messages: allMessages, model: modelInfo.model, tools, provider: modelInfo.provider,
                options: { ...presetOptions, projectRoot: activeWorkspacePath, systemMode, thinking: systemMode === 'thinking', agentToolsEnabled: systemMode === 'agent', reasoningEffort },
                chatId: streamId, projectId, systemMode
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
