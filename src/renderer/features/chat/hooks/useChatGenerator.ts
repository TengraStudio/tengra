import {
    classifyAiIntent,
} from '@shared/utils/ai-runtime.util';
import { useCallback, useState } from 'react';

import { generateId } from '@/lib/utils';
import { AppSettings, Chat, ChatError, Message, ToolDefinition } from '@/types';
import { CatchError } from '@/types/common';
import { appLogger } from '@/utils/renderer-logger';

import {
    buildAssistantPresentationMetadata,
    deduplicateMessages,
} from './ai-runtime-chat.util';
import {
    createModelToolList,
    extractImageRequestCount,
    getMessageTextContent,
    getReasoningEffort,
    isExplicitImageRequest,
    isImageOnlyModel,
} from './chat-runtime-policy.util';
import {
    completeDirectImageMessage,
} from './message-persistence.util';
import { prepareMessages } from './message-preparation.util';
import { generateMultiModelResponse } from './multi-model-chat.util';
import { StreamStreamingState } from './process-stream';
import { executeToolTurnLoop } from './tool-turn-loop-execution.util';
import { categorizeError } from './utils';

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
    t: (key: string, options?: Record<string, unknown>) => string;
    handleSpeak: (id: string, content: string) => void;
    autoReadEnabled: boolean;
    formatChatError: (err: CatchError) => string;
}

const logRendererError = (message: string, error: Error): void => {
    appLogger.error('useChatGenerator', message, error);
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

    const createAssistantPlaceholder = useCallback((params: {
        assistantId: string;
        chatId: string;
        modelsToUse: SelectedModelInfo[];
        isMultiModel: boolean;
        intentClassification: ReturnType<typeof classifyAiIntent>;
    }): void => {
        const { assistantId, chatId, modelsToUse, isMultiModel, intentClassification } = params;
        const placeholder: Message = {
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            provider: modelsToUse[0].provider,
            model: modelsToUse[0].model,
            metadata: buildAssistantPresentationMetadata({
                intent: intentClassification,
                isStreaming: true,
                language,
            }),
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
            prev.map(c => (c.id === chatId ? { ...c, messages: deduplicateMessages([...c.messages, placeholder]) } : c))
        );
        void window.electron.db.addMessage({ ...placeholder, chatId, timestamp: Date.now() }).catch((error) => {
            logRendererError('[generateResponse] Failed to persist assistant placeholder', error as Error);
        });
    }, [language, setChats]);

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
        const intentClassification = classifyAiIntent(userMessage, systemMode);
        const shouldEnableTools = !shouldUseDirectImageFlow
            && (systemMode === 'agent' || intentClassification.requiresTooling);

        try {
            createAssistantPlaceholder({
                assistantId,
                chatId,
                modelsToUse,
                isMultiModel,
                intentClassification,
            });

            if (shouldUseDirectImageFlow) {
                await completeDirectImageMessage({
                    assistantId,
                    chatId,
                    prompt: getMessageTextContent(userMessage),
                    requestedCount: extractImageRequestCount(userMessage),
                    activeModel,
                    selectedProvider,
                    setChats,
                    t,
                    intentClassification,
                    language,
                });
            } else if (isMultiModel) {
                const allTools: ToolDefinition[] = (await window.electron.getToolDefinitions()) ?? [];
                await generateMultiModelResponse({
                    chatId, assistantId, userMessage, models: modelsToUse, allTools, chats, setChats,
                    appSettings, language, selectedPersona, activeWorkspacePath, workspaceId, setStreamingStates,
                    autoReadEnabled, handleSpeak, t, formatChatError, systemMode, intentClassification,
                    getReasoningEffort, createModelToolList, prepareMessages
                });
            } else {
                const allTools: ToolDefinition[] = shouldEnableTools
                    ? (await window.electron.getToolDefinitions()) ?? []
                    : [];
                const tools = shouldEnableTools ? createModelToolList(allTools ?? []) : [];

                const { allMessages, presetOptions } = prepareMessages({
                    chatId, chats, userMessage, appSettings, selectedModel: activeModel,
                    selectedProvider, language, selectedPersona, activeWorkspacePath, systemMode, toolingEnabled: shouldEnableTools
                });

                const reasoningEffort = getReasoningEffort(activeModel, appSettings);
                const fullOptions = {
                    ...presetOptions, workspaceRoot: activeWorkspacePath, systemMode, thinking: systemMode === 'thinking',
                    agentToolsEnabled: shouldEnableTools, reasoningEffort
                };
                await executeToolTurnLoop({
                    initialMessages: allMessages,
                    chatId, assistantId, activeModel, selectedProvider, tools, fullOptions, workspaceId,
                    autoReadEnabled, handleSpeak, t, language, setStreamingStates, setChats, activeWorkspacePath, systemMode,
                    intentClassification
                });
            }
        } catch (e) {
            logRendererError('[generateResponse] Error', e as Error);
            const errText = formatChatError(e as CatchError);
            setLastChatError(categorizeError(errText, activeModel));
            const partialContent = streamingStates[chatId]?.content ?? '';
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
