/**
 * Database Migration Manager
 * Provides a robust system for managing database schema migrations
 */

import { CompatibleDatabase } from './sqljs-adapter'

export interface Migration {
    id: number
    name: string
    up: (db: CompatibleDatabase) => void
    down?: (db: CompatibleDatabase) => void // Optional rollback
}

export interface MigrationStatus {
    id: number
    name: string
    applied: boolean
    appliedAt?: number
}

export class MigrationManager {
    private migrations: Migration[] = []

    constructor(private db: CompatibleDatabase) {
        this.ensureMigrationsTable()
    }

    /**
     * Register a migration
     */
    register(migration: Migration): void {
        this.migrations.push(migration)
        // Sort by ID to ensure correct order
        this.migrations.sort((a, b) => a.id - b.id)
    }

    /**
     * Register multiple migrations
     */
    registerAll(migrations: Migration[]): void {
        for (const migration of migrations) {
            this.register(migration)
        }
    }

    /**
     * Get all registered migrations
     */
    getMigrations(): Migration[] {
        return [...this.migrations]
    }

    /**
     * Get migration status for all migrations
     */
    getStatus(): MigrationStatus[] {
        const applied = this.getAppliedMigrations()
        const appliedSet = new Set(applied.map(m => m.id))

        return this.migrations.map(migration => {
            const appliedMigration = applied.find(m => m.id === migration.id)
            return {
                id: migration.id,
                name: migration.name,
                applied: appliedSet.has(migration.id),
                appliedAt: appliedMigration?.appliedAt
            }
        })
    }

    /**
     * Run all pending migrations
     */
    migrate(): void {
        const applied = this.getAppliedMigrations()
        const appliedIds = new Set(applied.map(m => m.id))

        const pending = this.migrations.filter(m => !appliedIds.has(m.id))

        if (pending.length === 0) {
            console.log('[MigrationManager] No pending migrations')
            return
        }

        console.log(`[MigrationManager] Running ${pending.length} pending migration(s)`)

        for (const migration of pending) {
            this.runMigration(migration)
        }

        console.log('[MigrationManager] All migrations completed')
    }

    /**
     * Rollback the last migration
     */
    rollback(): void {
        const applied = this.getAppliedMigrations()
        if (applied.length === 0) {
            console.log('[MigrationManager] No migrations to rollback')
            return
        }

        const lastMigration = applied[applied.length - 1]
        const migration = this.migrations.find(m => m.id === lastMigration.id)

        if (!migration) {
            throw new Error(`Migration ${lastMigration.id} not found`)
        }

        if (!migration.down) {
            throw new Error(`Migration ${lastMigration.id} does not support rollback`)
        }

        console.log(`[MigrationManager] Rolling back migration ${lastMigration.id}: ${lastMigration.name}`)

        try {
            this.db.transaction(() => {
                migration.down!(this.db)
                this.db.prepare('DELETE FROM migrations WHERE id = ?').run(lastMigration.id)
            })()
            console.log(`[MigrationManager] Successfully rolled back migration ${lastMigration.id}`)
        } catch (error) {
            console.error(`[MigrationManager] Failed to rollback migration ${lastMigration.id}:`, error)
            throw error
        }
    }

    /**
     * Rollback to a specific migration ID
     */
    rollbackTo(targetId: number): void {
        const applied = this.getAppliedMigrations()
        const toRollback = applied.filter(m => m.id > targetId).sort((a, b) => b.id - a.id)

        for (let i = 0; i < toRollback.length; i++) {
            this.rollback()
        }
    }

    /**
     * Check if migrations table exists, create if not
     */
    private ensureMigrationsTable(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                run_at INTEGER NOT NULL
            )
        `)
    }

    /**
     * Get all applied migrations
     */
    private getAppliedMigrations(): Array<{ id: number; name: string; appliedAt: number }> {
        const stmt = this.db.prepare('SELECT id, name, run_at as appliedAt FROM migrations ORDER BY id')
        return stmt.all() as Array<{ id: number; name: string; appliedAt: number }>
    }

    /**
     * Run a single migration
     */
    private runMigration(migration: Migration): void {
        console.log(`[MigrationManager] Running migration ${migration.id}: ${migration.name}`)

        try {
            this.db.transaction(() => {
                migration.up(this.db)
                this.db.prepare('INSERT INTO migrations (id, name, run_at) VALUES (?, ?, ?)').run(
                    migration.id,
                    migration.name,
                    Date.now()
                )
            })()
            console.log(`[MigrationManager] Successfully applied migration ${migration.id}`)
        } catch (error) {
            console.error(`[MigrationManager] Migration ${migration.id} failed:`, error)
            throw error
        }
    }
}
