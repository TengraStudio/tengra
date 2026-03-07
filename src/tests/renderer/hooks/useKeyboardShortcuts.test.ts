import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { KeyboardShortcutsConfig } from '@/hooks/useKeyboardShortcuts';

vi.mock('@/hooks/shortcutBindings', () => {
    const DEFAULT_SHORTCUT_BINDINGS = {
        commandPalette: { key: 'k', mod: true },
        newChat: { key: 'n', mod: true },
        openSettings: { key: ',', mod: true },
        clearChat: { key: 'l', mod: true },
        toggleSidebar: { key: 'b', mod: true },
        showShortcuts: { key: '?', shift: true },
        goToChat: { key: '1', mod: true },
        goToWorkspaces: { key: '2', mod: true },
        goToSettings: { key: '4', mod: true },
    };

    return {
        loadShortcutBindings: () => DEFAULT_SHORTCUT_BINDINGS,
        matchesShortcut: (event: KeyboardEvent, binding: { key: string; mod?: boolean; shift?: boolean; alt?: boolean }, _isMac: boolean) => {
            const modPressed = event.ctrlKey || event.metaKey;
            return (
                event.key.toLowerCase() === binding.key.toLowerCase() &&
                modPressed === (binding.mod === true) &&
                event.shiftKey === (binding.shift === true) &&
                event.altKey === (binding.alt === true)
            );
        },
    };
});

import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

function createConfig(overrides?: Partial<KeyboardShortcutsConfig>): KeyboardShortcutsConfig {
    return {
        onCommandPalette: vi.fn(),
        onNewChat: vi.fn(),
        onOpenSettings: vi.fn(),
        onShowShortcuts: vi.fn(),
        onClearChat: vi.fn(),
        onSwitchView: vi.fn(),
        onToggleSidebar: vi.fn(),
        onCloseModals: vi.fn(),
        showCommandPalette: false,
        showShortcuts: false,
        showSSHManager: false,
        currentChatId: 'chat-1',
        ...overrides,
    };
}

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}): void {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
}

describe('useKeyboardShortcuts', () => {
    beforeEach(() => {
        // Mock navigator.platform for non-Mac
        Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('calls onCommandPalette on Ctrl+K', () => {
        const config = createConfig();
        renderHook(() => useKeyboardShortcuts(config));

        fireKey('k', { ctrlKey: true });
        expect(config.onCommandPalette).toHaveBeenCalledOnce();
    });

    it('calls onNewChat on Ctrl+N', () => {
        const config = createConfig();
        renderHook(() => useKeyboardShortcuts(config));

        fireKey('n', { ctrlKey: true });
        expect(config.onNewChat).toHaveBeenCalledOnce();
    });

    it('calls onToggleSidebar on Ctrl+B', () => {
        const config = createConfig();
        renderHook(() => useKeyboardShortcuts(config));

        fireKey('b', { ctrlKey: true });
        expect(config.onToggleSidebar).toHaveBeenCalledOnce();
    });

    it('calls onSwitchView with "chat" on Ctrl+1', () => {
        const config = createConfig();
        renderHook(() => useKeyboardShortcuts(config));

        fireKey('1', { ctrlKey: true });
        expect(config.onSwitchView).toHaveBeenCalledWith('chat');
    });

    it('skips clearChat when currentChatId is null', () => {
        const config = createConfig({ currentChatId: null });
        renderHook(() => useKeyboardShortcuts(config));

        fireKey('l', { ctrlKey: true });
        expect(config.onClearChat).not.toHaveBeenCalled();
    });

    it('calls onClearChat when currentChatId is set', () => {
        const config = createConfig({ currentChatId: 'chat-1' });
        renderHook(() => useKeyboardShortcuts(config));

        fireKey('l', { ctrlKey: true });
        expect(config.onClearChat).toHaveBeenCalledOnce();
    });

    it('Escape calls onCloseModals when modals are open', () => {
        const config = createConfig({ showCommandPalette: true });
        renderHook(() => useKeyboardShortcuts(config));

        fireKey('Escape');
        expect(config.onCloseModals).toHaveBeenCalledOnce();
    });

    it('Escape does nothing when no modals are open', () => {
        const config = createConfig();
        renderHook(() => useKeyboardShortcuts(config));

        fireKey('Escape');
        expect(config.onCloseModals).not.toHaveBeenCalled();
    });

    it('cleans up keydown listener on unmount', () => {
        const removeSpy = vi.spyOn(window, 'removeEventListener');
        const config = createConfig();
        const { unmount } = renderHook(() => useKeyboardShortcuts(config));

        unmount();
        expect(removeSpy).toHaveBeenCalledWith('keydown', expect.anything());
    });
});
