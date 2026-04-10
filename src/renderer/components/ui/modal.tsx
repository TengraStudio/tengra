import { X } from 'lucide-react';
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
            className="tengra-modal-overlay animate-in fade-in duration-300"
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
                className={cn("tengra-modal", `tengra-modal--${size}`, className)}
            >
                <div className="tengra-modal__header">
                    {!preventClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="tengra-modal__close"
                            aria-label={t('aria.closeModal')}
                        >
                            <X aria-hidden="true" />
                        </button>
                    )}
                    {title && <h3 id={titleId} className="tengra-modal__title">{title}</h3>}
                </div>
                <p id={descriptionId} className="tengra-modal__sr-description">
                    {t('modal.contentForTitle', { title: title ?? '' })}
                </p>
                <div className="tengra-modal__content">
                    {children}
                </div>
                {footer && (
                    <div className="tengra-modal__footer">
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
