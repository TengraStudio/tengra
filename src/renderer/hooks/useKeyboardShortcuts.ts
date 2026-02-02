/**
 * Keyboard Shortcuts Hook
 * Centralizes keyboard shortcut handling
 */

import { useEffect } from 'react';

import { AppView } from './useAppState';

export interface KeyboardShortcutsConfig {
    onCommandPalette: () => void
    onNewChat: () => void
    onOpenSettings: () => void
    onShowShortcuts: () => void
    onClearChat: () => void
    onSwitchView: (view: AppView) => void
    onToggleSidebar: () => void
    onCloseModals: () => void
    showCommandPalette: boolean
    showShortcuts: boolean
    showSSHManager: boolean
    currentChatId: string | null
}

interface ShortcutHandler {
    key: string
    modKey?: boolean
    handler: () => void
    requiresChatId?: boolean
}

function isInputElement(target: HTMLElement): boolean {
    return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

function handleViewShortcuts(e: KeyboardEvent, onSwitchView: (view: AppView) => void): boolean {
    const viewMap: Record<string, AppView> = { '1': 'chat', '2': 'projects', '4': 'settings' };
    if (!(e.key in viewMap)) {
        return false;
    }
    e.preventDefault();
    onSwitchView(viewMap[e.key]);
    return true;
}

function handleStandardShortcuts(e: KeyboardEvent, shortcuts: ShortcutHandler[], modKey: boolean, currentChatId: string | null): boolean {
    for (const shortcut of shortcuts) {
        const modMatch = shortcut.modKey ? modKey : (!e.ctrlKey && !e.metaKey);
        if (e.key === shortcut.key && modMatch && !e.shiftKey && !e.altKey) {
            if (shortcut.requiresChatId && !currentChatId) {
                continue;
            }
            e.preventDefault();
            shortcut.handler();
            return true;
        }
    }
    return false;
}

function handleEscape(e: KeyboardEvent, state: { showCommandPalette: boolean; showShortcuts: boolean; showSSHManager: boolean }, onCloseModals: () => void) {
    if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (state.showCommandPalette || state.showShortcuts || state.showSSHManager) {
            e.preventDefault();
            onCloseModals();
        }
    }
}

function handleInputKeys(e: KeyboardEvent, onShowShortcuts: () => void): boolean {
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        onShowShortcuts();
        return true;
    }
    return false;
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
    } = config;

    useEffect(() => {
        const shortcuts: ShortcutHandler[] = [
            { key: 'k', modKey: true, handler: onCommandPalette },
            { key: 'n', modKey: true, handler: onNewChat },
            { key: ',', modKey: true, handler: onOpenSettings },
            { key: 'l', modKey: true, handler: onClearChat, requiresChatId: true },
            { key: 'b', modKey: true, handler: onToggleSidebar },
            { key: '?', handler: onShowShortcuts },
        ];


        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;

            // 1. Handle Input Elements
            if (isInputElement(target)) {
                handleInputKeys(e, onShowShortcuts);
                return;
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modKey = isMac ? e.metaKey : e.ctrlKey;

            // 2. Handle View Switching
            if (modKey && !e.shiftKey && !e.altKey && handleViewShortcuts(e, onSwitchView)) {
                return;
            }

            // 3. Handle Standard Shortcuts
            if (handleStandardShortcuts(e, shortcuts, modKey, currentChatId)) {
                return;
            }

            // 4. Handle Escape
            handleEscape(e, { showCommandPalette, showShortcuts, showSSHManager }, onCloseModals);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
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
    ]);
}
