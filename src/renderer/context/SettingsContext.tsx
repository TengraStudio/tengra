import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo } from 'react';

import { loadSettings, updateSettings as updateSettingsInStore, useSettingsStore } from '@/store/settings.store';
import { AppSettings } from '@/types';

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
        if (settings.general.fontSize) {
            document.documentElement.style.setProperty('--font-size-base', `${settings.general.fontSize}px`);
        }
        if (settings.general.theme) {
            document.documentElement.setAttribute('data-theme', settings.general.theme);
        }
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
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
