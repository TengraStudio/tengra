import React, { useEffect, useMemo } from 'react';

import { useTheme } from '@/hooks/useTheme';
import { themeRegistry } from '@/themes/theme-registry.service';
import { appLogger } from '@/utils/renderer-logger';

/**
 * Runtime Theme Manager
 * Dynamically injects CSS variables from theme manifests into the DOM.
 * This allows marketplace themes to work without being hardcoded in index.css.
 */
export const RuntimeThemeManager: React.FC = () => {
    const { theme } = useTheme();
    
    // Get manifest from registry based on current theme ID
    const manifest = useMemo(() => themeRegistry.getTheme(theme), [theme]);

    useEffect(() => {
        // 'black' and 'white' are hardcoded in index.css for reliability/stability
        if (theme === 'black' || theme === 'white') {
            // Cleanup dynamic properties to ensure index.css takes over
            const root = document.documentElement;
            root.style.removeProperty('--primary');
            root.style.removeProperty('--background');
            root.style.removeProperty('--foreground');
            root.style.removeProperty('--card');
            root.style.removeProperty('--card-foreground');
            root.style.removeProperty('--popover');
            root.style.removeProperty('--popover-foreground');
            root.style.removeProperty('--secondary');
            root.style.removeProperty('--secondary-foreground');
            root.style.removeProperty('--muted');
            root.style.removeProperty('--muted-foreground');
            root.style.removeProperty('--accent');
            root.style.removeProperty('--accent-foreground');
            root.style.removeProperty('--destructive');
            root.style.removeProperty('--destructive-foreground');
            root.style.removeProperty('--border');
            root.style.removeProperty('--input');
            root.style.removeProperty('--ring');
            return;
        }

        if (!manifest) {
            appLogger.debug('RuntimeThemeManager', `Theme ${theme} manifest not found in registry yet.`);
            return;
        }

        appLogger.info('RuntimeThemeManager', `Applying theme: ${manifest.displayName} (${theme})`);

        const root = document.documentElement;
        const colors = manifest.colors;

        try {
            // Apply all colors from manifest to CSS variables
            Object.entries(colors).forEach(([key, value]) => {
                if (typeof value !== 'string') {
                    return;
                }
                
                // Convert camelCase to kebab-case (e.g. primaryForeground -> --primary-foreground)
                const cssVar = `--${key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}`;
                root.style.setProperty(cssVar, value);
            });

            // Ensure shadcn/ui mandatory mappings
            if (colors.primary) {
                root.style.setProperty('--ring', colors.primary);
            }
            if (colors.background) {
                root.style.setProperty('--card', colors.background);
            }
            if (colors.foreground) {
                root.style.setProperty('--card-foreground', colors.foreground);
            }

        } catch (error) {
            appLogger.error('RuntimeThemeManager', `Failed to apply theme variables for ${theme}`, error as Error);
        }

    }, [manifest, theme]);

    return null;
};
