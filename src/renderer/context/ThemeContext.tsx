import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Theme = string;

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

import { useSettings } from '@/context/SettingsContext';
import { readCachedSettings } from '@/store/settings.store';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { settings, updateSettings } = useSettings();

    // Initialize from localStorage as immediate fallback before settings load
    const [localTheme, setLocalTheme] = useState<Theme>(() => {
        return readCachedSettings()?.general.theme ?? localStorage.getItem('Tengra-theme') ?? 'graphite';
    });

    // Prefer settings if available, otherwise local state
    const theme = settings?.general.theme ?? localTheme;

    const setTheme = useCallback((newTheme: Theme) => {
        setLocalTheme(newTheme);
        localStorage.setItem('Tengra-theme', newTheme);

        if (settings) {
            void updateSettings({
                ...settings,
                general: { ...settings.general, theme: newTheme }
            }, true);
        }
    }, [settings, updateSettings]);

    const toggleTheme = useCallback(() => {
        setTheme(theme === 'black' ? 'white' : 'black');
    }, [theme, setTheme]);

    // DOM update is handled by SettingsContext for settings-based changes,
    // but we keep this for immediate local-only updates (e.g. before settings load)
    useEffect(() => {
        if (!settings) {
            const root = window.document.documentElement;
            root.setAttribute('data-theme', theme);
        }
    }, [theme, settings]);

    // Handle system preference changes if needed (optional for curated themes)
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            // Logic for auto-themeing could go here if we had an 'auto' mode
        };
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // Memoize the context value to prevent unnecessary re-renders
    const value = useMemo(() => ({
        theme,
        setTheme,
        toggleTheme
    }), [theme, setTheme, toggleTheme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};


