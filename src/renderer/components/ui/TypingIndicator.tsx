import React from 'react'

import { cn } from '@/lib/utils'

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
    const dotSizes = {
        sm: 'w-1.5 h-1.5',
        md: 'w-2 h-2',
        lg: 'w-2.5 h-2.5'
    }

    const gapSizes = {
        sm: 'gap-1',
        md: 'gap-1.5',
        lg: 'gap-2'
    }

    return (
        <div className={cn('flex items-center', gapSizes[size], className)}>
            <div className="typing-indicator flex items-center gap-1">
                <span className={cn('rounded-full bg-primary/60', dotSizes[size])} />
                <span className={cn('rounded-full bg-primary/60', dotSizes[size])} />
                <span className={cn('rounded-full bg-primary/60', dotSizes[size])} />
            </div>
            {label && (
                <span className="text-xs text-muted-foreground ml-2">{label}</span>
            )}
        </div>
    )
})

TypingIndicator.displayName = 'TypingIndicator'
