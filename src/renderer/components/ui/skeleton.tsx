import React from 'react';

import { cn } from '@/lib/utils';

import './skeleton.css';

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
        text: 'tengra-skeleton--text',
        circular: 'tengra-skeleton--circular',
        rectangular: 'tengra-skeleton--rectangular',
        rounded: 'tengra-skeleton--rounded'
    };

    const style: React.CSSProperties = {
        width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined
    };

    return (
        <div
            className={cn(
                'tengra-skeleton',
                animate && 'tengra-skeleton--animated',
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
        <div className={cn('tengra-skeleton-text', className)}>
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
        <div className={cn('tengra-skeleton-card', className)}>
            {showImage && (
                <Skeleton className="tengra-skeleton-card__image" variant="rounded" width="100%" height={120} />
            )}
            {showTitle && (
                <Skeleton className="tengra-skeleton-card__title" variant="text" width="70%" height={20} />
            )}
            {showDescription && (
                <SkeletonText lines={2} />
            )}
        </div>
    );
});

SkeletonCard.displayName = 'SkeletonCard';
