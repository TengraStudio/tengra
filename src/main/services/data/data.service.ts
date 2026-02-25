import * as fsp from 'fs/promises';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { TelemetryService } from '@main/services/analysis/telemetry.service';
import { BaseService } from '@main/services/base.service';
import { getErrorMessage } from '@shared/utils/error.util';
import { app } from 'electron';

/**
 * Standardized error codes for DataService operations
 */
export enum DataServiceErrorCode {
    INITIALIZATION_FAILED = 'DATA_SERVICE_INIT_FAILED',
    DIRECTORY_CREATE_FAILED = 'DATA_SERVICE_DIR_CREATE_FAILED',
    MIGRATION_FAILED = 'DATA_SERVICE_MIGRATION_FAILED',
    MIGRATION_PATH_INVALID = 'DATA_SERVICE_MIGRATION_PATH_INVALID',
    PATH_TYPE_INVALID = 'DATA_SERVICE_PATH_TYPE_INVALID',
    FILE_OPERATION_FAILED = 'DATA_SERVICE_FILE_OP_FAILED',
    PERMISSION_DENIED = 'DATA_SERVICE_PERMISSION_DENIED'
}

/**
 * Performance budget thresholds for DataService operations (in milliseconds)
 */
export const DATA_SERVICE_PERFORMANCE_BUDGETS = {
    INITIALIZE_MS: 5000,
    MIGRATE_MS: 30000,
    ENSURE_DIRECTORY_MS: 1000,
    GET_PATH_MS: 10
} as const;

/**
 * Telemetry event names for DataService
 */
export enum DataServiceTelemetryEvent {
    INITIALIZE_START = 'data_service_initialize_start',
    INITIALIZE_COMPLETE = 'data_service_initialize_complete',
    INITIALIZE_ERROR = 'data_service_initialize_error',
    MIGRATE_START = 'data_service_migrate_start',
    MIGRATE_COMPLETE = 'data_service_migrate_complete',
    MIGRATE_ERROR = 'data_service_migrate_error',
    DIRECTORY_CREATED = 'data_service_directory_created',
    PATH_ACCESSED = 'data_service_path_accessed'
}

export type DataType = 'auth' | 'db' | 'config' | 'logs' | 'models' | 'gallery' | 'galleryImages' | 'galleryVideos' | 'data'

/**
 * Valid DataType values for validation
 */
const VALID_DATA_TYPES: DataType[] = ['auth', 'db', 'config', 'logs', 'models', 'gallery', 'galleryImages', 'galleryVideos', 'data'];

/**
 * Migration entry definition
 */
interface MigrationEntry {
    old: string;
    new: string;
    isDir: boolean;
}

export class DataService extends BaseService {
    private baseDir: string;
    private paths: Record<DataType, string>;
    private telemetryService: TelemetryService | null = null;
    private initialized = false;

    constructor() {
        super('DataService');

        // Use standard AppData/tengra/data structure
        // app.getPath('userData') usually points to AppData/Roaming/tengra (or similar)
        // We want to organize things cleanly inside it.
        const userData = app.getPath('userData');
        this.baseDir = path.join(userData, 'data');

        this.paths = {
            auth: path.join(this.baseDir, 'auth'),
            db: path.join(userData, 'db'),
            config: path.join(this.baseDir, 'config'),
            logs: path.join(this.baseDir, 'logs'),
            models: path.join(this.baseDir, 'models'),
            data: this.baseDir, // Base data directory
            gallery: path.join(this.baseDir, 'gallery'),
            galleryImages: path.join(this.baseDir, 'gallery', 'images'),
            galleryVideos: path.join(this.baseDir, 'gallery', 'videos')
        };
    }

    /**
     * Set the telemetry service dependency
     */
    setTelemetryService(service: TelemetryService): void {
        this.telemetryService = service;
    }

    /**
     * Track telemetry event if service is available
     */
    private trackEvent(eventName: DataServiceTelemetryEvent, properties?: Record<string, unknown>): void {
        if (this.telemetryService) {
            this.telemetryService.track(eventName, properties);
        }
    }

    /**
     * Validate that the provided DataType is valid
     */
    private validateDataType(type: unknown): type is DataType {
        return typeof type === 'string' && VALID_DATA_TYPES.includes(type as DataType);
    }

