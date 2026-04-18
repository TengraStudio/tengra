/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export type ShortcutActionId =
    | 'newChat'
    | 'openSettings'
    | 'clearChat'
    | 'toggleSidebar'
    | 'showShortcuts'
    | 'goToChat'
    | 'goToWorkspaces'
    | 'goToSettings';

export interface ShortcutBinding {
    key: string;
    mod?: boolean;
    shift?: boolean;
    alt?: boolean;
}

export type ShortcutBindings = Record<ShortcutActionId, ShortcutBinding>;

export const SHORTCUTS_STORAGE_KEY = 'app.keyboard-shortcuts.v1';

export const DEFAULT_SHORTCUT_BINDINGS: ShortcutBindings = {
    newChat: { key: 'n', mod: true },
    openSettings: { key: ',', mod: true },
    clearChat: { key: 'l', mod: true },
    toggleSidebar: { key: 'b', mod: true },
    showShortcuts: { key: '?', shift: true },
    goToChat: { key: '1', mod: true },
    goToWorkspaces: { key: '2', mod: true },
    goToSettings: { key: '4', mod: true },
};

const SHORTCUT_ACTION_IDS = Object.keys(DEFAULT_SHORTCUT_BINDINGS) as ShortcutActionId[];

const normalizeKey = (key: string): string => key.toLowerCase();

const isObject = (value: RendererDataValue): value is Record<string, RendererDataValue> =>
    typeof value === 'object' && value !== null;

const sanitizeBinding = (value: RendererDataValue, fallback: ShortcutBinding): ShortcutBinding => {
    if (!isObject(value) || typeof value.key !== 'string' || value.key.length === 0) {
        return fallback;
    }

    return {
        key: normalizeKey(value.key),
        mod: value.mod === true,
        shift: value.shift === true,
        alt: value.alt === true,
    };
};

export const mergeShortcutBindings = (value: RendererDataValue): ShortcutBindings => {
    const record = isObject(value) ? value : {};
    const merged: Partial<ShortcutBindings> = {};

    for (const actionId of SHORTCUT_ACTION_IDS) {
        merged[actionId] = sanitizeBinding(record[actionId], DEFAULT_SHORTCUT_BINDINGS[actionId]);
    }

    return merged as ShortcutBindings;
};

export const loadShortcutBindings = (): ShortcutBindings => {
    try {
        const raw = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
        if (!raw) {
            return DEFAULT_SHORTCUT_BINDINGS;
        }
        return mergeShortcutBindings(JSON.parse(raw));
    } catch {
        return DEFAULT_SHORTCUT_BINDINGS;
    }
};

export const saveShortcutBindings = (bindings: ShortcutBindings): void => {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(bindings));
    window.dispatchEvent(new CustomEvent('app:shortcuts-updated'));
};

export const resetShortcutBindings = (): ShortcutBindings => {
    saveShortcutBindings(DEFAULT_SHORTCUT_BINDINGS);
    return DEFAULT_SHORTCUT_BINDINGS;
};

export const matchesShortcut = (
    event: KeyboardEvent,
    binding: ShortcutBinding,
    isMac: boolean
): boolean => {
    const modPressed = isMac ? event.metaKey : event.ctrlKey;
    return (
        normalizeKey(event.key) === normalizeKey(binding.key) &&
        modPressed === (binding.mod === true) &&
        event.shiftKey === (binding.shift === true) &&
        event.altKey === (binding.alt === true)
    );
};

export const shortcutBindingLabel = (binding: ShortcutBinding, isMac: boolean): string => {
    const parts: string[] = [];
    if (binding.mod) {
        parts.push(isMac ? 'Cmd' : 'Ctrl');
    }
    if (binding.alt) {
        parts.push(isMac ? 'Option' : 'Alt');
    }
    if (binding.shift) {
        parts.push('Shift');
    }

    const key = binding.key.length === 1 ? binding.key.toUpperCase() : binding.key;
    parts.push(key);
    return parts.join(' + ');
};

export const eventToShortcutBinding = (event: KeyboardEvent): ShortcutBinding | null => {
    const key = normalizeKey(event.key);
    if (key === 'control' || key === 'meta' || key === 'alt' || key === 'shift') {
        return null;
    }

    return {
        key,
        mod: event.ctrlKey || event.metaKey,
        shift: event.shiftKey,
        alt: event.altKey,
    };
};
