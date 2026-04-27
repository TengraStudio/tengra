/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconBookmark, IconCheck, IconCopy, IconThumbDown, IconThumbUp } from '@tabler/icons-react';
import { memo, useState } from 'react';

import { cn } from '@/lib/utils';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export const CopyButton = memo(({ text, t }: { text: string; t: TranslationFn }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            type="button"
            onClick={() => {
                void handleCopy();
            }}
            className="p-1.5 hover:bg-accent/50 rounded-md transition-colors text-muted-foreground hover:text-foreground"
            title={t('messageBubble.copy')}
            aria-label={t('messageBubble.copy')}
        >
            {copied ? (
                <IconCheck className="w-3.5 h-3.5 text-success" />
            ) : (
                <IconCopy className="w-3.5 h-3.5" />
            )}
        </button>
    );
});
CopyButton.displayName = 'CopyButton';

export const BookmarkButton = memo(
    ({ active, onClick, t }: { active: boolean; onClick: () => void; t: TranslationFn }) => (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'p-1.5 hover:bg-accent/50 rounded-md transition-all duration-300',
                active
                    ? 'text-warning bg-warning/10 glow-warning'
                    : 'text-muted-foreground hover:text-foreground'
            )}
            title={active ? t('messageBubble.removeBookmark') : t('messageBubble.addBookmark')}
            aria-label={active ? t('messageBubble.removeBookmark') : t('messageBubble.addBookmark')}
            aria-pressed={active}
        >
            <IconBookmark className={cn('w-3.5 h-3.5', active && 'fill-current')} />
        </button>
    )
);
BookmarkButton.displayName = 'BookmarkButton';

export const RatingButtons = memo(
    ({
        rating,
        onRate,
        t,
    }: {
        rating?: 1 | -1 | 0;
        onRate: (val: 1 | -1 | 0) => void;
        t: TranslationFn;
    }) => (
        <div className="flex items-center gap-1 border-s border-border/50 ps-2 ms-1">
            <button
                type="button"
                onClick={() => onRate(rating === 1 ? 0 : 1)}
                className={cn(
                    'p-1.5 rounded-md transition-all duration-200',
                    rating === 1
                        ? 'text-success bg-success/10'
                        : 'text-muted-foreground hover:text-success hover:bg-success/5'
                )}
                title={t('messageBubble.goodAnswer')}
                aria-label={t('messageBubble.goodAnswer')}
                aria-pressed={rating === 1}
            >
                <IconThumbUp className={cn('w-3.5 h-3.5', rating === 1 && 'fill-current')} />
            </button>
            <button
                type="button"
                onClick={() => onRate(rating === -1 ? 0 : -1)}
                className={cn(
                    'p-1.5 rounded-md transition-all duration-200',
                    rating === -1
                        ? 'text-destructive bg-destructive/10'
                        : 'text-muted-foreground hover:text-destructive hover:bg-destructive/5'
                )}
                title={t('messageBubble.badAnswer')}
                aria-label={t('messageBubble.badAnswer')}
                aria-pressed={rating === -1}
            >
                <IconThumbDown className={cn('w-3.5 h-3.5', rating === -1 && 'fill-current')} />
            </button>
        </div>
    )
);
RatingButtons.displayName = 'RatingButtons';
