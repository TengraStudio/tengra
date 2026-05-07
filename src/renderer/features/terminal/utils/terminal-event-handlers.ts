/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { RefObject } from 'react';

import {
    isTypingElement,
    keyboardEventToShortcut,
    normalizeShortcutBinding,
    type TerminalShortcutAction,
    type TerminalShortcutBindings,
} from './shortcut-config';

interface TerminalShortcutEventHandlerParams {
    isOpen: boolean;
    isSearchOpen: boolean;
    shortcutBindings: TerminalShortcutBindings;
    activeTabIdRef: RefObject<string | null>;
    hideTerminalPanel: () => void;
    createDefaultTerminal: () => void | Promise<void>;
    closeTab: (tabId: string) => void;
    closeTerminalSearch: () => void;
    openTerminalSearch: () => void;
    handleSplitTerminal: () => void;
    handleDetachTerminal: () => void | Promise<void>;
}

export function createTerminalShortcutEventHandler({
    isOpen,
    isSearchOpen,
    shortcutBindings,
    activeTabIdRef,
    hideTerminalPanel,
    createDefaultTerminal,
    closeTab,
    closeTerminalSearch,
    openTerminalSearch,
    handleSplitTerminal,
    handleDetachTerminal,
}: TerminalShortcutEventHandlerParams) {
    return (event: KeyboardEvent) => {
        if (!isOpen || isTypingElement(event.target)) {
            return;
        }

        const pressed = keyboardEventToShortcut(event);
        const matchedAction = (Object.entries(shortcutBindings) as Array<[TerminalShortcutAction, string]>)
            .find(([, binding]) => normalizeShortcutBinding(binding) === pressed)?.[0];
        if (!matchedAction) {
            return;
        }

        event.preventDefault();
        switch (matchedAction) {
            case 'togglePanel':
                hideTerminalPanel();
                break;
            case 'newTerminal':
                void createDefaultTerminal();
                break;
            case 'closeTab': {
                const activeId = activeTabIdRef.current;
                if (activeId) {
                    closeTab(activeId);
                }
                break;
            }
            case 'search':
                if (isSearchOpen) {
                    closeTerminalSearch();
                } else {
                    openTerminalSearch();
                }
                break;
            case 'split':
                handleSplitTerminal();
                break;
            case 'detach':
                void handleDetachTerminal();
                break;
            default:
                break;
        }
    };
}

