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


interface SkeletonProps {
    className?: string
    variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
    width?: string | number
    height?: string | number
    animate?: boolean
}

/**
 * Skeleton Component
 * 
 * A placeholder loading component with shimmer animation.
 * 
 * @example
 * ```tsx
 * <Skeleton variant="text" width={200} />
 * <Skeleton variant="circular" width={40} height={40} />
 * <Skeleton variant="rounded" width="100%" height={120} />
 * ```
 */
export const Skeleton: React.FC<SkeletonProps> = React.memo(({
    className,
    variant = 'text',
    width,
    height,
    animate = true
}) => {
    const variantClasses = {
        text: 'h-4 rounded',
        circular: 'rounded-full',
        rectangular: 'rounded-none',
        rounded: 'rounded-lg'
    };

    const style: React.CSSProperties = {
        width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined
    };

    return (
        <div
            className={cn(
                'skeleton',
                !animate && 'animate-none',
                variantClasses[variant],
                className
            )}
            style={style}
            aria-hidden="true"
        />
    );
});

Skeleton.displayName = 'Skeleton';

/**
 * SkeletonText Component
 * 
 * Multiple lines of skeleton text for paragraph placeholders.
 */
export const SkeletonText: React.FC<{
    lines?: number
    className?: string
    lastLineWidth?: string
}> = React.memo(({ lines = 3, className, lastLineWidth = '60%' }) => {
    return (
        <div className={cn('flex flex-col gap-2', className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    variant="text"
                    width={i === lines - 1 ? lastLineWidth : '100%'}
                />
            ))}
        </div>
    );
});

SkeletonText.displayName = 'SkeletonText';

/**
 * SkeletonCard Component
 * 
 * A card-shaped skeleton placeholder.
 */
export const SkeletonCard: React.FC<{
    className?: string
    showImage?: boolean
    showTitle?: boolean
    showDescription?: boolean
}> = React.memo(({ 
    className, 
    showImage = true, 
    showTitle = true, 
    showDescription = true 
}) => {
    return (
        <div className={cn('glass-card p-4 flex flex-col gap-4', className)}>
            {showImage && (
                <Skeleton className="w-full h-120 rounded-lg" variant="rounded" width="100%" height={120} />
            )}
            {showTitle && (
                <Skeleton className="w-70p h-5" variant="text" width="70%" height={20} />
            )}
            {showDescription && (
                <SkeletonText lines={2} />
            )}
        </div>
    );
});

SkeletonCard.displayName = 'SkeletonCard';

