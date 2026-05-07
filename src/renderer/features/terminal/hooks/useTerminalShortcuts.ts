/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useEffect, useState } from 'react';

import {
    parseShortcutStorage,
    sanitizeShortcutBindings,
    serializeShortcutStorage,
    TERMINAL_SHORTCUT_PRESETS,
    type TerminalShortcutBindings,
    type TerminalShortcutPresetId,
} from '../utils/shortcut-config';

interface UseTerminalShortcutsOptions {
    storageKey: string;
}

function loadShortcutPreferences(storageKey: string): {
    shortcutPreset: TerminalShortcutPresetId;
    shortcutBindings: TerminalShortcutBindings;
} {
    try {
        const raw = window.localStorage.getItem(storageKey);
        const parsed = parseShortcutStorage(raw);
        const basePreset = parsed.preset ?? 'default';
        return {
            shortcutPreset: basePreset,
            shortcutBindings: {
                ...TERMINAL_SHORTCUT_PRESETS[basePreset],
                ...sanitizeShortcutBindings(parsed.bindings),
            },
        };
    } catch {
        return {
            shortcutPreset: 'default',
            shortcutBindings: TERMINAL_SHORTCUT_PRESETS.default,
        };
    }
}

export function useTerminalShortcuts({ storageKey }: UseTerminalShortcutsOptions) {
    const [initialPreferences] = useState(() => loadShortcutPreferences(storageKey));
    const [shortcutPreset, setShortcutPreset] = useState<TerminalShortcutPresetId>(
        initialPreferences.shortcutPreset
    );
    const [shortcutBindings, setShortcutBindings] = useState<TerminalShortcutBindings>(
        initialPreferences.shortcutBindings
    );

    useEffect(() => {
        try {
            window.localStorage.setItem(
                storageKey,
                serializeShortcutStorage(shortcutPreset, shortcutBindings)
            );
        } catch {
            // Ignore localStorage failures in restricted environments.
        }
    }, [shortcutBindings, shortcutPreset, storageKey]);

    return {
        shortcutPreset,
        setShortcutPreset,
        shortcutBindings,
        setShortcutBindings,
    };
}

