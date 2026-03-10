/**
 * App State Management Hook
 * Centralizes UI state management for the App component
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
    dismissNotification,
    pushNotification,
    toActiveToasts,
    useNotificationCenterStore,
} from '@/store/notification-center.store';
import { setAppShellState, useUiLayoutStore } from '@/store/ui-layout.store';
import { Toast } from '@/types';
// SettingsCategory type is used by dependent modules via AppState interface

export type AppView = 'chat' | 'workspace' | 'settings' | 'mcp' | 'memory' | 'ideas' | 'automation-workflow' | 'docker' | 'terminal' | 'models'

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
    const [currentView, setCurrentView] = useState<AppView>('chat');

    // UI state
    const persistedSidebarCollapsed = useUiLayoutStore(snapshot => snapshot.appShell.sidebarCollapsed);
    const [isSidebarCollapsed, setIsSidebarCollapsedState] = useState(persistedSidebarCollapsed);
    const [isDragging, setIsDragging] = useState(false);

    // Modal state
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [showSSHManager, setShowSSHManager] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [showFileMenu, setShowFileMenu] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [isAudioOverlayOpen, setIsAudioOverlayOpen] = useState(false);

    useEffect(() => {
        setIsSidebarCollapsedState(persistedSidebarCollapsed);
    }, [persistedSidebarCollapsed]);

    const setIsSidebarCollapsed = useCallback((collapsed: boolean) => {
        if (collapsed === isSidebarCollapsed) {
            return;
        }
        setIsSidebarCollapsedState(collapsed);
        setAppShellState({ sidebarCollapsed: collapsed });
    }, [isSidebarCollapsed]);

    // Toast notifications (shared notification center)
    const activeNotifications = useNotificationCenterStore(snapshot => snapshot.active);
    const toasts = useMemo(() => toActiveToasts(activeNotifications), [activeNotifications]);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        pushNotification({
            type: toast.type,
            message: toast.message,
            source: 'app',
        });
    }, []);

    const removeToast = useCallback((id: string) => {
        dismissNotification(id);
    }, []);

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    return useMemo(() => ({
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
    }), [
        currentView,
        isSidebarCollapsed,
        isDragging,
        showCommandPalette,
        showSSHManager,
        showShortcuts,
        showFileMenu,
        showScrollButton,
        isAudioOverlayOpen,
        toasts,
        addToast,
        removeToast,
        setIsSidebarCollapsed,
        setCurrentView,
        setIsDragging,
        setShowCommandPalette,
        setShowSSHManager,
        setShowShortcuts,
        setShowFileMenu,
        setShowScrollButton,
        setIsAudioOverlayOpen
    ]);
}
