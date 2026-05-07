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
        return document.documentElement.getAttribute('data-theme') ?? 'tengra-black';
    });

    // Get theme type from registry (VSCode approach)
    const [isLight, setIsLight] = useState<boolean>(() => {
        const currentTheme = document.documentElement.getAttribute('data-theme') ?? 'tengra-black';
        return themeRegistry.isLightTheme(currentTheme);
    });

    useEffect(() => {
        const updateThemeInfo = () => {
            const newTheme = document.documentElement.getAttribute('data-theme') ?? 'tengra-black';
            setTheme(newTheme);
            setIsLight(themeRegistry.isLightTheme(newTheme));
        };

        // Subscribe to registry changes (in case themes are loaded later)
        const unsubscribe = themeRegistry.subscribe(updateThemeInfo);

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

        // Initial update in case it changed between state init and effect
        updateThemeInfo();

        return () => {
            observer.disconnect();
            unsubscribe();
        };
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

