import { useState } from 'react';

import { chatStream } from '@/lib/chat-stream';
import { getSystemPrompt } from '@/lib/identity';
import { generateId } from '@/lib/utils';
import { AppSettings, Chat, Message, ToolDefinition } from '@/types';
import { CatchError } from '@/types/common';

import { processChatStream, StreamStreamingState } from './process-stream';
import { formatMessageContent, getPresetOptions } from './utils';

interface SelectedModelInfo {
    provider: string
    model: string
}

interface UseChatGeneratorProps {
    chats: Chat[]
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>
    appSettings?: AppSettings | undefined
    selectedModel: string
    selectedProvider: string
    selectedModels?: SelectedModelInfo[]
    language: string
    activeWorkspacePath?: string | undefined
    projectId?: string | undefined
    t: (key: string) => string
    handleSpeak: (id: string, content: string) => void
    autoReadEnabled: boolean
    formatChatError: (err: CatchError) => string
}

interface PrepareMessagesOptions {
    chatId: string
    chats: Chat[]
    userMessage: Message
    appSettings: AppSettings | undefined
    selectedModel: string
    selectedProvider: string
    language: string
    selectedPersona?: { id: string, name: string, description: string, prompt: string } | null | undefined
    systemMode: 'thinking' | 'agent' | 'fast'
}

const prepareMessages = (options: PrepareMessagesOptions) => {
    const { chatId, chats, userMessage, appSettings, selectedModel, selectedProvider, language, selectedPersona } = options;
    const dbRefChat = chats.find(c => c.id === chatId);
    const contextMessages = (dbRefChat?.messages ?? []).slice(-15);

    const chatMessages = [...contextMessages, userMessage].map((msg: Message) => ({
        ...msg,
        content: formatMessageContent(msg)
    }));

    const modelSettings = appSettings?.modelSettings ?? {};
    const modelConfig = modelSettings[selectedModel] ?? {};
    const systemPrompt = modelConfig.systemPrompt ?? getSystemPrompt(language as 'tr' | 'en', selectedPersona?.prompt, selectedProvider, selectedModel);
    const systemMessage: Message = { role: 'system', content: systemPrompt, id: generateId(), timestamp: new Date() };

    const presetOptions = getPresetOptions(appSettings, modelConfig);

    return { allMessages: [systemMessage, ...chatMessages], presetOptions };
};

export const useChatGenerator = (props: UseChatGeneratorProps & { selectedPersona?: { id: string, name: string, description: string, prompt: string } | null | undefined, systemMode: 'thinking' | 'agent' | 'fast' }) => {
    const {
        chats, setChats, appSettings, selectedModel, selectedProvider, selectedModels,
        language, selectedPersona, activeWorkspacePath, projectId, t, handleSpeak,
        autoReadEnabled, formatChatError, systemMode
    } = props;

    const [streamingStates, setStreamingStates] = useState<Record<string, {
        content?: string,
        reasoning?: string,
        speed?: number | null,
        sources?: string[] | undefined,
        variants?: Record<number, { content: string, reasoning: string }>
    }>>({});

    const generateResponse = async (chatId: string, userMessage: Message, retryModel?: string) => {
        setStreamingStates(prev => ({ ...prev, [chatId]: { content: '', reasoning: '', speed: null } }));
        const assistantId = generateId();
        const activeModel = retryModel ?? selectedModel;

        // Determine which models to use - if multi-model selected and no retry, use all
        const modelsToUse: SelectedModelInfo[] = (!retryModel && selectedModels && selectedModels.length > 1)
            ? selectedModels
            : [{ provider: selectedProvider, model: activeModel }];

        const isMultiModel = modelsToUse.length > 1;

        try {
            const allTools: ToolDefinition[] = await window.electron.getToolDefinitions();

            // For multi-model responses, create placeholder message first
            const tempMsg: Message = {
                id: assistantId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
                provider: modelsToUse[0].provider,
                model: modelsToUse[0].model,
                variants: isMultiModel ? modelsToUse.map((m, idx) => ({
                    id: `${assistantId}-v${idx}`,
                    content: '',
                    model: m.model,
                    provider: m.provider,
                    timestamp: new Date(),
                    label: m.model,
                    isSelected: false
                })) : undefined
            };
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, tempMsg] } : c));
            void window.electron.db.addMessage({ ...tempMsg, chatId, timestamp: Date.now() });

            if (isMultiModel) {
                // Multi-model: generate responses in parallel
                await generateMultiModelResponse({
                    chatId, assistantId, userMessage, models: modelsToUse, allTools,
                    chats, setChats, appSettings, language, selectedPersona,
                    activeWorkspacePath, projectId, setStreamingStates,
                    autoReadEnabled, handleSpeak, t, formatChatError, systemMode
                });
            } else {
                // Single model: use existing stream logic
                const tools = allTools.filter((tDefinition) => {
                    if (selectedProvider === 'opencode') { return true; }
                    if (selectedProvider === 'antigravity') { return true; }
                    return tDefinition.function.name === 'generate_image';
                });

                const { presetOptions } = prepareMessages({
                    chatId, chats, userMessage, appSettings, selectedModel: activeModel,
                    selectedProvider, language, selectedPersona, systemMode
                });

                const fullOptions = { ...presetOptions, projectRoot: activeWorkspacePath, systemMode };
                await executeToolTurnLoop({
                    chatId, assistantId, activeModel, selectedProvider,
                    tools, fullOptions, projectId, autoReadEnabled, handleSpeak, t,
                    setStreamingStates, setChats, activeWorkspacePath, systemMode, chats
                });
            }
        } catch (e) {
            window.electron.log.error('[generateResponse] Error', e as Error);
            const errText = formatChatError(e as CatchError);
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.map(m => m.id === assistantId ? { ...m, content: `${t('chat.error')}: ${errText}` } : m), isGenerating: false } : c));
            void window.electron.db.updateMessage(assistantId, { content: `${t('chat.error')}: ${errText}` });
        } finally {
            setStreamingStates(prev => { const s = { ...prev }; delete s[chatId]; return s; });
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

    return {
        streamingStates,
        generateResponse,
        stopGeneration
    };
};

