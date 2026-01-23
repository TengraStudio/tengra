import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Theme = 'black' | 'white';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = localStorage.getItem('orbit-theme');
        if (saved === 'black' || saved === 'white') {
            return saved;
        }
        return 'black';
    });

    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('orbit-theme', newTheme);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(theme === 'black' ? 'white' : 'black');
    }, [theme, setTheme]);

    useEffect(() => {
        const root = window.document.documentElement;
        root.setAttribute('data-theme', theme);
    }, [theme]);

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
    }), [theme, setTheme, toggleTheme])

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
