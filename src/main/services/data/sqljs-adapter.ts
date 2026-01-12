/**
 * SQL.js Adapter - Compatibility layer to make sql.js work like better-sqlite3
 * This allows us to use sql.js (pure JavaScript, no native compilation) instead of better-sqlite3
 */

import { Database as SqlJsDatabase } from 'sql.js'

// Compatibility interface matching better-sqlite3's API
export interface CompatibleDatabase {
    exec(sql: string): void
    pragma(sql: string): void
    prepare(sql: string): PreparedStatement
    transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T
    close(): void
}

export interface PreparedStatement {
    run(...params: any[]): { changes: number; lastInsertRowid: number }
    get(...params: any[]): any
    all(...params: any[]): any[]
    finalize(): void
}

export class SqlJsAdapter implements CompatibleDatabase {
    private db: SqlJsDatabase
    private preparedStatements: Map<string, PreparedStatement> = new Map()

    constructor(db: SqlJsDatabase) {
        this.db = db
    }

    exec(sql: string): void {
        // sql.js exec returns results, but we just execute
        this.db.run(sql)
    }

    pragma(sql: string): void {
        // sql.js doesn't have pragma method, but we can execute PRAGMA statements
        // Extract the pragma command and execute it
        const pragmaMatch = sql.match(/PRAGMA\s+(\w+)\s*=\s*(.+)/i)
        if (pragmaMatch) {
            // For most pragmas, sql.js handles them automatically or we can ignore them
            // WAL mode, synchronous, etc. are handled differently in sql.js
            // Just execute as regular SQL
            try {
                this.db.run(sql)
            } catch (err) {
                // Some pragmas might not be supported, that's okay
                console.warn(`[SqlJsAdapter] Pragma not supported: ${sql}`)
            }
        } else {
            this.db.run(sql)
        }
    }

    prepare(sql: string): PreparedStatement {
        // Check if we already have this prepared statement
        if (this.preparedStatements.has(sql)) {
            return this.preparedStatements.get(sql)!
        }

        // Create a new prepared statement wrapper
        const stmt = new SqlJsPreparedStatement(this.db, sql)
        this.preparedStatements.set(sql, stmt)
        return stmt
    }

    transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
        // sql.js doesn't have explicit transactions, but we can simulate them
        // This matches better-sqlite3's transaction API: db.transaction(fn)(args)
        return (...args: any[]) => {
            try {
                // Begin transaction (sql.js doesn't support this, but we can try)
                this.db.run('BEGIN TRANSACTION')
                const result = fn(...args)
                this.db.run('COMMIT')
                return result
            } catch (error) {
                try {
                    this.db.run('ROLLBACK')
                } catch (rollbackError) {
                    // Ignore rollback errors
                }
                throw error
            }
        }
    }

    close(): void {
        // Clean up prepared statements
        this.preparedStatements.forEach(stmt => {
            try {
                stmt.finalize()
            } catch (err) {
                // Ignore errors during cleanup
            }
        })
        this.preparedStatements.clear()
    }

    getDatabase(): SqlJsDatabase {
        return this.db
    }
}

class SqlJsPreparedStatement implements PreparedStatement {
    private db: SqlJsDatabase
    private sql: string

    constructor(db: SqlJsDatabase, sql: string) {
        this.db = db
        this.sql = sql
    }

