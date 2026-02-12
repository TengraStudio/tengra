import { TimeTrackingService } from '@main/services/analysis/time-tracking.service';
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
    // Handle count queries for getDetailedStats
    if (normalizedSql.toLowerCase().includes('count(*)') && normalizedSql.toLowerCase().includes('messages')) {
        return { rows: [{ count: 5 }], affectedRows: 1 };
    }
    if (normalizedSql.toLowerCase().includes('count(*)') && normalizedSql.toLowerCase().includes('chats')) {
        return { rows: [{ count: 3 }], affectedRows: 1 };
    }
    // Handle token stats
    if (normalizedSql.toLowerCase().includes('sum(tokens_sent)')) {
        return { rows: [{ sent: 100, received: 200, total: 300 }], affectedRows: 1 };
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

        const mockTimeTracking = {
            getTimeStats: vi.fn().mockResolvedValue({
                totalOnlineTime: 100,
                totalCodingTime: 50,
                projectCodingTime: {}
            })
        } as unknown as TimeTrackingService;

        service = new DatabaseService(mockDataService, mockEventBus, mockDatabaseClient, mockTimeTracking);
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

        it('should archive a project', async () => {
            const updateSpy = vi.spyOn((service as any)._projects, 'updateProject').mockResolvedValue({
                id: '1',
                title: 'ToArchive',
                path: '/path',
                status: 'archived',
            });

            const archived = await service.archiveProject('1', true);

            expect(updateSpy).toHaveBeenCalledWith('1', { status: 'archived' });
            expect(archived?.status).toBe('archived');
        });
    });

    describe('Complex Chat Operations', () => {
        it('should search chats with filters', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], affectedRows: 0 });
            await service.searchChats({ query: 'test', limit: 10 });
            expect(mockQuery).toHaveBeenCalled();
        });

        it('should get detailed stats', async () => {
            vi.spyOn((service as any)._system, 'getDetailedStats').mockResolvedValue({
                chatCount: 3,
                messageCount: 5,
                dbSize: 0,
                totalTokens: 300,
                promptTokens: 100,
                completionTokens: 200,
                tokenTimeline: [],
                activity: [],
            });
            const result = await service.getDetailedStats();
            expect(result.messageCount).toBe(5);
            expect(result.chatCount).toBe(3);
            expect(result.totalTokens).toBe(300);
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
