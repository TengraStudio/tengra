import { buildAssistantPresentationMetadata } from '@renderer/features/chat/hooks/ai-runtime-chat.util';
import { createModelToolList } from '@renderer/features/chat/hooks/chat-runtime-policy.util';
import { classifyAiIntent } from '@shared/utils/ai-runtime.util';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { chatStream } from '@/lib/chat-stream';
import { ChatError, Message } from '@/types';

import {
    categorizeConversationError,
    formatStreamErrorContent,
    patchAssistantMessage,
    toTextContent,
} from './session-conversation-stream.util';

export interface ConsumeConversationStreamOptions {
    assistantId: string;
    assistantTimestamp: Date;
    intentClassification: ReturnType<typeof classifyAiIntent>;
    language: string;
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

export async function consumeConversationStream(
    options: ConsumeConversationStreamOptions
): Promise<void> {
    const {
        assistantId,
        assistantTimestamp,
        intentClassification,
        language,
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
    const getToolDefinitions = window.electron.getToolDefinitions;
    const allTools = typeof getToolDefinitions === 'function'
        ? await getToolDefinitions().catch(() => [])
        : [];
    const stream = chatStream({
        messages: streamMessages,
        model,
        provider,
        tools: createModelToolList(allTools ?? []),
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
                setMessages(previous => patchAssistantMessage(previous, assistantId, {
                    content: accumulated,
                    metadata: buildAssistantPresentationMetadata({
                        intent: intentClassification,
                        content: accumulated,
                        isStreaming: true,
                        language,
                    }),
                }));
            }

            if (chunk.type === 'error') {
                const errorMessage = chunk.error ?? 'unknown';
                const errorText = accumulated
                    ? `${accumulated}\n\n[Error: ${errorMessage}]`
                    : `Error: ${errorMessage}`;
                setMessages(previous => patchAssistantMessage(previous, assistantId, {
                    content: errorText,
                    metadata: buildAssistantPresentationMetadata({
                        intent: intentClassification,
                        content: errorText,
                        language,
                    }),
                }));
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
            const content = formatStreamErrorContent(existingContent, errorMessage);
            return patchAssistantMessage(previous, assistantId, {
                content,
                metadata: buildAssistantPresentationMetadata({
                    intent: intentClassification,
                    content,
                    language,
                }),
            });
        });
        setError(categorizeConversationError(errorMessage, model));
    } finally {
        setMessages(previous => {
            const assistantMessage = previous.find(message => message.id === assistantId);
            if (!assistantMessage) {
                return previous;
            }
            const content = toTextContent(assistantMessage.content);
            return patchAssistantMessage(previous, assistantId, {
                metadata: buildAssistantPresentationMetadata({
                    intent: intentClassification,
                    content,
                    isStreaming: false,
                    language,
                }),
                timestamp: assistantTimestamp,
            });
        });
        setIsStreaming(false);
    }
}