/**
 * Handles tool execution loop for autonomous tool use
 */
const executeToolTurnLoop = async (params: {
    chatId: string,
    assistantId: string,
    activeModel: string,
    selectedProvider: string,
    tools: ToolDefinition[],
    fullOptions: Record<string, unknown>,
    projectId: string | undefined,
    autoReadEnabled: boolean,
    handleSpeak: (id: string, content: string) => void,
    t: (key: string) => string,
    setStreamingStates: React.Dispatch<React.SetStateAction<Record<string, StreamStreamingState>>>,
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>,
    activeWorkspacePath: string | undefined,
    systemMode: 'thinking' | 'agent' | 'fast',
    chats: Chat[]
}) => {
    const {
        chatId, assistantId, activeModel, selectedProvider,
        tools, fullOptions, projectId, autoReadEnabled, handleSpeak, t,
        setStreamingStates, setChats, activeWorkspacePath, systemMode, chats
    } = params;

    let currentAssistantId = assistantId;
    let toolIterations = 0;
    const MAX_TOOL_ITERATIONS = 5;

    while (toolIterations < MAX_TOOL_ITERATIONS) {
        // Re-fetch messages from latest state for each iteration
        const currentMessages = chats.find(c => c.id === chatId)?.messages ?? [];

        const stream = chatStream({
            messages: currentMessages,
            model: activeModel,
            tools,
            provider: selectedProvider,
            options: { ...fullOptions, projectRoot: activeWorkspacePath, systemMode },
            chatId,
            projectId,
            systemMode
        });
        const streamStartTime = performance.now();

        const result = await processChatStream({
            stream, chatId, assistantId: currentAssistantId, setStreamingStates, setChats, streamStartTime,
            activeModel, selectedProvider, t, autoReadEnabled, handleSpeak
        });

        if (result.finalToolCalls.length > 0) {
            // Create assistant message with tool calls
            const assistantMsg: Message = {
                id: currentAssistantId,
                role: 'assistant',
                content: result.finalContent,
                timestamp: new Date(),
                provider: selectedProvider,
                model: activeModel,
                toolCalls: result.finalToolCalls
            };

            // Execute tools
            const toolResults: Message[] = [];
            for (const tc of result.finalToolCalls) {
                try {
                    const toolArgs = typeof tc.function.arguments === 'string'
                        ? JSON.parse(tc.function.arguments)
                        : tc.function.arguments;

                    const toolExecResult = await window.electron.executeTools(tc.function.name, toolArgs, tc.id);

                    const toolMsg: Message = {
                        id: generateId(),
                        role: 'tool' as const,
                        content: JSON.stringify(toolExecResult),
                        toolCallId: tc.id,
                        timestamp: new Date()
                    };
                    toolResults.push(toolMsg);

                    // Save tool message to DB
                    void window.electron.db.addMessage({ ...toolMsg, chatId, timestamp: Date.now() });
                } catch (error) {
                    window.electron.log.error('Tool execution error', error as Error);
                }
            }

            // Update chats with assistant message (including tool calls) AND tool results
            setChats(prev => prev.map(c => {
                if (c.id !== chatId) { return c; }
                return {
                    ...c,
                    messages: c.messages.map(m => m.id === currentAssistantId ? assistantMsg : m).concat(toolResults)
                };
            }));

            // Prepare for next turn
            currentAssistantId = generateId();

            // Add a placeholder for the next assistant response
            const nextAssistantPlaceholder: Message = {
                id: currentAssistantId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
                provider: selectedProvider,
                model: activeModel
            };
            setChats(prev => prev.map(c => {
                if (c.id !== chatId) { return c; }
                return { ...c, messages: [...c.messages, nextAssistantPlaceholder] };
            }));
            void window.electron.db.addMessage({ ...nextAssistantPlaceholder, chatId, timestamp: Date.now() });

            toolIterations++;
        } else {
            // No more tool calls, we are done
            break;
        }
    }
    return currentAssistantId;
};

