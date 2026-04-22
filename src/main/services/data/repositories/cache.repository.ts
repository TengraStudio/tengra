/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { DatabaseAdapter } from '@shared/types/database';
import { BaseRepository } from './base.repository';

export interface CacheEntry {
    namespace: string;
    key: string;
    value: string; // JSON string
    expiresAt: number | null;
    updatedAt: number;
}

export class CacheRepository extends BaseRepository {
    constructor(adapter: DatabaseAdapter) {
        super(adapter);
    }

    async ensureCacheTable(): Promise<void> {
        await this.adapter.exec(`
            CREATE TABLE IF NOT EXISTS cache (
                namespace TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                expires_at INTEGER,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (namespace, key)
            );
            CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at);
        `);
    }

    async get(namespace: string, key: string): Promise<CacheEntry | null> {
        const rows = await this.adapter.query<CacheEntry>(
            'SELECT namespace, key, value, expires_at as expiresAt, updated_at as updatedAt FROM cache WHERE namespace = ? AND key = ?',
            [namespace, key]
        );
        return rows.rows[0] || null;
    }

    async set(namespace: string, key: string, value: string, expiresAt: number | null): Promise<void> {
        await this.adapter.prepare(`
            INSERT INTO cache (namespace, key, value, expires_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(namespace, key) DO UPDATE SET
                value = excluded.value,
                expires_at = excluded.expires_at,
                updated_at = excluded.updated_at
        `).run(namespace, key, value, expiresAt, Date.now());
    }

    async delete(namespace: string, key: string): Promise<void> {
        await this.adapter.prepare('DELETE FROM cache WHERE namespace = ? AND key = ?').run(namespace, key);
    }

    async clearNamespace(namespace: string): Promise<void> {
        await this.adapter.prepare('DELETE FROM cache WHERE namespace = ?').run(namespace);
    }

    async deleteExpired(): Promise<number> {
        const result = await this.adapter.prepare('DELETE FROM cache WHERE expires_at IS NOT NULL AND expires_at < ?').run(Date.now());
        return result.rowsAffected ?? 0;
    }

    async getNamespacedEntries(namespace: string): Promise<CacheEntry[]> {
        const rows = await this.adapter.query<CacheEntry>(
            'SELECT namespace, key, value, expires_at as expiresAt, updated_at as updatedAt FROM cache WHERE namespace = ?',
            [namespace]
        );
        return rows.rows;
    }
}
