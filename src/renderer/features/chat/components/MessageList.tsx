import { MessageBubble } from '@renderer/features/chat/components/MessageBubble';
import { MessageSkeleton } from '@renderer/features/chat/components/MessageSkeleton';
import { memo, useCallback, useEffect, useState } from 'react';
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

    const [prevMessages, setPrevMessages] = useState(messages);

    if (messages !== prevMessages) {
        setPrevMessages(messages);
        if (messages.length === 0) {
            setFocusedIndex(-1);
            setSelectedMessageId(null);
        } else {
            const persistedMessageId = sessionStorage.getItem('chat.messageList.focusedMessageId');
            const persistedIndex = persistedMessageId
                ? messages.findIndex(message => message.id === persistedMessageId)
                : -1;

            setFocusedIndex(persistedIndex >= 0 ? persistedIndex : messages.length - 1);
        }
    }

    useEffect(() => {
        if (focusedIndex < 0 || focusedIndex >= messages.length) {
            return;
        }
        const focusedMessage = messages[focusedIndex];
        sessionStorage.setItem('chat.messageList.focusedMessageId', focusedMessage.id);
        virtuosoRef?.current?.scrollToIndex({
            index: focusedIndex,
            align: 'center',
            behavior: 'smooth',
        });
    }, [focusedIndex, messages, virtuosoRef]);

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

            if (event.key === 'Enter' && focusedIndex >= 0) {
                event.preventDefault();
                const focusedMessage = messages[focusedIndex];
                setSelectedMessageId(prev => (prev === focusedMessage.id ? null : focusedMessage.id));
                return;
            }

            if (event.key.toLowerCase() === 'r' && focusedIndex >= 0) {
                const focusedMessage = messages[focusedIndex];
                if (focusedMessage.role === 'assistant') {
                    event.preventDefault();
                    void onRegenerate?.(focusedMessage.id);
                }
            }
        },
        [focusedIndex, messages, onRegenerate]
    );

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
                itemContent={(index, message) => {
                    const isStreamingCurrent =
                        isLoading && index === messages.length - 1 && message.role === 'assistant';

                    // Add some padding to the last item
                    const isLast = index === messages.length - 1;
                    const isFocused =
                        index === focusedIndex || (selectedMessageId !== null && message.id === selectedMessageId);

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
                                onSpeak={(text) => onSpeak(text, message.id)}
                                onStop={onStopSpeak}
                                isSpeaking={speakingMessageId === message.id}
                                onCodeConvert={() => { }}
                                onReact={(e) =>
                                    void window.electron.db.updateMessage(message.id, { reactions: [e] })
                                }
                                onBookmark={(b) =>
                                    void window.electron.db.updateMessage(message.id, { isBookmarked: b })
                                }
                                onRate={(r) =>
                                    void window.electron.db.updateMessage(message.id, { rating: r })
                                }
                                onRegenerate={
                                    message.role === 'assistant'
                                        ? () => {
                                            void onRegenerate?.(message.id);
                                        }
                                        : undefined
                                }
                                onApprovePlan={() => { }}
                                streamingSpeed={isStreamingCurrent ? streamingSpeed : null}
                                streamingReasoning={
                                    isStreamingCurrent ? streamingReasoning : undefined
                                }
                            />
                            {isLast && <div className="h-4" />}
                        </div>
                    );
                }}
            />
        </div>
    );
});

MessageList.displayName = 'MessageList';
