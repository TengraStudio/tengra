/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Attachment, Message } from '@/types';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export interface QuotaDetails {
    message: string;
    resets_at: number | null;
    model: string | null;
}

export interface MessageBubbleContentProps {
    isUser: boolean;
    isStreaming?: boolean;
    displayContent: string;
    quotaDetails: QuotaDetails | null;
    images: string[];
    showRawMarkdown: boolean;
    onSpeak?: (text: string) => void;
    onStop?: () => void;
    isSpeaking?: boolean;
    onCodeConvert?: (imageUrl: string) => void;
    onSourceClick?: (source: string) => void;
    attachments: Attachment[];
    t: TranslationFn;
}

export interface MessageActionsContextProps {
    displayContent: string;
    message: Message;
    isSpeaking?: boolean;
    onStop?: () => void;
    onSpeak?: (text: string) => void;
    onBookmark?: (isBookmarked: boolean) => void;
    onReact?: (emoji: string) => void;
    onRate?: (rating: 1 | -1 | 0) => void;
    onRegenerate?: () => void;
    onSourceClick?: (path: string) => void;
    showRawMarkdown: boolean;
    setShowRawMarkdown: (val: boolean) => void;
    t: TranslationFn;
}

export interface ContentRenderContext {
    isUser: boolean;
    isStreaming?: boolean;
    displayContent: string;
    quotaDetails: QuotaDetails | null;
    images: string[];
    attachments: Attachment[];
    showRawMarkdown: boolean;
    callbacks: {
        onSpeak?: (text: string) => void;
        onStop?: () => void;
        isSpeaking?: boolean;
        onCodeConvert?: (imageUrl: string) => void;
    };
    t: TranslationFn;
}

export interface ActionsContext {
    message: Message;
    displayContent: string;
    callbacks: {
        isSpeaking?: boolean;
        onStop?: () => void;
        onSpeak?: (text: string) => void;
        onBookmark?: (isBookmarked: boolean) => void;
        onReact?: (emoji: string) => void;
        onRate?: (rating: 1 | -1 | 0) => void;
        onRegenerate?: () => void;
        onSourceClick?: (path: string) => void;
    };
    state: {
        showRawMarkdown: boolean;
        setShowRawMarkdown: (val: boolean) => void;
    };
    t: TranslationFn;
}

export const createToggleVisibilityFlags = (
    displayContent: string,
    hasImages: boolean,
    isUser: boolean,
    quotaDetails: QuotaDetails | null
) => ({
    showToggle: Boolean(displayContent && !hasImages && !isUser && !quotaDetails),
    showActions: Boolean(!isUser && displayContent && !quotaDetails),
});

export const buildMessageContentProps = (
    ctx: ContentRenderContext
): MessageBubbleContentProps => ({
    isUser: ctx.isUser,
    isStreaming: ctx.isStreaming,
    displayContent: ctx.displayContent,
    quotaDetails: ctx.quotaDetails,
    images: ctx.images,
    attachments: ctx.attachments,
    showRawMarkdown: ctx.showRawMarkdown,
    onSpeak: ctx.callbacks.onSpeak,
    onStop: ctx.callbacks.onStop,
    isSpeaking: ctx.callbacks.isSpeaking,
    onCodeConvert: ctx.callbacks.onCodeConvert,
    t: ctx.t,
});

export const buildActionsContextProps = (
    ctx: ActionsContext
): MessageActionsContextProps => ({
    displayContent: ctx.displayContent,
    message: ctx.message,
    isSpeaking: ctx.callbacks.isSpeaking,
    onStop: ctx.callbacks.onStop,
    onSpeak: ctx.callbacks.onSpeak,
    onBookmark: ctx.callbacks.onBookmark,
    onReact: ctx.callbacks.onReact,
    onRate: ctx.callbacks.onRate,
    onRegenerate: ctx.callbacks.onRegenerate,
    onSourceClick: ctx.callbacks.onSourceClick,
    showRawMarkdown: ctx.state.showRawMarkdown,
    setShowRawMarkdown: ctx.state.setShowRawMarkdown,
    t: ctx.t,
});
