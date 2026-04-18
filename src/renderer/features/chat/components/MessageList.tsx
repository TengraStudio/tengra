/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { compactToolCallsForDisplay } from '@renderer/features/chat/components/message/tool-call-display.util';
import { MessageBubble } from '@renderer/features/chat/components/MessageBubble';
import { MessageSkeleton } from '@renderer/features/chat/components/MessageSkeleton';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import { Language, useTranslation } from '@/i18n';
import { Message } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

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

function getMessageText(message: Message): string {
    if (typeof message.content === 'string') {
        return message.content.trim();
    }
    return '';
}

function mergeUniqueReasonings(previous: string[], incoming: string[]): string[] {
    const merged = [...previous];
    for (const segment of incoming) {
        const normalized = segment.trim();
        if (normalized.length === 0) {
            continue;
        }
        if (merged.includes(normalized)) {
            continue;
        }
        merged.push(normalized);
    }
    return merged;
}

function mergeToolCalls(previous: Message['toolCalls'], incoming: Message['toolCalls']): Message['toolCalls'] {
    const base = Array.isArray(previous) ? [...previous] : [];
    for (const toolCall of incoming ?? []) {
        const existingIndex = base.findIndex(existing => existing.id === toolCall.id);
        if (existingIndex >= 0) {
            base[existingIndex] = toolCall;
            continue;
        }
        base.push(toolCall);
    }
    return compactToolCallsForDisplay(base);
}

function mergeToolResults(previous: Message['toolResults'], incoming: Message['toolResults']): Message['toolResults'] {
    if (!Array.isArray(previous) && !Array.isArray(incoming)) {
        return incoming ?? previous;
    }

    const previousResults = Array.isArray(previous) ? previous : [];
    const incomingResults = Array.isArray(incoming) ? incoming : [];
    const merged = new Map<string, typeof previousResults[number]>();
    for (const toolResult of previousResults) {
        if (!toolResult) {
            continue;
        }
        if (typeof toolResult.toolCallId !== 'string' || toolResult.toolCallId.trim().length === 0) {
            continue;
        }
        merged.set(toolResult.toolCallId, toolResult);
    }
    for (const toolResult of incomingResults) {
        if (!toolResult) {
            continue;
        }
        if (typeof toolResult.toolCallId !== 'string' || toolResult.toolCallId.trim().length === 0) {
            continue;
        }
        merged.set(toolResult.toolCallId, toolResult);
    }
    return merged.size > 0 ? Array.from(merged.values()) : undefined;
}

function shouldCollapseAssistantEntry(previousMessage: Message, currentMessage: Message, reasoningSegments: string[]): boolean {
    if (previousMessage.role !== 'assistant' || currentMessage.role !== 'assistant') {
        return false;
    }
    if (reasoningSegments.length === 0) {
        return false;
    }
    const currentText = getMessageText(currentMessage);
    if (currentText.length > 0) {
        return false;
    }
    const previousText = getMessageText(previousMessage);
    return previousText.length === 0 || Array.isArray(currentMessage.toolCalls);
}

function readReasoningSegments(message: Message): string[] {
    const directSegments = Array.isArray(message.reasonings)
        ? message.reasonings.filter(
            (segment): segment is string =>
                typeof segment === 'string' && segment.trim().length > 0
        )
        : [];
    if (directSegments.length > 0) {
        return directSegments;
    }

    if (typeof message.reasoning === 'string' && message.reasoning.trim().length > 0) {
        return [message.reasoning];
    }

    const aiPresentation = message.metadata?.aiPresentation;
    if (!aiPresentation || typeof aiPresentation !== 'object' || Array.isArray(aiPresentation)) {
        return [];
    }
    const maybeSegments = (aiPresentation as Record<string, unknown>).reasoningSegments;
    if (!Array.isArray(maybeSegments)) {
        return [];
    }
    return maybeSegments.filter(
        (segment): segment is string =>
            typeof segment === 'string' && segment.trim().length > 0
    );
}

function readStickyReasoningSegments(
    message: Message,
    stickyReasoningMap: Map<string, string[]>
): string[] {
    const currentSegments = readReasoningSegments(message);
    if (currentSegments.length > 0) {
        stickyReasoningMap.set(message.id, [...currentSegments]);
        return currentSegments;
    }
    const stickySegments = stickyReasoningMap.get(message.id);
    if (stickySegments && stickySegments.length > 0) {
        return [...stickySegments];
    }
    return [];
}

