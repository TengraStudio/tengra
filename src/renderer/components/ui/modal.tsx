
import React from 'react'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    children: React.ReactNode
    footer?: React.ReactNode
    preventClose?: boolean
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full'
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    preventClose = false,
    size = 'md'
}) => {
    if (!isOpen) return null

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

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={handleBackdropClick}
        >
            <div className={`bg-popover border border-border w-full rounded-2xl shadow-2xl p-8 animate-in zoom-in-95 duration-300 mx-4 flex flex-col max-h-[90vh] ${sizeClasses[size]}`}>
                <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-6 shrink-0">
                    <h3 className="font-black leading-none tracking-tight text-2xl text-white uppercase">{title}</h3>
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

