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
            className={cn(
                'fixed z-40 p-3 rounded-full shadow-lg',
                'bg-primary text-primary-foreground',
                'transition-all duration-300 ease-out',
                'hover:scale-110 hover:shadow-xl',
                'animate-bounce-subtle ripple',
                'focus-ring',
                className
            )}
            aria-label={label}
        >
            <div className="relative">
                <ChevronDown className="w-5 h-5" />
                {newMessageCount && newMessageCount > 0 && (
                    <span className="absolute -top-3 -right-3 min-w-5 h-5 px-1.5 flex items-center justify-center text-xs font-bold bg-destructive text-foreground rounded-full animate-bounce-in">
                        {newMessageCount > 99 ? '99+' : newMessageCount}
                    </span>
                )}
            </div>
        </button>
    );
});

ScrollToBottomButton.displayName = 'ScrollToBottomButton';
