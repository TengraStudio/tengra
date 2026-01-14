import { Loader2 } from 'lucide-react'
import React from 'react'

import { cn } from '@/lib/utils'

export interface LoadingStateProps {
    /**
     * Optional message to display below the spinner
     */
    message?: string
    /**
     * Size of the loading spinner
     */
    size?: 'sm' | 'md' | 'lg'
    /**
     * Whether to show a full-screen overlay
     */
    fullScreen?: boolean
    /**
     * Additional className for styling
     */
    className?: string
    /**
     * Whether to show inline (smaller, for buttons/inputs)
     */
    inline?: boolean
}

/**
 * Consistent loading state component used throughout the application.
 * Provides standardized loading indicators with different sizes and contexts.
 * 
 * @example
 * ```tsx
 * // Full screen loading
 * <LoadingState message="Loading data..." fullScreen />
 * 
 * // Inline loading
 * <LoadingState size="sm" inline />
 * 
 * // Default loading state
 * <LoadingState message="Please wait..." />
 * ```
 */
export const LoadingState: React.FC<LoadingStateProps> = React.memo(({
    message,
    size = 'md',
    fullScreen = false,
    className,
    inline = false
}) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12'
    }

    const textSizeClasses = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base'
    }

    if (inline) {
        return (
            <Loader2 className={cn('animate-spin text-primary', sizeClasses[size], className)} aria-hidden="true" />
        )
    }

    if (fullScreen) {
        return (
            <div className={cn('fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm', className)} role="status" aria-live="polite">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} aria-hidden="true" />
                    {message && (
                        <span className={cn('font-medium', textSizeClasses[size])}>{message}</span>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className={cn('flex flex-col items-center justify-center min-h-[200px] gap-3 text-muted-foreground', className)} role="status" aria-live="polite">
            <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} aria-hidden="true" />
            {message && (
                <span className={cn('font-medium', textSizeClasses[size])}>{message}</span>
            )}
        </div>
    )
})

LoadingState.displayName = 'LoadingState'
