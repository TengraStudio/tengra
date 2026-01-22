import React, { useEffect, useRef } from 'react'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    children: React.ReactNode
    footer?: React.ReactNode
    preventClose?: boolean
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full'
    className?: string
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
    ].join(', ')

    return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors))
}

/**
 * Modal component with focus management and accessibility support.
 */
export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    preventClose = false,
    size = 'md',
    className = ''
}) => {
    const modalRef = useRef<HTMLDivElement>(null)
    const previousActiveElementRef = useRef<HTMLElement | null>(null)

    useEffect(() => {
        if (!isOpen) {
            return
        }

        // Save the previously focused element
        previousActiveElementRef.current = document.activeElement as HTMLElement

        // Focus the modal container initially
        if (modalRef.current) {
            const focusableElements = getFocusableElements(modalRef.current)
            if (focusableElements.length > 0) {
                // Focus the first focusable element
                focusableElements[0].focus()
            } else {
                // If no focusable elements, focus the modal container
                modalRef.current.focus()
            }
        }

        // Handle Escape key to close modal
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !preventClose) {
                onClose()
            }
        }

        // Handle Tab key to trap focus
        const handleTab = (e: KeyboardEvent) => {
            if (!modalRef.current || e.key !== 'Tab') { return }

            const focusableElements = getFocusableElements(modalRef.current)
            if (focusableElements.length === 0) {
                return
            }

            const firstElement = focusableElements[0]
            const lastElement = focusableElements[focusableElements.length - 1]

            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstElement) {
                    e.preventDefault()
                    lastElement.focus()
                }
            } else {
                // Tab
                if (document.activeElement === lastElement) {
                    e.preventDefault()
                    firstElement.focus()
                }
            }
        }

        // Lock body scroll when modal is open
        document.body.style.overflow = 'hidden'

        document.addEventListener('keydown', handleEscape)
        document.addEventListener('keydown', handleTab)

        return () => {
            document.body.style.overflow = ''
            document.removeEventListener('keydown', handleEscape)
            document.removeEventListener('keydown', handleTab)

            // Restore focus to the previously focused element
            if (previousActiveElementRef.current) {
                previousActiveElementRef.current.focus()
            }
        }
    }, [isOpen, preventClose, onClose])

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (!preventClose && e.target === e.currentTarget) {
            onClose()
        }
    }

    const sizeClasses = {
        sm: 'sm:max-w-sm',
        md: 'sm:max-w-md',
        lg: 'sm:max-w-lg',
        xl: 'sm:max-w-xl',
        '2xl': 'sm:max-w-2xl',
        '3xl': 'sm:max-w-3xl',
        '4xl': 'sm:max-w-4xl',
        '5xl': 'sm:max-w-5xl',
        full: 'sm:max-w-[95vw]'
    }

    if (!isOpen) { return null }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div
                ref={modalRef}
                tabIndex={-1}
                className={`bg-popover border border-border w-full rounded-2xl shadow-2xl p-8 animate-in zoom-in-95 duration-300 mx-4 flex flex-col max-h-[90vh] ${sizeClasses[size]} ${className}`}
            >
                <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-6 shrink-0">
                    <h3 id="modal-title" className="font-black leading-none tracking-tight text-2xl text-white uppercase">{title}</h3>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 pr-2">
                    {children}
                </div>
                {footer && (
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-8 shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    )
}
