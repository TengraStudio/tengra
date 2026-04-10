import React from 'react';

import { cn } from '@/lib/utils';


interface TypingIndicatorProps {
    className?: string
    size?: 'sm' | 'md' | 'lg'
    label?: string
}

/**
 * TypingIndicator Component
 * 
 * Shows an animated typing indicator (three bouncing dots) for AI responses.
 * 
 * @example
 * ```tsx
 * <TypingIndicator />
 * <TypingIndicator size="lg" label="AI is thinking..." />
 * ```
 */
export const TypingIndicator: React.FC<TypingIndicatorProps> = React.memo(({
    className,
    size = 'md',
    label
}) => {
    return (
        <div className={cn('tengra-typing-indicator', `tengra-typing-indicator--${size}`, className)}>
            <div className="tengra-typing-indicator__dots">
                <span className="tengra-typing-indicator__dot" />
                <span className="tengra-typing-indicator__dot" />
                <span className="tengra-typing-indicator__dot" />
            </div>
            {label && (
                <span className="tengra-typing-indicator__label">{label}</span>
            )}
        </div>
    );
});

TypingIndicator.displayName = 'TypingIndicator';
