import { Lock } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { useTranslation } from '@/i18n';

import './session-lock-overlay.css';

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
            className="tengra-session-lock"
            role="dialog"
            aria-modal="true"
            aria-label={t('session.lockedTitle')}
        >
            <div className="tengra-session-lock__card">
                <div className="tengra-session-lock__header">
                    <div className="tengra-session-lock__icon-wrap">
                        <Lock className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="tengra-session-lock__title">{t('session.lockedTitle')}</h2>
                        <p className="tengra-session-lock__subtext text-xs">
                            {t('session.lockedAt', {
                                time: lockedAt ? new Date(lockedAt).toLocaleTimeString() : '-'
                            })}
                        </p>
                    </div>
                </div>
                <p className="tengra-session-lock__description text-sm">
                    {t('session.lockedDescription')}
                </p>
                <div className="tengra-session-lock__actions">
                    <button
                        ref={unlockButtonRef}
                        type="button"
                        className="tengra-session-lock__btn tengra-session-lock__btn--primary"
                        onClick={onUnlock}
                    >
                        {t('session.unlock')}
                    </button>
                    {canUseBiometric && (
                        <button
                            type="button"
                            className="tengra-session-lock__btn tengra-session-lock__btn--secondary"
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
