/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { areMessagePropsEqual } from './message/message-bubble-compare.util';
import { MessageProps } from './message/MessageBubble.types';
import {
    ActionsContext,
    buildActionsContextProps,
    buildMessageContentProps,
    ContentRenderContext,
} from './message/MessageBubbleContent.util';
import { useChatMessageError, useMessageContent, useQuotaDetails } from './message/MessageUtils';
import { VariantsView } from './message/MessageVariants';
import { SingleMessageViewContent } from './message/SingleMessageViewContent';


type SingleMessageViewProps = MessageProps;

const initializeMessageState = () => ({
    isThoughtExpanded: false,
    showRawMarkdown: false,
});

type MessageState = ReturnType<typeof initializeMessageState>;

const SingleMessageView = memo(
    ({
        message,
        isLast,
        backend,
        isStreaming,
        language: _language,
        onSpeak,
        onStop,
        isSpeaking,
        onCodeConvert,
        onReact,
        onBookmark,
        onRate,
        onRegenerate,
        onApprovePlan,
        streamingSpeed,
        streamingReasoning,
        id,
        isFocused,
        onSourceClick,
        footerConfig,
    }: SingleMessageViewProps) => {
        const { t } = useTranslation(_language);
        const isUser = message.role === 'user';
        const [state, setState] = useState<MessageState>(initializeMessageState);
        const { isThoughtExpanded, showRawMarkdown } = state;
        const setIsThoughtExpanded = useCallback((v: boolean) =>
            setState(s => ({ ...s, isThoughtExpanded: v })), []);
        const setShowRawMarkdown = useCallback((v: boolean) => setState(s => ({ ...s, showRawMarkdown: v })), []);

        const { thought, plan, displayContent } = useMessageContent(
            message.content,
            message.reasoning,
            streamingReasoning
        );
        // Always use thought for completed messages
        const normalizedThought = thought;
        const interruptedToolNames = useMemo(() => {
            const recovery = message.metadata?.recovery;
            if (!recovery || typeof recovery !== 'object' || Array.isArray(recovery)) {
                return [];
            }
            const recoveryRecord = recovery as Record<string, RendererDataValue>;
            if (!Array.isArray(recoveryRecord.interruptedToolNames)) {
                return [];
            }
            return recoveryRecord.interruptedToolNames.filter(
                (toolName: RendererDataValue): toolName is string => typeof toolName === 'string'
            );
        }, [message.metadata]);

        const autoExpandDone = useRef(false);
        useEffect(() => {
            if (
                isLast &&
                normalizedThought &&
                !displayContent &&
                !isThoughtExpanded &&
                !autoExpandDone.current
            ) {
                setTimeout(() => {
                    setIsThoughtExpanded(true);
                }, 0);
                autoExpandDone.current = true;
            }
        }, [isLast, normalizedThought, displayContent, isThoughtExpanded, setIsThoughtExpanded]);

        const messageError = useChatMessageError(displayContent, message.model ?? null);
        const quota = useQuotaDetails(messageError, t);
        const images = useMemo(
            () => (message.images ?? []).filter((img): img is string => typeof img === 'string'),
            [message.images]
        );
        const hasReactions = useMemo(
            () => (message.reactions?.length ?? 0) > 0,
            [message.reactions]
        );

        const contentCtx: ContentRenderContext = {
            isUser,
            isStreaming,
            displayContent,
            quotaDetails: quota,
            images,
            attachments: message.attachments || [],
            showRawMarkdown,
            callbacks: { onSpeak, onStop, onCodeConvert, onSourceClick },
            t,
        };

        const actionsCtx: ActionsContext = {
            message,
            displayContent,
            callbacks: { isSpeaking, onStop, onSpeak, onBookmark, onReact, onRate, onRegenerate, onSourceClick },
            state: { showRawMarkdown, setShowRawMarkdown },
            t,
        };

        const contentProps = buildMessageContentProps(contentCtx);
        const actionsContextProps = buildActionsContextProps(actionsCtx);

        return (
            <SingleMessageViewContent
                message={message}
                backend={backend}
                isUser={isUser}
                isStreaming={isStreaming}
                interruptedToolNames={interruptedToolNames}
                isThoughtExpanded={isThoughtExpanded}
                setIsThoughtExpanded={setIsThoughtExpanded}
                plan={plan}
                thought={normalizedThought}
                streamingReasoning={streamingReasoning}
                isLast={isLast}
                onApprovePlan={onApprovePlan}
                displayContent={displayContent}
                quotaDetails={quota}
                contentProps={contentProps}
                actionsContextProps={actionsContextProps}
                hasReactions={hasReactions}
                onReact={onReact}
                id={id}
                isFocused={isFocused}
                language={_language}
                streamingSpeed={streamingSpeed}
                t={t}
                footerConfig={footerConfig}
            />
        );
    }
);
SingleMessageView.displayName = 'SingleMessageView';

export const MessageBubble = memo(
    ({
        message,
        isLast,
        backend,
        isStreaming,
        language,
        onSpeak,
        onStop,
        isSpeaking,
        onCodeConvert,
        onReact,
        onBookmark,
        onRate,
        onRegenerate,
        onApprovePlan,
        streamingSpeed,
        streamingReasoning,
        id,
        isFocused,
        onSourceClick,
        footerConfig,
    }: MessageProps) => {
        const { t } = useTranslation(language);
        const variants = message.variants ?? [];
        const uniqueVariantsContent = new Set(
            variants.map(v => (typeof v.content === 'string' ? v.content.trim() : ''))
        );
        const hasVariants =
            variants.length > 1 &&
            message.role !== 'user' &&
            uniqueVariantsContent.size > 1;

        if (hasVariants) {
            return (
                <div
                    id={id}
                    className={cn(
                        'w-full animate-fade-in py-2 group',
                        isFocused && 'bg-primary/5 ring-1 ring-primary/20 rounded-xl'
                    )}
                >
                    <VariantsView
                        message={message}
                        backend={backend}
                        isStreaming={isStreaming}
                        language={language}
                        onSpeak={onSpeak}
                        onStop={onStop}
                        isSpeaking={isSpeaking}
                        showRawMarkdown={false}
                        t={t}
                        footerConfig={footerConfig}
                    />
                </div>
            );
        }

        return (
            <SingleMessageView
                message={message}
                isLast={isLast}
                backend={backend}
                isStreaming={isStreaming}
                language={language}
                onSpeak={onSpeak}
                onStop={onStop}
                isSpeaking={isSpeaking}
                onCodeConvert={onCodeConvert}
                onReact={onReact}
                onBookmark={onBookmark}
                onRate={onRate}
                onRegenerate={onRegenerate}
                onApprovePlan={onApprovePlan}
                streamingSpeed={streamingSpeed}
                streamingReasoning={streamingReasoning}
                id={id}
                isFocused={isFocused}
                onSourceClick={onSourceClick}
                footerConfig={footerConfig}
            />
        );
    },
    areMessagePropsEqual
);
MessageBubble.displayName = 'MessageBubble';


