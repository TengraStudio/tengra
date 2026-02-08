import { MessageBubble } from '@renderer/features/chat/components/MessageBubble';
import { MessageSkeleton } from '@renderer/features/chat/components/MessageSkeleton';
import { memo } from 'react';
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
    onAtBottomStateChange,
    virtuosoRef
}: MessageListProps) => {
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
                const isStreamingCurrent = isLoading && index === messages.length - 1 && message.role === 'assistant';

                // Add some padding to the last item
                const isLast = index === messages.length - 1;

                return (
                    <div className="px-4 pb-4">
                        <MessageBubble
                            id={`message-bubble-${index}`}
                            message={message}
                            isLast={isLast}
                            isFocused={false} // Todo: reimplement keyboard focus if needed
                            isStreaming={isStreamingCurrent}
                            language={language}
                            backend={selectedProvider}
                            onSpeak={(text) => onSpeak(text, message.id)}
                            onStop={onStopSpeak}
                            isSpeaking={speakingMessageId === message.id}
                            onCodeConvert={() => { }}
                            onReact={(e) => void window.electron.db.updateMessage(message.id, { reactions: [e] })}
                            onBookmark={(b) => void window.electron.db.updateMessage(message.id, { isBookmarked: b })}
                            onRate={(r) => void window.electron.db.updateMessage(message.id, { rating: r })}
                            onApprovePlan={() => { }}
                            streamingSpeed={isStreamingCurrent ? streamingSpeed : null}
                            streamingReasoning={isStreamingCurrent ? streamingReasoning : undefined}
                        />
                        {isLast && <div className="h-4" />}
                    </div>
                );
            }}
        />
    );
});

MessageList.displayName = 'MessageList';
