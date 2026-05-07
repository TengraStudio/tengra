/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo } from 'react';

import {
    resolveAppFontPreset,
    resolveTypographyScale,
} from '@/lib/typography-settings';
import { loadSettings, updateSettings as updateSettingsInStore, useSettingsStore } from '@/store/settings.store';
import { AppSettings } from '@/types';
import { translateErrorMessage } from '@/utils/error-handler.util';

interface SettingsContextType {
    settings: AppSettings | null
    isLoading: boolean
    updateSettings: (newSettings: AppSettings, saveImmediately?: boolean) => Promise<void>
    reloadSettings: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const settings = useSettingsStore(snapshot => snapshot.settings);
    const isLoading = useSettingsStore(snapshot => snapshot.isLoading);

    const reloadSettings = useCallback(async () => {
        await loadSettings();
    }, []);

    useEffect(() => {
        void reloadSettings();
    }, [reloadSettings]);

    const updateSettings = useCallback(async (newSettings: AppSettings, saveImmediately = true) => {
        await updateSettingsInStore(newSettings, saveImmediately);
    }, []);

    // Apply global appearances settings
    useEffect(() => {
        if (!settings?.general) { return; }
        const fontPreset = resolveAppFontPreset();
        const typographyScale = resolveTypographyScale(settings.general.typographyScale);
        document.documentElement.style.setProperty('--font-sans', fontPreset.sans);
        document.documentElement.style.setProperty('--font-display', fontPreset.display);
        document.documentElement.style.setProperty('--font-mono', fontPreset.sans);
        document.documentElement.style.setProperty('--font-family', fontPreset.sans);
        document.documentElement.style.setProperty('--font-size-base', `${settings.general.fontSize}px`);
        document.documentElement.style.setProperty('--line-height-body', typographyScale.lineHeight);
        document.documentElement.style.setProperty('--heading-tracking', typographyScale.headingTracking);
        document.documentElement.setAttribute('data-typography-scale', typographyScale.id);
    }, [settings]);

    const value = useMemo(() => ({
        settings,
        isLoading,
        updateSettings,
        reloadSettings
    }), [settings, isLoading, updateSettings, reloadSettings]);

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error(translateErrorMessage('useSettings must be used within a SettingsProvider'));
    }
    return context;
}

