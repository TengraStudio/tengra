import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

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
    const modalRef = useRef<HTMLDivElement>(null)

    // Handle escape key
    useEffect(() => {
        if (!closeOnEscape || !isOpen) return

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }

        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [isOpen, onClose, closeOnEscape])

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen])

    // Focus trap
    useEffect(() => {
        if (!isOpen) return

        const focusableElements = modalRef.current?.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const firstElement = focusableElements?.[0] as HTMLElement
        const lastElement = focusableElements?.[focusableElements.length - 1] as HTMLElement

        const handleTab = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    lastElement?.focus()
                    e.preventDefault()
                }
            } else {
                if (document.activeElement === lastElement) {
                    firstElement?.focus()
                    e.preventDefault()
                }
            }
        }

        document.addEventListener('keydown', handleTab)
        firstElement?.focus()

        return () => document.removeEventListener('keydown', handleTab)
    }, [isOpen])

    if (!isOpen) return null

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        full: 'max-w-[90vw] max-h-[90vh]'
    }

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
                    'border border-white/10',
                    sizeClasses[size],
                    className
                )}
            >
                {/* Header */}
                {(title || showClose) && (
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        {title && (
                            <h2 id="modal-title" className="text-lg font-semibold gradient-text">
                                {title}
                            </h2>
                        )}
                        {showClose && (
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-white/10 transition-colors ripple"
                                aria-label="Close modal"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                )}

                {/* Body */}
                <div className="p-4 overflow-y-auto max-h-[70vh]">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    )
}

GlassModal.displayName = 'GlassModal'
