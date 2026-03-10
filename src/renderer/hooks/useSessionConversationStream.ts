import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useCallback, useRef, useState } from 'react';

import { chatStream } from '@/lib/chat-stream';
import { getSystemPrompt } from '@/lib/identity';
import { generateId } from '@/lib/utils';
import { ChatError, Message } from '@/types';

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

interface PreparedConversationMessages {
    assistantId: string;
    assistantMessage: Message;
    sessionId: string;
    systemMessage: Message;
    userMessage: Message;
}

interface ConsumeConversationStreamOptions {
    assistantId: string;
    model: string;
    provider: string;
    sessionId: string;
    setError: Dispatch<SetStateAction<ChatError | null>>;
    setIsStreaming: Dispatch<SetStateAction<boolean>>;
    setMessages: Dispatch<SetStateAction<Message[]>>;
    streamMessages: Message[];
    workspaceId?: string;
    abortedRef: MutableRefObject<boolean>;
}

function categorizeConversationError(message: string, model: string | null): ChatError {
    const lower = message.toLowerCase();

    if (
        lower.includes('quota')
        || lower.includes('rate limit')
        || lower.includes('429')
        || lower.includes('exceeded')
    ) {
        return { kind: 'quota_exhausted', message, model };
    }
    if (
        lower.includes('timeout')
        || lower.includes('timed out')
        || lower.includes('econnaborted')
    ) {
        return { kind: 'timeout', message, model };
    }
    if (
        lower.includes('econnrefused')
        || lower.includes('enotfound')
        || lower.includes('unavailable')
        || lower.includes('503')
        || lower.includes('network')
        || lower.includes('connect')
    ) {
        return { kind: 'provider_unavailable', message, model };
    }
    return { kind: 'generic', message, model };
}

function patchAssistantMessage(messages: Message[], assistantId: string, content: string): Message[] {
    return messages.map(message => {
        if (message.id !== assistantId) {
            return message;
        }
        return {
            ...message,
            content,
        };
    });
}

function toTextContent(content: Message['content']): string {
    if (typeof content === 'string') {
        return content;
    }

    return content
        .map(part => (part.type === 'text' ? part.text : part.image_url.url))
        .join('\n');
}

function buildSystemMessage(provider: string, model: string, language: string): Message {
    return {
        id: generateId(),
        role: 'system',
        content: getSystemPrompt(language as 'tr' | 'en', undefined, provider, model),
        timestamp: new Date(),
    };
}

function prepareConversationMessages(
    content: string,
    provider: string,
    model: string,
    language: string
): PreparedConversationMessages {
    const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: new Date(),
    };
    const assistantId = generateId();
    return {
        assistantId,
        assistantMessage: {
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            provider,
            model,
        },
        sessionId: generateId(),
        systemMessage: buildSystemMessage(provider, model, language),
        userMessage,
    };
}

function formatStreamErrorContent(existingContent: string, errorMessage: string): string {
    return existingContent
        ? `${existingContent}\n\n[${errorMessage}]`
        : errorMessage;
}

async function consumeConversationStream(
    options: ConsumeConversationStreamOptions
): Promise<void> {
    const {
        assistantId,
        model,
        provider,
        sessionId,
        setError,
        setIsStreaming,
        setMessages,
        streamMessages,
        workspaceId,
        abortedRef,
    } = options;
    const stream = chatStream({
        messages: streamMessages,
        model,
        provider,
        tools: [],
        chatId: sessionId,
        workspaceId,
        options: {},
    });
    let accumulated = '';
    const MAX_CHUNKS = 100000;
    let chunkCount = 0;

    try {
        for await (const chunk of stream) {
            if (abortedRef.current || chunkCount >= MAX_CHUNKS) {
                break;
            }
            chunkCount++;

            if (chunk.type === 'content' && chunk.content) {
                accumulated += chunk.content;
                setMessages(previous => patchAssistantMessage(previous, assistantId, accumulated));
            }

            if (chunk.type === 'error') {
                const errorMessage = chunk.error ?? 'unknown';
                const errorText = accumulated
                    ? `${accumulated}\n\n[Error: ${errorMessage}]`
                    : `Error: ${errorMessage}`;
                setMessages(previous => patchAssistantMessage(previous, assistantId, errorText));
                setError(categorizeConversationError(errorMessage, model));
                break;
            }
        }
    } catch (streamError) {
        const errorMessage = streamError instanceof Error ? streamError.message : 'Stream failed';
        setMessages(previous => {
            const existingContent = toTextContent(
                previous.find(message => message.id === assistantId)?.content ?? ''
            );
            return patchAssistantMessage(
                previous,
                assistantId,
                formatStreamErrorContent(existingContent, errorMessage)
            );
        });
        setError(categorizeConversationError(errorMessage, model));
    } finally {
        setIsStreaming(false);
    }
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
            window.electron.session.conversation.abort(activeSessionId);
        }
        setIsStreaming(false);
    }, [activeSessionId]);

    const sendMessage = useCallback((content: string) => {
        if (!content.trim() || isStreamActive) {
            return;
        }

        const preparedMessages = prepareConversationMessages(content, provider, model, language);

        setError(null);
        setMessages(previous => {
            return [...previous, preparedMessages.userMessage, preparedMessages.assistantMessage];
        });
        setIsStreaming(true);
        setActiveSessionId(preparedMessages.sessionId);
        lastContentRef.current = content;
        abortedRef.current = false;

        void consumeConversationStream({
            assistantId: preparedMessages.assistantId,
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