function buildDisplayMessages(
    messages: Message[],
    stickyReasoningMap: Map<string, string[]>
): DisplayMessageEntry[] {
    const entries: DisplayMessageEntry[] = [];
    let collapsedAssistantCount = 0;
    for (const message of messages) {
        if (message.role !== 'assistant') {
            entries.push({ id: message.id, sourceMessageId: message.id, message });
            continue;
        }

        const reasoningSegments = readStickyReasoningSegments(message, stickyReasoningMap);
        const previousEntry = entries.length > 0 ? entries[entries.length - 1] : undefined;
        if (previousEntry && shouldCollapseAssistantEntry(previousEntry.message, message, reasoningSegments)) {
            collapsedAssistantCount += 1;
            const previousReasonings = Array.isArray(previousEntry.message.reasonings)
                ? previousEntry.message.reasonings
                : [];
            const mergedReasonings = mergeUniqueReasonings(previousReasonings, reasoningSegments);
            entries[entries.length - 1] = {
                ...previousEntry,
                message: {
                    ...previousEntry.message,
                    reasonings: mergedReasonings.length > 0 ? mergedReasonings : previousEntry.message.reasonings,
                    reasoning: mergedReasonings.length > 0
                        ? mergedReasonings[mergedReasonings.length - 1]
                        : previousEntry.message.reasoning,
                    toolCalls: mergeToolCalls(previousEntry.message.toolCalls, message.toolCalls),
                    toolResults: mergeToolResults(previousEntry.message.toolResults, message.toolResults),
                    metadata: message.metadata ?? previousEntry.message.metadata,
                },
            };
            continue;
        }
        entries.push({
            id: message.id,
            sourceMessageId: message.id,
            message: {
                ...message,
                reasonings: reasoningSegments.length > 0 ? reasoningSegments : message.reasonings,
                toolCalls: compactToolCallsForDisplay(message.toolCalls),
            },
        });
    }
    appLogger.info(
        'MessageList',
        `display-build sourceMessages=${messages.length}, displayEntries=${entries.length}, collapsedAssistants=${collapsedAssistantCount}`
    );
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
    const [stickyReasoningMap] = useState<Map<string, string[]>>(() => new Map<string, string[]>());
    const displayMessages = useMemo(
        () => buildDisplayMessages(messages, stickyReasoningMap),
        [messages, stickyReasoningMap]
    );

    useEffect(() => {
        const assistantCount = messages.filter(message => message.role === 'assistant').length;
        const thoughtOnlyCount = 0;
        appLogger.info(
            'MessageList',
            `display-map messages=${messages.length}, assistants=${assistantCount}, displayEntries=${displayMessages.length}, thoughtOnlyEntries=${thoughtOnlyCount}, streaming=${String(isLoading)}`
        );
    }, [messages, displayMessages, isLoading]);

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
                    void window.electron.db.updateMessage(sourceMessageId, { reactions: [emoji] });
                },
                onBookmark: (isBookmarked) => {
                    void window.electron.db.updateMessage(sourceMessageId, { isBookmarked });
                },
                onRate: (rating) => {
                    void window.electron.db.updateMessage(sourceMessageId, { rating });
                },
                onRegenerate: message.role === 'assistant'
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
                if (focusedEntry.message.role === 'assistant') {
                    event.preventDefault();
                    void onRegenerate?.(focusedEntry.sourceMessageId);
                }
            }
        },
        [displayMessages, effectiveFocusedIndex, onRegenerate]
    );

    const renderMessageItem = useCallback((index: number, entry: DisplayMessageEntry) => {
        const { message } = entry;
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
                    streamingReasoning={isStreamingCurrent ? streamingReasoning : undefined}
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
                className="h-full w-full"
                data={displayMessages}
                // Avoid queuing smooth-scroll animations on every streamed chunk.
                followOutput="auto"
                atBottomStateChange={onAtBottomStateChange}
                initialTopMostItemIndex={displayMessages.length - 1}
                alignToBottom={true} // Start at bottom for chat feel
                itemContent={renderMessageItem}
            />
        </div>
    );
});

MessageList.displayName = 'MessageList';
