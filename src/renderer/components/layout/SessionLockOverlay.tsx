/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Lock } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { useTranslation } from '@/i18n';


interface SessionLockOverlayProps {
    isOpen: boolean;
    lockedAt?: number;
    canUseBiometric: boolean;
    onUnlock: () => void;
}

export function SessionLockOverlay({
    isOpen,
    lockedAt,
    canUseBiometric,
    onUnlock,
}: SessionLockOverlayProps) {
    const { t } = useTranslation();
    const unlockButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        unlockButtonRef.current?.focus();
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onUnlock();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onUnlock]);

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={t('session.lockedTitle')}
        >
            <div className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-2xl">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Lock className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold">{t('session.lockedTitle')}</h2>
                        <p className="typo-caption text-muted-foreground">
                            {t('session.lockedAt', {
                                time: lockedAt ? new Date(lockedAt).toLocaleTimeString() : '-'
                            })}
                        </p>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground">
                    {t('session.lockedDescription')}
                </p>
                <div className="flex gap-2">
                    <button
                        ref={unlockButtonRef}
                        type="button"
                        className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                        onClick={onUnlock}
                    >
                        {t('session.unlock')}
                    </button>
                    {canUseBiometric && (
                        <button
                            type="button"
                            className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                            onClick={onUnlock}
                        >
                            {t('session.unlockBiometric')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
