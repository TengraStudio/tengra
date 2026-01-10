import React, { memo } from 'react';
import { MessageBubble } from './MessageBubble';
import { Message } from '@/types';
import { Language } from '@/i18n';

interface MessageListProps {
    messages: Message[];
    streamingContent: string;
    streamingReasoning?: string;
    streamingSpeed: number | null;
    isLoading: boolean;
    language: Language;
    selectedProvider: string;
    selectedModel: string;
    onSpeak: (text: string, id: string) => void;
    onStopSpeak: () => void;
    speakingMessageId: string | null;
    messagesEndRef: React.RefObject<HTMLDivElement>;
}

/**
 * MessageList Component
 * 
 * Renders the list of messages in a chat, including:
 * - Message bubbles for user and assistant
 * - Streaming message content (when a response is in progress)
 * - Auto-scrolling to the bottom when new messages arrive.
 */
export const MessageList = memo(({
    messages,
    streamingContent,
    streamingReasoning,
    streamingSpeed,
    isLoading,
    language,
    selectedProvider,
    selectedModel,
    onSpeak,
    onStopSpeak,
    speakingMessageId,
    messagesEndRef
}: MessageListProps) => {
    const [focusedIndex, setFocusedIndex] = React.useState<number | null>(null);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeTag = document.activeElement?.tagName.toLowerCase();
            if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement).isContentEditable) {
                return;
            }

            if (e.key === 'j' || e.key === 'ArrowDown') {
                setFocusedIndex(prev => {
                    const next = (prev === null ? -1 : prev) + 1;
                    return Math.min(next, messages.length - 1);
                });
            } else if (e.key === 'k' || e.key === 'ArrowUp') {
                setFocusedIndex(prev => {
                    const next = (prev === null ? messages.length : prev) - 1;
                    return Math.max(next, 0);
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [messages.length]);

    React.useEffect(() => {
        if (focusedIndex !== null) {
            const el = document.getElementById(`message-bubble-${focusedIndex}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [focusedIndex]);

    return (
        <div className="max-w-3xl mx-auto w-full p-4 space-y-4 flex-1 flex flex-col pt-4">
            {messages.map((m, i) => (
                <MessageBubble
                    key={m.id}
                    id={`message-bubble-${i}`}
                    isFocused={i === focusedIndex}
                    message={m}
                    isLast={i === messages.length - 1 && !streamingContent}
                    isStreaming={isLoading && i === messages.length - 1 && m.role === 'assistant'}
                    language={language}
                    backend={selectedProvider}
                    onSpeak={(text) => onSpeak(text, m.id)}
                    onStop={onStopSpeak}
                    isSpeaking={speakingMessageId === m.id}
                    // These handlers remain in App.tsx or ChatView for now as they involve hook-level state
                    onCodeConvert={() => { }}
                    onReact={(e) => window.electron.db.updateMessage(m.id, { reactions: [e] })}
                    onBookmark={(b) => window.electron.db.updateMessage(m.id, { isBookmarked: b })}
                    onRate={(r) => window.electron.db.updateMessage(m.id, { rating: r })}
                    onApprovePlan={() => { }}
                    streamingSpeed={i === messages.length - 1 && isLoading ? streamingSpeed : null}
                    streamingReasoning={i === messages.length - 1 && isLoading ? streamingReasoning : undefined}
                />
            ))}
            {streamingContent && (
                <MessageBubble
                    message={{
                        id: 'streaming',
                        role: 'assistant',
                        content: streamingContent,
                        timestamp: new Date(),
                        provider: selectedProvider,
                        model: selectedModel
                    }}
                    isStreaming
                    isLast
                    language={language}
                    streamingSpeed={streamingSpeed}
                    streamingReasoning={streamingReasoning}
                />
            )}
            <div ref={messagesEndRef} className="h-4" />
        </div>
    );
});
