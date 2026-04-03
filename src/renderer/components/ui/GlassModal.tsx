import { X } from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import './glass-modal.css';

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
 * <GlassModal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t('settings.title')}>
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
            className="tengra-glass-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
        >
            {/* Backdrop with glassmorphism */}
            <div
                className="tengra-glass-modal__overlay"
                onClick={closeOnBackdrop ? onClose : undefined}
                aria-hidden="true"
            />

            {/* Modal content */}
            <div
                ref={modalRef}
                className={cn(
                    'tengra-glass-modal__content',
                    `tengra-glass-modal__content--${size}`,
                    className
                )}
            >
                {/* Header */}
                <ModalHeader title={title} showClose={showClose} onClose={onClose} />

                {/* Body */}
                <div className="tengra-glass-modal__body">
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
        <div className="tengra-glass-modal__header">
            {title && <h2 id="modal-title" className="tengra-glass-modal__title">{title}</h2>}
            {showClose && (
                <button onClick={onClose} className="tengra-glass-modal__close" aria-label={t('modal.close')}>
                    <X className="tengra-glass-modal__close-icon" />
                </button>
            )}
        </div>
    );
};
