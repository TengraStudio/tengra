import { AlertTriangle, ArrowRightLeft,RefreshCw } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';

import type { WorkspaceChatErrorKind } from '../../hooks/useWorkspaceChatStream';

interface ChatErrorBannerProps {
    errorKind: WorkspaceChatErrorKind;
    onRetry: () => void;
    onSwitchModel?: () => void;
    onDismiss?: () => void;
}

/** Maps error kinds to their corresponding i18n keys */
const ERROR_MESSAGE_KEYS: Record<WorkspaceChatErrorKind, string> = {
    provider_unavailable: 'chat.errorProviderUnavailable',
    quota_exhausted: 'chat.errorQuotaExhausted',
    timeout: 'chat.errorTimeout',
    generic: 'chat.errorGeneric',
};

/** Accent color per error kind */
const ERROR_COLORS: Record<WorkspaceChatErrorKind, string> = {
    provider_unavailable: 'border-orange-500/50 bg-orange-500/10',
    quota_exhausted: 'border-red-500/50 bg-red-500/10',
    timeout: 'border-yellow-500/50 bg-yellow-500/10',
    generic: 'border-red-500/50 bg-red-500/10',
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
        errorKind === 'provider_unavailable' || errorKind === 'quota_exhausted';

    return (
        <div
            role="alert"
            className={`mx-4 my-2 rounded-xl border p-3 ${ERROR_COLORS[errorKind]} flex flex-col gap-2`}
        >
            <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-foreground/90 leading-relaxed">
                    {t(ERROR_MESSAGE_KEYS[errorKind])}
                </p>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="ml-auto text-muted-foreground hover:text-foreground text-xs shrink-0"
                        aria-label={t('aria.dismiss')}
                    >
                        ✕
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={onRetry}
                    className="flex items-center gap-1 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary px-3 py-1.5 text-xs font-medium transition-colors"
                >
                    <RefreshCw className="w-3 h-3" />
                    {t('chat.errorRetry')}
                </button>

                {showSwitchModel && onSwitchModel && (
                    <button
                        onClick={onSwitchModel}
                        className="flex items-center gap-1 rounded-lg border border-white/10 hover:bg-white/5 text-muted-foreground hover:text-foreground px-3 py-1.5 text-xs font-medium transition-colors"
                    >
                        <ArrowRightLeft className="w-3 h-3" />
                        {t('chat.errorSwitchModel')}
                    </button>
                )}
            </div>
        </div>
    );
};
