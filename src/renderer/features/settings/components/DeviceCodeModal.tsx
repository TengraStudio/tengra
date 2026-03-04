import { Check, Copy, ExternalLink, Loader2, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import { Modal } from '@/components/ui/modal';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

export interface DeviceCodeModalState {
    isOpen: boolean
    userCode: string
    verificationUri: string
    provider: 'github' | 'copilot'
    status: 'pending' | 'success' | 'error'
    errorMessage?: string
}

interface DeviceCodeModalProps extends DeviceCodeModalState {
    onClose: () => void
}

/**
 * Modal for GitHub Device Code authentication flow.
 * Displays the user code with a prominent copy button and stays open until login completes.
 */
export const DeviceCodeModal: React.FC<DeviceCodeModalProps> = ({
    isOpen,
    onClose,
    userCode,
    verificationUri,
    provider,
    status,
    errorMessage
}) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(userCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Failed to copy - user can still manually copy
        }
    }, [userCode]);

    const handleOpenLink = useCallback(() => {
        window.electron.openExternal(verificationUri);
    }, [verificationUri]);

    const providerName = provider === 'copilot' ? 'GitHub Copilot' : 'GitHub';
    const isPending = status === 'pending';
    const isSuccess = status === 'success';
    const isError = status === 'error';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('auth.connectProvider', { provider: providerName })}
            preventClose={false}
            size="md"
        >
            <div className="space-y-6">
                {/* Instructions */}
                <p className="text-sm text-muted-foreground">
                    {t('auth.enterCodeOnGithub')}
                </p>

                {/* Device Code Display */}
                <div className="relative">
                    <div className="bg-muted/30 border border-border/50 rounded-xl p-6 text-center">
                        <code className="text-3xl font-mono font-bold tracking-[0.3em] text-primary select-all">
                            {userCode}
                        </code>
                    </div>

                    {/* Copy Button */}
                    <button
                        onClick={() => void handleCopy()}
                        className={cn(
                            "absolute -right-2 -top-2 p-2.5 rounded-lg border transition-all duration-200",
                            copied
                                ? "bg-success/20 border-success/50 text-success"
                                : "bg-muted/30 border-border/50 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50"
                        )}
                        title={t('auth.copyCode')}
                    >
                        {copied ? (
                            <Check className="w-4 h-4" />
                        ) : (
                            <Copy className="w-4 h-4" />
                        )}
                    </button>
                </div>

                {/* Open GitHub Button */}
                <button
                    onClick={handleOpenLink}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors font-semibold"
                >
                    <ExternalLink className="w-4 h-4" />
                    {t('auth.openGithubToEnter')}
                </button>

                {/* Status Display */}
                <div className="flex items-center justify-center gap-2 py-2">
                    {isPending && (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{t('auth.waitingForLogin')}</span>
                        </>
                    )}
                    {isSuccess && (
                        <>
                            <Check className="w-4 h-4 text-success" />
                            <span className="text-sm text-success font-semibold">{t('auth.connectedSuccessfully')}</span>
                        </>
                    )}
                    {isError && (
                        <>
                            <X className="w-4 h-4 text-destructive" />
                            <span className="text-sm text-destructive">{errorMessage ?? t('auth.connectionFailedGeneric')}</span>
                        </>
                    )}
                </div>

                <button
                    onClick={onClose}
                    className="w-full px-4 py-2.5 rounded-xl bg-muted/30 border border-border/50 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors text-sm font-medium"
                >
                    {isPending ? t('common.cancel') : t('common.close')}
                </button>
            </div>
        </Modal>
    );
};
