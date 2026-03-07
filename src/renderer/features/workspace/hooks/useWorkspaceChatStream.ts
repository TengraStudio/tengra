import { useCallback, useRef, useState } from 'react';

import { chatStream } from '@/lib/chat-stream';
import { getSystemPrompt } from '@/lib/identity';
import { generateId } from '@/lib/utils';
import { ChatError, Message } from '@/types';

export interface WorkspaceChatStreamResult {
    messages: Message[];
    isStreaming: boolean;
    error: ChatError | null;
    sendMessage: (content: string) => void;
    stopStreaming: () => void;
    clearError: () => void;
    retry: () => void;
}

interface UseWorkspaceChatStreamOptions {
    provider: string;
    model: string;
    language: string;
    projectId: string;
}

export interface UseWorkspaceChatStreamResult {
    messages: Message[];
    isStreaming: boolean;
    error: ChatError | null;
    sendMessage: (content: string) => void;
    stopStreaming: () => void;
    clearError: () => void;
    retry: () => void;
}

/**
 * Lightweight hook that wires workspace AI sidebar chat to
 * the production `chat:stream` IPC via the shared chatStream helper.
 */
export function useWorkspaceChatStream(
    options: UseWorkspaceChatStreamOptions
): UseWorkspaceChatStreamResult {
    const { provider, model, language, projectId } = options;

    const [messages, setMessages] = useState<Message[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<ChatError | null>(null);
    const abortedRef = useRef(false);
    const lastContentRef = useRef('');

    const clearError = useCallback(() => setError(null), []);

    const stopStreaming = useCallback(() => {
        abortedRef.current = true;
        window.electron.abortChat();
        setIsStreaming(false);
    }, []);

    const sendMessage = useCallback(
        (content: string) => {
            if (!content.trim() || isStreaming) {
                return;
            }

            setError(null);
            lastContentRef.current = content;

            const userMsg: Message = {
                id: generateId(),
                role: 'user',
                content,
                timestamp: new Date(),
            };

            const assistantId = generateId();
            const assistantMsg: Message = {
                id: assistantId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
                provider,
                model,
            };

            setMessages(prev => [...prev, userMsg, assistantMsg]);
            setIsStreaming(true);
            abortedRef.current = false;

            const chatId = generateId();

            const systemPrompt = getSystemPrompt(
                language as 'tr' | 'en',
                undefined,
                provider,
                model
            );

            const systemMessage: Message = {
                id: generateId(),
                role: 'system',
                content: systemPrompt,
                timestamp: new Date(),
            };

            const run = async () => {
                try {
                    const stream = chatStream({
                        messages: [systemMessage, userMsg],
                        model,
                        provider,
                        tools: [],
                        chatId,
                        workspaceId: projectId,
                        options: {},
                    });

                    let accumulated = '';

                    const MAX_CHUNKS = 100000;
                    let chunkCount = 0;

                    for await (const chunk of stream) {
                        if (abortedRef.current || chunkCount >= MAX_CHUNKS) {
                            break;
                        }
                        chunkCount++;

                        if (chunk.type === 'content' && chunk.content) {
                            accumulated += chunk.content;
                            const snapshot = accumulated;
                            setMessages(prev =>
                                prev.map(m =>
                                    m.id === assistantId
                                        ? { ...m, content: snapshot }
                                        : m
                                )
                            );
                        }

                        if (chunk.type === 'error') {
                            const errContent = accumulated
                                ? `${accumulated}\n\n[Error: ${chunk.error ?? 'unknown'}]`
                                : `Error: ${chunk.error ?? 'unknown'}`;
                            setMessages(prev =>
                                prev.map(m =>
                                    m.id === assistantId
                                        ? { ...m, content: errContent }
                                        : m
                                )
                            );
                            setError(categorizeError(
                                chunk.error ?? 'unknown',
                                model
                            ));
                            break;
                        }
                    }
                } catch (err: unknown) {
                    const errMsg = err instanceof Error ? err.message : 'Stream failed';
                    setMessages(prev =>
                        prev.map(m =>
                            m.id === assistantId
                                ? { ...m, content: m.content ? `${m.content}\n\n[${errMsg}]` : errMsg }
                                : m
                        )
                    );
                    setError(categorizeError(errMsg, model));
                } finally {
                    setIsStreaming(false);
                }
            };

            void run();
        },
        [isStreaming, provider, model, language, projectId]
    );

    const retry = useCallback(() => {
        if (lastContentRef.current) {
            setError(null);
            sendMessage(lastContentRef.current);
        }
    }, [sendMessage]);

    return { messages, isStreaming, error, sendMessage, stopStreaming, clearError, retry };
}

/** Categorize an error message into a known error kind */
function categorizeError(message: string, model: string | null): ChatError {
    const lower = message.toLowerCase();

    if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('429') || lower.includes('exceeded')) {
        return { kind: 'quota_exhausted', message, model };
    }
    if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('econnaborted')) {
        return { kind: 'timeout', message, model };
    }
    if (
        lower.includes('econnrefused') || lower.includes('enotfound')
        || lower.includes('unavailable') || lower.includes('503')
        || lower.includes('network') || lower.includes('connect')
    ) {
        return { kind: 'provider_unavailable', message, model };
    }
    return { kind: 'generic', message, model };
}
