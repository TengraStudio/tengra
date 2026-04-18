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
import { JsonValue } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { memo, useEffect, useMemo } from 'react';

import { UI_PRIMITIVES } from '@/constants/ui-primitives';
import { Language } from '@/i18n';
import { cn } from '@/lib/utils';
import { Message, ToolResult } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { ToolDisplay } from '../ToolDisplay';

import { AssistantLogo } from './AssistantLogo';
import { MessageBubbleContent } from './MarkdownContent';
import { MessageActions } from './MessageActions';
import {
    createToggleVisibilityFlags,
    MessageActionsContextProps,
    MessageBubbleContentProps,
    QuotaDetails,
} from './MessageBubbleContent.util';
import { MessageFooter } from './MessageFooter';
import { MessageImages } from './MessageImages';
import { MessageSources } from './MessageSources';
import { PlanSection } from './PlanSection';
import { RawToggle } from './RawToggle';
import { ResponseProgress } from './ResponseProgress';
import { ThoughtSection } from './ThoughtSection';
import { ToolRecoveryNotice } from './ToolRecoveryNotice';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;
type ToolCallView = {
    id: string;
    name: string;
    arguments: Record<string, JsonValue>;
    rawArguments: string;
};

function buildToolCalls(message: Message): ToolCallView[] {
    const displayToolCalls = compactToolCallsForDisplay(message.toolCalls);
    if (!displayToolCalls || displayToolCalls.length === 0) {
        return [];
    }
    return displayToolCalls
        .map(toolCall => {
            const name = typeof toolCall.function?.name === 'string' ? toolCall.function.name : '';
            const args = typeof toolCall.function?.arguments === 'string' ? toolCall.function.arguments : '';
            if (name.trim().length === 0 && args.trim().length === 0) {
                return null;
            }
            return {
                id: typeof toolCall.id === 'string' && toolCall.id.trim().length > 0
                    ? toolCall.id
                    : `${name || 'tool'}-${toolCall.index ?? 0}`,
                name,
                arguments: safeJsonParse<Record<string, JsonValue>>(args, {}),
                rawArguments: args
            };
        })
        .filter((tc): tc is ToolCallView => tc !== null);
}

function buildToolResultMap(message: Message): Map<string, ToolResult> {
    const toolResults = Array.isArray(message.toolResults) ? message.toolResults : [];
    const map = new Map<string, ToolResult>();
    for (const toolResult of toolResults) {
        if (typeof toolResult.toolCallId === 'string' && toolResult.toolCallId.length > 0) {
            map.set(toolResult.toolCallId, toolResult);
        }
    }
    return map;
}

interface BubbleContentSectionProps {
    contentProps: MessageBubbleContentProps;
    message: Message;
    showToggle: boolean;
    setShowRawMarkdown: (val: boolean) => void;
    t: TranslationFn;
}

const BubbleContentSection = memo(
    ({ contentProps, message, showToggle, setShowRawMarkdown, t }: BubbleContentSectionProps) => (
        <div className="flex flex-col gap-2">
            <MessageImages images={contentProps.images} t={t} />
            {showToggle && (
                <RawToggle
                    active={contentProps.showRawMarkdown}
                    onClick={() => setShowRawMarkdown(!contentProps.showRawMarkdown)}
                    t={t}
                />
            )}
            <MessageBubbleContent {...contentProps} />
            <MessageSources
                sources={message.sources ?? []}
                onSourceClick={contentProps.onSourceClick}
                t={t}
            />
        </div>
    )
);

BubbleContentSection.displayName = 'BubbleContentSection';

interface MessageBubbleInnerProps {
    isUser: boolean;
    isStreaming?: boolean;
    displayContent: string;
    quotaDetails: QuotaDetails | null;
    message: Message;
    contentProps: MessageBubbleContentProps;
    actionsContextProps: MessageActionsContextProps;
}

const MessageToolRuns = memo(({ message, isStreaming }: { message: Message; isStreaming?: boolean }) => {
    const toolCalls = buildToolCalls(message);
    if (toolCalls.length === 0) {
        return null;
    }
    const toolResultMap = buildToolResultMap(message);
    return (
        <div className="w-full space-y-3 my-2">
            {toolCalls.map(toolCall => (
                <div key={toolCall.id} className="w-full">
                    <ToolDisplay
                        toolCall={toolCall}
                        result={toolResultMap.get(toolCall.id)}
                        isExecuting={Boolean(isStreaming) && !toolResultMap.has(toolCall.id)}
                    />
                </div>
            ))}
        </div>
    );
});

MessageToolRuns.displayName = 'MessageToolRuns';

