import { BaseService } from './base.service';
import { SettingsService } from './settings.service';
// import * as dotenv from 'dotenv'; // Ensure dotenv is installed or load manually if not. Assuming typical electron setup. 
// If dotenv is not available, we rely on process.env (already loaded) or simple file loading.
// For Electron main process, usually envs are passed or loaded in main.ts. We assume process.env is populated.

export class ConfigService extends BaseService {
    private cache: Map<string, any> = new Map();

    constructor(private settingsService: SettingsService) {
        super('ConfigService');
    }

    /**
     * Sets a runtime configuration value.
     */
    setConfig(key: string, value: any) {
        this.cache.set(key, value);
    }

    /**
     * Gets a configuration value.
     * Order of precedence:
     * 1. Runtime Cache
     * 2. Environment Variable (process.env)
     * 3. Settings File (settings.json via SettingsService)
     * 4. Default Value
     */
    get<T = string>(key: string, defaultValue?: T): T {
        // 1. Check runtime cache (overrides)
        if (this.cache.has(key)) {
            return this.cache.get(key) as T;
        }

        // 2. Check Environment Variables
        if (process.env[key] !== undefined) {
            // Basic casting, env vars are strings. Might need parsing for boolean/numbers if stricter typing needed.
            // For now return string or cast.
            return process.env[key] as unknown as T;
        }

        // 3. Check Settings Service
        const settings = this.settingsService.getSettings();
        const settingKey = key.toLowerCase().replace(/_/g, '.');
        const settingValue = settingKey.split('.').reduce((obj, k) => (obj && (obj as any)[k] !== 'undefined') ? (obj as any)[k] : undefined, settings);

        if (settingValue !== undefined && settingValue !== null) {
            return settingValue as T;
        }

        // 4. Return Default
        return defaultValue as T;
    }

    /**
     * Gets a config value or throws if missing.
     */
    getOrThrow<T>(key: string): T {
        const val = this.get<T>(key);
        if (val === undefined || val === null || val === '') {
            throw new Error(`Missing configuration for key: ${key}`);
        }
        return val;
    }

    /**
     * Helper to get database path
     */
    getDatabasePath(): string {
        return process.env.DATABASE_PATH || 'default-orbit.db';
    }
}
