import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme =
    | 'graphite' | 'obsidian' | 'midnight' | 'deep-forest' | 'dracula' | 'cyberpunk'
    | 'matrix' | 'synthwave' | 'lava' | 'aurora' | 'snow' | 'sand' | 'sky'
    | 'minimal' | 'paper' | 'gold' | 'ocean' | 'rose' | 'coffee' | 'neon-pulse'
    | 'cyber-future' | 'soft-velvet';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = localStorage.getItem('orbit-theme');
        if (saved) {
            return saved as Theme;
        }
        return 'graphite';
    });

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('orbit-theme', newTheme);
    };

    const toggleTheme = () => {
        // Basic cycle for demo, though usually themes are selected from a list
        setTheme(theme === 'graphite' ? 'snow' : 'graphite');
    };

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

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
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
