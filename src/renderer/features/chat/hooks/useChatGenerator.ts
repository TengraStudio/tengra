/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    classifyAiIntent,
} from '@shared/utils/ai-runtime.util';
import { useCallback, useRef, useState } from 'react';

import { generateId } from '@/lib/utils';
import { AppSettings, Chat, ChatError, Message, ToolDefinition } from '@/types';
import { CatchError } from '@/types/common';
import { appLogger } from '@/utils/renderer-logger';

import {
    buildAssistantPresentationMetadata,
    deduplicateMessages,
} from './ai-runtime-chat.util';
import {
    getActiveAntigravityAccount,
    shouldConfirmAntigravityCreditUsage,
} from './antigravity-credit-usage.util';
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
    quotas?: { accounts: import('@/types/quota').QuotaResponse[] } | null | undefined;
    linkedAccounts?: Array<import('@renderer/electron.d').LinkedAccountInfo> | undefined;
}

interface AntigravityCreditConfirmationState {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
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
    antigravityCreditConfirmation: AntigravityCreditConfirmationState;
    confirmAntigravityCreditUsage: () => void;
    cancelAntigravityCreditUsage: () => void;
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
        quotas,
        linkedAccounts,
    } = props;

    const [streamingStates, setStreamingStates] = useState<Record<string, StreamStreamingState>>({});
    const [lastChatError, setLastChatError] = useState<ChatError | null>(null);
    const [antigravityCreditConfirmation, setAntigravityCreditConfirmation] = useState<AntigravityCreditConfirmationState>({
        isOpen: false,
        title: '',
        message: '',
        confirmLabel: '',
    });
    const pendingCreditConfirmationRef = useRef<((confirmed: boolean) => void) | null>(null);
    const clearChatError = useCallback(() => setLastChatError(null), []);
    const clearCreditConfirmation = useCallback(() => {
        setAntigravityCreditConfirmation({
            isOpen: false,
            title: '',
            message: '',
            confirmLabel: '',
        });
    }, []);
    const resolveCreditConfirmation = useCallback((confirmed: boolean) => {
        const resolver = pendingCreditConfirmationRef.current;
        pendingCreditConfirmationRef.current = null;
        clearCreditConfirmation();
        resolver?.(confirmed);
    }, [clearCreditConfirmation]);
    const confirmAntigravityCreditUsage = useCallback(() => {
        resolveCreditConfirmation(true);
    }, [resolveCreditConfirmation]);
    const cancelAntigravityCreditUsage = useCallback(() => {
        resolveCreditConfirmation(false);
    }, [resolveCreditConfirmation]);

    const requestAntigravityCreditConfirmation = useCallback(async (
        model: string,
        provider: string
    ): Promise<boolean> => {
        const confirmation = shouldConfirmAntigravityCreditUsage({
            provider,
            model,
            settings: appSettings,
            linkedAccounts,
            quotaData: quotas,
        });
        if (!confirmation) {
            return true;
        }

        const accountLabel = confirmation.account.email ?? confirmation.account.displayName ?? confirmation.account.id;
        const interpolations: Record<string, string | number> = {
            account: accountLabel,
            credits: confirmation.creditAmount ?? 0,
            minimum: confirmation.minimumCreditAmountForUsage ?? 0,
        };
        setAntigravityCreditConfirmation({
            isOpen: true,
            title: t('chat.antigravityCreditsConfirmTitle'),
            message: t('chat.antigravityCreditsConfirmMessage', interpolations),
            confirmLabel: t('chat.antigravityCreditsConfirmAction'),
        });

        return await new Promise<boolean>(resolve => {
            pendingCreditConfirmationRef.current = resolve;
        });
    }, [appSettings, linkedAccounts, quotas, t]);
    const buildProviderOptions = useCallback((provider: string, baseOptions: Record<string, RendererDataValue>) => {
        if (provider.trim().toLowerCase() !== 'antigravity') {
            return baseOptions;
        }

        const activeAccountId = getActiveAntigravityAccount(linkedAccounts)?.id;
        if (!activeAccountId) {
            return baseOptions;
        }

        return {
            ...baseOptions,
            accountId: activeAccountId,
        };
    }, [linkedAccounts]);

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
            for (const modelInfo of modelsToUse) {
                const approved = await requestAntigravityCreditConfirmation(modelInfo.model, modelInfo.provider);
                if (!approved) {
                    setChats(prev => prev.map(c => c.id === chatId ? { ...c, isGenerating: false } : c));
                    return;
                }
            }

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
                const fullOptions = buildProviderOptions(selectedProvider, {
                    ...presetOptions, workspaceRoot: activeWorkspacePath, systemMode, thinking: systemMode === 'thinking',
                    agentToolsEnabled: shouldEnableTools, reasoningEffort
                });
                await executeToolTurnLoop({
                    initialMessages: allMessages,
                    chatId, assistantId, activeModel, selectedProvider, tools, fullOptions, workspaceId,
                    autoReadEnabled, handleSpeak, t, language, setStreamingStates, setChats, activeWorkspacePath, systemMode,
                    intentClassification,
                    confirmAntigravityCreditUsage: requestAntigravityCreditConfirmation,
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
                appLogger.warn('useChatGenerator', `stopGeneration abort requested chatId=${activeChatId}`);
                window.electron.session.conversation.abort(activeChatId);
            }
            setStreamingStates({});
        } catch (e) {
            logRendererError('Failed to stop generation', e as Error);
        }
    };

    return {
        streamingStates,
        lastChatError,
        clearChatError,
        generateResponse,
        stopGeneration,
        antigravityCreditConfirmation,
        confirmAntigravityCreditUsage,
        cancelAntigravityCreditUsage,
    };
};
