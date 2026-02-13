import { ThemeManifest } from '@shared/types/theme';
import { z } from 'zod';

import { invokeIpc } from '@/lib/ipc-client';

const themeColorsSchema = z.object({
    background: z.string(),
    foreground: z.string(),
    card: z.string(),
    cardForeground: z.string(),
    popover: z.string(),
    popoverForeground: z.string(),
    primary: z.string(),
    primaryForeground: z.string(),
    secondary: z.string(),
    secondaryForeground: z.string(),
    muted: z.string(),
    mutedForeground: z.string(),
    accent: z.string(),
    accentForeground: z.string(),
    destructive: z.string(),
    destructiveForeground: z.string(),
    border: z.string(),
    input: z.string(),
    ring: z.string(),
    radius: z.number().optional(),
    fontFamily: z.string().optional(),
    glowColor: z.string().optional(),
    shadowColor: z.string().optional()
}).passthrough();

const themeManifestSchema: z.ZodType<ThemeManifest> = z.object({
    id: z.string(),
    name: z.string(),
    displayName: z.string(),
    description: z.string().optional(),
    author: z.string().optional(),
    version: z.string(),
    type: z.enum(['light', 'dark', 'highContrast']),
    colors: themeColorsSchema,
    preview: z.string().optional(),
    category: z.enum(['elite-dark', 'vibrant-neon', 'professional-light', 'artisanal']).optional(),
    downloads: z.number().optional(),
    rating: z.number().optional(),
    isPremium: z.boolean().optional(),
    isInstalled: z.boolean().optional(),
    publisher: z.string().optional(),
    repository: z.string().optional(),
    license: z.string().optional(),
    tags: z.array(z.string()).optional()
});

const themeManifestListSchema = z.array(themeManifestSchema);

/**
 * IPC utilities for runtime theme management
 */
export const themeIpc = {
    /**
     * Get all themes from runtime directory
     */
    async getAllThemes(): Promise<ThemeManifest[]> {
        return invokeIpc('theme:runtime:getAll', [], {
            responseSchema: themeManifestListSchema
        });
    },

    /**
     * Install a theme from a JSON file path
     */
    async installTheme(themePath: string): Promise<void> {
        await invokeIpc('theme:runtime:install', [themePath], {
            argsSchema: z.tuple([z.string().min(1)]),
            responseSchema: z.void()
        });
    },

    /**
     * Uninstall a theme by ID
     */
    async uninstallTheme(themeId: string): Promise<void> {
        await invokeIpc('theme:runtime:uninstall', [themeId], {
            argsSchema: z.tuple([z.string().min(1)]),
            responseSchema: z.void()
        });
    },

    /**
     * Open the runtime themes directory in file explorer
     */
    async openThemesDirectory(): Promise<void> {
        await invokeIpc('theme:runtime:openDirectory', [], {
            responseSchema: z.void()
        });
    }
};
