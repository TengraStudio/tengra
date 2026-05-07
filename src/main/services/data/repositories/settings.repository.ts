/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { JsonObject } from '@shared/types/common';
import { DatabaseAdapter } from '@shared/types/database';
import { getErrorMessage } from '@shared/utils/error.util';

import { BaseRepository } from './base.repository';

/** Represents a single settings entry stored in the database. */
export interface SettingsEntry {
    key: string;
    value: string;
    category: string;
    updatedAt: number;
}

/**
 * Repository for persisting application settings as key-value pairs.
 * Provides typed CRUD operations over the `app_settings` table.
 */
export class SettingsRepository extends BaseRepository {
    constructor(adapter: DatabaseAdapter) {
        super(adapter);
    }

    /** Ensures the `app_settings` table exists. */
    async ensureTable(): Promise<void> {
        await this.adapter.exec(`
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL DEFAULT '{}',
                category TEXT NOT NULL DEFAULT 'general',
                updated_at INTEGER NOT NULL
            )
        `);
    }

    /** Retrieve a single setting by key, returning `undefined` when absent. */
    async get(key: string): Promise<SettingsEntry | undefined> {
        const row = await this.adapter
            .prepare('SELECT * FROM app_settings WHERE key = ?')
            .get<JsonObject>(key);
        return row ? this.mapRow(row) : undefined;
    }

    /** Retrieve the parsed JSON value for a key, or `defaultValue` when absent. */
    async getValue<T>(key: string, defaultValue: T): Promise<T> {
        const entry = await this.get(key);
        if (!entry) { return defaultValue; }
        return this.parseJsonField<T>(entry.value, defaultValue);
    }

    /** Insert or update a setting. The value is serialised as JSON. */
    async set(key: string, value: RuntimeValue, category: string = 'general'): Promise<{ success: boolean; error?: string }> {
        try {
            const now = Date.now();
            const serialised = JSON.stringify(value);
            await this.adapter
                .prepare(`INSERT INTO app_settings(key, value, category, updated_at)
                          VALUES(?, ?, ?, ?)
                          ON CONFLICT(key) DO UPDATE SET value = ?, category = ?, updated_at = ?`)
                .run(key, serialised, category, now, serialised, category, now);
            return { success: true };
        } catch (error) {
            appLogger.error('SettingsRepository', `Failed to set "${key}"`, error as Error);
            return { success: false, error: getErrorMessage(error) };
        }
    }

    /** Retrieve all settings belonging to the given category. */
    async getByCategory(category: string): Promise<SettingsEntry[]> {
        const rows = await this.selectAllPaginated<JsonObject>(
            'SELECT * FROM app_settings WHERE category = ? ORDER BY key ASC',
            [category]
        );
        return rows.map(r => this.mapRow(r));
    }

    /** Delete a single setting by key. */
    async delete(key: string): Promise<{ success: boolean; error?: string }> {
        try {
            await this.adapter.prepare('DELETE FROM app_settings WHERE key = ?').run(key);
            return { success: true };
        } catch (error) {
            appLogger.error('SettingsRepository', `Failed to delete "${key}"`, error as Error);
            return { success: false, error: getErrorMessage(error) };
        }
    }

    /** Delete all settings in a category. */
    async deleteByCategory(category: string): Promise<{ success: boolean; error?: string }> {
        try {
            await this.adapter.prepare('DELETE FROM app_settings WHERE category = ?').run(category);
            return { success: true };
        } catch (error) {
            appLogger.error('SettingsRepository', `Failed to delete category "${category}"`, error as Error);
            return { success: false, error: getErrorMessage(error) };
        }
    }

    private mapRow(row: JsonObject): SettingsEntry {
        return {
            key: String(row.key),
            value: String(row.value),
            category: String(row.category),
            updatedAt: Number(row.updated_at),
        };
    }
}

