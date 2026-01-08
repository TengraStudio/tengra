import { useState, useEffect } from 'react';

export const useTheme = () => {
    // Initialize with current attribute or default
    const [theme, setTheme] = useState<string>(() => {
        return document.documentElement.getAttribute('data-theme') || 'graphite';
    });

    useEffect(() => {
        // Observer for changes to data-theme attribute on data-theme
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    const newTheme = document.documentElement.getAttribute('data-theme');
                    if (newTheme) setTheme(newTheme);
                }
            });
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });

        return () => observer.disconnect();
    }, []);

    // Helper to determine if we should use light or dark mode for Monaco
    // List of known light themes
    const isLight = ['snow', 'sand', 'sky', 'paper', 'minimal'].includes(theme);

    return {
        theme,
        isLight,
        isDark: !isLight
    };
};