const generateMultiModelResponse = async (params: {
    chatId: string,
    assistantId: string,
    userMessage: Message,
    models: SelectedModelInfo[],
    allTools: ToolDefinition[],
    chats: Chat[],
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>,
    appSettings: AppSettings | undefined,
    language: string,
    selectedPersona: { id: string, name: string, description: string, prompt: string } | null | undefined,
    activeWorkspacePath: string | undefined,
    projectId: string | undefined,
    setStreamingStates: React.Dispatch<React.SetStateAction<Record<string, StreamStreamingState>>>,
    autoReadEnabled: boolean,
    handleSpeak: (id: string, content: string) => void,
    t: (key: string) => string,
    formatChatError: (err: CatchError) => string,
    systemMode: 'thinking' | 'agent' | 'fast'
}) => {
    const {
        chatId, assistantId, userMessage, models, allTools,
        chats, setChats, appSettings, language, selectedPersona,
        activeWorkspacePath, projectId, setStreamingStates,
        autoReadEnabled, handleSpeak, t, formatChatError, systemMode
    } = params;

    const streamStartTime = performance.now();
    await orchestrationMultiModelStreams({
        chatId, assistantId, userMessage, models, allTools,
        chats, setChats, appSettings, language, selectedPersona,
        activeWorkspacePath, projectId, setStreamingStates, streamStartTime,
        autoReadEnabled, handleSpeak, t, formatChatError, systemMode
    });
};

interface OrchestrationParams {
    chatId: string
    assistantId: string
    userMessage: Message
    models: SelectedModelInfo[]
    allTools: ToolDefinition[]
    chats: Chat[]
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>
    appSettings: AppSettings | undefined
    language: string
    selectedPersona: { id: string, name: string, description: string, prompt: string } | null | undefined
    activeWorkspacePath: string | undefined
    projectId: string | undefined
    setStreamingStates: React.Dispatch<React.SetStateAction<Record<string, StreamStreamingState>>>
    streamStartTime: number
    autoReadEnabled: boolean
    handleSpeak: (id: string, content: string) => void
    t: (key: string) => string
    formatChatError: (err: CatchError) => string
    systemMode: 'thinking' | 'agent' | 'fast'
}

/**
 * Orchestrates multiple model streams in parallel
 */
