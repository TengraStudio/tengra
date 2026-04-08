import { MessageBubble } from '@renderer/features/chat/components/MessageBubble';
import { MessageSkeleton } from '@renderer/features/chat/components/MessageSkeleton';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import { Language, useTranslation } from '@/i18n';
import { Message } from '@/types';

interface MessageListProps {
    messages: Message[];
    streamingReasoning?: string | undefined;
    streamingSpeed: number | null;
    isLoading: boolean;
    language: Language;
    selectedProvider: string;
    selectedModel: string;
    onSpeak: (text: string, id: string) => void;
    onStopSpeak: () => void;
    speakingMessageId: string | null;
    onRegenerate?: (messageId: string) => void | Promise<void>;
    // Callbacks for parent to manage scroll button state
    onAtBottomStateChange?: (atBottom: boolean) => void;
    // Expose ref for external scrolling control
    virtuosoRef?: React.RefObject<VirtuosoHandle>;
}

interface MessageActionHandlers {
    onSpeak: (text: string) => void;
    onReact: (emoji: string) => void;
    onBookmark: (isBookmarked: boolean) => void;
    onRate: (rating: number) => void;
    onRegenerate?: () => void;
}

interface DisplayMessageEntry {
    id: string;
    sourceMessageId: string;
    message: Message;
}

function isThoughtOnlyMessage(message: Message): boolean {
    return Boolean(message.metadata?.thoughtOnly === true);
}

function hasRenderableAssistantPayload(message: Message): boolean {
    const textContent = typeof message.content === 'string'
        ? message.content.trim()
        : message.content.length > 0
            ? '[multipart]'
            : '';
    return textContent.length > 0
        || (message.images?.length ?? 0) > 0
        || (message.sources?.length ?? 0) > 0
        || (message.toolCalls?.length ?? 0) > 0
        || (Array.isArray(message.toolResults) && message.toolResults.length > 0);
}

function buildDisplayMessages(messages: Message[]): DisplayMessageEntry[] {
    const entries: DisplayMessageEntry[] = [];
    for (const message of messages) {
        if (message.role !== 'assistant' || isThoughtOnlyMessage(message)) {
            entries.push({ id: message.id, sourceMessageId: message.id, message });
            continue;
        }

        const reasoningSegments = (message.reasonings ?? [])
            .filter(segment => typeof segment === 'string' && segment.trim().length > 0);

        reasoningSegments.forEach((segment, index) => {
            entries.push({
                id: `${message.id}::thought::${index}`,
                sourceMessageId: message.id,
                message: {
                    ...message,
                    id: `${message.id}::thought::${index}`,
                    content: '',
                    reasoning: segment,
                    reasonings: undefined,
                    toolCalls: undefined,
                    toolResults: undefined,
                    images: undefined,
                    sources: undefined,
                    variants: undefined,
                    metadata: {
                        ...(message.metadata ?? {}),
                        thoughtOnly: true,
                        sourceMessageId: message.id,
                        thoughtIndex: index,
                    },
                },
            });
        });

        if (hasRenderableAssistantPayload(message) || reasoningSegments.length === 0) {
            entries.push({
                id: message.id,
                sourceMessageId: message.id,
                message: {
                    ...message,
                    reasoning: undefined,
                    reasonings: undefined,
                },
            });
        }
    }
    return entries;
}

