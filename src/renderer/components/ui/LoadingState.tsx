/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconLoader2, IconX } from '@tabler/icons-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import {
    beginLoadingOperation,
    completeLoadingOperation,
    updateLoadingOperationProgress,
} from '@/store/loading-analytics.store';



/* Batch-02: Extracted Long Classes */
const C_LOADINGSTATE_1 = "inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border/60 typo-caption text-foreground hover:bg-accent/40";

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
 * <LoadingState analyticsContext="initial-load" fullScreen />
 * 
 * // Inline loading
 * <LoadingState size="sm" inline />
 * 
 * // Default loading state
 * <LoadingState />
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
    cancelLabel,
    compact = false
}) => {
    const { t } = useTranslation();
    const resolvedCancelLabel = cancelLabel ?? t('common.cancel');
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
        sm: 'typo-caption',
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
        return seconds > 0 ? t('common.timeRemaining', { seconds }) : t('common.finalizing');
    }, [currentTime, estimatedMs, startedAt, t]);
    const statusLabel = useMemo(() => {
        if (message) {
            return message;
        }
        if (analyticsContext) {
            return t('common.loadingContext', { context: analyticsContext });
        }
        return t('common.loading');
    }, [analyticsContext, message, t]);

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
            <IconLoader2 className={cn('animate-spin text-primary', sizeClasses[size], className)} aria-hidden="true" aria-label={statusLabel} />
        );
    }

    if (fullScreen) {
        return (
            <div className={cn('fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm', className)} role="status" aria-live="polite" aria-label={statusLabel}>
                <div className="flex flex-col items-center gap-3 text-muted-foreground min-w-64">
                    <IconLoader2 className={cn('animate-spin text-primary', sizeClasses[size])} aria-hidden="true" />
                    {message && (
                        <span className={cn('font-medium', textSizeClasses[size])}>{message}</span>
                    )}
                    {stage && (
                        <span className="typo-caption text-muted-foreground">{stage}</span>
                    )}
                    {clampedProgress !== undefined && (
                        <div className="w-56 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-300 ease-out"
                                style={{ width: `${clampedProgress}%` }}
                            />
                        </div>
                    )}
                    {estimateLabel && <span className="typo-caption text-muted-foreground/80">{estimateLabel}</span>}
                    {onCancel && (
                        <button
                            onClick={() => {
                                if (operationId) {
                                    completeLoadingOperation(operationId, 'cancelled');
                                }
                                onCancel();
                            }}
                            className="mt-1 px-2.5 py-1 rounded border border-border/60 typo-caption text-foreground hover:bg-accent/40"
                        >
                            {resolvedCancelLabel}
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
                compact ? 'min-h-0 py-2 px-3 rounded-lg border border-border/50 bg-card/70' : 'min-h-52',
                className
            )}
            role="status"
            aria-live="polite"
            aria-label={statusLabel}
        >
            <IconLoader2 className={cn('animate-spin text-primary', sizeClasses[size])} aria-hidden="true" />
            {message && <span className={cn('font-medium', textSizeClasses[size])}>{message}</span>}
            {stage && <span className="typo-caption text-muted-foreground">{stage}</span>}
            {clampedProgress !== undefined && (
                <div className={cn('h-1.5 bg-muted/50 rounded-full overflow-hidden', compact ? 'w-44' : 'w-56')}>
                    <div
                        className="h-full bg-primary transition-all duration-300 ease-out"
                        style={{ width: `${clampedProgress}%` }}
                    />
                </div>
            )}
            {estimateLabel && <span className="typo-caption text-muted-foreground/80">{estimateLabel}</span>}
            {onCancel && (
                <button
                    onClick={() => {
                        if (operationId) {
                            completeLoadingOperation(operationId, 'cancelled');
                        }
                        onCancel();
                    }}
                    className={C_LOADINGSTATE_1}
                >
                    <IconX className="w-3 h-3" />
                    {resolvedCancelLabel}
                </button>
            )}
        </div>
    );
});

LoadingState.displayName = 'LoadingState';
