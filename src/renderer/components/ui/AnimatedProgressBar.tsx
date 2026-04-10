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

        return (
            <div className={cn(
                'tengra-progress-bar',
                `tengra-progress-bar--${size}`,
                `tengra-progress-bar--${variant}`,
                striped && 'tengra-progress-bar--striped',
                animated && 'tengra-progress-bar--animated',
                className
            )}>
                <div
                    className="tengra-progress-bar__track"
                    role="progressbar"
                    aria-valuenow={value}
                    aria-valuemin={0}
                    aria-valuemax={max}
                >
                    <div
                        className="tengra-progress-bar__fill"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                {showLabel && (
                    <div className="tengra-progress-bar__labels">
                        <span>{value}</span>
                        <span>{percentage.toFixed(0)}%</span>
                    </div>
                )}
            </div>
        );
    }
);

AnimatedProgressBar.displayName = 'AnimatedProgressBar';
