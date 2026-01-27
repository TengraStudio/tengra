import { useTranslation } from '@renderer/i18n';
import { AlertCircle, Check, Key, Loader2, ShieldCheck } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';

export interface ManualSessionModalState {
    isOpen: boolean
    accountId: string
    email?: string
}

interface ManualSessionModalProps extends ManualSessionModalState {
    onClose: () => void
    onSave: (sessionKey: string, accountId?: string) => Promise<{ success: boolean; error?: string }>
}

/**
 * Modal for manual Claude session key entry.
 * Provides clear instructions and validation for the 'sk-ant-sid' format.
 */
export const ManualSessionModal: React.FC<ManualSessionModalProps> = ({
    isOpen,
    onClose,
    onSave,
    email,
    accountId
}) => {
    const { t } = useTranslation();
    const [sessionKey, setSessionKey] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSave = useCallback(async () => {
        if (!sessionKey.trim()) {
            setError(t('auth.enterSessionKey'));
            return;
        }

        if (!sessionKey.startsWith('sk-ant-sid')) {
            setError(t('auth.invalidSessionFormat'));
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const result = await onSave(sessionKey.trim(), accountId);
            if (result.success) {
                setSuccess(true);
                setTimeout(() => {
                    onClose();
                    // Reset state after closing
                    setSuccess(false);
                    setSessionKey('');
                }, 1500);
            } else {
                setError(result.error ?? 'Failed to save session key');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setIsSaving(false);
        }
    }, [sessionKey, onSave, onClose, accountId, t]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('auth.sessionKeyRequired')}
            size="md"
            preventClose={isSaving}
        >
            <div className="space-y-6 py-2">
                {/* Header/Intro */}
                <div className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                            Complete Connection for {email ?? 'your account'}
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            To enable quota tracking and direct interaction, Orbit needs your Claude session key.
                            We encrypt and store this key locally on your device.
                        </p>
                    </div>
                </div>

                {/* Instructions */}
                <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <AlertCircle className="w-3 h-3" />
                        {t('auth.howToFindKey')}
                    </h4>
                    <ul className="text-xs text-muted-foreground space-y-2 list-decimal list-inside px-1">
                        <li>{t('auth.sessionKeyInstructions.step1')}</li>
                        <li>{t('auth.sessionKeyInstructions.step2')}</li>
                        <li>{t('auth.sessionKeyInstructions.step3')}</li>
                        <li>{t('auth.sessionKeyInstructions.step4')}</li>
                        <li>{t('auth.sessionKeyInstructions.step5')}</li>
                    </ul>
                </div>

                {/* Input Field */}
                <div className="space-y-2">
                    <label htmlFor="sessionKey" className="text-xs font-medium text-muted-foreground ml-1">
                        {t('auth.sessionKeyLabel')}
                    </label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                            <Key className="w-4 h-4" />
                        </div>
                        <input
                            id="sessionKey"
                            type="password"
                            placeholder={t('auth.sessionKeyPlaceholder')}
                            value={sessionKey}
                            onChange={(e) => setSessionKey(e.target.value)}
                            disabled={isSaving || success}
                            className={cn(
                                "w-full pl-10 pr-4 py-3 bg-muted/30 border rounded-xl outline-none transition-all font-mono text-sm",
                                error ? "border-destructive/50 focus:border-destructive" : "border-border/50 focus:border-primary/50 focus:bg-muted/50"
                            )}
                        />
                    </div>
                    {error && (
                        <p className="text-[11px] text-destructive font-medium ml-1 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                            <AlertCircle className="w-3 h-3" />
                            {error}
                        </p>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center gap-3 pt-2">
                    <button
                        onClick={onClose}
                        disabled={isSaving || success}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-border/50 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all disabled:opacity-50"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={() => void handleSave()}
                        disabled={isSaving || success || !sessionKey.startsWith('sk-ant-sid')}
                        className={cn(
                            "flex-[2] px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/10",
                            success
                                ? "bg-emerald-500 text-foreground shadow-emerald-500/20"
                                : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:grayscale"
                        )}
                    >
                        {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : success ? (
                            <>
                                <Check className="w-4 h-4" />
                                {t('auth.validatedAndSaved')}
                            </>
                        ) : (
                            t('auth.saveSessionKey')
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
