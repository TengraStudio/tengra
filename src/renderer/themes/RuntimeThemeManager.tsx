/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { useEffect, useRef, useSyncExternalStore } from 'react';

import { useTheme } from '@/hooks/useTheme';
import { themeRegistry } from '@/themes/theme-registry.service';
import { appLogger } from '@/utils/renderer-logger';

/**
 * Runtime Theme Manager
 * Dynamically injects CSS variables from theme manifests into the DOM.
 * This allows marketplace themes to work without being hardcoded in styles/index.css.
 */
export const RuntimeThemeManager: React.FC = () => {
    const { theme } = useTheme();
    const appliedVarsRef = useRef<Set<string>>(new Set());
    useSyncExternalStore(
        themeRegistry.subscribe,
        themeRegistry.getSnapshot,
        themeRegistry.getSnapshot
    );
    
    // Get manifest from registry based on current theme ID
    const manifest = themeRegistry.getTheme(theme);

    useEffect(() => {
        const root = document.documentElement;

        // Cleanup any previously-applied theme variables to avoid leakage across themes.
        // Only removes variables that were set by this manager (tracked in `appliedVarsRef`).
        for (const cssVarName of appliedVarsRef.current) {
            root.style.removeProperty(cssVarName);
        }
        appliedVarsRef.current.clear();

        if (!manifest) {
            appLogger.debug('RuntimeThemeManager', `Theme ${theme} manifest not found in registry yet.`);
            return;
        }

        appLogger.info('RuntimeThemeManager', `Applying theme: ${manifest.displayName} (${theme})`);

        const colors = manifest.colors;
        const vars = manifest.vars ?? {};

        const markApplied = (cssVarName: string) => {
            appliedVarsRef.current.add(cssVarName);
        };

        try {
            // Apply all colors from manifest to CSS variables
            Object.entries(colors).forEach(([key, value]) => {
                if (typeof value !== 'string') {
                    return;
                }

                // Convert camelCase to kebab-case (e.g. primaryForeground -> --primary-foreground)
                const cssVarName = `--${key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}`;
                root.style.setProperty(cssVarName, value);
                markApplied(cssVarName);
            });

            // Apply raw CSS variable overrides (`vars`) for full theming (layout/spacing/radius/shadows/etc.)
            Object.entries(vars).forEach(([key, value]) => {
                if (typeof value !== 'string') {
                    return;
                }
                const cssVarName = key.startsWith('--') ? key : `--${key}`;
                root.style.setProperty(cssVarName, value);
                markApplied(cssVarName);
            });

            // Ensure shadcn/ui mandatory mappings
            if (colors.primary) {
                root.style.setProperty('--ring', colors.primary);
                markApplied('--ring');
            }
            if (colors.background) {
                root.style.setProperty('--card', colors.background);
                markApplied('--card');
            }
            if (colors.foreground) {
                root.style.setProperty('--card-foreground', colors.foreground);
                markApplied('--card-foreground');
            }
        } catch (error) {
            appLogger.error('RuntimeThemeManager', `Failed to apply theme variables for ${theme}`, error as Error);
        }

    }, [manifest, theme]);

    return null;
};
