import React, { memo, useRef, useEffect, useMemo, useState } from 'react';
import { List } from 'react-window';
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
interface MessageRowProps {
    messages: Message[]
    streamingContent: string
    isLoading: boolean
    language: Language
    selectedProvider: string
    selectedModel: string
    onSpeak: (text: string, id: string) => void
    onStopSpeak: () => void
    speakingMessageId: string | null
    streamingSpeed: number | null
    streamingReasoning?: string
    focusedIndex: number | null
}

const MessageRow = memo(({ 
    index, 
    style, 
    messages,
    streamingContent,
    isLoading,
    language,
    selectedProvider,
    selectedModel,
    onSpeak,
    onStopSpeak,
    speakingMessageId,
    streamingSpeed,
    streamingReasoning,
    focusedIndex
}: MessageRowProps & { index: number; style: React.CSSProperties; ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' } }) => {

    // If this is the streaming message placeholder
    if (index === messages.length && streamingContent) {
        return (
            <div style={style} className="px-4 pb-4">
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
            </div>
        )
    }

    const message = messages[index]
    if (!message) return null

    return (
        <div style={style} className="px-4 pb-4">
            <MessageBubble
                id={`message-bubble-${index}`}
                isFocused={index === focusedIndex}
                message={message}
                isLast={index === messages.length - 1 && !streamingContent}
                isStreaming={isLoading && index === messages.length - 1 && message.role === 'assistant'}
                language={language}
                backend={selectedProvider}
                onSpeak={(text) => onSpeak(text, message.id)}
                onStop={onStopSpeak}
                isSpeaking={speakingMessageId === message.id}
                onCodeConvert={() => {}}
                onReact={(e) => window.electron.db.updateMessage(message.id, { reactions: [e] })}
                onBookmark={(b) => window.electron.db.updateMessage(message.id, { isBookmarked: b })}
                onRate={(r) => window.electron.db.updateMessage(message.id, { rating: r })}
                onApprovePlan={() => {}}
                streamingSpeed={index === messages.length - 1 && isLoading ? streamingSpeed : null}
                streamingReasoning={index === messages.length - 1 && isLoading ? streamingReasoning : undefined}
            />
        </div>
    )
})

MessageRow.displayName = 'MessageRow'

const VIRTUALIZATION_THRESHOLD = 20 // Use virtualization for 20+ messages
const ESTIMATED_ITEM_HEIGHT = 200 // Estimated height per message

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
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
    const [containerHeight, setContainerHeight] = useState(600)
    const containerRef = useRef<HTMLDivElement>(null)
    // Use any for listRef to avoid complex react-window type issues
    const listRef = useRef<{ readonly element: HTMLDivElement | null; scrollToRow: (config: { index: number; align?: 'auto' | 'start' | 'end' | 'center' | 'smart'; behavior?: 'auto' | 'instant' | 'smooth' }) => void } | null>(null)

    // Calculate item count (messages + streaming message if present)
    const itemCount = messages.length + (streamingContent ? 1 : 0)
    const useVirtualization = itemCount >= VIRTUALIZATION_THRESHOLD

    // Measure container height
    useEffect(() => {
        const updateHeight = () => {
            if (containerRef.current) {
                setContainerHeight(containerRef.current.clientHeight)
            }
        }
        updateHeight()
        window.addEventListener('resize', updateHeight)
        return () => window.removeEventListener('resize', updateHeight)
    }, [])

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        if (useVirtualization && listRef.current && (streamingContent || isLoading)) {
            listRef.current.scrollToRow({ index: itemCount - 1, align: 'end' })
        } else if (!useVirtualization && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [streamingContent, isLoading, itemCount, useVirtualization, messagesEndRef])

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeTag = document.activeElement?.tagName.toLowerCase()
            if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement).isContentEditable) {
                return
            }

            if (e.key === 'j' || e.key === 'ArrowDown') {
                setFocusedIndex(prev => {
                    const next = (prev === null ? -1 : prev) + 1
                    const newIndex = Math.min(next, messages.length - 1)
                    if (useVirtualization && listRef.current && newIndex >= 0) {
                        listRef.current.scrollToRow({ index: newIndex, align: 'center' })
                    } else if (!useVirtualization && newIndex >= 0) {
                        const el = document.getElementById(`message-bubble-${newIndex}`)
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                    return newIndex
                })
            } else if (e.key === 'k' || e.key === 'ArrowUp') {
                setFocusedIndex(prev => {
                    const next = (prev === null ? messages.length : prev) - 1
                    const newIndex = Math.max(next, 0)
                    if (useVirtualization && listRef.current && newIndex >= 0) {
                        listRef.current.scrollToRow({ index: newIndex, align: 'center' })
                    } else if (!useVirtualization && newIndex >= 0) {
                        const el = document.getElementById(`message-bubble-${newIndex}`)
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                    return newIndex
                })
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [messages.length, useVirtualization])

    const rowProps = useMemo(() => ({
        messages,
        streamingContent,
        isLoading,
        language,
        selectedProvider,
        selectedModel,
        onSpeak,
        onStopSpeak,
        speakingMessageId,
        streamingSpeed,
        streamingReasoning,
        focusedIndex
    }), [
        messages,
        streamingContent,
        isLoading,
        language,
        selectedProvider,
        selectedModel,
        onSpeak,
        onStopSpeak,
        speakingMessageId,
        streamingSpeed,
        streamingReasoning,
        focusedIndex
    ])

    // Use virtualization for long lists
    if (useVirtualization) {
        return (
            <div ref={containerRef} className="max-w-3xl mx-auto w-full flex-1 flex flex-col pt-4" style={{ height: '100%' }}>
                <List
                    listRef={listRef}
                    defaultHeight={containerHeight || 600}
                    rowCount={itemCount}
                    rowHeight={ESTIMATED_ITEM_HEIGHT}
                    rowProps={rowProps}
                    overscanCount={5}
                    rowComponent={MessageRow as (props: MessageRowProps & { index: number; style: React.CSSProperties; ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' } }) => React.ReactElement}
                />
                <div ref={messagesEndRef} className="h-4" />
            </div>
        )
    }

    // Regular rendering for short lists
    return (
        <div ref={containerRef} className="max-w-3xl mx-auto w-full p-4 space-y-4 flex-1 flex flex-col pt-4">
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
                    onCodeConvert={() => {}}
                    onReact={(e) => window.electron.db.updateMessage(m.id, { reactions: [e] })}
                    onBookmark={(b) => window.electron.db.updateMessage(m.id, { isBookmarked: b })}
                    onRate={(r) => window.electron.db.updateMessage(m.id, { rating: r })}
                    onApprovePlan={() => {}}
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
    )
}, (prevProps, nextProps) => {
    // Custom comparison function for memoization
    return (
        prevProps.messages.length === nextProps.messages.length &&
        prevProps.messages.every((msg, i) => msg.id === nextProps.messages[i]?.id && msg.content === nextProps.messages[i]?.content) &&
        prevProps.streamingContent === nextProps.streamingContent &&
        prevProps.isLoading === nextProps.isLoading &&
        prevProps.speakingMessageId === nextProps.speakingMessageId &&
        prevProps.selectedProvider === nextProps.selectedProvider &&
        prevProps.selectedModel === nextProps.selectedModel
    )
})
