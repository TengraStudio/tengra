/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { classifyAiIntent } from '@shared/utils/ai/ai-runtime.util';
import { appLogger } from '@system/utils/renderer-logger';
import { useCallback, useRef, useState } from 'react';

import { buildAssistantPresentationMetadata } from '@/features/chat/hooks/ai-runtime-chat.util';
import { ChatError, Message } from '@/types';

import {
    prepareConversationMessages,
} from '../utils/session-conversation-stream.util';
import { consumeConversationStream } from '../utils/session-conversation-stream-consumer.util';

import { useSessionState } from './useSessionState';

export interface SessionConversationStreamOptions {
    provider: string;
    model: string;
    language: string;
    workspaceId?: string;
}

export interface SessionConversationStreamState {
    activeSessionId: string | null;
    messages: Message[];
    isStreaming: boolean;
    error: ChatError | null;
    sendMessage: (content: string) => void;
    stopStreaming: () => void;
    clearError: () => void;
    retry: () => void;
}

export function useSessionConversationStream(
    options: SessionConversationStreamOptions
): SessionConversationStreamState {
    const { provider, model, language, workspaceId } = options;

    const [messages, setMessages] = useState<Message[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<ChatError | null>(null);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    const abortedRef = useRef(false);
    const lastContentRef = useRef('');
    const sessionState = useSessionState(activeSessionId);

    const isSessionStreaming =
        sessionState?.status === 'preparing' || sessionState?.status === 'streaming';
    const isStreamActive = isStreaming || isSessionStreaming;

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const stopStreaming = useCallback(() => {
        abortedRef.current = true;
        if (activeSessionId) {
            appLogger.warn('useSessionConversationStream', `stopStreaming abort requested sessionId=${activeSessionId}`);
            window.electron.session.conversation.abort(activeSessionId);
        }
        setIsStreaming(false);
    }, [activeSessionId]);

    const sendMessage = useCallback((content: string) => {
        if (!content.trim() || isStreamActive) {
            return;
        }

        const preparedMessages = prepareConversationMessages(content, provider, model, language);
        const intentClassification = classifyAiIntent(preparedMessages.userMessage, 'agent');

        setError(null);
        setMessages(previous => {
            return [
                ...previous,
                preparedMessages.userMessage,
                {
                    ...preparedMessages.assistantMessage,
                    metadata: buildAssistantPresentationMetadata({
                        intent: intentClassification,
                        isStreaming: true,
                        language,
                    }),
                },
            ];
        });
        setIsStreaming(true);
        setActiveSessionId(preparedMessages.sessionId);
        lastContentRef.current = content;
        abortedRef.current = false;

        void consumeConversationStream({
            assistantId: preparedMessages.assistantId,
            assistantTimestamp: preparedMessages.assistantMessage.timestamp,
            intentClassification,
            language,
            model,
            provider,
            sessionId: preparedMessages.sessionId,
            setError,
            setIsStreaming,
            setMessages,
            streamMessages: [preparedMessages.systemMessage, preparedMessages.userMessage],
            workspaceId,
            abortedRef,
        });
    }, [isStreamActive, language, model, provider, workspaceId]);

    const retry = useCallback(() => {
        if (!lastContentRef.current) {
            return;
        }
        setError(null);
        sendMessage(lastContentRef.current);
    }, [sendMessage]);

    return {
        activeSessionId,
        messages,
        isStreaming: isStreamActive,
        error,
        sendMessage,
        stopStreaming,
        clearError,
        retry,
    };
}

