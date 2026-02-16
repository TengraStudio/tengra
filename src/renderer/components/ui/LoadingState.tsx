import { Loader2, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import {
    beginLoadingOperation,
    completeLoadingOperation,
    updateLoadingOperationProgress,
} from '@/store/loading-analytics.store';

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
    /**
     * Optional operation id for loading analytics correlation.
     */
    operationId?: string
    /**
     * Optional context label for loading analytics.
     */
    analyticsContext?: string
    /**
     * Optional operation start timestamp for estimation.
     */
    startedAt?: number
    /**
     * Optional estimated total duration in milliseconds.
     */
    estimatedMs?: number
    /**
     * Optional explicit progress percentage [0..100].
     */
    progress?: number
    /**
     * Optional stage label shown under the loading message.
     */
    stage?: string
    /**
     * Optional cancellation callback.
     */
    onCancel?: () => void
    /**
     * Optional cancellation button label.
     */
    cancelLabel?: string
    /**
     * Compact layout variant for overlays/toolbars.
     */
    compact?: boolean
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
    inline = false,
    operationId,
    analyticsContext,
    startedAt,
    estimatedMs,
    progress,
    stage,
    onCancel,
    cancelLabel = 'Cancel',
    compact = false
}) => {
    const hasRegisteredRef = useRef(false);
    const [currentTime, setCurrentTime] = useState(() => Date.now());

    // Update current time periodically for progress calculation
    useEffect(() => {
        if (typeof startedAt === 'number' && typeof estimatedMs === 'number' && estimatedMs > 0) {
            const interval = setInterval(() => {
                setCurrentTime(Date.now());
            }, 100); // Update every 100ms for smooth progress
            return () => clearInterval(interval);
        }
        return undefined;
    }, [startedAt, estimatedMs]);

    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12'
    };

    const textSizeClasses = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base'
    };

    const clampedProgress = useMemo(() => {
        if (typeof progress === 'number' && Number.isFinite(progress)) {
            return Math.max(0, Math.min(100, progress));
        }
        if (
            typeof startedAt === 'number' &&
            Number.isFinite(startedAt) &&
            typeof estimatedMs === 'number' &&
            Number.isFinite(estimatedMs) &&
            estimatedMs > 0
        ) {
            const elapsed = Math.max(0, currentTime - startedAt);
            return Math.max(0, Math.min(98, (elapsed / estimatedMs) * 100));
        }
        return undefined;
    }, [currentTime, estimatedMs, progress, startedAt]);

    const estimateLabel = useMemo(() => {
        if (
            typeof startedAt !== 'number' ||
            !Number.isFinite(startedAt) ||
            typeof estimatedMs !== 'number' ||
            !Number.isFinite(estimatedMs) ||
            estimatedMs <= 0
        ) {
            return null;
        }
        const remaining = Math.max(0, estimatedMs - (currentTime - startedAt));
        const seconds = Math.ceil(remaining / 1000);
        return seconds > 0 ? `~${seconds}s remaining` : 'Finalizing...';
    }, [currentTime, estimatedMs, startedAt]);

    useEffect(() => {
        if (!operationId || hasRegisteredRef.current) {
            return;
        }
        beginLoadingOperation({
            id: operationId,
            context: analyticsContext ?? 'loading-state',
            estimatedMs,
            progress: clampedProgress,
            cancellable: typeof onCancel === 'function',
        });
        hasRegisteredRef.current = true;
        return () => {
            completeLoadingOperation(operationId, 'completed');
            hasRegisteredRef.current = false;
        };
    }, [analyticsContext, clampedProgress, estimatedMs, onCancel, operationId]);

    useEffect(() => {
        if (!operationId || clampedProgress === undefined) {
            return;
        }
        updateLoadingOperationProgress(operationId, clampedProgress);
    }, [clampedProgress, operationId]);

    if (inline) {
        return (
            <Loader2 className={cn('animate-spin text-primary', sizeClasses[size], className)} aria-hidden="true" />
        );
    }

    if (fullScreen) {
        return (
            <div className={cn('fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm', className)} role="status" aria-live="polite">
                <div className="flex flex-col items-center gap-3 text-muted-foreground min-w-[260px]">
                    <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} aria-hidden="true" />
                    {message && (
                        <span className={cn('font-medium', textSizeClasses[size])}>{message}</span>
                    )}
                    {stage && (
                        <span className="text-xs text-muted-foreground">{stage}</span>
                    )}
                    {clampedProgress !== undefined && (
                        <div className="w-56 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-[width] duration-300 ease-out"
                                style={{ width: `${clampedProgress}%` }}
                            />
                        </div>
                    )}
                    {estimateLabel && <span className="text-xs text-muted-foreground/80">{estimateLabel}</span>}
                    {onCancel && (
                        <button
                            onClick={() => {
                                if (operationId) {
                                    completeLoadingOperation(operationId, 'cancelled');
                                }
                                onCancel();
                            }}
                            className="mt-1 px-2.5 py-1 rounded border border-border/60 text-xs text-foreground hover:bg-accent/40"
                        >
                            {cancelLabel}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-3 text-muted-foreground',
                compact ? 'min-h-0 py-2 px-3 rounded-lg border border-border/50 bg-card/70' : 'min-h-[200px]',
                className
            )}
            role="status"
            aria-live="polite"
        >
            <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} aria-hidden="true" />
            {message && <span className={cn('font-medium', textSizeClasses[size])}>{message}</span>}
            {stage && <span className="text-xs text-muted-foreground">{stage}</span>}
            {clampedProgress !== undefined && (
                <div className={cn('h-1.5 bg-muted/50 rounded-full overflow-hidden', compact ? 'w-44' : 'w-56')}>
                    <div
                        className="h-full bg-primary transition-[width] duration-300 ease-out"
                        style={{ width: `${clampedProgress}%` }}
                    />
                </div>
            )}
            {estimateLabel && <span className="text-xs text-muted-foreground/80">{estimateLabel}</span>}
            {onCancel && (
                <button
                    onClick={() => {
                        if (operationId) {
                            completeLoadingOperation(operationId, 'cancelled');
                        }
                        onCancel();
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border/60 text-xs text-foreground hover:bg-accent/40"
                >
                    <X className="w-3 h-3" />
                    {cancelLabel}
                </button>
            )}
        </div>
    );
});

LoadingState.displayName = 'LoadingState';
