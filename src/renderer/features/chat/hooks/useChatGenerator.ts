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
import { 
    addMessageToStore, 
    setStreamingState, 
    updateChatInStore, 
    updateMessageInStore, 
    useChatStore 
} from '@/store/chat.store';
import { AppSettings, Chat, ChatError, Message, ToolDefinition } from '@/types';
import { CatchError } from '@/types/common';
import { appLogger } from '@/utils/renderer-logger';

import {
    buildAssistantPresentationMetadata,
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
    appSettings?: AppSettings | undefined;
    selectedModel: string;
    selectedProvider: string;
    selectedModels?: SelectedModelInfo[];
    language: string;
    activeWorkspacePath?: string | undefined;
    workspaceId?: string | undefined;
    workspaceTitle?: string | undefined;
    workspaceDescription?: string | undefined;
    t: (key: string, options?: Record<string, unknown>) => string;
    handleSpeak: (id: string, content: string) => void;
    autoReadEnabled: boolean;
    formatChatError: (err: CatchError) => string;
    quotas?: { accounts: import('@/types/quota').QuotaResponse[] } | null | undefined;
    linkedAccounts?: Array<import('@/electron.d').LinkedAccountInfo> | undefined;
    onMessageAdded?: (chatId: string, message: Message) => void;
    onMessageUpdated?: (chatId: string, messageId: string, updates: Partial<Message>) => void;
    onChatUpdated?: (chatId: string, updates: Partial<Chat>) => void;
    onStreamingStateUpdated?: (chatId: string, state: StreamStreamingState | null) => void;
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
        appSettings,
        selectedModel,
        selectedProvider,
        selectedModels,
        language,
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

    const streamingStates = useChatStore(s => s.streamingStates);
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
            title: t('frontend.chat.antigravityCreditsConfirmTitle'),
            message: t('frontend.chat.antigravityCreditsConfirmMessage', interpolations),
            confirmLabel: t('frontend.chat.antigravityCreditsConfirmAction'),
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

        if (props.onMessageAdded) {
            props.onMessageAdded(chatId, placeholder);
        } else {
            addMessageToStore(chatId, placeholder);
        }
        
        void window.electron.db.addMessage({ ...placeholder, chatId, timestamp: Date.now() }).catch((error) => {
            logRendererError('[generateResponse] Failed to persist assistant placeholder', error as Error);
        });
    }, [language, props]);

    const generateResponse = async (chatId: string, userMessage: Message, retryModel?: string): Promise<void> => {
        setLastChatError(null);
        setStreamingState(chatId, { content: '', reasoning: '', speed: null, error: null });
        const assistantId = generateId();
        const initialModel = retryModel ?? selectedModel;

        const modelsToUse: SelectedModelInfo[] =
            !retryModel && selectedModels && selectedModels.length > 1
                ? selectedModels
                : [{ provider: selectedProvider, model: initialModel }];

        const isMultiModel = modelsToUse.length > 1;
        const shouldUseDirectImageFlow = isImageOnlyModel(initialModel) || isExplicitImageRequest(userMessage);
        const intentClassification = classifyAiIntent(userMessage, systemMode);
        const shouldEnableTools = !shouldUseDirectImageFlow
            && (systemMode === 'agent' || intentClassification.requiresTooling);

        try {
            for (const modelInfo of modelsToUse) {
                const approved = await requestAntigravityCreditConfirmation(modelInfo.model, modelInfo.provider);
                if (!approved) {
                    if (props.onChatUpdated) {
                        props.onChatUpdated(chatId, { isGenerating: false });
                    } else {
                        updateChatInStore(chatId, { isGenerating: false });
                    }
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
                    activeModel: initialModel,
                    selectedProvider,
                    t,
                    intentClassification,
                    language,
                });
            } else if (isMultiModel) {
                const allTools: ToolDefinition[] = (await window.electron.getToolDefinitions()) ?? [];
                await generateMultiModelResponse({
                    chatId, assistantId, userMessage, models: modelsToUse, allTools, chats,
                    appSettings, language, activeWorkspacePath, workspaceId,
                    autoReadEnabled, handleSpeak, t, formatChatError, systemMode, intentClassification,
                    getReasoningEffort, createModelToolList, prepareMessages
                });
            } else {
                const allTools: ToolDefinition[] = shouldEnableTools
                    ? (await window.electron.getToolDefinitions()) ?? []
                    : [];
                const tools = shouldEnableTools ? createModelToolList(allTools ?? []) : [];

                const { allMessages, presetOptions } = prepareMessages({
                    chatId, chats, userMessage, appSettings, selectedModel: initialModel,
                    selectedProvider, language, activeWorkspacePath, systemMode, toolingEnabled: shouldEnableTools,
                    workspaceTitle: props.workspaceTitle,
                    workspaceDescription: props.workspaceDescription
                });

                const reasoningEffort = getReasoningEffort(initialModel, appSettings);
                const fullOptions = buildProviderOptions(selectedProvider, {
                    ...presetOptions, workspaceRoot: activeWorkspacePath, systemMode, thinking: systemMode === 'thinking',
                    agentToolsEnabled: shouldEnableTools, reasoningEffort
                });
                await executeToolTurnLoop({
                    initialMessages: allMessages,
                    chatId, assistantId, activeModel: initialModel, selectedProvider, tools, fullOptions, workspaceId,
                    autoReadEnabled, handleSpeak, t, language, activeWorkspacePath, systemMode,
                    intentClassification,
                    confirmAntigravityCreditUsage: requestAntigravityCreditConfirmation,
                    onStreamingUpdate: (update) => {
                        if (props.onMessageUpdated) {
                            props.onMessageUpdated(chatId, assistantId, update);
                        } else {
                            updateMessageInStore(chatId, assistantId, update);
                        }
                    }
                });
            }
        } catch (e) {
            logRendererError('[generateResponse] Error', e as Error);
            const errText = formatChatError(e as CatchError);
            setLastChatError(categorizeError(errText, initialModel));
            const partialContent = streamingStates[chatId]?.content ?? '';
            const finalErrorText = partialContent.trim().length > 0
                ? `${partialContent}\n\n[Generation interrupted: ${errText}]`
                : `${t('frontend.chat.error')}: ${errText}`;
            
            if (props.onMessageUpdated) {
                props.onMessageUpdated(chatId, assistantId, { content: finalErrorText });
            } else {
                updateMessageInStore(chatId, assistantId, { content: finalErrorText });
            }

            if (props.onChatUpdated) {
                props.onChatUpdated(chatId, { isGenerating: false });
            } else {
                updateChatInStore(chatId, { isGenerating: false });
            }
            void window.electron.db.updateMessage(assistantId, { content: finalErrorText });
        } finally {
            if (props.onChatUpdated) {
                props.onChatUpdated(chatId, { isGenerating: false });
            } else {
                updateChatInStore(chatId, { isGenerating: false });
            }
            const chatUpdate = window.electron.db.updateChat?.(chatId, { isGenerating: false });
            void chatUpdate?.catch((error) => {
                appLogger.warn('useChatGenerator', `Failed to persist generation completion for chatId=${chatId}`, error as Error);
            });
            
            if (props.onStreamingStateUpdated) {
                props.onStreamingStateUpdated(chatId, null);
            } else {
                setStreamingState(chatId, null);
            }
        }
    };

    const stopGeneration = async (): Promise<void> => {
        try {
            for (const activeChatId of Object.keys(streamingStates)) {
                appLogger.warn('useChatGenerator', `stopGeneration abort requested chatId=${activeChatId}`);
                window.electron.session.conversation.abort(activeChatId);
            }
            // Clear all streaming states
            for (const activeChatId of Object.keys(streamingStates)) {
                setStreamingState(activeChatId, null);
            }
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
