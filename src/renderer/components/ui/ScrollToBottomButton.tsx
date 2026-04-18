/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ChevronDown } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';


interface ScrollToBottomButtonProps {
    onClick: () => void
    visible: boolean
    className?: string
    newMessageCount?: number
}

/**
 * ScrollToBottomButton Component
 * 
 * An animated button that appears when the user scrolls up in a chat.
 * 
 * @example
 * ```tsx
 * <ScrollToBottomButton
 *   onClick={scrollToBottom}
 *   visible={showButton}
 *   newMessageCount={3}
 * />
 * ```
 */
export const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = React.memo(({
    onClick,
    visible,
    className,
    newMessageCount
}) => {
    const { t } = useTranslation();
    if (!visible) { return null; }

    const label = newMessageCount && newMessageCount > 0
        ? t('chat.scrollToBottomWithCount', { count: newMessageCount })
        : t('chat.scrollToBottom');

    return (
        <button
            onClick={onClick}
            className={cn('fixed z-40 p-3 bg-primary text-primary-foreground border-none rounded-full shadow-lg cursor-pointer transition-all duration-300 ease-out hover:scale-110 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring animate-scroll-bounce-subtle hover:animate-none', className)}
            aria-label={label}
        >
            <div className="relative flex items-center justify-center">
                <ChevronDown className="w-5 h-5" />
                {newMessageCount && newMessageCount > 0 && (
                    <span className="absolute -top-3 -right-3 min-w-5 h-5 px-1.5 bg-destructive text-foreground text-xs font-bold rounded-full flex items-center justify-center animate-scroll-bounce-in">
                        {newMessageCount > 99 ? '99+' : newMessageCount}
                    </span>
                )}
            </div>
        </button>
    );
});

ScrollToBottomButton.displayName = 'ScrollToBottomButton';
