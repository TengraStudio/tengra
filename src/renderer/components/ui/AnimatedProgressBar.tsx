/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
                'w-full',
                className
            )}>
                <div
                    className={cn(
                        "w-full bg-muted overflow-hidden",
                        size === 'sm' && "h-1 rounded-full",
                        size === 'md' && "h-2 rounded-full",
                        size === 'lg' && "h-3 rounded-full"
                    )}
                    role="progressbar"
                    aria-valuenow={value}
                    aria-valuemin={0}
                    aria-valuemax={max}
                >
                    <div
                        className={cn(
                            "h-full rounded-full transition-all duration-500 ease-out",
                            variant === 'default' && "bg-primary",
                            variant === 'success' && "bg-success",
                            variant === 'warning' && "bg-warning",
                            variant === 'error' && "bg-destructive",
                            variant === 'gradient' && "bg-gradient-to-r from-accent via-primary to-info",
                            striped && "progress-animated",
                            animated && striped && "animate-progress-stripes"
                        )}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                {showLabel && (
                    <div className="flex justify-between mt-1 text-sm text-muted-foreground">
                        <span>{value}</span>
                        <span>{percentage.toFixed(0)}%</span>
                    </div>
                )}
            </div>
        );
    }
);

AnimatedProgressBar.displayName = 'AnimatedProgressBar';
