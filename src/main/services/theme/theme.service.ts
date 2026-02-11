/**
 * Theme Service
 * Manages theme installation, loading, and discovery from runtime/themes directory
 */

import { promises as fs } from 'fs';
import * as path from 'path';

import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import type { ThemeManifest } from '@shared/types/theme';

export class ThemeService extends BaseService {
    private themesDir: string;
    private installedThemes: Map<string, ThemeManifest> = new Map();

    constructor(private dataService: DataService) {
        super('ThemeService');
        // Runtime themes directory: userData/runtime/themes
        const userDataPath = path.dirname(this.dataService.getPath('db'));
        this.themesDir = path.join(userDataPath, 'runtime', 'themes');
    }

    override async initialize(): Promise<void> {
        this.logInfo('Initializing theme service...');
        
        // Ensure themes directory exists
        await this.ensureThemesDirectory();
        
        // Install built-in themes if not present
        await this.installBuiltInThemes();
        
        // Scan and load all themes
        await this.loadThemes();
        
        this.logInfo(`Loaded ${this.installedThemes.size} themes`);
    }

    override async cleanup(): Promise<void> {
        this.installedThemes.clear();
    }

    private async ensureThemesDirectory(): Promise<void> {
        try {
            await fs.mkdir(this.themesDir, { recursive: true });
            this.logDebug(`Themes directory: ${this.themesDir}`);
        } catch (error) {
            this.logError('Failed to create themes directory', error as Error);
            throw error;
        }
    }

    private async installBuiltInThemes(): Promise<void> {
        const builtInThemes = [
            {
                id: 'black',
                name: 'tandem-black',
                displayName: 'Tandem Black',
                version: '1.0.0',
                type: 'dark' as const,
                description: 'Pure black theme with electric cyan accents',
                author: 'Tandem Team',
                colors: {
                    background: '0 0% 0%',
                    foreground: '0 0% 100%',
                    card: '0 0% 4%',
                    cardForeground: '0 0% 100%',
                    popover: '0 0% 4%',
                    popoverForeground: '0 0% 100%',
                    primary: '199 89% 48%',
                    primaryForeground: '0 0% 100%',
                    secondary: '0 0% 10%',
                    secondaryForeground: '0 0% 100%',
                    accent: '199 70% 15%',
                    accentForeground: '199 89% 70%',
                    destructive: '0 72% 51%',
                    destructiveForeground: '0 0% 100%',
                    muted: '0 0% 8%',
                    mutedForeground: '0 0% 60%',
                    border: '0 0% 15%',
                    input: '0 0% 15%',
                    ring: '199 89% 48%'
                }
            },
            {
                id: 'white',
                name: 'tandem-white',
                displayName: 'Tandem White',
                version: '1.0.0',
                type: 'light' as const,
                description: 'Clean white theme with vibrant purple accents',
                author: 'Tandem Team',
                colors: {
                    background: '0 0% 100%',
                    foreground: '0 0% 0%',
                    card: '0 0% 98%',
                    cardForeground: '0 0% 10%',
                    popover: '0 0% 100%',
                    popoverForeground: '0 0% 0%',
                    primary: '262 83% 58%',
                    primaryForeground: '0 0% 100%',
                    secondary: '0 0% 95%',
                    secondaryForeground: '0 0% 10%',
                    accent: '262 70% 95%',
                    accentForeground: '262 83% 40%',
                    destructive: '0 84% 60%',
                    destructiveForeground: '0 0% 100%',
                    muted: '0 0% 92%',
                    mutedForeground: '0 0% 40%',
                    border: '0 0% 85%',
                    input: '0 0% 85%',
                    ring: '262 83% 58%'
                }
            }
        ];

        for (const theme of builtInThemes) {
            const themePath = path.join(this.themesDir, `${theme.id}.theme.json`);
            
            try {
                await fs.access(themePath);
                this.logDebug(`Built-in theme ${theme.id} already installed`);
            } catch {
                await fs.writeFile(themePath, JSON.stringify(theme, null, 2));
                this.logInfo(`Installed built-in theme: ${theme.displayName}`);
            }
        }
    }

    private async loadThemes(): Promise<void> {
        try {
            const files = await fs.readdir(this.themesDir);
            
            for (const file of files) {
                if (file.endsWith('.theme.json')) {
                    await this.loadTheme(file);
                }
            }
        } catch (error) {
            this.logError('Failed to scan themes directory', error as Error);
        }
    }

    private async loadTheme(filename: string): Promise<void> {
        const themePath = path.join(this.themesDir, filename);
        
        try {
            const content = await fs.readFile(themePath, 'utf-8');
            const manifest = JSON.parse(content) as ThemeManifest;
            
            if (!this.validateManifest(manifest)) {
                this.logWarn(`Invalid theme manifest: ${filename}`);
                return;
            }
            
            this.installedThemes.set(manifest.id, manifest);
            this.logDebug(`Loaded theme: ${manifest.displayName}`);
        } catch (error) {
            this.logError(`Failed to load theme ${filename}`, error as Error);
        }
    }

    private validateManifest(manifest: unknown): manifest is ThemeManifest {
        if (typeof manifest !== 'object' || manifest === null) {
            return false;
        }

        const m = manifest as Record<string, unknown>;
        
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

    async getAllThemes(): Promise<ThemeManifest[]> {
        return Array.from(this.installedThemes.values());
    }

    async getTheme(id: string): Promise<ThemeManifest | undefined> {
        return this.installedThemes.get(id);
    }

    async installTheme(manifest: ThemeManifest): Promise<boolean> {
        try {
            if (!this.validateManifest(manifest)) {
                throw new Error('Invalid theme manifest');
            }

            const themePath = path.join(this.themesDir, `${manifest.id}.theme.json`);
            await fs.writeFile(themePath, JSON.stringify(manifest, null, 2));
            
            this.installedThemes.set(manifest.id, manifest);
            
            this.logInfo(`Installed theme: ${manifest.displayName}`);
            return true;
        } catch (error) {
            this.logError('Failed to install theme', error as Error);
            return false;
        }
    }

    async uninstallTheme(id: string): Promise<boolean> {
        if (id === 'black' || id === 'white') {
            this.logWarn(`Cannot uninstall built-in theme: ${id}`);
            return false;
        }

        try {
            const themePath = path.join(this.themesDir, `${id}.theme.json`);
            await fs.unlink(themePath);
            
            this.installedThemes.delete(id);
            
            this.logInfo(`Uninstalled theme: ${id}`);
            return true;
        } catch (error) {
            this.logError(`Failed to uninstall theme ${id}`, error as Error);
            return false;
        }
    }

    getThemesDirectory(): string {
        return this.themesDir;
    }
}
