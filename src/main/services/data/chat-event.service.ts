import { BaseService } from '../base.service';
import { DatabaseService } from './database.service';
import { v4 as uuidv4 } from 'uuid';
import { JsonValue } from '../../../shared/types/common';

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

    appendEvent(threadId: string, type: ChatEventType, payload: JsonValue, metadata: JsonValue = {}): ChatEvent {
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

            stmt.run(
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

    getEvents(threadId: string): ChatEvent[] {
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

            const rows = stmt.all(threadId) as ChatEventRow[];

            return rows.map(row => ({
                id: row.id,
                threadId: row.thread_id,
                type: row.type as ChatEventType,
                payload: JSON.parse(row.payload) as JsonValue,
                timestamp: row.timestamp,
                metadata: JSON.parse(row.metadata) as JsonValue
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
    rebuildThreadState(threadId: string): { messages: Array<{ id?: string; content?: string; timestamp: number; [key: string]: JsonValue | undefined }> } {
        const events = this.getEvents(threadId);
        const state: { messages: Array<{ id?: string; content?: string; timestamp: number; [key: string]: JsonValue | undefined }> } = { messages: [] };

        for (const event of events) {
            switch (event.type) {
                case 'message_sent':
                case 'message_received':
                    state.messages.push({
                        ...event.payload as object,
                        timestamp: event.timestamp
                    });
                    break;
                case 'message_edited':
                    const editPayload = event.payload as { messageId: string, newContent: string };
                    const msg = state.messages.find(m => m.id === editPayload.messageId);
                    if (msg) {
                        msg.content = editPayload.newContent;
                    }
                    break;
                case 'message_deleted':
                    const deletePayload = event.payload as { messageId: string };
                    state.messages = state.messages.filter(m => m.id !== deletePayload.messageId);
                    break;
            }
        }

        return state;
    }
}
