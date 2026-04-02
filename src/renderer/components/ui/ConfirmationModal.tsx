import { useFocusTrap } from '@renderer/utils/accessibility';
import { AlertTriangle, X } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import './confirmation-modal.css';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel,
    cancelText,
    variant = 'danger',
    isLoading = false,
}) => {
    const { t } = useTranslation();
    const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

    if (!isOpen) {
        return null;
    }

    const resolvedConfirmLabel = confirmLabel ?? t('common.confirm');
    const resolvedCancelText = cancelText ?? t('common.cancel');

    return (
        <div className={cn('tengra-confirmation-modal', `tengra-confirmation-modal--${variant}`)}>
            <div
                className="tengra-confirmation-modal__overlay"
                onClick={isLoading ? undefined : onClose}
            />

            <div
                ref={focusTrapRef as React.RefObject<HTMLDivElement>}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirmation-modal-title"
                className="tengra-confirmation-modal__container"
            >
                <div className="tengra-confirmation-modal__content">
                    <div className="tengra-confirmation-modal__body">
                        <div className="tengra-confirmation-modal__icon">
                            <AlertTriangle className="tengra-confirmation-modal__icon-svg" />
                        </div>
                        <div className="tengra-confirmation-modal__text">
                            <h3 id="confirmation-modal-title" className="tengra-confirmation-modal__title">
                                {title}
                            </h3>
                            <p className="tengra-confirmation-modal__message">
                                {message}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="tengra-confirmation-modal__footer">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="tengra-confirmation-modal__cancel"
                    >
                        {resolvedCancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="tengra-confirmation-modal__confirm"
                    >
                        {isLoading ? (
                            <div className="tengra-confirmation-modal__loading">
                                <div className="tengra-confirmation-modal__spinner" />
                                {t('common.processing')}
                            </div>
                        ) : (
                            resolvedConfirmLabel
                        )}
                    </button>
                </div>

                <button
                    onClick={onClose}
                    disabled={isLoading}
                    aria-label={t('common.close')}
                    className="tengra-confirmation-modal__close"
                >
                    <X className="tengra-confirmation-modal__close-icon" />
                </button>
            </div>
        </div>
    );
};
