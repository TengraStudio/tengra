import { useFocusTrap } from '@renderer/utils/accessibility';
import { AlertTriangle, X } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

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

    const variantStyles = {
        danger: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20',
        warning: 'bg-yellow/10 text-warning border-yellow/20 hover:bg-yellow/20',
        info: 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20',
    };

    const confirmButtonStyles = {
        danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        warning: 'bg-warning text-warning-foreground hover:bg-warning/90',
        info: 'bg-primary text-primary-foreground hover:bg-primary/90',
    };
    const resolvedConfirmLabel = confirmLabel ?? t('common.confirm');
    const resolvedCancelText = cancelText ?? t('common.cancel');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-background/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={isLoading ? undefined : onClose}
            />

            <div
                ref={focusTrapRef as React.RefObject<HTMLDivElement>}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirmation-modal-title"
                className="relative w-full max-w-md bg-background border border-border/50 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            >
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={cn('p-3 rounded-xl border', variantStyles[variant])}>
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h3 id="confirmation-modal-title" className="text-xl font-bold text-foreground leading-none mb-2">
                                {title}
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                {message}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-4 bg-muted/30 border-t border-border/50">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {resolvedCancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={cn(
                            'px-6 py-2 text-sm font-bold rounded-lg transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:active:scale-100',
                            confirmButtonStyles[variant]
                        )}
                    >
                        {isLoading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
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
                    className="absolute top-4 right-4 p-2 text-muted-foreground/40 hover:text-foreground transition-colors rounded-lg"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
