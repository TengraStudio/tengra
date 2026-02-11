import { ThemeManifest } from '@shared/types/theme';

/**
 * IPC utilities for runtime theme management
 */
export const themeIpc = {
    /**
     * Get all themes from runtime directory
     */
    async getAllThemes(): Promise<ThemeManifest[]> {
        return window.electron.ipcRenderer.invoke('theme:runtime:getAll');
    },

    /**
     * Install a theme from a JSON file path
     */
    async installTheme(themePath: string): Promise<void> {
        return window.electron.ipcRenderer.invoke('theme:runtime:install', themePath);
    },

    /**
     * Uninstall a theme by ID
     */
    async uninstallTheme(themeId: string): Promise<void> {
        return window.electron.ipcRenderer.invoke('theme:runtime:uninstall', themeId);
    },

    /**
     * Open the runtime themes directory in file explorer
     */
    async openThemesDirectory(): Promise<void> {
        return window.electron.ipcRenderer.invoke('theme:runtime:openDirectory');
    }
};
