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

    useEffect(() => {
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(terminalAppearance));
        } catch {
            // Ignore localStorage failures in restricted environments.
        }
    }, [storageKey, terminalAppearance]);

    return { terminalAppearance, setTerminalAppearance };
}
