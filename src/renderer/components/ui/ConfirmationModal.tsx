/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertTriangle, IconX } from '@tabler/icons-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/utils/accessibility';


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

    const getIconStyles = (variant: 'danger' | 'warning' | 'info') => {
        switch (variant) {
            case 'danger': return 'bg-destructive/10 text-destructive border-destructive/20';
            case 'warning': return 'bg-warning/10 text-warning border-warning/20';
            case 'info': return 'bg-primary/10 text-primary border-primary/20';
        }
    };

    const getButtonStyles = (variant: 'danger' | 'warning' | 'info') => {
        switch (variant) {
            case 'danger': return 'bg-destructive text-destructive-foreground hover:bg-destructive/90';
            case 'warning': return 'bg-warning text-warning-foreground hover:bg-warning/90';
            case 'info': return 'bg-primary text-primary-foreground hover:bg-primary/90';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-background/60 backdrop-blur-4 animate-in fade-in duration-200"
                onClick={isLoading ? undefined : onClose}
            />

            <div
                ref={focusTrapRef as React.RefObject<HTMLDivElement>}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirmation-modal-title"
                className="relative w-full max-w-112 bg-background border border-border/50 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            >
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={cn("p-3 rounded-xl border", getIconStyles(variant))}>
                            <IconAlertTriangle className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h3 id="confirmation-modal-title" className="text-xl font-bold text-foreground leading-none mb-2">
                                {title}
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {message}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-4 bg-muted/30 border-t border-border/50">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground bg-transparent border-none rounded-lg cursor-pointer transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {resolvedCancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={cn(
                            "px-6 py-2 text-sm font-bold border-none rounded-lg shadow-sm cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
                            getButtonStyles(variant)
                        )}
                    >
                        {isLoading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
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
                    className="absolute top-4 right-4 p-2 text-muted-foreground/40 bg-transparent border-none rounded-lg cursor-pointer transition-colors hover:text-foreground disabled:cursor-not-allowed"
                >
                    <IconX className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