async function orchestrationMultiModelStreams(params: OrchestrationParams) {
    const {
        chatId, assistantId, userMessage, models, allTools,
        chats, setChats, appSettings, language, selectedPersona,
        activeWorkspacePath, projectId, setStreamingStates, streamStartTime,
        autoReadEnabled, handleSpeak, t, formatChatError, systemMode
    } = params;

    const promises = models.map(async (modelInfo: SelectedModelInfo, index: number) => {
        const streamId = `${chatId}-model-${index}-${Date.now()}`;
        try {
            const tools = allTools.filter((tDefinition: ToolDefinition) => {
                if (modelInfo.provider === 'opencode') { return true; }
                return tDefinition.function.name === 'generate_image' && modelInfo.provider === 'antigravity';
            });

            const { allMessages, presetOptions } = prepareMessages({
                chatId, chats, userMessage, appSettings, selectedModel: modelInfo.model,
                selectedProvider: modelInfo.provider, language, selectedPersona, systemMode
            });

            const fullOptions = { ...presetOptions, projectRoot: activeWorkspacePath, systemMode };
            const stream = chatStream({
                messages: allMessages, model: modelInfo.model, tools,
                provider: modelInfo.provider, options: fullOptions,
                chatId: streamId, projectId, systemMode
            });

            let variantContent = '';
            let variantReasoning = '';
            let lastUpdate = 0;

            for await (const chunk of stream) {
                if (chunk.content) { variantContent += chunk.content; }
                if (chunk.reasoning) { variantReasoning += chunk.reasoning; }

                setStreamingStates((prev: Record<string, StreamStreamingState>) => {
                    const state = prev[chatId] ?? { content: '', reasoning: '', speed: null, variants: {} };
                    const variants = { ...state.variants };
                    variants[index] = { content: variantContent, reasoning: variantReasoning };
                    const isMain = index === 0;
                    return {
                        ...prev,
                        [chatId]: {
                            ...state,
                            content: isMain ? variantContent : state.content,
                            reasoning: isMain ? variantReasoning : state.reasoning,
                            variants
                        }
                    };
                });

                const now = Date.now();
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
                                        id: `${assistantId}-v${index}`,
                                        content: '',
                                        model: modelInfo.model,
                                        provider: modelInfo.provider,
                                        timestamp: new Date(),
                                        label: modelInfo.model,
                                        isSelected: index === 0
                                    };
                                }
                                currentVariants[index] = { ...currentVariants[index], content: variantContent };
                                const isMain = index === 0;
                                return {
                                    ...m,
                                    content: isMain ? variantContent : m.content,
                                    reasoning: isMain ? variantReasoning : m.reasoning,
                                    variants: currentVariants
                                };
                            })
                        };
                    }));
                }
            }

            return {
                model: modelInfo.model, provider: modelInfo.provider,
                content: variantContent, reasoning: variantReasoning,
                responseTime: Math.round(performance.now() - streamStartTime)
            };
        } catch (e) {
            const errText = `${t('chat.error')}: ${formatChatError(e as CatchError)}`;
            return {
                model: modelInfo.model, provider: modelInfo.provider,
                content: errText, error: errText
            };
        }
    });

    const results = await Promise.all(promises);
    const finalResponseTime = Math.round(performance.now() - streamStartTime);
    const finalVariants = results.map((r, idx) => ({
        id: `${assistantId}-v${idx}`,
        content: r.content,
        model: r.model,
        provider: r.provider,
        timestamp: new Date(),
        label: r.model,
        isSelected: idx === 0,
        error: r.error
    }));

    const finalContent = results[0]?.content || '';
    const finalReasoning = results[0]?.reasoning;

    setChats((prev: Chat[]) => prev.map(c => {
        if (c.id !== chatId) { return c; }
        let title = c.title;
        if (c.messages.length <= 2 && finalContent) {
            title = finalContent.split('\n')[0].replace(/[#*`]/g, '').trim().slice(0, 50) || t('sidebar.newChat');
        }
        return {
            ...c,
            title,
            messages: c.messages.map(m => {
                if (m.id !== assistantId) { return m; }
                return {
                    ...m,
                    content: finalContent,
                    reasoning: finalReasoning,
                    responseTime: finalResponseTime,
                    variants: finalVariants.length > 1 ? finalVariants : undefined
                };
            }),
            isGenerating: false
        };
    }));

    await window.electron.db.updateMessage(assistantId, {
        content: finalContent,
        reasoning: finalReasoning,
        responseTime: finalResponseTime,
        variants: finalVariants.length > 1 ? finalVariants : undefined
    });

    if (autoReadEnabled && finalContent) {
        handleSpeak(assistantId, finalContent);
    }
}
