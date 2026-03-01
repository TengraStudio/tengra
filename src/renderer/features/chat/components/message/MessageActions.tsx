import { RotateCcw, Smile, Volume2, VolumeX } from 'lucide-react';
import React, { memo } from 'react';

import { Message } from '@/types';

import { BookmarkButton, CopyButton, RatingButtons } from './CopierRatingBookmark';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

const handleToolbarArrowNavigation = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        return;
    }

    const controls = Array.from(
        event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
    );
    if (controls.length === 0) {
        return;
    }

    const activeIndex = controls.findIndex(control => control === document.activeElement);
    let nextIndex = activeIndex >= 0 ? activeIndex : 0;

    if (event.key === 'ArrowDown') {
        nextIndex = (nextIndex + 1) % controls.length;
    } else if (event.key === 'ArrowUp') {
        nextIndex = (nextIndex - 1 + controls.length) % controls.length;
    } else if (event.key === 'Home') {
        nextIndex = 0;
    } else if (event.key === 'End') {
        nextIndex = controls.length - 1;
    }

    controls[nextIndex]?.focus();
    event.preventDefault();
};

export interface MessageActionsProps {
    displayContent: string;
    message: Message;
    isSpeaking?: boolean;
    onStop?: () => void;
    onSpeak?: (text: string) => void;
    onBookmark?: (isBookmarked: boolean) => void;
    onReact?: (emoji: string) => void;
    onRate?: (rating: 1 | -1 | 0) => void;
    onRegenerate?: () => void;
    t: TranslationFn;
}

/**
 * MessageActions component
 * 
 * Renders the floating action toolbar for each message.
 * Includes text-to-speech, copy, bookmark, regenerate, and emoji reactions.
 */
export const MessageActions = memo(
    ({
        displayContent,
        message,
        isSpeaking,
        onStop,
        onSpeak,
        onBookmark,
        onReact,
        onRate,
        onRegenerate,
        t,
    }: MessageActionsProps) => (
        <div
            className="absolute start-full ms-4 top-0 flex flex-col gap-1 opacity-0 group-hover/bubble:opacity-100 group-focus-within/bubble:opacity-100 transition-all duration-200"
            role="toolbar"
            aria-label={t('messageBubble.actions')}
            aria-orientation="vertical"
            onKeyDown={handleToolbarArrowNavigation}
        >
            {isSpeaking ? (
                <button
                    type="button"
                    onClick={onStop}
                    className="p-1.5 bg-muted/20 hover:bg-muted/40 rounded-lg text-primary transition-all border border-border/50 backdrop-blur-sm"
                    title={t('messageBubble.stop')}
                    aria-label={t('messageBubble.stop')}
                >
                    <VolumeX className="w-3.5 h-3.5" />
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => onSpeak?.(displayContent)}
                    className="p-1.5 bg-muted/20 hover:bg-muted/40 rounded-lg text-muted-foreground hover:text-foreground transition-all border border-border/50 backdrop-blur-sm"
                    title={t('messageBubble.speakAloud')}
                    aria-label={t('messageBubble.speakAloud')}
                >
                    <Volume2 className="w-3.5 h-3.5" />
                </button>
            )}
            <CopyButton text={displayContent} t={t} />
            <BookmarkButton
                active={!!message.isBookmarked}
                onClick={() => onBookmark?.(!message.isBookmarked)}
                t={t}
            />
            {onRegenerate && (
                <button
                    type="button"
                    onClick={onRegenerate}
                    className="p-1.5 bg-muted/20 hover:bg-muted/40 rounded-lg text-muted-foreground hover:text-foreground transition-all border border-border/50 backdrop-blur-sm"
                    title={t('messageBubble.regenerate')}
                    aria-label={t('messageBubble.regenerate')}
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                </button>
            )}
            <div className="relative group/react">
                <button
                    type="button"
                    className="p-1.5 bg-muted/20 hover:bg-muted/40 rounded-lg text-muted-foreground hover:text-foreground transition-all border border-border/50 backdrop-blur-sm"
                    title={t('messageBubble.react')}
                    aria-label={t('messageBubble.react')}
                    aria-haspopup="true"
                >
                    <Smile className="w-3.5 h-3.5" />
                </button>
                <div
                    className="absolute bottom-full mb-2 bg-popover border border-border/50 rounded-full px-2 py-1 shadow-xl flex gap-1 opacity-0 group-hover/react:opacity-100 group-focus-within/react:opacity-100 pointer-events-none group-hover/react:pointer-events-auto group-focus-within/react:pointer-events-auto transition-all scale-90 group-hover/react:scale-100 group-focus-within/react:scale-100 origin-bottom"
                    role="group"
                    aria-label={t('messageBubble.emojiReactions')}
                >
                    {['👍', '👎', '❤️', '🎉', '🚀'].map(emoji => (
                        <button
                            type="button"
                            key={emoji}
                            onClick={() => onReact?.(emoji)}
                            className="hover:scale-125 transition-transform text-sm p-1"
                            aria-label={emoji}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>
            {onRate && <RatingButtons rating={message.rating} onRate={onRate} t={t} />}
        </div>
    )
);

MessageActions.displayName = 'MessageActions';
