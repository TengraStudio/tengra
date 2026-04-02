import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { useTranslation } from '@renderer/i18n';
import { AlertCircle, Check, Key, Loader2, ShieldCheck, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';

export interface ManualSessionModalState {
    isOpen: boolean;
    accountId: string;
    email?: string;
}

interface ManualSessionModalProps extends ManualSessionModalState {
    onClose: () => void;
    onSave: (
        sessionKey: string,
        accountId?: string
    ) => Promise<{ success: boolean; error?: string }>;
}

const HeaderSection: React.FC<{
    email?: string;
    t: (key: string, options?: Record<string, string>) => string;
}> = ({ email, t }) => (
    <div className="flex items-start gap-4 p-5 rounded-2xl bg-primary/5 border border-primary/10 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary shadow-sm">
            <ShieldCheck className="w-5.5 h-5.5" />
        </div>
        <div className="space-y-1.5 flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">
                {t('auth.completeConnection', { email: email ?? t('auth.yourAccount') })}
            </p>
            <p className="text-xxs text-muted-foreground leading-relaxed font-medium opacity-80">
                {t('auth.sessionKeyDescription')}
            </p>
        </div>
    </div>
);

const InstructionsSection: React.FC<{ t: (key: string) => string }> = ({ t }) => (
    <div className="space-y-4 px-1">
        <h4 className="text-xxs font-bold text-primary/70 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" />
            {t('auth.howToFindKey')}
        </h4>
        <ul className="grid grid-cols-1 gap-2.5">
            {[1, 2, 3, 4, 5].map(step => (
                <li
                    key={step}
                    className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/10 text-[11px] text-muted-foreground font-medium leading-relaxed transition-all hover:bg-muted/30"
                >
                    <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[9px] border border-primary/20">
                        {step}
                    </span>
                    <span>{t(`auth.sessionKeyInstructions.step${step}`)}</span>
                </li>
            ))}
        </ul>
    </div>
);

interface InputSectionProps {
    sessionKey: string;
    setSessionKey: (v: string) => void;
    isSaving: boolean;
    success: boolean;
    error: string | null;
    t: (key: string) => string;
}

const InputSection: React.FC<InputSectionProps> = ({
    sessionKey,
    setSessionKey,
    isSaving,
    success,
    error,
    t,
}) => (
    <div className="space-y-2.5 px-0.5">
        <label
            htmlFor="sessionKey"
            className="text-xxs font-bold text-muted-foreground/70 ml-1"
        >
            {t('auth.sessionKeyLabel')}
        </label>
        <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                <Key className="w-4 h-4" />
            </div>
            <Input
                id="sessionKey"
                type="password"
                placeholder={t('auth.sessionKeyPlaceholder')}
                value={sessionKey}
                onChange={e => setSessionKey(e.target.value)}
                disabled={isSaving || success}
                className={cn(
                    'w-full h-12 pl-11 pr-4 bg-background/50 border-border/40 rounded-2xl outline-none transition-all font-mono text-sm font-medium shadow-sm focus-visible:ring-primary/20',
                    error ? 'border-destructive/40 focus:border-destructive' : 'border-border/40'
                )}
            />
            {sessionKey && !isSaving && !success && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSessionKey('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 rounded-lg"
                >
                    <X className="w-3.5 h-3.5" />
                </Button>
            )}
        </div>
        {error && (
            <p className="text-xxs text-destructive font-bold ml-1 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 px-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
            </p>
        )}
    </div>
);

interface SaveButtonProps {
    isSaving: boolean;
    success: boolean;
    t: (key: string) => string;
}

const SaveButtonContent: React.FC<SaveButtonProps> = ({ isSaving, success, t }) => {
    if (isSaving) {
        return <Loader2 className="w-4.5 h-4.5 animate-spin" />;
    }
    if (success) {
        return (
            <>
                <Check className="w-4.5 h-4.5" />
                {t('auth.validatedAndSaved')}
            </>
        );
    }
    return (
        <>
            <ShieldCheck className="w-4.5 h-4.5" />
            {t('auth.saveSessionKey')}
        </>
    );
};

/**
 * Modal for manual Claude session key entry.
 * Provides clear instructions and validation for the 'sk-ant-sid' format.
 */
export const ManualSessionModal: React.FC<ManualSessionModalProps> = ({
    isOpen,
    onClose,
    onSave,
    email,
    accountId,
}) => {
    const { t } = useTranslation();
    const [sessionKey, setSessionKey] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const validateSessionKey = useCallback(
        (key: string): string | null => {
            if (!key.trim()) {
                return t('auth.enterSessionKey');
            }
            if (!key.startsWith('sk-ant-sid')) {
                return t('auth.invalidSessionFormat');
            }
            return null;
        },
        [t]
    );

    const handleSaveSuccess = useCallback(() => {
        setSuccess(true);
        setTimeout(() => {
            onClose();
            setSuccess(false);
            setSessionKey('');
        }, 1500);
    }, [onClose]);

    const handleSave = useCallback(async () => {
        const validationError = validateSessionKey(sessionKey);
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const result = await onSave(sessionKey.trim(), accountId);
            if (result.success) {
                handleSaveSuccess();
            } else {
                setError(result.error ?? t('auth.saveSessionKeyFailed'));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('common.error'));
        } finally {
            setIsSaving(false);
        }
    }, [sessionKey, onSave, accountId, validateSessionKey, handleSaveSuccess, t]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('auth.sessionKeyRequired')}
            size="md"
            preventClose={isSaving}
        >
            <div className="space-y-8 py-2">
                <HeaderSection email={email} t={t} />
                <InstructionsSection t={t} />
                <InputSection
                    sessionKey={sessionKey}
                    setSessionKey={setSessionKey}
                    isSaving={isSaving}
                    success={success}
                    error={error}
                    t={t}
                />
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isSaving || success}
                        className="w-full sm:flex-1 h-12 rounded-2xl text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all disabled:opacity-50 border border-border/40"
                    >
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant={success ? 'default' : 'default'}
                        onClick={() => void handleSave()}
                        disabled={isSaving || success || !sessionKey.startsWith('sk-ant-sid')}
                        className={cn(
                            'w-full sm:tw-flex-2 h-12 rounded-2xl text-[11px] font-bold   flex items-center justify-center gap-3 transition-all shadow-xl',
                            success
                                ? 'bg-success hover:bg-success text-foreground shadow-emerald-500/20'
                                : 'bg-primary text-primary-foreground shadow-primary/20 hover:scale-[1.02] active:scale-95 disabled:scale-100 disabled:opacity-40 disabled:grayscale'
                        )}
                    >
                        <SaveButtonContent isSaving={isSaving} success={success} t={t} />
                    </Button>
                </div>
            </div>
        </Modal>
    );
};