const MessageBubbleInner = memo(
    ({
        isUser,
        isStreaming,
        displayContent,
        quotaDetails,
        message,
        contentProps,
        actionsContextProps,
    }: MessageBubbleInnerProps) => {
        const { showToggle, showActions } = createToggleVisibilityFlags(
            displayContent,
            contentProps.images.length > 0,
            isUser,
            quotaDetails
        );

        return (
            <div className={UI_PRIMITIVES.CHAT_BUBBLE_BASE}>
                {isStreaming && <ResponseProgress />}
                <BubbleContentSection
                    contentProps={contentProps}
                    message={message}
                    showToggle={showToggle}
                    setShowRawMarkdown={actionsContextProps.setShowRawMarkdown}
                    t={actionsContextProps.t}
                />
                {showActions && (
                    <MessageActions
                        displayContent={displayContent}
                        message={message}
                        isSpeaking={actionsContextProps.isSpeaking}
                        onStop={actionsContextProps.onStop}
                        onSpeak={actionsContextProps.onSpeak}
                        onBookmark={actionsContextProps.onBookmark}
                        onReact={actionsContextProps.onReact}
                        onRate={actionsContextProps.onRate}
                        onRegenerate={actionsContextProps.onRegenerate}
                        t={actionsContextProps.t}
                    />
                )}
                {isUser && (
                    <svg
                        className="absolute -bottom-px -right-2 h-2.5 w-2 fill-current text-muted/10 pointer-events-none"
                        viewBox="0 0 8 10"
                    >
                        <path d="M0 0 L8 10 L0 10 Z" />
                    </svg>
                )}
            </div>
        );
    }
);

MessageBubbleInner.displayName = 'MessageBubbleInner';

interface PlanAndThoughtProps {
    plan: string | null;
    thought: string | null;
    thoughtDurationMs?: number;
    isLast: boolean;
    isStreaming?: boolean;
    onApprovePlan?: () => void;
    isThoughtExpanded: boolean;
    setIsThoughtExpanded: (v: boolean) => void;
    t: TranslationFn;
}

export function buildThoughtHistory(
    reasonings?: string[],
    thought?: string | null,
    showReasoningHistory: boolean = true
): string[] {
    if (!showReasoningHistory) {
        return [];
    }

    const thoughts = (reasonings ?? [])
        .filter(reasoningItem => reasoningItem.trim().length > 0);
    const nextThought = typeof thought === 'string' ? thought : '';
    const normalizedThought = nextThought.trim();
    if (normalizedThought.length === 0) {
        return thoughts;
    }

    if (thoughts.length === 0) {
        return [nextThought];
    }

    const latestIndex = thoughts.length - 1;
    const latestInHistory = thoughts[latestIndex].trim();
    if (normalizedThought === latestInHistory) {
        return thoughts;
    }
    if (normalizedThought.startsWith(latestInHistory)) {
        thoughts[latestIndex] = nextThought;
        return thoughts;
    }
    if (latestInHistory.startsWith(normalizedThought)) {
        return thoughts;
    }

    thoughts.push(nextThought);
    return thoughts;
}

const PlanAndThought = memo(
    ({
        plan,
        thought,
        thoughtDurationMs,
        reasonings,
        showReasoningHistory = true,
        isLast,
        isStreaming,
        onApprovePlan,
        isThoughtExpanded: _isThoughtExpanded,
        setIsThoughtExpanded: _setIsThoughtExpanded,
        t,
    }: PlanAndThoughtProps & { reasonings?: string[]; showReasoningHistory?: boolean }) => {
        const allThoughts = useMemo(() => {
            return buildThoughtHistory(reasonings, thought, showReasoningHistory);
        }, [reasonings, thought, showReasoningHistory]);

        useEffect(() => {
            const messageHint = typeof thought === 'string' ? thought.trim().slice(0, 80) : '';
            appLogger.info(
                'SingleMessageViewContent',
                `PlanAndThought render: thoughts=${allThoughts.length}, hasPlan=${String(Boolean(plan && plan.trim().length > 0))}, isStreaming=${String(Boolean(isStreaming))}, isLast=${String(isLast)}, latestThoughtPreview=${messageHint}`
            );
        }, [allThoughts.length, thought, plan, isStreaming, isLast]);

        return (
            <>
                <PlanSection
                    plan={plan}
                    isLast={isLast}
                    isStreaming={isStreaming}
                    onApprovePlan={onApprovePlan}
                    t={t}
                />
                {allThoughts.map((tText: string, idx: number) => {
                    const isLatest = idx === allThoughts.length - 1;
                    const isFirst = idx === 0;
                    const initiallyExpanded = (isFirst && _isThoughtExpanded) || (isLatest && isStreaming && isLast);

                    return (
                        <ThoughtSection
                            key={idx}
                            thought={tText}
                            thoughtDurationMs={thoughtDurationMs}
                            initiallyExpanded={initiallyExpanded}
                            segmentIndex={idx}
                            isStreaming={isLatest && Boolean(isStreaming) && isLast}
                            t={t}
                        />
                    );
                })}
            </>
        );
    }
);

