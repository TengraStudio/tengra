import { AiPresentationMetadata } from '@shared/types/ai-runtime';
import { memo } from 'react';

import { Language } from '@/i18n';
import { cn } from '@/lib/utils';
import { Message } from '@/types';

import { AiPresentationPanel } from './AiPresentationPanel';
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
        const bubbleClass = isUser
            ? 'bg-muted/10 px-4 py-3 rounded-tr-sm border border-border/50 text-foreground/90'
            : 'bg-transparent';

        return (
            <div
                className={cn(
                    'rounded-2xl px-0 py-1 text-base leading-relaxed whitespace-pre-wrap break-words border-none relative group/bubble w-full overflow-hidden',
                    bubbleClass
                )}
            >
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
    isLast: boolean;
    isStreaming?: boolean;
    onApprovePlan?: () => void;
    isThoughtExpanded: boolean;
    setIsThoughtExpanded: (v: boolean) => void;
    t: TranslationFn;
}

const PlanAndThought = memo(
    ({
        plan,
        thought,
        isLast,
        isStreaming,
        onApprovePlan,
        isThoughtExpanded,
        setIsThoughtExpanded,
        t,
    }: PlanAndThoughtProps) => (
        <>
            <PlanSection
                plan={plan}
                isLast={isLast}
                isStreaming={isStreaming}
                onApprovePlan={onApprovePlan}
                t={t}
            />
            <ThoughtSection
                thought={thought}
                isThoughtExpanded={isThoughtExpanded}
                setIsThoughtExpanded={setIsThoughtExpanded}
                t={t}
            />
        </>
    )
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
    aiPresentation: AiPresentationMetadata | null;
    isThoughtExpanded: boolean;
    setIsThoughtExpanded: (v: boolean) => void;
    plan: string | null;
    thought: string | null;
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
        aiPresentation,
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
                        {!isUser && <AiPresentationPanel presentation={aiPresentation} t={t} />}
                        <PlanAndThought
                            plan={plan}
                            thought={thought}
                            isLast={isLast}
                            isStreaming={isStreaming}
                            onApprovePlan={onApprovePlan}
                            isThoughtExpanded={isThoughtExpanded}
                            setIsThoughtExpanded={setIsThoughtExpanded}
                            t={t}
                        />
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
                        {hasReactions && (
                            <div className="mb-1 mt-1 flex flex-wrap gap-1 px-1">
                                {message.reactions?.map((emoji, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => onReact?.(emoji)}
                                        className="rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-xxs transition-colors hover:bg-primary/20"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                        {!isUser &&
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
