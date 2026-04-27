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

import type { TerminalAppearancePreferences } from '../types/terminal-appearance';

interface UseTerminalAppearanceOptions {
    storageKey: string;
    defaultAppearance: TerminalAppearancePreferences;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function loadTerminalAppearance(
    storageKey: string,
    defaultAppearance: TerminalAppearancePreferences
): TerminalAppearancePreferences {
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
            return defaultAppearance;
        }
        const parsed = JSON.parse(raw) as Partial<TerminalAppearancePreferences>;
        return {
            themePresetId:
                typeof parsed.themePresetId === 'string'
                    ? parsed.themePresetId
                    : defaultAppearance.themePresetId,
            fontPresetId:
                typeof parsed.fontPresetId === 'string'
                    ? parsed.fontPresetId
                    : defaultAppearance.fontPresetId,
            ligatures:
                typeof parsed.ligatures === 'boolean' ? parsed.ligatures : defaultAppearance.ligatures,
            surfaceOpacity: clamp(
                typeof parsed.surfaceOpacity === 'number'
                    ? parsed.surfaceOpacity
                    : defaultAppearance.surfaceOpacity,
                0.6,
                1
            ),
            surfaceBlur: clamp(
                typeof parsed.surfaceBlur === 'number'
                    ? parsed.surfaceBlur
                    : defaultAppearance.surfaceBlur,
                0,
                24
            ),
            cursorStyle:
                typeof parsed.cursorStyle === 'string' && ['block', 'underline', 'bar'].includes(parsed.cursorStyle)
                    ? parsed.cursorStyle
                    : defaultAppearance.cursorStyle,
            cursorBlink:
                typeof parsed.cursorBlink === 'boolean'
                    ? parsed.cursorBlink
                    : defaultAppearance.cursorBlink,
            fontSize: clamp(
                typeof parsed.fontSize === 'number' ? parsed.fontSize : defaultAppearance.fontSize,
                8,
                32
            ),
            lineHeight: clamp(
                typeof parsed.lineHeight === 'number' ? parsed.lineHeight : defaultAppearance.lineHeight,
                1,
                2
            ),
            customTheme:
                parsed.customTheme && typeof parsed.customTheme === 'object'
                    ? parsed.customTheme
                    : defaultAppearance.customTheme,
        };
    } catch {
        return defaultAppearance;
    }
}

export function useTerminalAppearance({
    storageKey,
    defaultAppearance,
}: UseTerminalAppearanceOptions) {
    const [terminalAppearance, setTerminalAppearance] = useState<TerminalAppearancePreferences>(() =>
        loadTerminalAppearance(storageKey, defaultAppearance)
    );

    // Sync from other tabs/windows
    useEffect(() => {
        const handleSync = () => {
            setTerminalAppearance(loadTerminalAppearance(storageKey, defaultAppearance));
        };

        window.addEventListener('storage', handleSync);
        window.addEventListener('terminal-appearance-sync', handleSync);

        return () => {
            window.removeEventListener('storage', handleSync);
            window.removeEventListener('terminal-appearance-sync', handleSync);
        };
    }, [storageKey, defaultAppearance]);

    // Persist and notify local components
    useEffect(() => {
        try {
            const current = window.localStorage.getItem(storageKey);
            const next = JSON.stringify(terminalAppearance);
            
            if (current !== next) {
                window.localStorage.setItem(storageKey, next);
                window.dispatchEvent(new CustomEvent('terminal-appearance-sync'));
            }
        } catch {
            // Ignore localStorage failures.
        }
    }, [storageKey, terminalAppearance]);

    return { terminalAppearance, setTerminalAppearance };
}
