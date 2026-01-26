/**
 * Database Migration Service
 * Handles schema versioning and data migrations
 */

import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { DataService } from '@main/services/data/data.service';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

export interface Migration {
    version: number
    name: string
    up: () => Promise<void>
    down?: () => Promise<void>
}

export interface MigrationRecord {
    version: number
    name: string
    appliedAt: string
}

export class MigrationService {
    private migrationsPath: string;
    private migrations: Migration[] = [];
    private applied: MigrationRecord[] = [];

    constructor(dataService: DataService) {
        this.migrationsPath = path.join(dataService.getPath('data'), 'migrations.json');
    }

    /**
     * Register a migration
     */
    register(migration: Migration) {
        // Insert in order by version
        const index = this.migrations.findIndex(m => m.version > migration.version);
        if (index === -1) {
            this.migrations.push(migration);
        } else {
            this.migrations.splice(index, 0, migration);
        }
    }

    /**
     * Load applied migrations from disk
     */
    private async loadApplied() {
        try {
            try {
                await fs.promises.access(this.migrationsPath);
            } catch { // Removed 'e' as it was unused
                // File does not exist, which is normal for a fresh install
                appLogger.debug('MigrationService', `Migration history file not found at ${this.migrationsPath}. Initializing empty.`);
                this.applied = [];
                return;
            }

            const content = await fs.promises.readFile(this.migrationsPath, 'utf8');
            this.applied = safeJsonParse<MigrationRecord[]>(content, []);
        } catch (error) {
            appLogger.error('MigrationService', `Failed to load migration history: ${getErrorMessage(error as Error)}`);
            this.applied = [];
        }
    }

    /**
     * Save applied migrations to disk
     */
    private async saveApplied() {
        try {
            const dir = path.dirname(this.migrationsPath);
            try {
                await fs.promises.access(dir);
            } catch {
                await fs.promises.mkdir(dir, { recursive: true });
            }
            await fs.promises.writeFile(this.migrationsPath, JSON.stringify(this.applied, null, 2));
        } catch (e) {
            appLogger.error('MigrationService', `Failed to save migration history: ${getErrorMessage(e as Error)}`);
        }
    }

    /**
     * Get current schema version
     */
    async getCurrentVersion(): Promise<number> {
        await this.loadApplied();
        if (this.applied.length === 0) { return 0; }
        return Math.max(...this.applied.map(m => m.version));
    }

    /**
     * Get pending migrations
     */
    async getPending(): Promise<Migration[]> {
        const currentVersion = await this.getCurrentVersion();
        return this.migrations.filter(m => m.version > currentVersion);
    }

    /**
     * Run all pending migrations
     */
    async migrate(): Promise<{ success: boolean; applied: string[]; error?: string }> {
        await this.loadApplied();
        const pending = await this.getPending();

        if (pending.length === 0) {
            appLogger.info('MigrationService', 'Database is up to date');
            return { success: true, applied: [] };
        }

        appLogger.info('MigrationService', `Running ${pending.length} pending migrations...`);

        const appliedMigrations: string[] = [];

        for (const migration of pending) {
            try {
                appLogger.info('MigrationService', `Running migration: ${migration.name} (v${migration.version})`);
                await migration.up();

                this.applied.push({
                    version: migration.version,
                    name: migration.name,
                    appliedAt: new Date().toISOString()
                });
                await this.saveApplied();

                appliedMigrations.push(migration.name);
                appLogger.info('MigrationService', `Completed: ${migration.name}`);
            } catch (e) {
                appLogger.error('MigrationService', `Failed migration ${migration.name}: ${getErrorMessage(e as Error)}`);
                return {
                    success: false,
                    applied: appliedMigrations,
                    error: `Migration ${migration.name} failed: ${getErrorMessage(e as Error)}`
                };
            }
        }

        appLogger.info('MigrationService', `Successfully applied ${appliedMigrations.length} migrations`);
        return { success: true, applied: appliedMigrations };
    }

    /**
     * Rollback the last migration (if down is defined)
     */
    async rollback(): Promise<{ success: boolean; rolledBack?: string; error?: string }> {
        await this.loadApplied();

        if (this.applied.length === 0) {
            return { success: false, error: 'No migrations to roll back' };
        }

        const lastApplied = this.applied[this.applied.length - 1];
        const migration = this.migrations.find(m => m.version === lastApplied.version);

        if (!migration) {
            return { success: false, error: `Migration v${lastApplied.version} not found in registry` };
        }

        if (!migration.down) {
            return { success: false, error: `Migration ${migration.name} does not support rollback` };
        }

        try {
            appLogger.info('MigrationService', `Rolling back: ${migration.name}`);
            await migration.down();

            this.applied.pop();
            await this.saveApplied();

            appLogger.info('MigrationService', `Rolled back: ${migration.name}`);
            return { success: true, rolledBack: migration.name };
        } catch (e) {
            appLogger.error('MigrationService', `Rollback failed for ${migration.name}: ${getErrorMessage(e as Error)}`);
            return { success: false, error: getErrorMessage(e as Error) };
        }
    }

    /**
     * Get migration status
     */
    async getStatus(): Promise<{
        currentVersion: number
        pendingCount: number
        appliedMigrations: MigrationRecord[]
        pendingMigrations: string[]
    }> {
        await this.loadApplied();
        const pending = await this.getPending();

        return {
            currentVersion: await this.getCurrentVersion(),
            pendingCount: pending.length,
            appliedMigrations: this.applied,
            pendingMigrations: pending.map(m => `v${m.version}: ${m.name}`)
        };
    }
}

// Singleton instance
let instance: MigrationService | null = null;

export function getMigrationService(dataService: DataService): MigrationService {
    return instance ??= new MigrationService(dataService);
}
