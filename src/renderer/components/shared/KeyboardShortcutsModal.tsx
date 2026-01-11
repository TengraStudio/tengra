import React, { useEffect, useRef } from 'react'
import { X, Keyboard } from 'lucide-react'
import { useTranslation, Language } from '@/i18n'

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

interface ShortcutItemProps {
    keys: string[]
    description: string
}

const ShortcutItem: React.FC<ShortcutItemProps> = ({ keys, description }) => (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
        <span className="text-sm text-zinc-400">{description}</span>
        <div className="flex gap-1.5">
            {keys.map((key, i) => (
                <kbd key={i} className="px-2 py-1 bg-zinc-800 border border-white/10 rounded text-[10px] font-mono text-zinc-300 min-w-[24px] text-center shadow-sm">
                    {key}
                </kbd>
            ))}
        </div>
    </div>
)

interface KeyboardShortcutsModalProps {
    isOpen: boolean
    onClose: () => void
    language?: Language
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = React.memo(({ isOpen, onClose, language = 'tr' }) => {
    const { t } = useTranslation(language)
    const modalRef = useRef<HTMLDivElement>(null)
    const closeButtonRef = useRef<HTMLButtonElement>(null)
    const previousActiveElementRef = useRef<HTMLElement | null>(null)

    useEffect(() => {
        if (!isOpen) return

        // Save the previously focused element
        previousActiveElementRef.current = document.activeElement as HTMLElement

        // Focus the close button when modal opens
        if (closeButtonRef.current) {
            setTimeout(() => closeButtonRef.current?.focus(), 50)
        }

        // Handle Escape key to close modal
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }

        // Handle Tab key to trap focus
        const handleTab = (e: KeyboardEvent) => {
            if (!modalRef.current || e.key !== 'Tab') return

            const focusableElements = getFocusableElements(modalRef.current)
            if (focusableElements.length === 0) return

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
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-modal-title"
        >
            <div 
                ref={modalRef}
                tabIndex={-1}
                className="w-[450px] bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            >
                {/* Header */}
                <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-white/5">
                    <div className="flex items-center gap-2">
                        <Keyboard className="w-5 h-5 text-purple-400" aria-hidden="true" />
                        <h2 id="shortcuts-modal-title" className="text-lg font-medium text-white">{t('shortcuts.title')}</h2>
                    </div>
                    <button 
                        ref={closeButtonRef}
                        onClick={onClose} 
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-zinc-400 hover:text-white"
                        aria-label={t('shortcuts.close')}
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                    <div>
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 px-1">{t('shortcuts.general')}</h3>
                        <div className="bg-black/20 rounded-xl px-4 border border-white/5">
                            <ShortcutItem keys={['Ctrl', 'N']} description={t('shortcuts.newChat')} />
                            <ShortcutItem keys={['Ctrl', ',']} description={t('shortcuts.openSettings')} />
                            <ShortcutItem keys={['Ctrl', 'K']} description={t('shortcuts.commandPalette')} />
                            <ShortcutItem keys={['Ctrl', 'B']} description={t('shortcuts.toggleSidebar')} />
                            <ShortcutItem keys={['?']} description={t('shortcuts.showShortcuts')} />
                            <ShortcutItem keys={['Esc']} description={t('shortcuts.close')} />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 px-1">{t('shortcuts.navigation')}</h3>
                        <div className="bg-black/20 rounded-xl px-4 border border-white/5">
                            <ShortcutItem keys={['Ctrl', '1']} description={t('shortcuts.goToChat')} />
                            <ShortcutItem keys={['Ctrl', '2']} description={t('shortcuts.goToProjects')} />
                            <ShortcutItem keys={['Ctrl', '3']} description={t('shortcuts.goToCouncil')} />
                            <ShortcutItem keys={['Ctrl', '4']} description={t('shortcuts.goToSettings')} />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 px-1">{t('shortcuts.chat')}</h3>
                        <div className="bg-black/20 rounded-xl px-4 border border-white/5">
                            <ShortcutItem keys={['Enter']} description={t('shortcuts.sendMessage')} />
                            <ShortcutItem keys={['Shift', 'Enter']} description={t('shortcuts.newLine')} />
                            <ShortcutItem keys={['Ctrl', 'L']} description={t('shortcuts.clearChat')} />
                            <ShortcutItem keys={['Ctrl', 'F']} description={t('shortcuts.searchChat')} />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-black/20 border-t border-white/5 text-center">
                    <p className="text-[10px] text-zinc-500">{t('shortcuts.footer')}</p>
                </div>
            </div>
        </div>
    )
})

KeyboardShortcutsModal.displayName = 'KeyboardShortcutsModal'
