import { MessageBubble } from '@renderer/features/chat/components/MessageBubble';
import { MessageSkeleton } from '@renderer/features/chat/components/MessageSkeleton';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import { Language } from '@/i18n';
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
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

    const persistedFocusedIndex = useMemo(() => {
        if (messages.length === 0) {
            return -1;
        }
        const persistedMessageId = sessionStorage.getItem('chat.messageList.focusedMessageId');
        return persistedMessageId
            ? messages.findIndex(message => message.id === persistedMessageId)
            : -1;
    }, [messages]);

    const effectiveFocusedIndex =
        messages.length === 0
            ? -1
            : focusedIndex >= 0 && focusedIndex < messages.length
                ? focusedIndex
                : persistedFocusedIndex >= 0
                    ? persistedFocusedIndex
                    : messages.length - 1;

    useEffect(() => {
        if (effectiveFocusedIndex < 0 || effectiveFocusedIndex >= messages.length) {
            return;
        }
        const focusedMessage = messages[effectiveFocusedIndex];
        sessionStorage.setItem('chat.messageList.focusedMessageId', focusedMessage.id);
        virtuosoRef?.current?.scrollToIndex({
            index: effectiveFocusedIndex,
            align: 'center',
            behavior: 'smooth',
        });
    }, [effectiveFocusedIndex, messages, virtuosoRef]);

    const messageActionHandlers = useMemo(() => {
        const handlers = new Map<string, MessageActionHandlers>();
        for (const message of messages) {
            const messageId = message.id;
            handlers.set(messageId, {
                onSpeak: (text) => onSpeak(text, messageId),
                onReact: (emoji) => {
                    void window.electron.db.updateMessage(messageId, { reactions: [emoji] });
                },
                onBookmark: (isBookmarked) => {
                    void window.electron.db.updateMessage(messageId, { isBookmarked });
                },
                onRate: (rating) => {
                    void window.electron.db.updateMessage(messageId, { rating });
                },
                onRegenerate: message.role === 'assistant'
                    ? () => {
                        void onRegenerate?.(messageId);
                    }
                    : undefined,
            });
        }
        return handlers;
    }, [messages, onRegenerate, onSpeak]);

    const handleKeyboardNavigation = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (messages.length === 0) {
                return;
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setFocusedIndex(prev => Math.max(0, prev <= 0 ? messages.length - 1 : prev - 1));
                return;
            }

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setFocusedIndex(prev => Math.min(messages.length - 1, prev < 0 ? 0 : prev + 1));
                return;
            }

            if (event.key === 'Home') {
                event.preventDefault();
                setFocusedIndex(0);
                return;
            }

            if (event.key === 'End') {
                event.preventDefault();
                setFocusedIndex(messages.length - 1);
                return;
            }

            if (event.key === 'Enter' && effectiveFocusedIndex >= 0) {
                event.preventDefault();
                const focusedMessage = messages[effectiveFocusedIndex];
                setSelectedMessageId(prev => (prev === focusedMessage.id ? null : focusedMessage.id));
                return;
            }

            if (event.key.toLowerCase() === 'r' && effectiveFocusedIndex >= 0) {
                const focusedMessage = messages[effectiveFocusedIndex];
                if (focusedMessage.role === 'assistant') {
                    event.preventDefault();
                    void onRegenerate?.(focusedMessage.id);
                }
            }
        },
        [effectiveFocusedIndex, messages, onRegenerate]
    );

    const renderMessageItem = useCallback((index: number, message: Message) => {
        const isStreamingCurrent =
            isLoading && index === messages.length - 1 && message.role === 'assistant';
        const isLast = index === messages.length - 1;
        const isFocused =
            index === effectiveFocusedIndex ||
            (selectedMessageId !== null && message.id === selectedMessageId);
        const handlers = messageActionHandlers.get(message.id);
        if (!handlers) {
            return null;
        }

        return (
            <div className="px-4 pb-4" aria-selected={isFocused}>
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
                        isStreamingCurrent ? streamingReasoning : undefined
                    }
                />
                {isLast && <div className="h-4" />}
            </div>
        );
    }, [
        isLoading,
        messages.length,
        effectiveFocusedIndex,
        selectedMessageId,
        messageActionHandlers,
        language,
        selectedProvider,
        onStopSpeak,
        speakingMessageId,
        streamingSpeed,
        streamingReasoning,
    ]);

    // Determine if we should follow the output (stick to bottom)
    // We stick to bottom if we are loading (streaming) or if the user is near the bottom (handled by Virtuoso default 'smooth' or 'auto')

    if (messages.length === 0 && isLoading) {
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
            aria-label="Message list. Use arrow keys to navigate messages and Enter to select."
        >
            <Virtuoso
                ref={virtuosoRef}
                style={{ height: '100%', width: '100%' }}
                data={messages}
                // Follow output only if currently streaming the last message
                followOutput={isLoading ? 'smooth' : 'auto'}
                atBottomStateChange={onAtBottomStateChange}
                initialTopMostItemIndex={messages.length - 1}
                alignToBottom={true} // Start at bottom for chat feel
                itemContent={renderMessageItem}
            />
        </div>
    );
});

MessageList.displayName = 'MessageList';
