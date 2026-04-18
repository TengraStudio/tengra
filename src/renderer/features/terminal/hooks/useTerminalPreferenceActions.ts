/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { type MutableRefObject,useCallback, useMemo } from 'react';

import { getTerminalTheme } from '@/lib/terminal-theme';
import { appLogger } from '@/utils/renderer-logger';

import {
    clamp,
    resolveTerminalAppearance,
} from '../constants/terminal-panel-constants';
import type {
    TerminalAppearancePreferences,
} from '../types/terminal-appearance';
import { alertDialog } from '../utils/dialog';
import { promptDialog } from '../utils/dialog';
import {
    createShortcutShareCode,
    parseShortcutShareCode,
    parseShortcutStorage,
    sanitizeShortcutBindings,
    serializeShortcutStorage,
    TERMINAL_SHORTCUT_PRESETS,
    type TerminalShortcutBindings,
    type TerminalShortcutPresetId,
} from '../utils/shortcut-config';
import { validateTerminalAppearanceImport } from '../utils/terminal-panel-helpers';

interface UseTerminalPreferenceActionsParams {
    theme: string;
    terminalAppearance: TerminalAppearancePreferences;
    setTerminalAppearance: (fn: (prev: TerminalAppearancePreferences) => TerminalAppearancePreferences) => void;
    shortcutPreset: TerminalShortcutPresetId;
    shortcutBindings: TerminalShortcutBindings;
    setShortcutPreset: (preset: TerminalShortcutPresetId) => void;
    setShortcutBindings: (fn: TerminalShortcutBindings | ((prev: TerminalShortcutBindings) => TerminalShortcutBindings)) => void;
    appearanceImportInputRef: MutableRefObject<HTMLInputElement | null>;
    shortcutImportInputRef: MutableRefObject<HTMLInputElement | null>;
    t: (key: string) => string;
}

export function useTerminalPreferenceActions({
    theme,
    terminalAppearance,
    setTerminalAppearance,
    shortcutPreset,
    shortcutBindings,
    setShortcutPreset,
    setShortcutBindings,
    t,
}: UseTerminalPreferenceActionsParams) {
    const applyAppearancePatch = useCallback((patch: Partial<TerminalAppearancePreferences>) => {
        setTerminalAppearance(prev => ({
            themePresetId: patch.themePresetId ?? prev.themePresetId,
            fontPresetId: patch.fontPresetId ?? prev.fontPresetId,
            ligatures: patch.ligatures ?? prev.ligatures,
            surfaceOpacity: clamp(patch.surfaceOpacity ?? prev.surfaceOpacity, 0.6, 1),
            surfaceBlur: clamp(patch.surfaceBlur ?? prev.surfaceBlur, 0, 24),
            cursorStyle: patch.cursorStyle ?? prev.cursorStyle,
            cursorBlink: patch.cursorBlink ?? prev.cursorBlink,
            fontSize: clamp(patch.fontSize ?? prev.fontSize, 8, 32),
            lineHeight: clamp(patch.lineHeight ?? prev.lineHeight, 1, 2),
            customTheme: patch.customTheme !== undefined ? patch.customTheme : prev.customTheme,
        }));
    }, [setTerminalAppearance]);

    const exportAppearancePreferences = useCallback(() => {
        const payload = JSON.stringify(terminalAppearance, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'terminal-theme.json';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }, [terminalAppearance]);

    const importAppearancePreferences = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) {
                return;
            }
            try {
                const raw = await file.text();
                const parsed = JSON.parse(raw);
                const validation = validateTerminalAppearanceImport(parsed);
                if (!validation.valid) {
                    const validationMessage = validation.errors
                        .map(errorKey => t(errorKey))
                        .join(', ');
                    appLogger.error(
                        'TerminalPanel',
                        `Theme validation failed: ${validationMessage}`
                    );
                    alertDialog(t('terminal.invalidThemeFile'));
                    return;
                }
                applyAppearancePatch(parsed as Partial<TerminalAppearancePreferences>);
            } catch (error) {
                appLogger.error(
                    'TerminalPanel',
                    'Failed to import terminal appearance preset',
                    error as Error
                );
                alertDialog(t('terminal.failedImportThemeInvalidJson'));
            }
        },
        [applyAppearancePatch, t]
    );

    const resolvedTerminalAppearance = useMemo(() => {
        void theme;
        return resolveTerminalAppearance(getTerminalTheme(), terminalAppearance);
    }, [terminalAppearance, theme]);

    const applyShortcutPreset = useCallback((presetId: TerminalShortcutPresetId) => {
        setShortcutPreset(presetId);
        setShortcutBindings(TERMINAL_SHORTCUT_PRESETS[presetId]);
    }, [setShortcutPreset, setShortcutBindings]);

    const applyShortcutPayload = useCallback(
        (
            payload: {
                preset: TerminalShortcutPresetId | null;
                bindings: Partial<TerminalShortcutBindings>;
            },
            source: 'file' | 'share-code'
        ) => {
            if (payload.preset) {
                setShortcutPreset(payload.preset);
            }
            if (Object.keys(payload.bindings).length > 0) {
                setShortcutBindings(prev => ({
                    ...prev,
                    ...sanitizeShortcutBindings(payload.bindings),
                }));
            }
            if (!payload.preset && Object.keys(payload.bindings).length === 0) {
                appLogger.warn('TerminalPanel', `Ignored empty shortcut payload from ${source}`);
            }
        },
        [setShortcutPreset, setShortcutBindings]
    );

    const exportShortcutPreferences = useCallback(() => {
        const payload = serializeShortcutStorage(shortcutPreset, shortcutBindings);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'terminal-shortcuts.json';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }, [shortcutBindings, shortcutPreset]);

    const importShortcutPreferences = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) {
                return;
            }
            try {
                const raw = await file.text();
                const parsed = parseShortcutStorage(raw);
                applyShortcutPayload(parsed, 'file');
            } catch (error) {
                appLogger.error(
                    'TerminalPanel',
                    'Failed to import terminal shortcut settings',
                    error as Error
                );
            }
        },
        [applyShortcutPayload]
    );

    const shareShortcutPreferences = useCallback(async () => {
        try {
            const shareCode = createShortcutShareCode(shortcutPreset, shortcutBindings);
            await navigator.clipboard.writeText(shareCode);
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to copy shortcut share code', error as Error);
        }
    }, [shortcutBindings, shortcutPreset]);

    const importShortcutShareCode = useCallback(() => {
        const raw = promptDialog(t('terminal.shortcutShareCodePrompt'));
        if (!raw?.trim()) {
            return;
        }
        const parsed = parseShortcutShareCode(raw);
        applyShortcutPayload(parsed, 'share-code');
    }, [applyShortcutPayload, t]);

    return {
        applyAppearancePatch,
        exportAppearancePreferences,
        importAppearancePreferences,
        resolvedTerminalAppearance,
        applyShortcutPreset,
        applyShortcutPayload,
        exportShortcutPreferences,
        importShortcutPreferences,
        shareShortcutPreferences,
        importShortcutShareCode,
    };
}
