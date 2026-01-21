import React from 'react'

import { Button } from '@/components/ui/button'
import { GlassModal } from '@/components/ui/GlassModal'

interface ConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    isDestructive?: boolean
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    isDestructive = false
}) => {
    return (
        <GlassModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
        >
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    {message}
                </p>
                <div className="flex justify-end gap-2 pt-2">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        size="sm"
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={isDestructive ? 'destructive' : 'default'}
                        onClick={() => {
                            onConfirm()
                            onClose()
                        }}
                        size="sm"
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </GlassModal>
    )
}
