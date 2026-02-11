import React from 'react';

import { cn } from '@/lib/utils';

interface AnimatedProgressBarProps {
    value: number;
    max?: number;
    className?: string;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'success' | 'warning' | 'error' | 'gradient';
    animated?: boolean;
    striped?: boolean;
}

const getStripedClass = (striped: boolean, animated: boolean): string => {
    if (!striped) {
        return '';
    }
    return animated ? 'progress-animated' : 'bg-stripes';
};

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
export const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = React.memo(
    ({
        value,
        max = 100,
        className,
        showLabel = false,
        size = 'md',
        variant = 'default',
        animated = false,
        striped = false,
    }) => {
        const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

        const sizeClasses: Record<typeof size, string> = {
            sm: 'h-1',
            md: 'h-2',
            lg: 'h-3',
        };

        const variantClasses: Record<typeof variant, string> = {
            default: 'bg-primary',
            success: 'bg-success',
            warning: 'bg-warning',
            error: 'bg-destructive',
            gradient: 'bg-gradient-to-r from-accent via-primary to-info',
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
                            getStripedClass(striped, animated)
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
    }
);

AnimatedProgressBar.displayName = 'AnimatedProgressBar';
