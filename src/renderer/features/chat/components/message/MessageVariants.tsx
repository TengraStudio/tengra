import { Check, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { memo, useState } from 'react';

import { Language } from '@/i18n';
import { cn } from '@/lib/utils';
import { Message, MessageVariant } from '@/types';

import { AssistantLogo } from './AssistantLogo';
import { MessageBubbleContent } from './MarkdownContent';
import { MessageFooter } from './MessageFooter';
import { useChatMessageError, useMessageContent, useQuotaDetails } from './MessageUtils';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

const MessageVariantCard = memo(
    ({
        variant,
        isSelected,
        onClick,
        t,
        isUser,
        isStreaming,
        onSpeak,
        onStop,
        isSpeaking,
        showRawMarkdown,
        language,
        footerConfig,
    }: {
        variant: MessageVariant;
        isSelected: boolean;
        onClick: () => void;
        t: TranslationFn;
        isUser: boolean;
        isStreaming?: boolean;
        onSpeak?: (text: string) => void;
        onStop?: () => void;
        isSpeaking?: boolean;
        showRawMarkdown: boolean;
        language: Language;
        footerConfig?: {
            showTimestamp?: boolean;
            showTokens?: boolean;
            showModel?: boolean;
            showResponseTime?: boolean;
        };
    }) => {
        const { displayContent } = useMessageContent(variant.content, undefined, undefined);
        const messageError = useChatMessageError(displayContent, variant.model ?? null);
        const quota = useQuotaDetails(messageError, t);
        const variantInterrupted = variant.status === 'interrupted' || typeof variant.error === 'string';

        return (
            <div
                onClick={onClick}
                className={cn(
                    'relative flex flex-col gap-2 p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md',
                    isSelected
                        ? 'bg-card border-primary/50 ring-1 ring-primary/20 shadow-sm'
                        : 'bg-card/50 border-border/40 hover:bg-card hover:border-primary/30'
                )}
            >
                <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-border/20">
                    <div className="flex items-center gap-2">
                        <AssistantLogo
                            displayModel={variant.model}
                            provider={variant.provider}
                            t={t}
                        />
                        <div className="flex flex-col">
                            <span className="typo-caption font-bold text-foreground/90">
                                {variant.model ?? t('messageBubble.unknownModel')}
                            </span>
                            <span className="text-xxs text-muted-foreground">
                                {variant.provider}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {variantInterrupted && (
                            <span className="rounded-full bg-destructive/10 px-2 py-1 text-xxs font-semibold text-destructive">
                                {t('tools.failed')}
                            </span>
                        )}
                        {isSelected && (
                            <div className="bg-primary/10 text-primary p-1 rounded-full">
                                <Check className="w-3 h-3" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 min-h-24">
                    <MessageBubbleContent
                        showRawMarkdown={showRawMarkdown}
                        quotaDetails={quota}
                        displayContent={displayContent}
                        images={[]}
                        isStreaming={isStreaming}
                        onSpeak={onSpeak}
                        onStop={onStop}
                        isSpeaking={isSpeaking}
                        attachments={[]}
                        t={t}
                        isUser={isUser}
                    />
                </div>

                <MessageFooter
                    message={{
                        id: variant.id ?? 'v',
                        content: variant.content,
                        role: 'assistant',
                        timestamp: variant.timestamp,
                        model: variant.model,
                        provider: variant.provider,
                    } as Message}
                    displayContent={displayContent}
                    language={language}
                    isStreaming={isStreaming}
                    config={footerConfig}
                />
            </div>
        );
    }
);

MessageVariantCard.displayName = 'MessageVariantCard';

const MessageVariantsGrid = memo(
    ({
        variants,
        selectedVariantId,
        onVariantClick,
        t,
        isUser,
        backend,
        isStreaming,
        onSpeak,
        onStop,
        isSpeaking,
        showRawMarkdown,
        language,
        footerConfig,
    }: {
        variants: MessageVariant[];
        selectedVariantId: string | null;
        onVariantClick: (id: string) => void;
        t: TranslationFn;
        isUser: boolean;
        backend?: string;
        isStreaming: boolean;
        onSpeak?: (text: string) => void;
        onStop?: () => void;
        isSpeaking?: boolean;
        showRawMarkdown: boolean;
        language: Language;
        footerConfig?: {
            showTimestamp?: boolean;
            showTokens?: boolean;
            showModel?: boolean;
            showResponseTime?: boolean;
        };
    }) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {variants.map(variant => (
                <MessageVariantCard
                    key={variant.id}
                    variant={variant}
                    isSelected={
                        !!(
                            selectedVariantId === variant.id ||
                            (!selectedVariantId && variant.isSelected)
                        )
                    }
                    onClick={() => onVariantClick(variant.id)}
                    t={t}
                    isUser={isUser}
                    isStreaming={Boolean(isStreaming && variant.model === backend)}
                    onSpeak={onSpeak}
                    onStop={onStop}
                    isSpeaking={isSpeaking}
                    showRawMarkdown={showRawMarkdown}
                    language={language}
                    footerConfig={footerConfig}
                />
            ))}
        </div>
    )
);

MessageVariantsGrid.displayName = 'MessageVariantsGrid';

export const VariantsView = memo(
    ({
        message,
        backend,
        isStreaming,
        onSpeak,
        onStop,
        isSpeaking,
        showRawMarkdown,
        language,
        t,
        footerConfig,
    }: {
        message: Message;
        backend?: string;
        isStreaming?: boolean;
        language: Language;
        onSpeak?: (text: string) => void;
        onStop?: () => void;
        isSpeaking?: boolean;
        showRawMarkdown: boolean;
        t: TranslationFn;
        footerConfig?: {
            showTimestamp?: boolean;
            showTokens?: boolean;
            showModel?: boolean;
            showResponseTime?: boolean;
        };
    }) => {
        const variants = message.variants ?? [];
        const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

        const handleVariantClick = (vId: string) => {
            setSelectedVariantId(vId);
        };

        return (
            <div className={cn('w-full animate-fade-in py-2 group')}>
                <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="bg-primary/10 p-1.5 rounded-lg">
                        <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <span className="typo-caption font-bold text-muted-foreground">
                        {t('chat.modelComparison')}
                    </span>
                </div>
                <MessageVariantsGrid
                    variants={variants}
                    selectedVariantId={selectedVariantId}
                    onVariantClick={handleVariantClick}
                    t={t}
                    isUser={false}
                    backend={backend}
                    isStreaming={!!isStreaming}
                    onSpeak={onSpeak}
                    onStop={onStop}
                    isSpeaking={isSpeaking}
                    showRawMarkdown={showRawMarkdown}
                    language={language}
                    footerConfig={footerConfig}
                />
            </div>
        );
    }
);

VariantsView.displayName = 'VariantsView';

export const MessageVariants = memo(
    ({
        variants,
        variantIndex,
        setVariantIndex,
        t,
    }: {
        variants: MessageVariant[];
        variantIndex: number;
        setVariantIndex: (idx: number) => void;
        t: TranslationFn;
    }) => (
        <div className="flex flex-col gap-2 mt-3 select-none">
            <div className="flex items-center gap-1 flex-wrap bg-muted/10 rounded-lg p-1 border border-border/30">
                {variants.map((v, idx) => (
                    <button
                        key={idx}
                        onClick={() => setVariantIndex(idx)}
                        className={cn(
                            'px-2.5 py-1 rounded-md text-xxs font-bold transition-all flex items-center gap-2 border',
                            idx === variantIndex
                                ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 scale-102'
                                : 'hover:bg-accent/50 text-muted-foreground border-transparent'
                        )}
                    >
                        {(
                            v.label ??
                            v.model ??
                            t('messageBubble.responseShort', { index: idx + 1 })
                        ).slice(0, 20)}{' '}
                        {idx === variantIndex && <Check className="w-2.5 h-2.5" />}
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-2 justify-center mt-1">
                <button
                    disabled={variantIndex === 0}
                    onClick={() => setVariantIndex(variantIndex - 1)}
                    className="p-1 px-1.5 rounded bg-accent/30 hover:bg-accent/50 disabled:opacity-30 transition-colors"
                >
                    <ChevronLeft className="w-3 h-3" />
                </button>
                <span className="text-xxs text-muted-foreground/60 font-bold">
                    {variantIndex + 1} / {variants.length}
                </span>
                <button
                    disabled={variantIndex === variants.length - 1}
                    onClick={() => setVariantIndex(variantIndex + 1)}
                    className="p-1 px-1.5 rounded bg-accent/30 hover:bg-accent/50 disabled:opacity-30 transition-colors"
                >
                    <ChevronRight className="w-3 h-3" />
                </button>
            </div>
        </div>
    )
);

MessageVariants.displayName = 'MessageVariants';