PlanAndThought.displayName = 'PlanAndThought';

const buildWrapperClasses = (isUser: boolean, isFocused?: boolean): string =>
    cn(
        'flex w-full animate-fade-in group/message rounded-2xl p-2 transition-all duration-300',
        isUser ? 'justify-end' : 'justify-start',
        isFocused && 'bg-primary/5 ring-1 ring-primary/20 shadow-lg shadow-primary/5'
    );

const buildContentWrapperClasses = (isUser: boolean): string =>
    cn('flex max-w-4xl gap-3 md:max-w-3xl', isUser ? 'flex-row-reverse' : 'flex-row');

const buildColumnWrapperClasses = (isUser: boolean): string =>
    cn('flex min-w-0 flex-col gap-1', isUser ? 'items-end' : 'items-start');

export interface SingleMessageViewContentProps {
    message: Message;
    backend?: string;
    isUser: boolean;
    isStreaming?: boolean;
    interruptedToolNames: string[];
    isThoughtExpanded: boolean;
    setIsThoughtExpanded: (v: boolean) => void;
    plan: string | null;
    thought: string | null;
    streamingReasoning?: string;
    isLast: boolean;
    onApprovePlan?: () => void;
    displayContent: string;
    quotaDetails: QuotaDetails | null;
    contentProps: MessageBubbleContentProps;
    actionsContextProps: MessageActionsContextProps;
    hasReactions: boolean;
    onReact?: (emoji: string) => void;
    id?: string;
    isFocused?: boolean;
    language: Language;
    streamingSpeed?: number | null;
    t: TranslationFn;
    footerConfig?: {
        showTimestamp?: boolean;
        showTokens?: boolean;
        showModel?: boolean;
        showResponseTime?: boolean;
    };
}

export const SingleMessageViewContent = memo(
    ({
        message,
        backend,
        isUser,
        isStreaming,
        interruptedToolNames,
        isThoughtExpanded,
        setIsThoughtExpanded,
        plan,
        thought,
        isLast,
        onApprovePlan,
        displayContent,
        quotaDetails,
        contentProps,
        actionsContextProps,
        hasReactions,
        onReact,
        id,
        isFocused,
        language,
        streamingSpeed,
        t,
        footerConfig,
    }: SingleMessageViewContentProps) => {
        const wrapperClasses = buildWrapperClasses(isUser, isFocused);
        const contentWrapperClasses = buildContentWrapperClasses(isUser);
        const columnWrapperClasses = buildColumnWrapperClasses(isUser);
        const isThoughtOnly = Boolean(message.metadata?.thoughtOnly === true);

        return (
            <div id={id} className={wrapperClasses}>
                <div className={contentWrapperClasses}>
                    {!isUser && (
                        <AssistantLogo
                            displayModel={message.model}
                            provider={message.provider}
                            backend={backend}
                            t={t}
                        />
                    )}
                    <div className={columnWrapperClasses}>
                        <PlanAndThought
                            plan={plan}
                            thought={thought}
                            thoughtDurationMs={message.responseTime}
                            reasonings={isThoughtOnly ? undefined : message.reasonings}
                            showReasoningHistory={!isThoughtOnly}
                            isLast={isLast}
                            isStreaming={isStreaming}
                            onApprovePlan={onApprovePlan}
                            isThoughtExpanded={isThoughtExpanded}
                            setIsThoughtExpanded={setIsThoughtExpanded}
                            t={t}
                        />
                        {!isThoughtOnly && (
                            <>
                                <ToolRecoveryNotice
                                    interruptedToolNames={interruptedToolNames}
                                    onRegenerate={actionsContextProps.onRegenerate}
                                    t={t}
                                />
                                <MessageBubbleInner
                                    isUser={isUser}
                                    isStreaming={isStreaming}
                                    displayContent={displayContent}
                                    quotaDetails={quotaDetails}
                                    message={message}
                                    contentProps={contentProps}
                                    actionsContextProps={actionsContextProps}
                                />
                                {!isUser && <MessageToolRuns message={message} isStreaming={isStreaming} />}
                            </>
                        )}
                        {!isThoughtOnly && hasReactions && (
                            <div className="mb-1 mt-1 flex flex-wrap gap-1 px-1">
                                {message.reactions?.map((emoji, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => onReact?.(emoji)}
                                        className={UI_PRIMITIVES.REACTION_BADGE}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                        {!isThoughtOnly &&
                            !isUser &&
                            !quotaDetails &&
                            (displayContent || contentProps.images.length > 0) && (
                                <MessageFooter
                                    message={message}
                                    displayContent={displayContent}
                                    language={language}
                                    isStreaming={isStreaming}
                                    streamingSpeed={streamingSpeed}
                                    config={footerConfig}
                                />
                            )}
                    </div>
                </div>
            </div>
        );
    }
);

SingleMessageViewContent.displayName = 'SingleMessageViewContent';
