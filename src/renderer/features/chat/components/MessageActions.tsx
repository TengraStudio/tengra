import { FEEDBACK_TIMEOUTS } from '@shared/constants';
import { Bookmark, Check, Code2, Copy, RotateCcw, Smile, ThumbsDown, ThumbsUp, Volume2, VolumeX } from 'lucide-react';
import React, { useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface ActionButtonProps {
    label: string
    onClick: () => void
    children: React.ReactNode
    active?: boolean | undefined
    activeClassName?: string | undefined
}

const ActionButton: React.FC<ActionButtonProps> = ({ label, onClick, children, active, activeClassName }) => (
    <button
        onClick={onClick}
        className={cn(
            "p-1.5 rounded-lg transition-all border border-transparent backdrop-blur-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            active ? (activeClassName || "bg-primary/10 text-primary border-primary/20") : "bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
        )}
        title={label}
        aria-label={label}
        aria-pressed={active}
    >
        {children}
    </button>
);

export const CopyButton = ({ text }: { text: string }) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), FEEDBACK_TIMEOUTS.COPY_FEEDBACK);
    };
    return (
        <ActionButton label={t('messageBubble.copy')} onClick={handleCopy}>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
        </ActionButton>
    );
};

export const BookmarkButton = ({ active, onClick }: { active: boolean; onClick: () => void }) => {
    const { t } = useTranslation();
    return (
        <ActionButton
            label={active ? t('messageBubble.removeBookmark') : t('messageBubble.addBookmark')}
            onClick={onClick}
            active={active}
            activeClassName="text-amber-400 bg-amber-400/10 border-amber-400/20 shadow-[0_0_10px_rgba(251,191,36,0.1)]"
        >
            <Bookmark className={cn("w-3.5 h-3.5", active && "fill-current")} aria-hidden="true" />
        </ActionButton>
    );
};

export const RatingButtons = ({ rating, onRate }: { rating?: 1 | -1 | 0 | undefined; onRate: (val: 1 | -1 | 0) => void }) => {
    const { t } = useTranslation();
    return (
        <div className="flex items-center gap-1 border-l border-white/5 pl-2 ml-1" role="group" aria-label={t('messageBubble.rating') || 'Rate response'}>
            <button
                onClick={() => onRate(rating === 1 ? 0 : 1)}
                className={cn(
                    "p-1.5 rounded-md transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    rating === 1 ? "text-emerald-400 bg-emerald-400/10" : "text-zinc-400 hover:text-emerald-400 hover:bg-emerald-400/5"
                )}
                title={t('messageBubble.goodAnswer')}
                aria-label={t('messageBubble.goodAnswer')}
                aria-pressed={rating === 1}
            >
                <ThumbsUp className={cn("w-3.5 h-3.5", rating === 1 && "fill-current")} aria-hidden="true" />
            </button>
            <button
                onClick={() => onRate(rating === -1 ? 0 : -1)}
                className={cn(
                    "p-1.5 rounded-md transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    rating === -1 ? "text-red-400 bg-red-400/10" : "text-zinc-400 hover:text-red-400 hover:bg-red-400/5"
                )}
                title={t('messageBubble.badAnswer')}
                aria-label={t('messageBubble.badAnswer')}
                aria-pressed={rating === -1}
            >
                <ThumbsDown className={cn("w-3.5 h-3.5", rating === -1 && "fill-current")} aria-hidden="true" />
            </button>
        </div>
    );
};

export const CopyMarkdownButton = ({ text, role }: { text: string; role: string }) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        const roleLabel = role === 'user' ? t('messageBubble.user') : t('messageBubble.assistant');
        const markdown = `**${roleLabel}:**\n\n${text}`;
        await navigator.clipboard.writeText(markdown);
        setCopied(true);
        setTimeout(() => setCopied(false), FEEDBACK_TIMEOUTS.COPY_FEEDBACK);
    };
    return (
        <ActionButton label={t('messageBubble.copyAsMarkdown')} onClick={handleCopy}>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" /> : <Code2 className="w-3.5 h-3.5" aria-hidden="true" />}
        </ActionButton>
    );
};

interface MessageActionsGroupProps {
    displayContent: string
    role: 'user' | 'assistant' | 'system'
    isBookmarked?: boolean
    onBookmark?: (value: boolean) => void
    rating?: 1 | -1 | 0
    onRate?: (val: 1 | -1 | 0) => void
    isSpeaking?: boolean
    onSpeak?: (text: string) => void
    onStop?: () => void
    onReact?: (emoji: string) => void
}

const EMOJI_REACTIONS = [
    { emoji: '\u{1F44D}', label: 'Thumbs up' },
    { emoji: '\u{1F44E}', label: 'Thumbs down' },
    { emoji: '\u{2764}\u{FE0F}', label: 'Heart' },
    { emoji: '\u{1F389}', label: 'Celebrate' },
    { emoji: '\u{1F680}', label: 'Rocket' }
];

export const MessageActionsGroup = ({
    displayContent,
    role,
    isBookmarked,
    onBookmark,
    rating,
    onRate,
    isSpeaking,
    onSpeak,
    onStop,
    onReact
}: MessageActionsGroupProps) => {
    const { t } = useTranslation();

    return (
        <div
            className="absolute left-full ml-4 top-0 flex flex-col gap-1 opacity-0 group-hover/bubble:opacity-100 transition-all duration-200"
            role="toolbar"
            aria-label={t('messageBubble.actions') || 'Message actions'}
        >
            <ActionButton
                label={isSpeaking ? t('messageBubble.stop') : t('messageBubble.speakAloud')}
                onClick={isSpeaking ? (onStop || (() => { })) : () => { if (onSpeak) {onSpeak(displayContent);} }}
                active={isSpeaking}
            >
                {isSpeaking ? <VolumeX className="w-3.5 h-3.5" aria-hidden="true" /> : <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />}
            </ActionButton>

            <CopyButton text={displayContent} />
            <CopyMarkdownButton text={displayContent} role={role} />
            <BookmarkButton active={!!isBookmarked} onClick={() => onBookmark?.(!isBookmarked)} />

            <div className="relative group/react">
                <ActionButton label={t('messageBubble.react')} onClick={() => { }}>
                    <Smile className="w-3.5 h-3.5" aria-hidden="true" />
                </ActionButton>
                <div
                    className="absolute bottom-full mb-2 bg-[#1a1b26] border border-border/50 rounded-full px-2 py-1 shadow-xl flex gap-1 opacity-0 group-hover/react:opacity-100 pointer-events-none group-hover/react:pointer-events-auto transition-all scale-90 group-hover/react:scale-100 origin-bottom"
                    role="group"
                    aria-label="Emoji reactions"
                >
                    {EMOJI_REACTIONS.map(({ emoji, label }) => (
                        <button
                            key={emoji}
                            onClick={() => onReact?.(emoji)}
                            className="hover:scale-125 transition-transform text-sm p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                            aria-label={label}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>

            {role === 'assistant' && (
                <ActionButton label={t('messageBubble.regenerate') || 'Regenerate'} onClick={() => console.warn('Regenerate feature coming soon!')}>
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                </ActionButton>
            )}

            {onRate && <RatingButtons rating={rating} onRate={onRate} />}
        </div>
    );
};
