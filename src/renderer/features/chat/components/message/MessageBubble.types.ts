/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Language } from '@/i18n';
import { Message } from '@/types';

export interface MessageFooterConfig {
    showTimestamp?: boolean;
    showTokens?: boolean;
    showModel?: boolean;
    showResponseTime?: boolean;
}

export interface MessageProps {
    message: Message;
    isLast: boolean;
    backend?: string;
    isStreaming?: boolean;
    language: Language;
    onSpeak?: (text: string) => void;
    onStop?: () => void;
    isSpeaking?: boolean;
    onCodeConvert?: (imageUrl: string) => void;
    onReact?: (emoji: string) => void;
    onBookmark?: (isBookmarked: boolean) => void;
    onRate?: (rating: 1 | -1 | 0) => void;
    onRegenerate?: () => void;
    onApprovePlan?: () => void;
    streamingSpeed?: number | null;
    streamingReasoning?: string;
    id?: string;
    isFocused?: boolean;
    onSourceClick?: (path: string) => void;
    footerConfig?: MessageFooterConfig;
}

