
export type SqlValue = string | number | boolean | null | undefined | Uint8Array | Date
export type SqlParams = SqlValue[]

export interface RunResult {
    rowsAffected?: number
    insertId?: number | bigint
}

export interface PreparedStatement {
    run(...params: SqlValue[]): Promise<RunResult>
    all<T = unknown>(...params: SqlValue[]): Promise<T[]>
    get<T = unknown>(...params: SqlValue[]): Promise<T | undefined>
}

export interface DatabaseAdapter {
    /**
     * Prepare a statement for execution.
     */
    prepare(sql: string): PreparedStatement

    /**
     * Execute a SQL string directly (no result rows expected).
     */
    exec(sql: string): Promise<void>

    /**
     * Execute a raw query and return rows (for PGlite compatibility).
     */
    query<T = unknown>(sql: string, params?: SqlParams): Promise<{ rows: T[]; fields?: unknown[] }>

    /**
     * Execute a transaction.
     */
    transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T>
}