export const MessageList = memo(({
    messages,
    streamingReasoning,
    streamingSpeed,
    isLoading,
    language,
    selectedProvider,
    selectedModel: _selectedModel,
    onSpeak,
    onStopSpeak,
    speakingMessageId,
    onRegenerate,
    onAtBottomStateChange,
    virtuosoRef
}: MessageListProps) => {
    const [focusedIndex, setFocusedIndex] = useState<number>(-1);
    const { t } = useTranslation(language);
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
    const displayMessages = useMemo(() => buildDisplayMessages(messages), [messages]);

    const effectiveFocusedIndex =
        displayMessages.length === 0
            ? -1
            : focusedIndex >= 0 && focusedIndex < displayMessages.length
                ? focusedIndex
                : -1;

    useEffect(() => {
        if (effectiveFocusedIndex < 0 || effectiveFocusedIndex >= displayMessages.length) {
            return;
        }
        const focusedMessage = displayMessages[effectiveFocusedIndex].message;
        sessionStorage.setItem('chat.messageList.focusedMessageId', focusedMessage.id);
        virtuosoRef?.current?.scrollToIndex({
            index: effectiveFocusedIndex,
            align: 'center',
            behavior: 'smooth',
        });
    }, [displayMessages, effectiveFocusedIndex, virtuosoRef]);

    const messageActionHandlers = useMemo(() => {
        const handlers = new Map<string, MessageActionHandlers>();
        for (const entry of displayMessages) {
            const { id, message, sourceMessageId } = entry;
            handlers.set(id, {
                onSpeak: (text) => onSpeak(text, sourceMessageId),
                onReact: (emoji) => {
                    if (isThoughtOnlyMessage(message)) {
                        return;
                    }
                    void window.electron.db.updateMessage(sourceMessageId, { reactions: [emoji] });
                },
                onBookmark: (isBookmarked) => {
                    if (isThoughtOnlyMessage(message)) {
                        return;
                    }
                    void window.electron.db.updateMessage(sourceMessageId, { isBookmarked });
                },
                onRate: (rating) => {
                    if (isThoughtOnlyMessage(message)) {
                        return;
                    }
                    void window.electron.db.updateMessage(sourceMessageId, { rating });
                },
                onRegenerate: message.role === 'assistant' && !isThoughtOnlyMessage(message)
                    ? () => {
                        void onRegenerate?.(sourceMessageId);
                    }
                    : undefined,
            });
        }
        return handlers;
    }, [displayMessages, onRegenerate, onSpeak]);

    const handleKeyboardNavigation = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (displayMessages.length === 0) {
                return;
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setFocusedIndex(prev => Math.max(0, prev <= 0 ? displayMessages.length - 1 : prev - 1));
                return;
            }

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setFocusedIndex(prev => Math.min(displayMessages.length - 1, prev < 0 ? 0 : prev + 1));
                return;
            }

            if (event.key === 'Home') {
                event.preventDefault();
                setFocusedIndex(0);
                return;
            }

            if (event.key === 'End') {
                event.preventDefault();
                setFocusedIndex(displayMessages.length - 1);
                return;
            }

            if (event.key === 'Enter' && effectiveFocusedIndex >= 0) {
                event.preventDefault();
                const focusedMessage = displayMessages[effectiveFocusedIndex].message;
                setSelectedMessageId(prev => (prev === focusedMessage.id ? null : focusedMessage.id));
                return;
            }

            if (event.key.toLowerCase() === 'r' && effectiveFocusedIndex >= 0) {
                const focusedEntry = displayMessages[effectiveFocusedIndex];
                if (focusedEntry.message.role === 'assistant' && !isThoughtOnlyMessage(focusedEntry.message)) {
                    event.preventDefault();
                    void onRegenerate?.(focusedEntry.sourceMessageId);
                }
            }
        },
        [displayMessages, effectiveFocusedIndex, onRegenerate]
    );

    const renderMessageItem = useCallback((index: number, entry: DisplayMessageEntry) => {
        const { message, sourceMessageId } = entry;
        const isStreamingCurrent =
            isLoading && index === displayMessages.length - 1 && message.role === 'assistant';
        const isLast = index === displayMessages.length - 1;
        const isFocused =
            index === effectiveFocusedIndex ||
            (selectedMessageId !== null && message.id === selectedMessageId);
        const handlers = messageActionHandlers.get(entry.id);
        if (!handlers) {
            return null;
        }

        return (
            <div
                id={`message-list-option-${message.id}`}
                className="px-4 pb-4"
                aria-selected={isFocused}
                role="option"
            >
                <MessageBubble
                    id={`message-bubble-${message.id}`}
                    message={message}
                    isLast={isLast}
                    isFocused={isFocused}
                    isStreaming={isStreamingCurrent}
                    language={language}
                    backend={selectedProvider}
                    onSpeak={handlers.onSpeak}
                    onStop={onStopSpeak}
                    isSpeaking={speakingMessageId === message.id}
                    onCodeConvert={() => { }}
                    onReact={handlers.onReact}
                    onBookmark={handlers.onBookmark}
                    onRate={handlers.onRate}
                    onRegenerate={handlers.onRegenerate}
                    onApprovePlan={() => { }}
                    streamingSpeed={isStreamingCurrent ? streamingSpeed : null}
                    streamingReasoning={
                        isStreamingCurrent && sourceMessageId === messages[messages.length - 1]?.id
                            ? streamingReasoning
                            : undefined
                    }
                />
                {isLast && <div className="h-4" />}
            </div>
        );
    }, [
        isLoading,
        displayMessages.length,
        effectiveFocusedIndex,
        selectedMessageId,
        messageActionHandlers,
        messages,
        language,
        selectedProvider,
        onStopSpeak,
        speakingMessageId,
        streamingSpeed,
        streamingReasoning,
    ]);

    // Determine if we should follow the output (stick to bottom)
    // We stick to bottom if we are loading (streaming) or if the user is near the bottom (handled by Virtuoso default 'smooth' or 'auto')

    if (displayMessages.length === 0 && isLoading) {
        return (
            <div className="p-4 h-full flex flex-col justify-end">
                <MessageSkeleton />
            </div>
        );
    }

    return (
        <div
            className="h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-lg"
            tabIndex={0}
            onKeyDown={handleKeyboardNavigation}
            role="listbox"
            aria-label={t('aria.messageList')}
            aria-describedby="message-list-keyboard-help"
            aria-activedescendant={
                effectiveFocusedIndex >= 0 && displayMessages[effectiveFocusedIndex]
                    ? `message-list-option-${displayMessages[effectiveFocusedIndex].id}`
                    : undefined
            }
        >
            <p id="message-list-keyboard-help" className="sr-only">
                {t('aria.messageListKeyboardHelp')}
            </p>
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {isLoading ? t('aria.messageListStreaming') : ''}
                {displayMessages.length > 0 && !isLoading
                    ? t('aria.messageListCount', { count: displayMessages.length })
                    : ''}
            </div>
            <div aria-live="polite" aria-atomic="false" className="sr-only">
                {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'assistant'
                    && typeof messages[messages.length - 1].content === 'string'
                    ? (messages[messages.length - 1].content as string).slice(-200)
                    : ''}
            </div>
            <Virtuoso
                ref={virtuosoRef}
                style={{ height: '100%', width: '100%' }}
                data={displayMessages}
                // Follow output only if currently streaming the last message
                followOutput={isLoading ? 'smooth' : 'auto'}
                atBottomStateChange={onAtBottomStateChange}
                initialTopMostItemIndex={displayMessages.length - 1}
                alignToBottom={true} // Start at bottom for chat feel
                itemContent={renderMessageItem}
            />
        </div>
    );
});

MessageList.displayName = 'MessageList';
