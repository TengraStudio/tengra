/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertCircle, IconCheck, IconKey, IconLoader2, IconShieldCheck, IconX } from '@tabler/icons-react';
import React, { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_MANUALSESSIONMODAL_1 = "flex items-start gap-4 p-5 rounded-2xl bg-primary/5 border border-primary/10 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300";
const C_MANUALSESSIONMODAL_2 = "flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/10 typo-body text-muted-foreground font-medium leading-relaxed transition-all hover:bg-muted/30";
const C_MANUALSESSIONMODAL_3 = "flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-primary/10 text-primary font-bold typo-body border border-primary/20";
const C_MANUALSESSIONMODAL_4 = "absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors";
const C_MANUALSESSIONMODAL_5 = "absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 rounded-lg";
const C_MANUALSESSIONMODAL_6 = "w-full sm:flex-1 h-12 rounded-2xl typo-body font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all disabled:opacity-50 border border-border/40";


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
    <div className={C_MANUALSESSIONMODAL_1}>
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary shadow-sm">
            <IconShieldCheck className="w-5.5 h-5.5" />
        </div>
        <div className="space-y-1.5 flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">
                {t('frontend.auth.completeConnection', { email: email ?? t('frontend.auth.yourAccount') })}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed font-medium opacity-80">
                {t('frontend.auth.sessionKeyDescription')}
            </p>
        </div>
    </div>
);

const InstructionsSection: React.FC<{ t: (key: string) => string }> = ({ t }) => (
    <div className="space-y-4 px-1">
        <h4 className="text-sm font-bold text-primary/70 flex items-center gap-2">
            <IconAlertCircle className="w-3.5 h-3.5" />
            {t('frontend.auth.howToFindKey')}
        </h4>
        <ul className="grid grid-cols-1 gap-2.5">
            {[1, 2, 3, 4, 5].map(step => (
                <li
                    key={step}
                    className={C_MANUALSESSIONMODAL_2}
                >
                    <span className={C_MANUALSESSIONMODAL_3}>
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
            className="text-sm font-bold text-muted-foreground/70 ml-1"
        >
            {t('frontend.auth.sessionKeyLabel')}
        </label>
        <div className="relative group">
            <div className={C_MANUALSESSIONMODAL_4}>
                <IconKey className="w-4 h-4" />
            </div>
            <Input
                id="sessionKey"
                type="password"
                placeholder={t('frontend.auth.sessionKeyPlaceholder')}
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
                    className={C_MANUALSESSIONMODAL_5}
                >
                    <IconX className="w-3.5 h-3.5" />
                </Button>
            )}
        </div>
        {error && (
            <p className="text-sm text-destructive font-bold ml-1 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 px-1">
                <IconAlertCircle className="w-3.5 h-3.5" />
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
        return <IconLoader2 className="w-4.5 h-4.5 animate-spin" />;
    }
    if (success) {
        return (
            <>
                <IconCheck className="w-4.5 h-4.5" />
                {t('frontend.auth.validatedAndSaved')}
            </>
        );
    }
    return (
        <>
            <IconShieldCheck className="w-4.5 h-4.5" />
            {t('frontend.auth.saveSessionKey')}
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
                return t('frontend.auth.enterSessionKey');
            }
            if (!key.startsWith('sk-ant-sid')) {
                return t('frontend.auth.invalidSessionFormat');
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
                setError(result.error ?? t('frontend.auth.saveSessionKeyFailed'));
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
            title={t('frontend.auth.sessionKeyRequired')}
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
                        className={C_MANUALSESSIONMODAL_6}
                    >
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant={success ? 'default' : 'default'}
                        onClick={() => void handleSave()}
                        disabled={isSaving || success || !sessionKey.startsWith('sk-ant-sid')}
                        className={cn(
                            'w-full sm:flex-2 h-12 rounded-2xl typo-body font-bold flex items-center justify-center gap-3 transition-all shadow-xl',
                            success
                                ? 'bg-success hover:bg-success text-foreground shadow-emerald-500/20'
                                : 'bg-primary text-primary-foreground shadow-primary/20 hover:scale-102 active:scale-95 disabled:scale-100 disabled:opacity-40 disabled:grayscale'
                        )}
                    >
                        <SaveButtonContent isSaving={isSaving} success={success} t={t} />
                    </Button>
                </div>
            </div>
        </Modal>
    );
};


