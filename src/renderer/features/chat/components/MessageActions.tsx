/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { FEEDBACK_TIMEOUTS } from '@shared/constants';
import { IconBookmark, IconCheck, IconCode, IconCopy, IconMoodSmile, IconRotate, IconThumbDown, IconThumbUp, IconVolume, IconVolumeOff } from '@tabler/icons-react';
import React, { useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_MESSAGEACTIONS_1 = "absolute bottom-full mb-2 bg-popover border border-border/50 rounded-full px-2 py-1 shadow-xl flex gap-1 opacity-0 group-hover/react:opacity-100 pointer-events-none group-hover/react:pointer-events-auto transition-all scale-90 group-hover/react:scale-100 origin-bottom";
const C_MESSAGEACTIONS_2 = "hover:scale-125 transition-transform text-sm p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded";


interface ActionButtonProps {
    label: string;
    onClick: () => void;
    children: React.ReactNode;
    active?: boolean | undefined;
    activeClassName?: string | undefined;
}

const ActionButton: React.FC<ActionButtonProps> = ({
    label,
    onClick,
    children,
    active,
    activeClassName,
}) => (
    <button
        onClick={onClick}
        className={cn(
            'p-1.5 rounded-lg transition-all border border-transparent backdrop-blur-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            active
                ? (activeClassName ?? 'bg-primary/10 text-primary border-primary/20')
                : 'bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
        )}
        title={label}
        aria-label={label}
        aria-pressed={active}
    >
        {children}
    </button>
);

export const CopyButton = React.memo(({ text }: { text: string }) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), FEEDBACK_TIMEOUTS.COPY_FEEDBACK);
    };
    return (
        <ActionButton label={t('frontend.messageBubble.copy')} onClick={() => void handleCopy()}>
            {copied ? (
                <IconCheck className="w-3.5 h-3.5 text-success" aria-hidden="true" />
            ) : (
                <IconCopy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
        </ActionButton>
    );
});

export const BookmarkButton = React.memo(({ active, onClick }: { active: boolean; onClick: () => void }) => {
    const { t } = useTranslation();
    return (
        <ActionButton
            label={active ? t('frontend.messageBubble.removeBookmark') : t('frontend.messageBubble.addBookmark')}
            onClick={onClick}
            active={active}
            activeClassName="text-warning bg-warning/10 border-warning/20 glow-warning"
        >
            <IconBookmark className={cn('w-3.5 h-3.5', active && 'fill-current')} aria-hidden="true" />
        </ActionButton>
    );
});

export const RatingButtons = React.memo(({
    rating,
    onRate,
}: {
    rating?: 1 | -1 | 0 | undefined;
    onRate: (val: 1 | -1 | 0) => void;
}) => {
    const { t } = useTranslation();
    return (
        <div
            className="flex items-center gap-1 border-l border-border/40 pl-2 ml-1"
            role="group"
            aria-label={t('frontend.messageBubble.rating')}
        >
            <button
                onClick={() => onRate(rating === 1 ? 0 : 1)}
                className={cn(
                    'p-1.5 rounded-md transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    rating === 1
                        ? 'text-success bg-success/10'
                        : 'text-muted-foreground hover:text-success hover:bg-success/5'
                )}
                title={t('frontend.messageBubble.goodAnswer')}
                aria-label={t('frontend.messageBubble.goodAnswer')}
                aria-pressed={rating === 1}
            >
                <IconThumbUp
                    className={cn('w-3.5 h-3.5', rating === 1 && 'fill-current')}
                    aria-hidden="true"
                />
            </button>
            <button
                onClick={() => onRate(rating === -1 ? 0 : -1)}
                className={cn(
                    'p-1.5 rounded-md transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    rating === -1
                        ? 'text-destructive bg-destructive/10'
                        : 'text-muted-foreground hover:text-destructive hover:bg-destructive/5'
                )}
                title={t('frontend.messageBubble.badAnswer')}
                aria-label={t('frontend.messageBubble.badAnswer')}
                aria-pressed={rating === -1}
            >
                <IconThumbDown
                    className={cn('w-3.5 h-3.5', rating === -1 && 'fill-current')}
                    aria-hidden="true"
                />
            </button>
        </div>
    );
});

