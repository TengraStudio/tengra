/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */


export type SqlValue = string | number | boolean | null | undefined | Uint8Array | Date
export type SqlParams = SqlValue[]

export interface RunResult {
    rowsAffected?: number | undefined
    insertId?: number | bigint | undefined
}

export interface PreparedStatement {
    run(...params: SqlValue[]): Promise<RunResult>
    all<T = RuntimeValue>(...params: SqlValue[]): Promise<T[]>
    get<T = RuntimeValue>(...params: SqlValue[]): Promise<T | undefined>
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
     * Execute a raw query and return rows.
     */
    query<T = RuntimeValue>(sql: string, params?: SqlParams): Promise<{ rows: T[]; fields?: RuntimeValue[] }>

    /**
     * Execute a transaction.
     */
    transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T>
}
