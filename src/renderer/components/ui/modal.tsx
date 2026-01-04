
import React from 'react'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    children: React.ReactNode
    footer?: React.ReactNode
    preventClose?: boolean
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, preventClose = false }) => {
    if (!isOpen) return null

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (!preventClose && e.target === e.currentTarget) {
            onClose()
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleBackdropClick}
        >
            <div className="bg-popover border border-border sm:max-w-[425px] w-full rounded-xl shadow-lg p-6 animate-in zoom-in-95 duration-200 mx-4">
                <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-4">
                    <h3 className="font-semibold leading-none tracking-tight text-lg text-white">{title}</h3>
                </div>
                <div className="text-sm text-muted-foreground">
                    {children}
                </div>
                {footer && (
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    )
}