export const CopyMarkdownButton = React.memo(({ text, role }: { text: string; role: string }) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        const roleLabel = role === 'user' ? t('frontend.messageBubble.user') : t('frontend.messageBubble.assistant');
        const markdown = `**${roleLabel}:**\n\n${text}`;
        await navigator.clipboard.writeText(markdown);
        setCopied(true);
        setTimeout(() => setCopied(false), FEEDBACK_TIMEOUTS.COPY_FEEDBACK);
    };
    return (
        <ActionButton label={t('frontend.messageBubble.copyAsMarkdown')} onClick={() => void handleCopy()}>
            {copied ? (
                <IconCheck className="w-3.5 h-3.5 text-success" aria-hidden="true" />
            ) : (
                <IconCode className="w-3.5 h-3.5" aria-hidden="true" />
            )}
        </ActionButton>
    );
});

interface MessageActionsGroupProps {
    displayContent: string;
    role: 'user' | 'assistant' | 'system';
    isBookmarked?: boolean;
    onBookmark?: (value: boolean) => void;
    rating?: 1 | -1 | 0;
    onRate?: (val: 1 | -1 | 0) => void;
    isSpeaking?: boolean;
    onSpeak?: (text: string) => void;
    onStop?: () => void;
    onReact?: (emoji: string) => void;
    onRegenerate?: () => void;
}

export const MessageActionsGroup = React.memo(({
    displayContent,
    role,
    isBookmarked,
    onBookmark,
    rating,
    onRate,
    isSpeaking,
    onSpeak,
    onStop,
    onReact,
    onRegenerate,
}: MessageActionsGroupProps) => {
    const { t } = useTranslation();

    return (
        <div
            className="absolute left-full ml-4 top-0 flex flex-col gap-1 opacity-0 group-hover/bubble:opacity-100 transition-all duration-200"
            role="toolbar"
            aria-label={t('frontend.messageBubble.actions')}
        >
            <ActionButton
                label={isSpeaking ? t('frontend.messageBubble.stop') : t('frontend.messageBubble.speakAloud')}
                onClick={
                    isSpeaking
                        ? (onStop ?? (() => {}))
                        : () => {
                              if (onSpeak) {
                                  onSpeak(displayContent);
                              }
                          }
                }
                active={isSpeaking}
            >
                {isSpeaking ? (
                    <IconVolumeOff className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                    <IconVolume className="w-3.5 h-3.5" aria-hidden="true" />
                )}
            </ActionButton>

            <CopyButton text={displayContent} />
            <CopyMarkdownButton text={displayContent} role={role} />
            <BookmarkButton active={!!isBookmarked} onClick={() => onBookmark?.(!isBookmarked)} />

            <div className="relative group/react">
                <ActionButton label={t('frontend.messageBubble.react')} onClick={() => {}}>
                    <IconMoodSmile className="w-3.5 h-3.5" aria-hidden="true" />
                </ActionButton>
                <div
                    className={C_MESSAGEACTIONS_1}
                    role="group"
                    aria-label={t('frontend.messageBubble.emojiReactions')}
                >
                    {[
                        { emoji: '\u{1F44D}', label: t('frontend.messageBubble.emojiThumbsUp') },
                        { emoji: '\u{1F44E}', label: t('frontend.messageBubble.emojiThumbsDown') },
                        { emoji: '\u{2764}\u{FE0F}', label: t('frontend.messageBubble.emojiHeart') },
                        { emoji: '\u{1F389}', label: t('frontend.messageBubble.emojiCelebrate') },
                        { emoji: '\u{1F680}', label: t('frontend.messageBubble.emojiRocket') },
                    ].map(({ emoji, label }) => (
                        <button
                            key={emoji}
                            onClick={() => onReact?.(emoji)}
                            className={C_MESSAGEACTIONS_2}
                            aria-label={label}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>

            {role === 'assistant' && (
                <ActionButton
                    label={t('frontend.messageBubble.regenerate')}
                    onClick={() => onRegenerate?.()}
                >
                    <IconRotate className="w-3.5 h-3.5" aria-hidden="true" />
                </ActionButton>
            )}

            {onRate && <RatingButtons rating={rating} onRate={onRate} />}
        </div>
    );
});


