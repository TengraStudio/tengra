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
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-6"
            role="dialog"
            aria-modal="true"
            aria-label={t('session.lockedTitle')}
        >
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4 shadow-2xl">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <Lock className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold">{t('session.lockedTitle')}</h2>
                        <p className="text-xs text-muted-foreground">
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
                        className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
                        onClick={onUnlock}
                    >
                        {t('session.unlock')}
                    </button>
                    {canUseBiometric && (
                        <button
                            type="button"
                            className="px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40"
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
