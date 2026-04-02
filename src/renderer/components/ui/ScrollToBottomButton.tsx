import { ChevronDown } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import './scroll-to-bottom-button.css';

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
            className={cn('tengra-scroll-to-bottom', className)}
            aria-label={label}
        >
            <div className="tengra-scroll-to-bottom__content">
                <ChevronDown className="tengra-scroll-to-bottom__icon" />
                {newMessageCount && newMessageCount > 0 && (
                    <span className="tengra-scroll-to-bottom__badge">
                        {newMessageCount > 99 ? '99+' : newMessageCount}
                    </span>
                )}
            </div>
        </button>
    );
});

ScrollToBottomButton.displayName = 'ScrollToBottomButton';
