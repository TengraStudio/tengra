import { AlertTriangle, ArrowRightLeft, Clock, RefreshCw, WifiOff, X } from 'lucide-react';
import React, { useMemo } from 'react';

import { useTranslation } from '@/i18n';
import { ChatError, ChatErrorKind } from '@/types';

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
    provider_unavailable: 'chat.errorProviderUnavailable',
    quota_exhausted: 'chat.errorQuotaExhausted',
    capacity_exhausted: 'chat.errorCapacityExhausted',
    rate_limited: 'chat.errorRateLimited',
    timeout: 'chat.errorTimeout',
    auth: 'chat.errorAuth',
    permission_denied: 'chat.errorPermissionDenied',
    generic: 'chat.errorGeneric',
};

const ERROR_ACTION_KEYS: Record<ChatErrorKind, string> = {
    provider_unavailable: 'chat.errorProviderUnavailableAction',
    quota_exhausted: 'chat.errorQuotaExhaustedAction',
    capacity_exhausted: 'chat.errorCapacityExhaustedAction',
    rate_limited: 'chat.errorRateLimitedAction',
    timeout: 'chat.errorTimeoutAction',
    auth: 'chat.errorAuthAction',
    permission_denied: 'chat.errorPermissionDeniedAction',
    generic: 'chat.errorRetry',
};

/** Icon component per error kind */
const ErrorIcon: React.FC<{ kind: ChatErrorKind; className?: string }> = ({ kind, className }) => {
    const iconClass = `w-5 h-5 ${className ?? ''}`;
    if (kind === 'provider_unavailable') {
        return <WifiOff className={iconClass} />;
    }
    if (kind === 'timeout') {
        return <Clock className={iconClass} />;
    }
    if (kind === 'capacity_exhausted' || kind === 'rate_limited') {
        return <Clock className={iconClass} />;
    }
    return <AlertTriangle className={iconClass} />;
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
        return t('chat.errorQuotaResetHint', { time: new Date(error.resetsAt * 1000).toLocaleString() });
    }, [error.resetsAt, t]);

    return (
        <div
            role="alert"
            className={`mx-4 my-3 rounded-xl border ${style.border} ${style.bg} p-4 animate-in fade-in slide-in-from-bottom-2 duration-300`}
        >
            <div className="flex items-start gap-3">
                <div className={`shrink-0 mt-0.5 ${style.icon}`}>
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
                            <Clock className="w-3 h-3" />
                            <span>{resetTimeLabel}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                        <button
                            onClick={onRetry}
                            disabled={error.retryable === false}
                            className="flex items-center gap-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary px-3 py-1.5 typo-caption font-medium transition-colors"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            {t(ERROR_ACTION_KEYS[error.kind])}
                        </button>

                        {showSwitchModel && onSwitchModel && (
                            <button
                                onClick={onSwitchModel}
                                className="flex items-center gap-1.5 rounded-lg border border-border/70 hover:bg-accent/50 text-muted-foreground hover:text-foreground px-3 py-1.5 typo-caption font-medium transition-colors"
                            >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                {t('chat.errorSwitchModel')}
                            </button>
                        )}
                    </div>
                </div>

                <button
                    onClick={onDismiss}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent/50"
                    aria-label={t('chat.errorDismiss')}
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
});

ChatErrorState.displayName = 'ChatErrorState';
