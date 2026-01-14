/**
 * Database Migration Manager
 * Provides a robust system for managing database schema migrations
 * Updated for Async/PGlite compatibility
 */

export interface AsyncDatabaseAdapter {
    prepare(sql: string): {
        run(...params: any[]): Promise<any>;
        all(...params: any[]): Promise<any[]>;
        get(...params: any[]): Promise<any>;
    };
    exec(sql: string): Promise<void>;
    transaction<T>(fn: (tx: any) => Promise<T>): Promise<T>;
    query(sql: string, params?: any[]): Promise<any>; // PGlite raw access
}

export interface Migration {
    id: number
    name: string
    up: (db: AsyncDatabaseAdapter) => Promise<void>
    down?: (db: AsyncDatabaseAdapter) => Promise<void> // Optional rollback
}

export interface MigrationStatus {
    id: number
    name: string
    applied: boolean
    appliedAt?: number
}

export class MigrationManager {
    private migrations: Migration[] = []

    constructor(private db: AsyncDatabaseAdapter) {
        // Init happens in migrate() to ensure async is awaited
    }

    /**
     * Register a migration
     */
    register(migration: Migration): void {
        this.migrations.push(migration)
        this.migrations.sort((a, b) => a.id - b.id)
    }

    registerAll(migrations: Migration[]): void {
        for (const migration of migrations) this.register(migration)
    }

    getMigrations(): Migration[] {
        return [...this.migrations]
    }

    async getStatus(): Promise<MigrationStatus[]> {
        await this.ensureMigrationsTable()
        const applied = await this.getAppliedMigrations()
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

    async migrate(): Promise<void> {
        await this.ensureMigrationsTable()
        const applied = await this.getAppliedMigrations()
        const appliedIds = new Set(applied.map(m => m.id))

        const pending = this.migrations.filter(m => !appliedIds.has(m.id))

        if (pending.length === 0) {
            console.log('[MigrationManager] No pending migrations')
            return
        }

        console.log(`[MigrationManager] Running ${pending.length} pending migration(s)`)

        for (const migration of pending) {
            await this.runMigration(migration)
        }

        console.log('[MigrationManager] All migrations completed')
    }

    async rollback(): Promise<void> {
        await this.ensureMigrationsTable()
        const applied = await this.getAppliedMigrations()
        if (applied.length === 0) return

        const lastMigration = applied[applied.length - 1]
        const migration = this.migrations.find(m => m.id === lastMigration.id)

        if (!migration || !migration.down) {
            throw new Error(`Migration ${lastMigration.id} does not support rollback`)
        }

        console.log(`[MigrationManager] Rolling back migration ${lastMigration.id}: ${lastMigration.name}`)

        try {
            await this.db.transaction(async (tx) => {
                await migration.down!(tx)
                await tx.prepare('DELETE FROM migrations WHERE id = $1').run(lastMigration.id)
            })
            console.log(`[MigrationManager] Successfully rolled back migration ${lastMigration.id}`)
        } catch (error) {
            console.error(`[MigrationManager] Failed to rollback migration ${lastMigration.id}:`, error)
            throw error
        }
    }

    private async ensureMigrationsTable(): Promise<void> {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                run_at BIGINT NOT NULL
            )
        `)

        // Ensure existing table has BIGINT for run_at (fixes legacy INTEGER type)
        try {
            await this.db.exec('ALTER TABLE migrations ALTER COLUMN run_at TYPE BIGINT')
        } catch (e) {
            // Ignore error if it fails (e.g. column already BIGINT or type change not supported)
            console.debug('[MigrationManager] migration table type fix skipped or failed:', e)
        }
    }

    private async getAppliedMigrations(): Promise<Array<{ id: number; name: string; appliedAt: number }>> {
        const stmt = this.db.prepare('SELECT id, name, run_at as appliedAt FROM migrations ORDER BY id')
        return (await stmt.all()) as Array<{ id: number; name: string; appliedAt: number }>
    }

    private async runMigration(migration: Migration): Promise<void> {
        console.log(`[MigrationManager] Running migration ${migration.id}: ${migration.name}`)

        try {
            // Transaction wrapper
            await this.db.transaction(async (tx) => {
                await migration.up(tx)
                await tx.prepare('INSERT INTO migrations (id, name, run_at) VALUES ($1, $2, $3)').run(
                    migration.id,
                    migration.name,
                    Date.now()
                )
            })
            console.log(`[MigrationManager] Successfully applied migration ${migration.id}`)
        } catch (error) {
            console.error(`[MigrationManager] Migration ${migration.id} failed:`, error)
            throw error
        }
    }
}
