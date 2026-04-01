/**
 * Theme Registry Service
 * Manages theme manifests and provides VSCode-style theme loading
 * Now loads themes from runtime directory dynamically
 */

import type { ThemeManifest, ThemeRegistry, ThemeType } from '@shared/types/theme';

import { appLogger } from '@/utils/renderer-logger';
import { themeIpc } from '@/utils/theme-ipc.util';

/**
 * Theme Registry API
 */
export class ThemeRegistryService {
    private themes: ThemeRegistry = {};
    private isLoaded = false;

    constructor() {
        // Listen for theme updates from Main process (e.g. after marketplace install)
        if (window.electron?.ipcRenderer) {
            window.electron.ipcRenderer.on('theme:runtime:updated', () => {
                appLogger.info('ThemeRegistry', 'Received theme update notification, reloading themes...');
                void this.reloadThemes();
            });
        }
    }

    /**
     * Load themes from runtime directory
     * Should be called on app initialization
     */
    async loadThemes(): Promise<void> {
        try {
            const manifests = await themeIpc.getAllThemes();
            this.themes = {};

            for (const manifest of manifests) {
                if (this.validateManifest(manifest)) {
                    this.themes[manifest.id] = manifest;
                }
            }

            this.isLoaded = true;
        } catch (error) {
            appLogger.error('ThemeRegistry', 'Failed to load themes', error as Error);
            // Fallback to empty registry
            this.themes = {};
            this.isLoaded = true;
        }
    }

    /**
     * Reload themes from runtime directory
     */
    async reloadThemes(): Promise<void> {
        this.isLoaded = false;
        await this.loadThemes();
    }

    /**
     * Check if themes are loaded
     */
    isThemesLoaded(): boolean {
        return this.isLoaded;
    }

    /**
     * Get theme manifest by ID
     */
    getTheme(id: string): ThemeManifest | undefined {
        return this.themes[id];
    }

    /**
     * Get theme type (light/dark/highContrast)
     * This is the VSCode-style approach - explicit declaration
     */
    getThemeType(id: string): ThemeType {
        const theme = this.getTheme(id);
        return theme?.type ?? 'dark'; // Default to dark if not found
    }

    /**
     * Check if theme is light
     * Uses manifest type instead of color calculation
     */
    isLightTheme(id: string): boolean {
        return this.getThemeType(id) === 'light';
    }

    /**
     * Check if theme is dark
     */
    isDarkTheme(id: string): boolean {
        return this.getThemeType(id) === 'dark';
    }

    /**
     * Check if theme is high contrast
     */
    isHighContrastTheme(id: string): boolean {
        return this.getThemeType(id) === 'highContrast';
    }

    /**
     * Get all available themes
     */
    getAllThemes(): ThemeManifest[] {
        return Object.values(this.themes);
    }

    /**
     * Get themes by type
     */
    getThemesByType(type: ThemeType): ThemeManifest[] {
        return this.getAllThemes().filter(theme => theme.type === type);
    }

    /**
     * Validate theme manifest
     */
    validateManifest(manifest: RendererDataValue): manifest is ThemeManifest {
        if (typeof manifest !== 'object' || manifest === null) {
            return false;
        }

        const m = manifest as Record<string, RendererDataValue>;

        return (
            typeof m.id === 'string' &&
            typeof m.name === 'string' &&
            typeof m.displayName === 'string' &&
            typeof m.version === 'string' &&
            (m.type === 'light' || m.type === 'dark' || m.type === 'highContrast') &&
            typeof m.colors === 'object' &&
            m.colors !== null
        );
    }
}

// Singleton instance
export const themeRegistry = new ThemeRegistryService();
