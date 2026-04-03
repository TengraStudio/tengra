import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { areMessagePropsEqual } from './message/message-bubble-compare.util';
import { readAiPresentationMetadata } from './message/message-presentation.util';
import { MessageProps } from './message/MessageBubble.types';
import {
    ActionsContext,
    buildActionsContextProps,
    buildMessageContentProps,
    ContentRenderContext,
} from './message/MessageBubbleContent.util';
import { useMessageContent, useQuotaDetails } from './message/MessageUtils';
import { VariantsView } from './message/MessageVariants';
import { SingleMessageViewContent } from './message/SingleMessageViewContent';

import 'katex/dist/katex.min.css';
import '@renderer/features/chat/components/MessageBubble.css';

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
        const aiPresentation = useMemo(
            () => readAiPresentationMetadata(message, displayContent, streamingReasoning, _language),
            [displayContent, message, streamingReasoning, _language]
        );
        const normalizedThought = aiPresentation ? null : thought;
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
        }, [isLast, normalizedThought, displayContent, isThoughtExpanded]);

        // PERF-002-2: Memoize expensive computations
        const is429 = useMemo(
            () =>
                displayContent.includes('429') ||
                displayContent.includes('RESOURCE_EXHAUSTED') ||
                displayContent.includes('Rate limit') ||
                displayContent.includes('quota'),
            [displayContent]
        );
        const quota = useQuotaDetails(is429, displayContent, t);
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
            callbacks: { onSpeak, onStop, onCodeConvert },
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
                aiPresentation={aiPresentation}
                isThoughtExpanded={isThoughtExpanded}
                setIsThoughtExpanded={setIsThoughtExpanded}
                plan={plan}
                thought={normalizedThought}
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

