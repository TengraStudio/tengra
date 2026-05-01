/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconX } from '@tabler/icons-react';
import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';


interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: React.ReactNode
    footer?: React.ReactNode
    preventClose?: boolean
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full'
    className?: string
    width?: 'auto' | number | string
    height?: 'auto' | number | string
}

/**
 * Get all focusable elements within a container.
 */
const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
    const focusableSelectors = [
        'button:not([disabled])',
        'a[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
};

/**
 * Modal component with focus management and accessibility support.
 */
const ModalBase: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    preventClose = false,
    size = 'md',
    className = '',
    width,
    height,
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const previousActiveElementRef = useRef<HTMLElement | null>(null);
    const titleId = useId();
    const descriptionId = useId();
    const { t } = useTranslation();

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        // Save the previously focused element
        previousActiveElementRef.current = document.activeElement as HTMLElement;

        // Focus the modal container initially
        if (modalRef.current) {
            const focusableElements = getFocusableElements(modalRef.current);
            if (focusableElements.length > 0) {
                // Focus the first focusable element
                focusableElements[0].focus();
            } else {
                // If no focusable elements, focus the modal container
                modalRef.current.focus();
            }
        }

        // Handle Escape key to close modal
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !preventClose) {
                onClose();
            }
        };

        // Handle Tab key to trap focus
        const handleTab = (e: KeyboardEvent) => {
            if (!modalRef.current || e.key !== 'Tab') { return; }

            const focusableElements = getFocusableElements(modalRef.current);
            if (focusableElements.length === 0) {
                return;
            }

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        // Lock body scroll when modal is open
        document.body.style.overflow = 'hidden';

        document.addEventListener('keydown', handleEscape);
        document.addEventListener('keydown', handleTab);

        return () => {
            document.body.style.overflow = '';
            document.removeEventListener('keydown', handleEscape);
            document.removeEventListener('keydown', handleTab);

            // Restore focus to the previously focused element
            if (previousActiveElementRef.current) {
                previousActiveElementRef.current.focus();
            }
        };
    }, [isOpen, preventClose, onClose]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (!preventClose && e.target === e.currentTarget) {
            onClose();
        }
    };

    const normalizeDimension = (
        value: 'auto' | number | string | undefined,
        axis: 'width' | 'height'
    ): string | undefined => {
        if (value === undefined) {
            return undefined;
        }
        if (typeof value === 'number') {
            return `${value}px`;
        }
        if (value === 'auto') {
            // Responsive auto-sizing based on viewport dimensions
            return axis === 'width' ? 'min(92vw, 1040px)' : 'min(86vh, 820px)';
        }
        return value;
    };

    const computedWidth = normalizeDimension(width, 'width');
    const computedHeight = normalizeDimension(height, 'height');

    if (!isOpen) { return null; }

    const modalContent = (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
        >
            <div
                ref={modalRef}
                tabIndex={-1}
                role="document"
                style={{
                    width: computedWidth,
                    height: computedHeight,
                }}
                className={cn(
                    "relative flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card shadow-2xl animate-in zoom-in-95 duration-200",
                    {
                        'max-w-sm': size === 'sm',
                        'max-w-md': size === 'md',
                        'max-w-lg': size === 'lg',
                        'max-w-xl': size === 'xl',
                        'max-w-2xl': size === '2xl',
                        'max-w-3xl': size === '3xl',
                        'max-w-4xl': size === '4xl',
                        'max-w-5xl': size === '5xl',
                        'max-w-95vw': size === 'full',
                    },
                    className
                )}
            >
                <div className="flex items-center justify-between p-6 border-b border-border/50 bg-muted/30 backdrop-blur-md">
                    {title && <h3 id={titleId} className="text-xl font-bold text-foreground">{title}</h3>}
                    {!preventClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all active:scale-95"
                            aria-label={t('frontend.aria.closeModal')}
                        >
                            <IconX className="w-5 h-5" aria-hidden="true" />
                        </button>
                    )}
                </div>
                <p id={descriptionId} className="sr-only">
                    {t('frontend.modal.contentForTitle', { title: title ?? '' })}
                </p>
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    {children}
                </div>
                {footer && (
                    <div className="flex items-center justify-end gap-3 p-6 border-t border-border/10 bg-muted/5">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export const Modal = React.memo(ModalBase);
Modal.displayName = 'Modal';
