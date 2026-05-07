/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Keyboard Shortcuts Hook
 * Centralizes keyboard shortcut handling
 */

import { useEffect, useState } from 'react';

import {
    loadShortcutBindings,
    matchesShortcut,
    ShortcutActionId,
} from './shortcutBindings';
import { AppView } from './useAppState';

export interface KeyboardShortcutsConfig {
    onNewChat: () => void
    onOpenSettings: () => void
    onShowShortcuts: () => void
    onClearChat: () => void
    onSwitchView: (view: AppView) => void
    onToggleSidebar: () => void
    onCloseModals: () => void
    onZoomIn: () => void
    onZoomOut: () => void
    onResetZoom: () => void
    showShortcuts: boolean
    showSSHManager: boolean
    currentChatId: string | null
}

function isInputElement(target: HTMLElement): boolean {
    return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

function isZoomShortcut(event: KeyboardEvent, isMac: boolean): boolean {
    const primaryKey = isMac ? event.metaKey : event.ctrlKey;
    if (!primaryKey || event.altKey) {
        return false;
    }
    return event.key === '-' || event.key === '=' || event.key === '+' || event.key === '0';
}

function handleEscape(
    e: KeyboardEvent,
    state: { showShortcuts: boolean; showSSHManager: boolean },
    onCloseModals: () => void
) {
    if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (state.showShortcuts || state.showSSHManager) {
            e.preventDefault();
            onCloseModals();
        }
    }
}

/**
 * Hook for managing global keyboard shortcuts
 */
export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
    const {
        onNewChat,
        onOpenSettings,
        onShowShortcuts,
        onClearChat,
        onSwitchView,
        onToggleSidebar,
        onCloseModals,
        onZoomIn,
        onZoomOut,
        onResetZoom,
        showShortcuts,
        showSSHManager,
        currentChatId
    } = config;

    const [bindings, setBindings] = useState(loadShortcutBindings);

    useEffect(() => {
        const syncBindings = () => {
            setBindings(loadShortcutBindings());
        };
        window.addEventListener('storage', syncBindings);
        window.addEventListener('app:shortcuts-updated', syncBindings as EventListener);
        return () => {
            window.removeEventListener('storage', syncBindings);
            window.removeEventListener('app:shortcuts-updated', syncBindings as EventListener);
        };
    }, []);

    useEffect(() => {
        const actionHandlers: Record<ShortcutActionId, () => void> = {
            newChat: onNewChat,
            openSettings: onOpenSettings,
            clearChat: onClearChat,
            toggleSidebar: onToggleSidebar,
            showShortcuts: onShowShortcuts,
            goToChat: () => onSwitchView('chat'),
            goToWorkspaces: () => onSwitchView('workspace'),
            goToSettings: () => onSwitchView('settings'),
        };

        const orderedActions: ShortcutActionId[] = [
            'goToChat',
            'goToWorkspaces',
            'goToSettings',
            'newChat',
            'openSettings',
            'clearChat',
            'toggleSidebar',
            'showShortcuts',
        ];

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

            if (isZoomShortcut(e, isMac)) {
                e.preventDefault();
                if (e.key === '-' ) {
                    onZoomOut();
                    return;
                }
                if (e.key === '0') {
                    onResetZoom();
                    return;
                }
                onZoomIn();
                return;
            }

            if (isInputElement(target)) {
                return;
            }

            for (const actionId of orderedActions) {
                const binding = bindings[actionId];
                if (!matchesShortcut(e, binding, isMac)) {
                    continue;
                }
                if (actionId === 'clearChat' && !currentChatId) {
                    continue;
                }

                e.preventDefault();
                actionHandlers[actionId]();
                return;
            }

            handleEscape(e, { showShortcuts, showSSHManager }, onCloseModals);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [
        onNewChat,
        onOpenSettings,
        onShowShortcuts,
        onClearChat,
        onSwitchView,
        onToggleSidebar,
        onCloseModals,
        onZoomIn,
        onZoomOut,
        onResetZoom,
        showShortcuts,
        showSSHManager,
        currentChatId,
        bindings,
    ]);
}

