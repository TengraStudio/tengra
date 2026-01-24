import { BaseService } from '@main/services/base.service';
import { SettingsService } from '@main/services/system/settings.service';
import { JsonValue } from '@shared/types/common';
import { appLogger } from '@main/logging/logger';

/**
 * Service for managing configuration values with priority-based resolution.
 * Configuration values are resolved in the following order:
 * 1. Runtime cache (highest priority)
 * 2. Environment variables
 * 3. Settings file
 * 4. Default value (lowest priority)
 */
export class ConfigService extends BaseService {
    private cache: Map<string, JsonValue> = new Map();

    constructor(private settingsService: SettingsService) {
        super('ConfigService');
    }

    /**
     * Initialize the ConfigService
     */
    async initialize(): Promise<void> {
        appLogger.info(this.name, 'Initializing configuration service...');
        
        // Pre-load common configuration values
        const commonKeys = ['DATABASE_PATH', 'NODE_ENV', 'LOG_LEVEL', 'API_TIMEOUT'];
        for (const key of commonKeys) {
            if (process.env[key]) {
                this.cache.set(key, process.env[key]);
            }
        }
        
        appLogger.info(this.name, `Initialized with ${this.cache.size} cached config values`);
    }

    /**
     * Cleanup the ConfigService
     */
    async cleanup(): Promise<void> {
        appLogger.info(this.name, 'Cleaning up configuration service...');
        this.cache.clear();
        appLogger.info(this.name, 'Configuration cache cleared');
    }

    /**
     * Sets a runtime configuration value.
     * 
     * @param key - The configuration key
     * @param value - The value to set (must be JSON-serializable)
     */
    setConfig(key: string, value: JsonValue): void {
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
        const settingValue = settingKey.split('.').reduce((obj: JsonValue | undefined, k: string) => {
            if (obj && typeof obj === 'object' && k in obj) {
                return (obj as Record<string, JsonValue>)[k];
            }
            return undefined;
        }, settings as JsonValue);

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
        return process.env.DATABASE_PATH ?? 'default-orbit.db';
    }
}
