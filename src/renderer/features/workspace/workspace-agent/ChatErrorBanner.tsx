/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertTriangle, IconArrowsRightLeft, IconRefresh } from '@tabler/icons-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { ChatErrorKind } from '@/types';

/* Batch-02: Extracted Long Classes */
const C_CHATERRORBANNER_1 = "flex items-center gap-1 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary px-3 py-1.5 typo-caption font-medium transition-colors";
const C_CHATERRORBANNER_2 = "flex items-center gap-1 rounded-lg border border-border/60 hover:bg-accent/50 text-muted-foreground hover:text-foreground px-3 py-1.5 typo-caption font-medium transition-colors";


interface ChatErrorBannerProps {
    errorKind: ChatErrorKind;
    onRetry: () => void;
    onSwitchModel?: () => void;
    onDismiss?: () => void;
}

/** Maps error kinds to their corresponding i18n keys */
const ERROR_MESSAGE_KEYS: Record<ChatErrorKind, string> = {
    provider_unavailable: 'chat.errorProviderUnavailable',
    quota_exhausted: 'chat.errorQuotaExhausted',
    capacity_exhausted: 'chat.errorCapacityExhausted',
    rate_limited: 'chat.errorRateLimited',
    timeout: 'chat.errorTimeout',
    auth: 'chat.errorAuth',
    permission_denied: 'chat.errorPermissionDenied',
    generic: 'chat.errorGeneric',
};

/** Accent color per error kind */
const ERROR_COLORS: Record<ChatErrorKind, string> = {
    provider_unavailable: 'border-warning/50 bg-warning/10',
    quota_exhausted: 'border-destructive/50 bg-destructive/10',
    capacity_exhausted: 'border-warning/50 bg-warning/10',
    rate_limited: 'border-warning/50 bg-warning/10',
    timeout: 'border-warning/50 bg-warning/10',
    auth: 'border-destructive/50 bg-destructive/10',
    permission_denied: 'border-destructive/50 bg-destructive/10',
    generic: 'border-destructive/50 bg-destructive/10',
};

/**
 * Displays a contextual error banner inside the workspace chat
 * with Retry and optional Switch Model actions.
 */
export const ChatErrorBanner: React.FC<ChatErrorBannerProps> = ({
    errorKind,
    onRetry,
    onSwitchModel,
    onDismiss,
}) => {
    const { t } = useTranslation();

    const showSwitchModel =
        errorKind === 'provider_unavailable'
        || errorKind === 'quota_exhausted'
        || errorKind === 'capacity_exhausted';

    return (
        <div
            role="alert"
            className={cn(
                'mx-4 my-2 rounded-xl border p-3 flex flex-col gap-2',
                ERROR_COLORS[errorKind]
            )}
        >
            <div className="flex items-start gap-2">
                <IconAlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <p className="typo-caption text-foreground/90 leading-relaxed">
                    {t(ERROR_MESSAGE_KEYS[errorKind])}
                </p>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="ml-auto text-muted-foreground hover:text-foreground typo-caption shrink-0"
                        aria-label={t('aria.dismiss')}
                    >
                        ✕
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={onRetry}
                    className={C_CHATERRORBANNER_1}
                >
                    <IconRefresh className="w-3 h-3" />
                    {t('chat.errorRetry')}
                </button>

                {showSwitchModel && onSwitchModel && (
                    <button
                        onClick={onSwitchModel}
                        className={C_CHATERRORBANNER_2}
                    >
                        <IconArrowsRightLeft className="w-3 h-3" />
                        {t('chat.errorSwitchModel')}
                    </button>
                )}
            </div>
        </div>
    );
};

