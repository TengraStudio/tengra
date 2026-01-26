import { AlertTriangle, X } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

interface ConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmLabel?: string
    cancelText?: string
    variant?: 'danger' | 'warning' | 'info'
    isLoading?: boolean
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    isLoading = false
}) => {
    if (!isOpen) { return null; }

    const variantStyles = {
        danger: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20',
        warning: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20',
        info: 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
    };

    const confirmButtonStyles = {
        danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        warning: 'bg-yellow-600 text-white hover:bg-yellow-600/90',
        info: 'bg-primary text-primary-foreground hover:bg-primary/90'
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-background/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={isLoading ? undefined : onClose}
            />

            <div className="relative w-full max-w-md bg-background border border-border/50 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={cn(
                            "p-3 rounded-xl border",
                            variantStyles[variant]
                        )}>
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-foreground leading-none mb-2">
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
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={cn(
                            "px-6 py-2 text-sm font-bold rounded-lg transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:active:scale-100",
                            confirmButtonStyles[variant]
                        )}
                    >
                        {isLoading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                Processing...
                            </div>
                        ) : confirmLabel}
                    </button>
                </div>

                <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="absolute top-4 right-4 p-2 text-muted-foreground/40 hover:text-foreground transition-colors rounded-lg"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
