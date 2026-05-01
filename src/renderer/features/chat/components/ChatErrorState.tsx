/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertTriangle, IconArrowsRightLeft, IconClock, IconRefresh, IconWifiOff, IconX } from '@tabler/icons-react';
import React, { useMemo } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { ChatError, ChatErrorKind } from '@/types';

/* Batch-02: Extracted Long Classes */
const C_CHATERRORSTATE_1 = "flex items-center gap-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary px-3 py-1.5 typo-caption font-medium transition-colors";
const C_CHATERRORSTATE_2 = "flex items-center gap-1.5 rounded-lg border border-border/70 hover:bg-accent/50 text-muted-foreground hover:text-foreground px-3 py-1.5 typo-caption font-medium transition-colors";


interface ChatErrorStateProps {
    error: ChatError;
    onRetry: () => void;
    onSwitchModel?: () => void;
    onDismiss: () => void;
}

/** Accent color per error kind */
const ERROR_STYLES: Record<ChatErrorKind, { border: string; bg: string; icon: string }> = {
    provider_unavailable: { border: 'border-warning/40', bg: 'bg-warning/10', icon: 'text-warning' },
    quota_exhausted: { border: 'border-destructive/40', bg: 'bg-destructive/10', icon: 'text-destructive' },
    capacity_exhausted: { border: 'border-warning/40', bg: 'bg-warning/10', icon: 'text-warning' },
    rate_limited: { border: 'border-warning/40', bg: 'bg-warning/10', icon: 'text-warning' },
    timeout: { border: 'border-warning/40', bg: 'bg-warning/10', icon: 'text-warning' },
    auth: { border: 'border-destructive/40', bg: 'bg-destructive/10', icon: 'text-destructive' },
    permission_denied: { border: 'border-destructive/40', bg: 'bg-destructive/10', icon: 'text-destructive' },
    generic: { border: 'border-destructive/40', bg: 'bg-destructive/10', icon: 'text-destructive' },
};

const ERROR_TITLE_KEYS: Record<ChatErrorKind, string> = {
    provider_unavailable: 'frontend.chat.errorProviderUnavailable',
    quota_exhausted: 'frontend.chat.errorQuotaExhausted',
    capacity_exhausted: 'frontend.chat.errorCapacityExhausted',
    rate_limited: 'frontend.chat.errorRateLimited',
    timeout: 'frontend.chat.errorTimeout',
    auth: 'frontend.chat.errorAuth',
    permission_denied: 'frontend.chat.errorPermissionDenied',
    generic: 'frontend.chat.errorGeneric',
};

const ERROR_ACTION_KEYS: Record<ChatErrorKind, string> = {
    provider_unavailable: 'frontend.chat.errorProviderUnavailableAction',
    quota_exhausted: 'frontend.chat.errorQuotaExhaustedAction',
    capacity_exhausted: 'frontend.chat.errorCapacityExhaustedAction',
    rate_limited: 'frontend.chat.errorRateLimitedAction',
    timeout: 'frontend.chat.errorTimeoutAction',
    auth: 'frontend.chat.errorAuthAction',
    permission_denied: 'frontend.chat.errorPermissionDeniedAction',
    generic: 'frontend.chat.errorRetry',
};

/** Icon component per error kind */
const ErrorIcon: React.FC<{ kind: ChatErrorKind; className?: string }> = ({ kind, className }) => {
    const iconClass = cn('w-5 h-5', className);
    if (kind === 'provider_unavailable') {
        return <IconWifiOff className={iconClass} />;
    }
    if (kind === 'timeout') {
        return <IconClock className={iconClass} />;
    }
    if (kind === 'capacity_exhausted' || kind === 'rate_limited') {
        return <IconClock className={iconClass} />;
    }
    return <IconAlertTriangle className={iconClass} />;
};

/**
 * Displays a contextual error card inside the main chat view
 * when a chat stream fails due to provider, quota, or timeout issues.
 */
export const ChatErrorState: React.FC<ChatErrorStateProps> = React.memo(({
    error,
    onRetry,
    onSwitchModel,
    onDismiss,
}) => {
    const { t } = useTranslation();
    const style = ERROR_STYLES[error.kind];

    const showSwitchModel = error.kind === 'provider_unavailable'
        || error.kind === 'quota_exhausted'
        || error.kind === 'capacity_exhausted';

    const resetTimeLabel = useMemo(() => {
        if (!error.resetsAt) {
            return null;
        }
        return t('frontend.chat.errorQuotaResetHint', { time: new Date(error.resetsAt * 1000).toLocaleString() });
    }, [error.resetsAt, t]);

    return (
        <div
            role="alert"
            className={cn(
                'mx-4 my-3 rounded-xl border p-4 animate-in fade-in slide-in-from-bottom-2 duration-300',
                style.border,
                style.bg
            )}
        >
            <div className="flex items-start gap-3">
                <div className={cn('shrink-0 mt-0.5', style.icon)}>
                    <ErrorIcon kind={error.kind} />
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-sm text-foreground/90 leading-relaxed">
                        {t(ERROR_TITLE_KEYS[error.kind])}
                    </p>

                    {error.model && (
                        <p className="typo-caption text-muted-foreground">
                            {error.model}
                        </p>
                    )}

                    {resetTimeLabel && (
                        <div className="flex items-center gap-1.5 typo-caption text-muted-foreground">
                            <IconClock className="w-3 h-3" />
                            <span>{resetTimeLabel}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                        <button
                            onClick={onRetry}
                            disabled={error.retryable === false}
                            className={C_CHATERRORSTATE_1}
                        >
                            <IconRefresh className="w-3.5 h-3.5" />
                            {t(ERROR_ACTION_KEYS[error.kind])}
                        </button>

                        {showSwitchModel && onSwitchModel && (
                            <button
                                onClick={onSwitchModel}
                                className={C_CHATERRORSTATE_2}
                            >
                                <IconArrowsRightLeft className="w-3.5 h-3.5" />
                                {t('frontend.chat.errorSwitchModel')}
                            </button>
                        )}
                    </div>
                </div>

                <button
                    onClick={onDismiss}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent/50"
                    aria-label={t('frontend.chat.errorDismiss')}
                >
                    <IconX className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
});

ChatErrorState.displayName = 'ChatErrorState';
