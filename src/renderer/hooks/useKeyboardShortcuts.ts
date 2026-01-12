/**
 * Keyboard Shortcuts Hook
 * Centralizes keyboard shortcut handling
 */

import { useEffect } from 'react'

export interface KeyboardShortcutsConfig {
    onCommandPalette: () => void
    onNewChat: () => void
    onOpenSettings: () => void
    onShowShortcuts: () => void
    onClearChat: () => void
    onSwitchView: (view: 'chat' | 'projects' | 'council' | 'settings') => void
    onToggleSidebar: () => void
    onCloseModals: () => void
    showCommandPalette: boolean
    showShortcuts: boolean
    showSSHManager: boolean
    currentChatId: string | null
}

/**
 * Hook for managing global keyboard shortcuts
 */
export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
    const {
        onCommandPalette,
        onNewChat,
        onOpenSettings,
        onShowShortcuts,
        onClearChat,
        onSwitchView,
        onToggleSidebar,
        onCloseModals,
        showCommandPalette,
        showShortcuts,
        showSSHManager,
        currentChatId
    } = config

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable elements
            const target = e.target as HTMLElement
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                // Allow some shortcuts even in inputs
                if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                    e.preventDefault()
                    onShowShortcuts()
                }
                return
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
            const modKey = isMac ? e.metaKey : e.ctrlKey

            // Ctrl/Cmd + K: Command Palette
            if (modKey && e.key === 'k' && !e.shiftKey && !e.altKey) {
                e.preventDefault()
                onCommandPalette()
                return
            }

            // Ctrl/Cmd + N: New Chat
            if (modKey && e.key === 'n' && !e.shiftKey && !e.altKey) {
                e.preventDefault()
                onNewChat()
                return
            }

            // Ctrl/Cmd + ,: Open Settings
            if (modKey && e.key === ',' && !e.shiftKey && !e.altKey) {
                e.preventDefault()
                onOpenSettings()
                return
            }

            // ?: Show Keyboard Shortcuts
            if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                e.preventDefault()
                onShowShortcuts()
                return
            }

            // Ctrl/Cmd + L: Clear current chat
            if (modKey && e.key === 'l' && !e.shiftKey && !e.altKey) {
                e.preventDefault()
                if (currentChatId) {
                    onClearChat()
                }
                return
            }

            // Ctrl/Cmd + 1-4: Switch views
            if (modKey && !e.shiftKey && !e.altKey) {
                if (e.key === '1') {
                    e.preventDefault()
                    onSwitchView('chat')
                    return
                }
                if (e.key === '2') {
                    e.preventDefault()
                    onSwitchView('projects')
                    return
                }
                if (e.key === '3') {
                    e.preventDefault()
                    onSwitchView('council')
                    return
                }
                if (e.key === '4') {
                    e.preventDefault()
                    onSwitchView('settings')
                    return
                }
            }

            // Ctrl/Cmd + B: Toggle Sidebar
            if (modKey && e.key === 'b' && !e.shiftKey && !e.altKey) {
                e.preventDefault()
                onToggleSidebar()
                return
            }

            // Escape: Close modals
            if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                if (showCommandPalette || showShortcuts || showSSHManager) {
                    e.preventDefault()
                    onCloseModals()
                    return
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [
        onCommandPalette,
        onNewChat,
        onOpenSettings,
        onShowShortcuts,
        onClearChat,
        onSwitchView,
        onToggleSidebar,
        onCloseModals,
        showCommandPalette,
        showShortcuts,
        showSSHManager,
        currentChatId
    ])
}
