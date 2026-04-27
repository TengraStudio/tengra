/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconBookmark, IconThumbDown, IconThumbUp } from '@tabler/icons-react';
import { memo } from 'react';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Message } from '@/types';

export interface MessageFooterProps {
    message: Message;
    displayContent: string;
    language: Language;
    isStreaming?: boolean;
    streamingSpeed?: number | null;
    onRate?: (rating: number) => void;
    config?: {
        showTimestamp?: boolean;
        showTokens?: boolean;
        showModel?: boolean;
        showResponseTime?: boolean;
    };
}

/**
 * MessageFooter component
 * 
 * Displays metadata at the bottom of the AI message, including:
 * - Timestamp
 * - Token estimate
 * - Model name
 * - Response time
 * - Bookmark status
 * - Streaming speed
 */
export const MessageFooter = memo(
    ({ message, displayContent, language, isStreaming, streamingSpeed, onRate, config }: MessageFooterProps) => {
        const { t } = useTranslation(language);
        const showTimestamp = config?.showTimestamp ?? true;
        const showTokens = config?.showTokens ?? true;
        const showModel = config?.showModel ?? true;
        const showResponseTime = config?.showResponseTime ?? true;
        return (
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground/40 font-medium">
                {showTimestamp && (
                    <span>
                        {new Date(message.timestamp).toLocaleTimeString(t('common.locale'), {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </span>
                )}
                {showTokens && (
                    <>
                        <span className="h-1 rounded-full bg-muted-foreground/20" />
                        <span>
                            {t('messageBubble.tokenEstimate', {
                                count: Math.ceil(displayContent.length / 4),
                            })}
                        </span>
                    </>
                )}
                {showModel && message.model && (
                    <>
                        <span className="h-1 rounded-full bg-muted-foreground/20" />
                        <span className="truncate max-w-32">{message.model}</span>
                    </>
                )}
                {showResponseTime && message.responseTime && (
                    <>
                        <span className="h-1 rounded-full bg-muted-foreground/20" />
                        <span className="text-success/60">
                            {(message.responseTime / 1000).toFixed(1)}
                            {t('messageBubble.secondsShort')}
                        </span>
                    </>
                )}
                {message.isBookmarked && (
                    <>
                        <span className="h-1 rounded-full bg-muted-foreground/20" />
                        <span className="text-warning/60 flex items-center gap-1">
                            <IconBookmark className="w-2.5 h-2.5 fill-current" />
                        </span>
                    </>
                )}
                {isStreaming && streamingSpeed && (
                    <>
                        <span className="h-1 rounded-full bg-muted-foreground/20" />
                        <span className="text-primary animate-pulse font-bold">
                            {streamingSpeed.toFixed(1)} {t('messageBubble.tokensPerSecond')}
                        </span>
                    </>
                )}
                {onRate && (
                    <>
                        <span className="h-1 rounded-full bg-muted-foreground/20" />
                        <span className="flex items-center gap-0.5">
                            <button
                                type="button"
                                onClick={() => onRate(message.rating === 1 ? 0 : 1)}
                                className={cn(
                                    'p-0.5 rounded transition-colors',
                                    message.rating === 1
                                        ? 'text-success/80'
                                        : 'text-muted-foreground/30 hover:text-success/60'
                                )}
                                title={t('messageReactions.thumbsUp')}
                                aria-label={t('messageReactions.thumbsUp')}
                                aria-pressed={message.rating === 1}
                            >
                                <IconThumbUp className={cn('w-2.5 h-2.5', message.rating === 1 && 'fill-current')} />
                            </button>
                            <button
                                type="button"
                                onClick={() => onRate(message.rating === -1 ? 0 : -1)}
                                className={cn(
                                    'p-0.5 rounded transition-colors',
                                    message.rating === -1
                                        ? 'text-destructive/80'
                                        : 'text-muted-foreground/30 hover:text-destructive/60'
                                )}
                                title={t('messageReactions.thumbsDown')}
                                aria-label={t('messageReactions.thumbsDown')}
                                aria-pressed={message.rating === -1}
                            >
                                <IconThumbDown className={cn('w-2.5 h-2.5', message.rating === -1 && 'fill-current')} />
                            </button>
                        </span>
                    </>
                )} </div>
        );
    }
);

MessageFooter.displayName = 'MessageFooter';
