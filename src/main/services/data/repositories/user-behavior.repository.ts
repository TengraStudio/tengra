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
import { UserBehaviorRecord } from '@shared/schemas/user-behavior.schema';
import { JsonObject } from '@shared/types/common';
import { DatabaseAdapter, SqlValue } from '@shared/types/database';
import { getErrorMessage } from '@shared/utils/error.util';
import { v4 as uuidv4 } from 'uuid';

import { BaseRepository } from './base.repository';

export class UserBehaviorRepository extends BaseRepository {
    constructor(adapter: DatabaseAdapter) {
        super(adapter);
    }

    /**
     * Tracks a user interaction by incrementing count and updating timestamp.
     * Uses UPSERT pattern to handle concurrency and existence.
     */
    async trackInteraction(
        eventType: string,
        eventKey: string,
        metadata?: JsonObject
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const now = Date.now();
            const id = uuidv4();
            const metadataStr = metadata ? JSON.stringify(metadata) : null;

            await this.adapter.prepare(`
                INSERT INTO user_behavior (id, event_type, event_key, count, last_used_at, metadata)
                VALUES (?, ?, ?, 1, ?, ?)
                ON CONFLICT(event_type, event_key) DO UPDATE SET
                    count = user_behavior.count + 1,
                    last_used_at = EXCLUDED.last_used_at,
                    metadata = COALESCE(EXCLUDED.metadata, user_behavior.metadata)
            `).run(id, eventType, eventKey, now, metadataStr);

            return { success: true };
        } catch (error) {
            appLogger.error('UserBehaviorRepository', 'Failed to track interaction:', error as Error);
            return { success: false, error: getErrorMessage(error) };
        }
    }

    /**
     * Gets the most frequent interactions for a specific event type.
     */
    async getTopInteractions(eventType: string, limit: number = 10): Promise<UserBehaviorRecord[]> {
        try {
            const rows = await this.adapter.prepare(`
                SELECT * FROM user_behavior
                WHERE event_type = ?
                ORDER BY count DESC, last_used_at DESC
                LIMIT ?
            `).all<JsonObject>(eventType, limit);

            return rows.map(row => this.mapRowToRecord(row));
        } catch (error) {
            appLogger.error('UserBehaviorRepository', 'Failed to get top interactions:', error as Error);
            return [];
        }
    }

    /**
     * Gets the most recent interactions across all types or a specific type.
     */
    async getRecentInteractions(limit: number = 10, eventType?: string): Promise<UserBehaviorRecord[]> {
        try {
            let sql = 'SELECT * FROM user_behavior';
            const params: SqlValue[] = [];

            if (eventType) {
                sql += ' WHERE event_type = ?';
                params.push(eventType);
            }

            sql += ' ORDER BY last_used_at DESC LIMIT ?';
            params.push(limit);

            const rows = await this.adapter.prepare(sql).all<JsonObject>(...params);
            return rows.map(row => this.mapRowToRecord(row));
        } catch (error) {
            appLogger.error('UserBehaviorRepository', 'Failed to get recent interactions:', error as Error);
            return [];
        }
    }

    private mapRowToRecord(row: JsonObject): UserBehaviorRecord {
        return {
            id: String(row.id),
            eventType: String(row.event_type),
            eventKey: String(row.event_key),
            count: Number(row.count),
            lastUsedAt: Number(row.last_used_at),
            metadata: this.parseJsonField(row.metadata as string | null, {})
        };
    }
}

