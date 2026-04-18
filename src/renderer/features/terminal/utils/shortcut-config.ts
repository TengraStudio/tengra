/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export type TerminalShortcutPresetId = 'default' | 'vim' | 'emacs';

export type TerminalShortcutAction =
    | 'togglePanel'
    | 'newTerminal'
    | 'closeTab'
    | 'search'
    | 'split'
    | 'detach';

export type TerminalShortcutBindings = Record<TerminalShortcutAction, string>;

export const TERMINAL_SHORTCUT_PRESETS: Record<TerminalShortcutPresetId, TerminalShortcutBindings> =
    {
        default: {
            togglePanel: 'Ctrl+Backquote',
            newTerminal: 'Ctrl+Shift+Backquote',
            closeTab: 'Ctrl+W',
            search: 'Ctrl+F',
            split: 'Ctrl+\\',
            detach: 'Ctrl+Shift+D',
        },
        vim: {
            togglePanel: 'Ctrl+Backquote',
            newTerminal: 'Ctrl+Shift+Backquote',
            closeTab: 'Ctrl+W',
            search: 'Ctrl+/',
            split: 'Ctrl+\\',
            detach: 'Ctrl+Shift+D',
        },
        emacs: {
            togglePanel: 'Ctrl+Backquote',
            newTerminal: 'Ctrl+Shift+T',
            closeTab: 'Ctrl+W',
            search: 'Ctrl+S',
            split: 'Ctrl+\\',
            detach: 'Ctrl+Shift+D',
        },
    };

const TERMINAL_SHORTCUT_ACTIONS: TerminalShortcutAction[] = [
    'togglePanel',
    'newTerminal',
    'closeTab',
    'search',
    'split',
    'detach',
];

function isTerminalShortcutAction(value: string): value is TerminalShortcutAction {
    return TERMINAL_SHORTCUT_ACTIONS.includes(value as TerminalShortcutAction);
}

function encodeShortcutPayload(raw: string): string {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
        const utf8 = encodeURIComponent(raw).replace(
            /%([0-9A-F]{2})/g,
            (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16))
        );
        return window.btoa(utf8);
    }
    return raw;
}

function decodeShortcutPayload(raw: string): string {
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
        const binary = window.atob(raw);
        const encoded = Array.from(binary)
            .map(char => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
            .join('');
        return decodeURIComponent(encoded);
    }
    return raw;
}

export function normalizeShortcutBinding(binding: string): string {
    return binding
        .trim()
        .replace(/\s+/g, '')
        .toUpperCase()
        .replace('`', 'BACKQUOTE')
        .replace('\\', 'BACKSLASH')
        .replace('/', 'SLASH');
}

export function keyboardEventToShortcut(event: KeyboardEvent): string {
    const parts: string[] = [];
    if (event.ctrlKey || event.metaKey) {
        parts.push('CTRL');
    }
    if (event.altKey) {
        parts.push('ALT');
    }
    if (event.shiftKey) {
        parts.push('SHIFT');
    }

    let key = event.code || event.key;
    if (key.startsWith('Key')) {
        key = key.slice(3);
    } else if (key.startsWith('Digit')) {
        key = key.slice(5);
    }

    const keyMap: Record<string, string> = {
        Backquote: 'BACKQUOTE',
        Backslash: 'BACKSLASH',
        Slash: 'SLASH',
        Escape: 'ESC',
    };

    const normalizedKey = keyMap[key] ?? key.toUpperCase();
    parts.push(normalizedKey);
    return parts.join('+');
}

export function isTypingElement(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    const tagName = target.tagName.toLowerCase();
    const contentEditableAttr = target.getAttribute('contenteditable');
    const isContentEditableAttr =
        contentEditableAttr === '' || contentEditableAttr?.toLowerCase() === 'true';
    return (
        tagName === 'input' ||
        tagName === 'textarea' ||
        target.isContentEditable ||
        isContentEditableAttr ||
        target.getAttribute('role') === 'textbox'
    );
}

export function sanitizeShortcutBindings(raw: RendererDataValue): Partial<TerminalShortcutBindings> {
    if (!raw || typeof raw !== 'object') {
        return {};
    }
    const candidate = raw as Record<string, RendererDataValue>;
    const sanitized: Partial<TerminalShortcutBindings> = {};
    Object.entries(candidate).forEach(([key, value]) => {
        if (!isTerminalShortcutAction(key) || typeof value !== 'string') {
            return;
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return;
        }
        sanitized[key] = trimmed;
    });
    return sanitized;
}

export function parseShortcutStorage(raw: string | null): {
    preset: TerminalShortcutPresetId | null;
    bindings: Partial<TerminalShortcutBindings>;
} {
    if (!raw) {
        return { preset: null, bindings: {} };
    }
    try {
        const parsed = JSON.parse(raw) as {
            preset?: RendererDataValue;
            bindings?: RendererDataValue;
        };
        const preset =
            typeof parsed.preset === 'string' && parsed.preset in TERMINAL_SHORTCUT_PRESETS
                ? (parsed.preset as TerminalShortcutPresetId)
                : null;
        return {
            preset,
            bindings: sanitizeShortcutBindings(parsed.bindings),
        };
    } catch {
        return { preset: null, bindings: {} };
    }
}

export function serializeShortcutStorage(
    preset: TerminalShortcutPresetId,
    bindings: TerminalShortcutBindings
): string {
    return JSON.stringify({ preset, bindings });
}

export function createShortcutShareCode(
    preset: TerminalShortcutPresetId,
    bindings: TerminalShortcutBindings
): string {
    return encodeShortcutPayload(serializeShortcutStorage(preset, bindings));
}

export function parseShortcutShareCode(raw: string): {
    preset: TerminalShortcutPresetId | null;
    bindings: Partial<TerminalShortcutBindings>;
} {
    try {
        const decoded = decodeShortcutPayload(raw.trim());
        return parseShortcutStorage(decoded);
    } catch {
        return { preset: null, bindings: {} };
    }
}
