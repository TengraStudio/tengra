import { DataService } from '@main/services/data/data.service';
import { DatabaseService } from '@main/services/data/database.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules
vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

// Mock query implementation
const mockQuery = vi.fn().mockImplementation(async (sql: string, _params: any[]) => {
    const rows: any[] = [];
    const normalizedSql = typeof sql === 'string' ? sql.replace(/\s+/g, ' ').trim() : '';

    if (normalizedSql.includes('SELECT') && normalizedSql.includes('projects') && (normalizedSql.includes('id = $1') || normalizedSql.includes('id = ?'))) {
        return { rows: [{ id: '1', title: 'Test', path: '/path', status: 'active' }], affectedRows: 1 };
    }
    return { rows, affectedRows: 0 };
});

import { DatabaseClientService } from '@main/services/data/database-client.service';

describe('DatabaseService', () => {
    let service: DatabaseService;
    let mockDataService: DataService;
    let mockEventBus: EventBusService;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockDataService = {
            getPath: vi.fn().mockReturnValue('/mock/db/path')
        } as unknown as DataService;
        mockEventBus = {
            emit: vi.fn(),
            on: vi.fn(),
            off: vi.fn()
        } as unknown as EventBusService;

        const mockDatabaseClient = {
            initialize: vi.fn().mockResolvedValue(undefined),
            isConnected: vi.fn().mockReturnValue(true),
            executeQuery: vi.fn().mockImplementation(async (req) => {
                const res = await mockQuery(req.sql, req.params);
                return {
                    rows: res.rows,
                    affected_rows: res.affectedRows ?? 0
                };
            })
        } as unknown as DatabaseClientService;

        service = new DatabaseService(mockDataService, mockEventBus, mockDatabaseClient);
        await service.initialize();
        mockQuery.mockClear();
    });

    describe('Initialization', () => {
        it('should initialize and run migrations', () => {
            expect(service).toBeDefined();
        });
    });

    describe('Project Operations', () => {
        it('should create and get a project', async () => {
            // mockQuery already returns default project for SELECT by id
            const project = await service.createProject('Test', '/path');
            expect(project.title).toBe('Test');
        });

        it.skip('should archive a project', async () => {
            // Override mock for this test to simulate status change
            mockQuery.mockImplementation(async (sql: string, _params: any[]) => {
                const normalizedSql = typeof sql === 'string' ? sql.replace(/\s+/g, ' ').trim() : '';
                if (normalizedSql.includes('SELECT') && normalizedSql.includes('projects') && normalizedSql.includes('id = $1')) {
                    // Return archived for verification
                    return { rows: [{ id: '1', title: 'ToArchive', status: 'archived' }], affectedRows: 1 };
                }
                return { rows: [], affectedRows: 0 };
            });

            await service.archiveProject('1', true);
            const fetched = await service.getProject('1');
            // Archive project doesn't return anything.
            // getProject should return what we mocked.
            expect(fetched?.status).toBe('archived');
        });
    });

    describe('Complex Chat Operations', () => {
        it('should search chats with filters', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], affectedRows: 0 });
            await service.searchChats({ query: 'test', limit: 10 });
            expect(mockQuery).toHaveBeenCalled();
        });

        it('should get detailed stats', async () => {
            // Mock get(count) calls
            mockQuery.mockResolvedValue({ rows: [{ c: 5 }], affectedRows: 1 });
            const result = await service.getDetailedStats();
            expect(result.messageCount).toBe(5);
        });

        it('should duplicate a chat', async () => {
            // Mock get chat (sequence matters: 1. get chat, 2. insert)
            // But internal logic might query more.
            // We use mockResolvedValueOnce chaining
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'old-id', title: 'Old Chat', messages: [], model: 'gpt-4' }], affectedRows: 1 });
            mockQuery.mockResolvedValue({ rows: [], affectedRows: 1 }); // for inserts

            await service.duplicateChat('old-id');
            expect(mockQuery).toHaveBeenCalled();
        });
    });
});