    run(...params: any[]): { changes: number; lastInsertRowid: number } {
        // sql.js doesn't have prepared statements with parameters in the same way
        // We need to manually substitute parameters with proper escaping
        let sql = this.sql
        const paramCount = (sql.match(/\?/g) || []).length
        
        if (params.length > 0 && paramCount > 0) {
            // Parameter substitution with proper escaping
            let paramIndex = 0
            sql = sql.replace(/\?/g, () => {
                if (paramIndex >= params.length) return 'NULL'
                const param = params[paramIndex++]
                
                if (param === null || param === undefined) {
                    return 'NULL'
                } else if (typeof param === 'string') {
                    // Escape single quotes by doubling them
                    return `'${param.replace(/'/g, "''")}'`
                } else if (typeof param === 'number') {
                    return String(param)
                } else if (typeof param === 'boolean') {
                    return param ? '1' : '0'
                } else {
                    // For objects/arrays, stringify and escape
                    return `'${JSON.stringify(param).replace(/'/g, "''")}'`
                }
            })
        }

        try {
            this.db.run(sql)
            // Get last insert rowid if this was an INSERT
            let lastInsertRowid = 0
            if (sql.trim().toUpperCase().startsWith('INSERT')) {
                try {
                    const result = this.db.exec('SELECT last_insert_rowid() as id')
                    if (result.length > 0 && result[0].values.length > 0) {
                        lastInsertRowid = result[0].values[0][0] as number
                    }
                } catch (e) {
                    // Ignore if last_insert_rowid() is not available
                }
            }
            
            return {
                changes: 1, // Approximate - sql.js doesn't provide exact count
                lastInsertRowid: lastInsertRowid
            }
        } catch (error) {
            console.error(`[SqlJsPreparedStatement] Error executing: ${sql}`, error)
            throw error
        }
    }

    get(...params: any[]): any {
        // Use the same parameter substitution as all()
        let sql = this.sql
        const paramCount = (sql.match(/\?/g) || []).length
        
        if (params.length > 0 && paramCount > 0) {
            let paramIndex = 0
            sql = sql.replace(/\?/g, () => {
                if (paramIndex >= params.length) return 'NULL'
                const param = params[paramIndex++]
                
                if (param === null || param === undefined) {
                    return 'NULL'
                } else if (typeof param === 'string') {
                    return `'${param.replace(/'/g, "''")}'`
                } else if (typeof param === 'number') {
                    return String(param)
                } else if (typeof param === 'boolean') {
                    return param ? '1' : '0'
                } else {
                    return `'${JSON.stringify(param).replace(/'/g, "''")}'`
                }
            })
        }

        try {
            const results = this.db.exec(sql)
            if (results.length === 0) {
                return undefined
            }

            // Convert sql.js result format to object
            const columns = results[0].columns
            const values = results[0].values
            
            if (values.length === 0) {
                return undefined
            }

            const obj: any = {}
                columns.forEach((col: string, index: number) => {
                    obj[col] = values[0][index]
                })

            return obj
        } catch (error) {
            console.error(`[SqlJsPreparedStatement] Error querying: ${sql}`, error)
            throw error
        }
    }

    all(...params: any[]): any[] {
        let sql = this.sql
        const paramCount = (sql.match(/\?/g) || []).length
        
        if (params.length > 0 && paramCount > 0) {
            // Parameter substitution with proper escaping
            let paramIndex = 0
            sql = sql.replace(/\?/g, () => {
                if (paramIndex >= params.length) return 'NULL'
                const param = params[paramIndex++]
                
                if (param === null || param === undefined) {
                    return 'NULL'
                } else if (typeof param === 'string') {
                    return `'${param.replace(/'/g, "''")}'`
                } else if (typeof param === 'number') {
                    return String(param)
                } else if (typeof param === 'boolean') {
                    return param ? '1' : '0'
                } else {
                    return `'${JSON.stringify(param).replace(/'/g, "''")}'`
                }
            })
        }

        try {
            const results = this.db.exec(sql)
            if (results.length === 0) {
                return []
            }

            // Convert sql.js result format to array of objects
            const columns = results[0].columns
            const values = results[0].values
            const rows: any[] = []

            for (const row of values) {
                const obj: any = {}
            columns.forEach((col: string, index: number) => {
                obj[col] = row[index]
            })
                rows.push(obj)
            }

            return rows
        } catch (error) {
            console.error(`[SqlJsPreparedStatement] Error querying: ${sql}`, error)
            throw error
        }
    }

    finalize(): void {
        // sql.js doesn't require explicit finalization
        // But we can mark it as finalized
    }
}
