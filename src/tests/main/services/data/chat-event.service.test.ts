/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ChatEventService } from '@main/services/data/chat-event.service';
import { DatabaseService } from '@main/services/data/database.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockRunStatement {
    run: ReturnType<typeof vi.fn>;
}

interface MockAllStatement {
    all: ReturnType<typeof vi.fn>;
}

interface MockDatabase {
    prepare: ReturnType<typeof vi.fn>;
    exec: ReturnType<typeof vi.fn>;
}

interface ChatEventDatabaseServiceMock {
    getDatabase: ReturnType<typeof vi.fn>;
}

describe('ChatEventService', () => {
    let service: ChatEventService;
    let mockDb: MockDatabase;
    let mockDatabaseService: DatabaseService;

    beforeEach(() => {
        // Mock SQLite Database
        mockDb = {
            prepare: vi.fn(),
            exec: vi.fn()
        };

        // Mock DatabaseService
        const dbServiceMock: ChatEventDatabaseServiceMock = {
            getDatabase: vi.fn().mockReturnValue(mockDb)
        };
        mockDatabaseService = dbServiceMock as never as DatabaseService;

        service = new ChatEventService(mockDatabaseService);
    });

    it('should append an event successfully', async () => {
        const stmtMock: MockRunStatement = { run: vi.fn().mockResolvedValue({}) };
        mockDb.prepare.mockReturnValue(stmtMock);

        const threadId = 'thread-123';
        const payload = { text: 'Hello' };

        const event = await service.appendEvent(threadId, 'message_sent', payload);

        expect(event).toBeDefined();
        expect(event.threadId).toBe(threadId);
        expect(event.type).toBe('message_sent');
        expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO chat_events'));
        expect(stmtMock.run).toHaveBeenCalled();
    });

    it('should get events for a thread', async () => {
        const mockRow = {
            id: 'evt-1',
            thread_id: 'thread-123',
            type: 'message_sent',
            payload: JSON.stringify({ text: 'Hello' }),
            timestamp: 1000,
            metadata: '{}'
        };

        const stmtMock: MockAllStatement = { all: vi.fn().mockResolvedValue([mockRow]) };
        mockDb.prepare.mockReturnValue(stmtMock);

        const events = await service.getEvents('thread-123');

        expect(events).toHaveLength(1);
        expect(events[0]!.payload).toEqual({ text: 'Hello' });
        expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM chat_events'));
    });

    it('should rebuild thread state correctly', async () => {
        // Mock full DB behavior for retrieving multiple events
        const mockRows = [
            {
                id: '1', thread_id: '1', type: 'message_sent', timestamp: 100,
                payload: JSON.stringify({ id: 'm1', content: 'Hi' }), metadata: '{}'
            },
            {
                id: '2', thread_id: '1', type: 'message_received', timestamp: 200,
                payload: JSON.stringify({ id: 'm2', content: 'Hello there' }), metadata: '{}'
            },
            {
                id: '3', thread_id: '1', type: 'message_edited', timestamp: 300,
                payload: JSON.stringify({ messageId: 'm1', newContent: 'Hi updated' }), metadata: '{}'
            },
            {
                id: '4', thread_id: '1', type: 'message_sent', timestamp: 400,
                payload: JSON.stringify({ id: 'm3', content: 'Delete me' }), metadata: '{}'
            },
            {
                id: '5', thread_id: '1', type: 'message_deleted', timestamp: 500,
                payload: JSON.stringify({ messageId: 'm3' }), metadata: '{}'
            }
        ];

        const stmtMock: MockAllStatement = { all: vi.fn().mockResolvedValue(mockRows) };
        mockDb.prepare.mockReturnValue(stmtMock);

        const state = await service.rebuildThreadState('1');

        expect(state.messages).toHaveLength(2); // m1 and m2 remain
        expect(state.messages[0]!.content).toBe('Hi updated'); // m1 edited
        expect(state.messages[1]!.content).toBe('Hello there'); // m2 unchanged
        // m3 was added then deleted
    });
});

