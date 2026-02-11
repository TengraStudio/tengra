import { useEffect, useState } from 'react';

import { themeRegistry } from '@/themes/theme-registry.service';

/**
 * Theme Detection Hook - VSCode Style
 * Uses theme manifest type instead of dynamic color calculation
 *
 * NOTE: This is for theme TYPE detection (light/dark).
 * For theme MANAGEMENT, use ThemeContext from @/context/ThemeContext
 */
export const useThemeDetection = () => {
    // Initialize with current attribute or default
    const [theme, setTheme] = useState<string>(() => {
        return document.documentElement.getAttribute('data-theme') ?? 'black';
    });

    // Get theme type from registry (VSCode approach)
    const [isLight, setIsLight] = useState<boolean>(() => {
        const currentTheme = document.documentElement.getAttribute('data-theme') ?? 'black';
        return themeRegistry.isLightTheme(currentTheme);
    });

    useEffect(() => {
        const updateThemeInfo = () => {
            const newTheme = document.documentElement.getAttribute('data-theme');
            if (newTheme) {
                setTheme(newTheme);
                // Use manifest type instead of calculating luminance
                setIsLight(themeRegistry.isLightTheme(newTheme));
            }
        };

        // Observer for changes to data-theme attribute
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    updateThemeInfo();
                }
            });
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme'],
        });

        return () => observer.disconnect();
    }, []);

    return {
        theme,
        isLight,
        isDark: !isLight,
        themeType: themeRegistry.getThemeType(theme),
        manifest: themeRegistry.getTheme(theme),
    };
};

// Backward compatibility export
export const useTheme = useThemeDetection;
