/**
 * App State Management Hook
 * Centralizes UI state management for the App component
 */

import { useRef,useState } from 'react'

import { Toast } from '@/types'
// SettingsCategory type is used by dependent modules via AppState interface

export type AppView = 'chat' | 'projects' | 'council' | 'settings' | 'mcp'

export interface AppState {
    // View state
    currentView: AppView
    setCurrentView: (view: AppView) => void

    // UI state
    isSidebarCollapsed: boolean
    setIsSidebarCollapsed: (collapsed: boolean) => void
    isDragging: boolean
    setIsDragging: (dragging: boolean) => void

    // Modal state
    showCommandPalette: boolean
    setShowCommandPalette: (show: boolean) => void
    showSSHManager: boolean
    setShowSSHManager: (show: boolean) => void
    showShortcuts: boolean
    setShowShortcuts: (show: boolean) => void
    showFileMenu: boolean
    setShowFileMenu: (show: boolean) => void
    showScrollButton: boolean
    setShowScrollButton: (show: boolean) => void
    isAudioOverlayOpen: boolean
    setIsAudioOverlayOpen: (open: boolean) => void

    // Toast notifications
    toasts: Toast[]
    addToast: (toast: Omit<Toast, 'id'>) => void
    removeToast: (id: string) => void

    // Refs
    fileInputRef: React.RefObject<HTMLInputElement>
    textareaRef: React.RefObject<HTMLTextAreaElement>
    messagesEndRef: React.RefObject<HTMLDivElement>
}

/**
 * Centralized app state management hook
 */
export function useAppState(): AppState {
    // View state
    const [currentView, setCurrentView] = useState<AppView>('chat')

    // UI state
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

    // Modal state
    const [showCommandPalette, setShowCommandPalette] = useState(false)
    const [showSSHManager, setShowSSHManager] = useState(false)
    const [showShortcuts, setShowShortcuts] = useState(false)
    const [showFileMenu, setShowFileMenu] = useState(false)
    const [showScrollButton, setShowScrollButton] = useState(false)
    const [isAudioOverlayOpen, setIsAudioOverlayOpen] = useState(false)

    // Toast notifications
    const [toasts, setToasts] = useState<Toast[]>([])

    const addToast = (toast: Omit<Toast, 'id'>) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        setToasts(prev => [...prev, { ...toast, id }])
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 5000)
    }

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    return {
        currentView,
        setCurrentView,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        isDragging,
        setIsDragging,
        showCommandPalette,
        setShowCommandPalette,
        showSSHManager,
        setShowSSHManager,
        showShortcuts,
        setShowShortcuts,
        showFileMenu,
        setShowFileMenu,
        showScrollButton,
        setShowScrollButton,
        isAudioOverlayOpen,
        setIsAudioOverlayOpen,
        toasts,
        addToast,
        removeToast,
        fileInputRef,
        textareaRef,
        messagesEndRef
    }
}
