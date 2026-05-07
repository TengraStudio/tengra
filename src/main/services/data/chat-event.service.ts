/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { JsonValue } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { v4 as uuidv4 } from 'uuid';

export interface ChatEvent {
    id: string;
    threadId: string;
    type: ChatEventType;
    payload: JsonValue;
    timestamp: number;
    metadata?: JsonValue;
}

export type ChatEventType =
    | 'message_sent'
    | 'message_received'
    | 'message_edited'
    | 'message_deleted'
    | 'thread_created'
    | 'thread_archived';

export class ChatEventService extends BaseService {
    constructor(private databaseService: DatabaseService) {
        super('ChatEventService');
    }

    async appendEvent(threadId: string, type: ChatEventType, payload: JsonValue, metadata: JsonValue = {}): Promise<ChatEvent> {
        const event: ChatEvent = {
            id: uuidv4(),
            threadId,
            type,
            payload,
            timestamp: Date.now(),
            metadata
        };

        try {
            const db = this.databaseService.getDatabase();
            const stmt = db.prepare(`
                INSERT INTO chat_events (id, thread_id, type, payload, timestamp, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            await stmt.run(
                event.id,
                event.threadId,
                event.type,
                JSON.stringify(event.payload),
                event.timestamp,
                JSON.stringify(event.metadata)
            );

            return event;
        } catch (error) {
            this.logError('Failed to append chat event', error);
            throw error;
        }
    }

    async getEvents(threadId: string): Promise<ChatEvent[]> {
        try {
            const db = this.databaseService.getDatabase();
            const stmt = db.prepare(`
                SELECT * FROM chat_events 
                WHERE thread_id = ? 
                ORDER BY timestamp ASC
            `);

            interface ChatEventRow {
                id: string;
                thread_id: string;
                type: string;
                payload: string;
                timestamp: number;
                metadata: string;
            }

            const rows = await stmt.all(threadId) as ChatEventRow[];

            return rows.map(row => ({
                id: row.id,
                threadId: row.thread_id,
                type: row.type as ChatEventType,
                payload: safeJsonParse<JsonValue>(row.payload, {}),
                timestamp: row.timestamp,
                metadata: safeJsonParse<JsonValue>(row.metadata, {})
            }));
        } catch (error) {
            this.logError(`Failed to get events for thread ${threadId}`, error);
            return [];
        }
    }

    /**
     * Rebuilds the current state of a chat thread by replaying all events.
     * This is a basic implementation that can be expanded based on state requirements.
     */
    async rebuildThreadState(threadId: string): Promise<{ messages: Array<{ id?: string; content?: string; timestamp: number;[key: string]: JsonValue | undefined }> }> {
        const events = await this.getEvents(threadId);
        const state: { messages: Array<{ id?: string; content?: string; timestamp: number;[key: string]: JsonValue | undefined }> } = { messages: [] };

        for (const event of events) {
            switch (event.type) {
                case 'message_sent':
                case 'message_received':
                    state.messages.push({
                        ...event.payload as object,
                        timestamp: event.timestamp
                    });
                    break;
                case 'message_edited': {
                    const editPayload = event.payload as { messageId: string, newContent: string };
                    const msg = state.messages.find(m => m.id === editPayload.messageId);
                    if (msg) {
                        msg.content = editPayload.newContent;
                    }
                    break;
                }
                case 'message_deleted': {
                    const deletePayload = event.payload as { messageId: string };
                    state.messages = state.messages.filter(m => m.id !== deletePayload.messageId);
                    break;
                }
            }
        }

        return state;
    }
}