    async initialize(): Promise<void> {
        const startTime = Date.now();
        this.logInfo('Initializing data service and ensuring directory structure...');
        this.trackEvent(DataServiceTelemetryEvent.INITIALIZE_START);

        try {
            await this.ensureDirectories();
            this.initialized = true;
            const duration = Date.now() - startTime;

            this.logInfo(`Data service initialized successfully in ${duration}ms`);
            this.trackEvent(DataServiceTelemetryEvent.INITIALIZE_COMPLETE, {
                durationMs: duration,
                success: true
            });

            // Warn if initialization exceeded budget
            if (duration > DATA_SERVICE_PERFORMANCE_BUDGETS.INITIALIZE_MS) {
                this.logWarn(`Initialization exceeded performance budget: ${duration}ms > ${DATA_SERVICE_PERFORMANCE_BUDGETS.INITIALIZE_MS}ms`);
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logError('Failed to initialize data service', error);
            this.trackEvent(DataServiceTelemetryEvent.INITIALIZE_ERROR, {
                durationMs: duration,
                error: getErrorMessage(error as Error)
            });
            throw error;
        }
    }

    async cleanup(): Promise<void> {
        this.logInfo('Data service cleanup - no resources to clean');
        this.initialized = false;
    }

    /**
     * Check if the service has been initialized
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    private async ensureDirectories(): Promise<void> {
        const startTime = Date.now();

        try {
            await fsp.mkdir(this.baseDir, { recursive: true, mode: 0o700 });
            this.trackEvent(DataServiceTelemetryEvent.DIRECTORY_CREATED, { path: this.baseDir });

            for (const targetPath of Object.values(this.paths)) {
                await fsp.mkdir(targetPath, { recursive: true, mode: 0o700 });
                this.trackEvent(DataServiceTelemetryEvent.DIRECTORY_CREATED, { path: targetPath });
            }

            const duration = Date.now() - startTime;
            if (duration > DATA_SERVICE_PERFORMANCE_BUDGETS.ENSURE_DIRECTORY_MS) {
                this.logWarn(`ensureDirectories exceeded budget: ${duration}ms`);
            }
        } catch (error) {
            this.logError('Failed to create directories', error);
            const dataError = new Error(getErrorMessage(error)) as Error & { code?: string };
            dataError.code = DataServiceErrorCode.DIRECTORY_CREATE_FAILED;
            throw dataError;
        }
    }

    /**
     * Get the path for a given data type.
     * @param type - The type of data to get the path for
     * @returns The path string for the requested data type
     * @throws Error if the type is invalid
     */
    getPath(type: DataType): string {
        const startTime = Date.now();

        if (!this.validateDataType(type)) {
            const error = new Error(`Invalid DataType: ${type}`) as Error & { code?: string };
            error.code = DataServiceErrorCode.PATH_TYPE_INVALID;
            throw error;
        }

        const result = this.paths[type];
        const duration = Date.now() - startTime;

        this.trackEvent(DataServiceTelemetryEvent.PATH_ACCESSED, { type, durationMs: duration });

        if (duration > DATA_SERVICE_PERFORMANCE_BUDGETS.GET_PATH_MS) {
            this.logWarn(`getPath exceeded budget for type ${type}: ${duration}ms`);
        }

        return result;
    }

    /**
     * Get all registered paths
     */
    getAllPaths(): Record<DataType, string> {
        return { ...this.paths };
    }

    /**
     * Get the base data directory
     */
    getBaseDir(): string {
        return this.baseDir;
    }

    /**
     * Validate a path is within allowed directories (path traversal protection)
     */
    validatePath(targetPath: string, allowedRoot: string): boolean {
        const resolvedTarget = path.resolve(targetPath);
        const resolvedRoot = path.resolve(allowedRoot);
        return resolvedTarget.startsWith(resolvedRoot);
    }

    /**
     * One-time migration to move files from old locations to new centralized locations.
     * Should be called on app startup.
     */
    async migrate() {
        const userData = app.getPath('userData'); // tengra/runtime
        const rootPath = path.dirname(userData);  // tengra

        const migrations: MigrationEntry[] = [
            // Auth: root/auth -> data/auth
            {
                old: path.join(rootPath, 'auth'),
                new: this.paths.auth,
                isDir: true
            },
            // Encrypted Token: root/cliproxy-auth.enc -> data/auth/proxy-auth-token.enc
            {
                old: path.join(rootPath, 'cliproxy-auth.enc'),
                new: path.join(this.paths.auth, 'proxy-auth-token.enc'),
                isDir: false
            },
            // Legacy Migration: root/cliproxy-auth-work -> data/auth
            {
                old: path.join(rootPath, 'cliproxy-auth-work'),
                new: this.paths.auth,
                isDir: true
            },
            // DB: root/tengra-lancedb -> data/db/vector-store (Renamed from tengra-lancedb)
            {
                old: path.join(rootPath, 'tengra-lancedb'),
                new: path.join(this.paths.db, 'vector-store'),
                isDir: true
            },
            // DB: runtime/data/db/tengra-lancedb -> data/db/vector-store (Rename if already migrated)
            {
                old: path.join(this.paths.db, 'tengra-lancedb'),
                new: path.join(this.paths.db, 'vector-store'),
                isDir: true
            },
            // SQLite: root/databases -> data/db
            // We move the contents of root/databases to data/db
            {
                old: path.join(rootPath, 'databases'),
                new: this.paths.db,
                isDir: true
            },
            // Settings: root/settings.json -> data/config/settings.json
            {
                old: path.join(rootPath, 'settings.json'),
                new: path.join(this.paths.config, 'settings.json'),
                isDir: false
            },
            // Proxy Config: root/proxy-config.yaml -> data/config/proxy-config.yaml
            {
                old: path.join(rootPath, 'proxy-config.yaml'),
                new: path.join(this.paths.config, 'proxy-config.yaml'),
                isDir: false
            },
            // Models: root/models -> data/models
            {
                old: path.join(rootPath, 'models'),
                new: this.paths.models,
                isDir: true
            },
            // Static: root/static -> runtime/static
            // We assume static files should be in runtime/static as app assets
            {
                old: path.join(rootPath, 'static'),
                new: path.join(userData, 'static'),
                isDir: true
            },
            // Gallery: Pictures/tengra/Gallery -> gallery/images (External path)
            {
                old: path.join(app.getPath('pictures'), 'tengra', 'Gallery'),
                new: this.paths.galleryImages,
                isDir: true
            }
        ];

        appLogger.info('DataService', 'Checking for migrations...');

        for (const [index, migration] of migrations.entries()) {
            try {
                if (!(await this.pathExists(migration.old))) {
                    continue;
                }

                if (migration.isDir) {
                    await this.migrateDirectory(migration.old, migration.new);
                } else {
                    await this.migrateFile(migration.old, migration.new);
                }
                if ((index + 1) % 3 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            } catch (error) {
                appLogger.error('DataService', `Failed to migrate ${migration.old}: ${getErrorMessage(error as Error)}`);
            }
        }

        // Cleanup: Remove legacy .cli-proxy-api folder from Root
        try {
            const legacyPath = path.join(rootPath, '.cli-proxy-api');
            if (await this.pathExists(legacyPath)) {
                appLogger.info('DataService', 'Cleaning up legacy .cli-proxy-api folder');
                await fsp.rm(legacyPath, { recursive: true, force: true });
            }
        } catch (e) {
            appLogger.error('DataService', `Failed to cleanup legacy folder: ${getErrorMessage(e as Error)}`);
        }
    }

    private async migrateDirectory(oldPath: string, newPath: string): Promise<void> {
        await fsp.mkdir(newPath, { recursive: true });
        const files = await fsp.readdir(oldPath);
        for (const file of files) {
            const oldFile = path.join(oldPath, file);
            const newFile = path.join(newPath, file);
            if (await this.pathExists(newFile)) {
                continue;
            }
            appLogger.info('DataService', `Migrating file ${file} to ${newPath}`);
            await fsp.rename(oldFile, newFile);
        }

        // Try to remove old dir if empty
        try {
            if ((await fsp.readdir(oldPath)).length === 0) {
                await fsp.rmdir(oldPath);
            }
        } catch {
            // Ignore error during cleanup of empty dir
        }
    }

    private async migrateFile(oldPath: string, newPath: string): Promise<void> {
        if (await this.pathExists(newPath)) {
            return;
        }
        appLogger.info('DataService', `Migrating ${path.basename(oldPath)} to ${newPath}`);
        const destDir = path.dirname(newPath);
        await fsp.mkdir(destDir, { recursive: true });
        await fsp.rename(oldPath, newPath);
    }

    private async pathExists(targetPath: string): Promise<boolean> {
        try {
            await fsp.access(targetPath);
            return true;
        } catch {
            return false;
        }
    }
}

