import React from 'react';
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
export const MessageList: React.FC<MessageListProps> = ({
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
}) => {
    return (
        <div className="max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-8 flex-1 flex flex-col pt-8 sm:pt-12">
            {messages.map((m, i) => (
                <MessageBubble
                    key={m.id}
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
                        provider: (selectedProvider as any),
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
};
