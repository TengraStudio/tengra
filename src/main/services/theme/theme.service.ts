/**
 * Theme Service
 * Manages theme installation, loading, and discovery from runtime/themes directory
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import type { ThemeManifest } from '@shared/types/theme';
import { getErrorMessage } from '@shared/utils/error.util';

// Performance budgets for theme operations (in milliseconds)
const THEME_OPERATION_BUDGETS = {
    initialize: 1000,
    loadThemes: 500,
    installTheme: 2000,
    uninstallTheme: 1000,
    getTheme: 50,
    getAllThemes: 100
} as const;

// Theme-specific error codes
export enum ThemeErrorCode {
    INVALID_MANIFEST = 'THEME_INVALID_MANIFEST',
    THEME_NOT_FOUND = 'THEME_NOT_FOUND',
    INSTALL_FAILED = 'THEME_INSTALL_FAILED',
    UNINSTALL_FAILED = 'THEME_UNINSTALL_FAILED',
    UNINSTALL_BUILTIN = 'THEME_UNINSTALL_BUILTIN',
    VALIDATION_FAILED = 'THEME_VALIDATION_FAILED',
    PERMISSION_DENIED = 'THEME_PERMISSION_DENIED',
    DISK_FULL = 'THEME_DISK_FULL',
    CORRUPT_THEME_FILE = 'THEME_CORRUPT_FILE'
}

interface ThemeOperationMetrics {
    operations: number;
    successes: number;
    failures: number;
    totalDurationMs: number;
    lastError?: string;
    lastErrorTime?: number;
}

class ThemeMetricsStore {
    private metrics: Map<string, ThemeOperationMetrics> = new Map();

    getMetrics(operation: string): ThemeOperationMetrics {
        if (!this.metrics.has(operation)) {
            this.metrics.set(operation, {
                operations: 0,
                successes: 0,
                failures: 0,
                totalDurationMs: 0
            });
        }
        const operationMetrics = this.metrics.get(operation);
        if (!operationMetrics) {
            throw new Error(`Theme metrics missing for operation: ${operation}`);
        }
        return operationMetrics;
    }

    recordSuccess(operation: string, durationMs: number): void {
        const metrics = this.getMetrics(operation);
        metrics.operations += 1;
        metrics.successes += 1;
        metrics.totalDurationMs += durationMs;

        if (durationMs > (THEME_OPERATION_BUDGETS[operation as keyof typeof THEME_OPERATION_BUDGETS] || 1000)) {
            // No need for awkward call, this is handled within the service methods
        }
    }

    recordFailure(operation: string, durationMs: number, error: string): void {
        const metrics = this.getMetrics(operation);
        metrics.operations += 1;
        metrics.failures += 1;
        metrics.totalDurationMs += durationMs;
        metrics.lastError = error;
        metrics.lastErrorTime = Date.now();
    }

    getSummary() {
        const summary: Record<string, { ops: number; success: number; fail: number; avgMs: number; lastError?: string }> = {};
        for (const [op, metrics] of this.metrics) {
            summary[op] = {
                ops: metrics.operations,
                success: metrics.successes,
                fail: metrics.failures,
                avgMs: metrics.operations > 0 ? Math.round(metrics.totalDurationMs / metrics.operations) : 0,
                lastError: metrics.lastError
            };
        }
        return summary;
    }
}

const themeMetrics = new ThemeMetricsStore();

export { themeMetrics };

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
        const startTime = Date.now();
        try {
            await fs.mkdir(this.themesDir, { recursive: true });
            this.logDebug(`Themes directory: ${this.themesDir}`);
            themeMetrics.recordSuccess('ensureThemesDirectory', Date.now() - startTime);
        } catch (error) {
            const duration = Date.now() - startTime;
            const message = getErrorMessage(error);
            themeMetrics.recordFailure('ensureThemesDirectory', duration, message);
            if (message.includes('EACCES') || message.includes('permission')) {
                throw new Error(`${ThemeErrorCode.PERMISSION_DENIED}: Cannot create themes directory - ${message}`);
            }
            throw error;
        }
    }

    private async installBuiltInThemes(): Promise<void> {
        const builtInThemes = [
            {
                id: 'black',
                name: 'tengra-black',
                displayName: 'Tengra Black',
                version: '1.0.0',
                type: 'dark' as const,
                description: 'Pure black theme with electric cyan accents',
                author: 'Tengra Team',
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
                name: 'tengra-white',
                displayName: 'Tengra White',
                version: '1.0.0',
                type: 'light' as const,
                description: 'Clean white theme with vibrant purple accents',
                author: 'Tengra Team',
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
            this.logWarn('Manifest validation failed: not an object');
            return false;
        }

        const m = manifest as Record<string, unknown>;

        // Validate required string fields
        if (typeof m.id !== 'string' || !m.id.trim()) {
            this.logWarn('Manifest validation failed: invalid or missing id');
            return false;
        }
        if (typeof m.name !== 'string' || !m.name.trim()) {
            this.logWarn('Manifest validation failed: invalid or missing name');
            return false;
        }
        if (typeof m.displayName !== 'string' || !m.displayName.trim()) {
            this.logWarn('Manifest validation failed: invalid or missing displayName');
            return false;
        }
        if (typeof m.version !== 'string' || !m.version.trim()) {
            this.logWarn('Manifest validation failed: invalid or missing version');
            return false;
        }

        // Validate type enum
        if (m.type !== 'light' && m.type !== 'dark' && m.type !== 'highContrast') {
            this.logWarn(`Manifest validation failed: invalid type "${m.type}"`);
            return false;
        }

        // Validate colors object
        if (typeof m.colors !== 'object' || m.colors === null || Array.isArray(m.colors)) {
            this.logWarn('Manifest validation failed: colors must be an object');
            return false;
        }

        const colors = m.colors as Record<string, unknown>;
        // Validate required color fields
        const requiredColors = ['background', 'foreground', 'primary', 'secondary', 'accent', 'muted', 'destructive', 'border', 'input', 'ring', 'card', 'cardForeground', 'popover', 'popoverForeground', 'primaryForeground', 'secondaryForeground', 'accentForeground', 'destructiveForeground', 'mutedForeground'];
        for (const color of requiredColors) {
            if (typeof colors[color] !== 'string') {
                this.logWarn(`Manifest validation failed: missing or invalid color "${color}"`);
                return false;
            }
        }

        return true;
    }

    async getAllThemes(): Promise<ThemeManifest[]> {
        const startTime = Date.now();
        try {
            const themes = Array.from(this.installedThemes.values());
            themeMetrics.recordSuccess('getAllThemes', Date.now() - startTime);
            return themes;
        } catch (error) {
            themeMetrics.recordFailure('getAllThemes', Date.now() - startTime, getErrorMessage(error));
            return [];
        }
    }

    async getTheme(id: string): Promise<ThemeManifest | undefined> {
        const startTime = Date.now();
        try {
            // Validate input to prevent injection
            if (!id || typeof id !== 'string' || id.length > 256) {
                themeMetrics.recordFailure('getTheme', Date.now() - startTime, 'Invalid theme ID');
                return undefined;
            }
            const theme = this.installedThemes.get(id);
            themeMetrics.recordSuccess('getTheme', Date.now() - startTime);
            return theme;
        } catch (error) {
            themeMetrics.recordFailure('getTheme', Date.now() - startTime, getErrorMessage(error));
            return undefined;
        }
    }

    async installTheme(manifest: ThemeManifest): Promise<boolean> {
        const startTime = Date.now();
        try {
            if (!this.validateManifest(manifest)) {
                const errorMsg = 'Invalid theme manifest';
                themeMetrics.recordFailure('installTheme', Date.now() - startTime, errorMsg);
                throw new Error(`${ThemeErrorCode.INVALID_MANIFEST}: ${errorMsg}`);
            }

            const themePath = path.join(this.themesDir, `${manifest.id}.theme.json`);
            await fs.writeFile(themePath, JSON.stringify(manifest, null, 2));

            this.installedThemes.set(manifest.id, manifest);

            this.logInfo(`Installed theme: ${manifest.displayName}`);
            themeMetrics.recordSuccess('installTheme', Date.now() - startTime);
            return true;
        } catch (error) {
            const message = getErrorMessage(error);
            themeMetrics.recordFailure('installTheme', Date.now() - startTime, message);

            // Map specific errors to error codes
            if (message.includes('EACCES') || message.includes('permission')) {
                throw new Error(`${ThemeErrorCode.PERMISSION_DENIED}: ${message}`);
            }
            if (message.includes('ENOSPC') || message.includes('no space')) {
                throw new Error(`${ThemeErrorCode.DISK_FULL}: ${message}`);
            }
            throw error;
        }
    }

    async uninstallTheme(id: string): Promise<boolean> {
        const startTime = Date.now();

        // Validate input to prevent injection attacks
        if (!id || typeof id !== 'string' || id.length > 256 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
            const errorMsg = 'Invalid theme ID format';
            themeMetrics.recordFailure('uninstallTheme', Date.now() - startTime, errorMsg);
            this.logWarn(errorMsg);
            return false;
        }

        if (id === 'black' || id === 'white') {
            const errorMsg = `Cannot uninstall built-in theme: ${id}`;
            themeMetrics.recordFailure('uninstallTheme', Date.now() - startTime, errorMsg);
            this.logWarn(errorMsg);
            return false;
        }

        try {
            const themePath = path.join(this.themesDir, `${id}.theme.json`);
            await fs.unlink(themePath);

            this.installedThemes.delete(id);

            this.logInfo(`Uninstalled theme: ${id}`);
            themeMetrics.recordSuccess('uninstallTheme', Date.now() - startTime);
            return true;
        } catch (error) {
            const message = getErrorMessage(error);
            themeMetrics.recordFailure('uninstallTheme', Date.now() - startTime, message);

            // Map specific errors to error codes
            if (message.includes('ENOENT') || message.includes('no such file')) {
                this.logWarn(`Theme not found for deletion: ${id}`);
                return false;
            }
            if (message.includes('EACCES') || message.includes('permission')) {
                throw new Error(`${ThemeErrorCode.PERMISSION_DENIED}: Cannot delete theme - ${message}`);
            }
            throw error;
        }
    }

    /**
     * Get theme operation metrics summary
     * Useful for health dashboards and monitoring
     */
    getMetrics(): ReturnType<ThemeMetricsStore['getSummary']> {
        return themeMetrics.getSummary();
    }

    getThemesDirectory(): string {
        return this.themesDir;
    }
}

