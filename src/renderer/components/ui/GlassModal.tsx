import { X } from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface GlassModalProps {
    isOpen: boolean
    onClose: () => void
    children: React.ReactNode
    title?: string
    className?: string
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
    showClose?: boolean
    closeOnBackdrop?: boolean
    closeOnEscape?: boolean
}

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const SIZE_CLASSES: Record<ModalSize, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-screen-lg max-h-screen'
};

function useEscapeKey(isOpen: boolean, closeOnEscape: boolean, onClose: () => void): void {
    useEffect(() => {
        if (!closeOnEscape || !isOpen) { return; }

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onClose(); }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose, closeOnEscape]);
}

function useBodyScrollLock(isOpen: boolean): void {
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);
}

function useFocusTrap(isOpen: boolean, modalRef: React.RefObject<HTMLDivElement | null>): void {
    const handleTab = useCallback((e: KeyboardEvent, first: HTMLElement, last: HTMLElement) => {
        if (e.key !== 'Tab') { return; }

        if (e.shiftKey && document.activeElement === first) {
            last.focus();
            e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
            first.focus();
            e.preventDefault();
        }
    }, []);

    useEffect(() => {
        if (!isOpen) { return; }

        const focusableElements = modalRef.current?.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements?.[0] as HTMLElement | undefined;
        const lastElement = focusableElements?.[focusableElements.length - 1] as HTMLElement | undefined;

        if (!firstElement || !lastElement) { return; }

        const handler = (e: KeyboardEvent) => handleTab(e, firstElement, lastElement);

        document.addEventListener('keydown', handler);
        firstElement.focus();

        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, modalRef, handleTab]);
}

/**
 * GlassModal Component
 * 
 * A modal with glassmorphism effect background.
 * 
 * @example
 * ```tsx
 * <GlassModal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Settings">
 *   <p>Modal content here</p>
 * </GlassModal>
 * ```
 */
export const GlassModal: React.FC<GlassModalProps> = ({
    isOpen,
    onClose,
    children,
    title,
    className,
    size = 'md',
    showClose = true,
    closeOnBackdrop = true,
    closeOnEscape = true
}) => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEscapeKey(isOpen, closeOnEscape, onClose);
    useBodyScrollLock(isOpen);
    useFocusTrap(isOpen, modalRef);

    if (!isOpen) { return null; }

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
        >
            {/* Backdrop with glassmorphism */}
            <div
                className={cn(
                    'absolute inset-0 glass-dark',
                    'animate-in fade-in-0 duration-200'
                )}
                onClick={closeOnBackdrop ? onClose : undefined}
                aria-hidden="true"
            />

            {/* Modal content */}
            <div
                ref={modalRef}
                className={cn(
                    'relative w-full glass rounded-2xl shadow-2xl',
                    'animate-in fade-in-0 zoom-in-95 duration-300',
                    'border border-border/40',
                    SIZE_CLASSES[size],
                    className
                )}
            >
                {/* Header */}
                <ModalHeader title={title} showClose={showClose} onClose={onClose} />

                {/* Body */}
                <div className="p-4 overflow-y-auto max-h-screen">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};

GlassModal.displayName = 'GlassModal';

interface ModalHeaderProps {
    title?: string
    showClose: boolean
    onClose: () => void
}

const ModalHeader: React.FC<ModalHeaderProps> = ({ title, showClose, onClose }) => {
    const { t } = useTranslation();
    const showHeader = title ?? showClose;
    if (!showHeader) { return null; }

    return (
        <div className="flex items-center justify-between p-4 border-b border-border/40">
            {title && <h2 id="modal-title" className="text-lg font-semibold gradient-text">{title}</h2>}
            {showClose && (
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/60 transition-colors ripple" aria-label={t('modal.close')}>
                    <X className="w-5 h-5" />
                </button>
            )}
        </div>
    );
};
