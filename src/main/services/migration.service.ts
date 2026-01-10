/**
 * Database Migration Service
 * Handles schema versioning and data migrations
 */

import * as fs from 'fs'
import * as path from 'path'
import { DataService } from '../services/data/data.service'
import { getErrorMessage } from '../../shared/utils/error.util'

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
    private migrationsPath: string
    private migrations: Migration[] = []
    private applied: MigrationRecord[] = []

    constructor(dataService: DataService) {
        this.migrationsPath = path.join(dataService.getPath('data'), 'migrations.json')
    }

    /**
     * Register a migration
     */
    register(migration: Migration) {
        // Insert in order by version
        const index = this.migrations.findIndex(m => m.version > migration.version)
        if (index === -1) {
            this.migrations.push(migration)
        } else {
            this.migrations.splice(index, 0, migration)
        }
    }

    /**
     * Load applied migrations from disk
     */
    private loadApplied() {
        try {
            if (fs.existsSync(this.migrationsPath)) {
                const content = fs.readFileSync(this.migrationsPath, 'utf8')
                this.applied = JSON.parse(content)
            }
        } catch (e) {
            console.error('[MigrationService] Failed to load migration history:', getErrorMessage(e as Error))
            this.applied = []
        }
    }

    /**
     * Save applied migrations to disk
     */
    private saveApplied() {
        try {
            const dir = path.dirname(this.migrationsPath)
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true })
            }
            fs.writeFileSync(this.migrationsPath, JSON.stringify(this.applied, null, 2))
        } catch (e) {
            console.error('[MigrationService] Failed to save migration history:', getErrorMessage(e as Error))
        }
    }

    /**
     * Get current schema version
     */
    getCurrentVersion(): number {
        this.loadApplied()
        if (this.applied.length === 0) return 0
        return Math.max(...this.applied.map(m => m.version))
    }

    /**
     * Get pending migrations
     */
    getPending(): Migration[] {
        const currentVersion = this.getCurrentVersion()
        return this.migrations.filter(m => m.version > currentVersion)
    }

    /**
     * Run all pending migrations
     */
    async migrate(): Promise<{ success: boolean; applied: string[]; error?: string }> {
        this.loadApplied()
        const pending = this.getPending()

        if (pending.length === 0) {
            console.log('[MigrationService] Database is up to date')
            return { success: true, applied: [] }
        }

        console.log(`[MigrationService] Running ${pending.length} pending migrations...`)

        const appliedMigrations: string[] = []

        for (const migration of pending) {
            try {
                console.log(`[MigrationService] Running migration: ${migration.name} (v${migration.version})`)
                await migration.up()

                this.applied.push({
                    version: migration.version,
                    name: migration.name,
                    appliedAt: new Date().toISOString()
                })
                this.saveApplied()

                appliedMigrations.push(migration.name)
                console.log(`[MigrationService] Completed: ${migration.name}`)
            } catch (e) {
                console.error(`[MigrationService] Failed migration ${migration.name}:`, e)
                return {
                    success: false,
                    applied: appliedMigrations,
                    error: `Migration ${migration.name} failed: ${getErrorMessage(e as Error)}`
                }
            }
        }

        console.log(`[MigrationService] Successfully applied ${appliedMigrations.length} migrations`)
        return { success: true, applied: appliedMigrations }
    }

    /**
     * Rollback the last migration (if down is defined)
     */
    async rollback(): Promise<{ success: boolean; rolledBack?: string; error?: string }> {
        this.loadApplied()

        if (this.applied.length === 0) {
            return { success: false, error: 'No migrations to roll back' }
        }

        const lastApplied = this.applied[this.applied.length - 1]
        const migration = this.migrations.find(m => m.version === lastApplied.version)

        if (!migration) {
            return { success: false, error: `Migration v${lastApplied.version} not found in registry` }
        }

        if (!migration.down) {
            return { success: false, error: `Migration ${migration.name} does not support rollback` }
        }

        try {
            console.log(`[MigrationService] Rolling back: ${migration.name}`)
            await migration.down()

            this.applied.pop()
            this.saveApplied()

            console.log(`[MigrationService] Rolled back: ${migration.name}`)
            return { success: true, rolledBack: migration.name }
        } catch (e) {
            console.error(`[MigrationService] Rollback failed for ${migration.name}:`, e)
            return { success: false, error: getErrorMessage(e as Error) }
        }
    }

    /**
     * Get migration status
     */
    getStatus(): {
        currentVersion: number
        pendingCount: number
        appliedMigrations: MigrationRecord[]
        pendingMigrations: string[]
    } {
        this.loadApplied()
        const pending = this.getPending()

        return {
            currentVersion: this.getCurrentVersion(),
            pendingCount: pending.length,
            appliedMigrations: this.applied,
            pendingMigrations: pending.map(m => `v${m.version}: ${m.name}`)
        }
    }
}

// Singleton instance
let instance: MigrationService | null = null

export function getMigrationService(dataService: DataService): MigrationService {
    if (!instance) {
        instance = new MigrationService(dataService)
    }
    return instance
}
