import { ChatEventService } from '@main/services/data/chat-event.service';
import { DatabaseService } from '@main/services/data/database.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ChatEventService', () => {
    let service: ChatEventService;
    let mockDb: any;
    let mockDatabaseService: any;

    beforeEach(() => {
        // Mock SQLite Database
        mockDb = {
            prepare: vi.fn(),
            exec: vi.fn()
        };

        // Mock DatabaseService
        mockDatabaseService = {
            getDatabase: vi.fn().mockReturnValue(mockDb)
        } as unknown as DatabaseService;

        service = new ChatEventService(mockDatabaseService);
    });

    it('should append an event successfully', async () => {
        const stmtMock = { run: vi.fn().mockResolvedValue({}) };
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

        const stmtMock = { all: vi.fn().mockResolvedValue([mockRow]) };
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

        const stmtMock = { all: vi.fn().mockResolvedValue(mockRows) };
        mockDb.prepare.mockReturnValue(stmtMock);

        const state = await service.rebuildThreadState('1');

        expect(state.messages).toHaveLength(2); // m1 and m2 remain
        expect(state.messages[0]!.content).toBe('Hi updated'); // m1 edited
        expect(state.messages[1]!.content).toBe('Hello there'); // m2 unchanged
        // m3 was added then deleted
    });
});
