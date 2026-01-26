import React from 'react';

import { cn } from '@/lib/utils';

interface AnimatedProgressBarProps {
    value: number
    max?: number
    className?: string
    showLabel?: boolean
    size?: 'sm' | 'md' | 'lg'
    variant?: 'default' | 'success' | 'warning' | 'error' | 'gradient'
    animated?: boolean
    striped?: boolean
}

/**
 * AnimatedProgressBar Component
 * 
 * A visually enhanced progress bar with animations and variants.
 * 
 * @example
 * ```tsx
 * <AnimatedProgressBar value={75} />
 * <AnimatedProgressBar value={50} variant="gradient" striped animated />
 * ```
 */
export const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = React.memo(({
    value,
    max = 100,
    className,
    showLabel = false,
    size = 'md',
    variant = 'default',
    animated = false,
    striped = false
}) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const sizeClasses = {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3'
    };

    const variantClasses = {
        default: 'bg-primary',
        success: 'bg-emerald-500',
        warning: 'bg-amber-500',
        error: 'bg-red-500',
        gradient: 'bg-gradient-to-r from-violet-500 via-primary to-cyan-500'
    };

    return (
        <div className={cn('w-full', className)}>
            <div 
                className={cn(
                    'w-full bg-muted rounded-full overflow-hidden',
                    sizeClasses[size]
                )}
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={max}
            >
                <div
                    className={cn(
                        'h-full rounded-full transition-all duration-500 ease-out',
                        variantClasses[variant],
                        striped && animated && 'progress-animated',
                        striped && !animated && 'bg-stripes'
                    )}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {showLabel && (
                <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                    <span>{value}</span>
                    <span>{percentage.toFixed(0)}%</span>
                </div>
            )}
        </div>
    );
});

AnimatedProgressBar.displayName = 'AnimatedProgressBar';
