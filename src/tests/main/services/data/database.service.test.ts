import { TimeTrackingService } from '@main/services/analysis/time-tracking.service';
import { DataService } from '@main/services/data/data.service';
import { DatabaseService, DatabaseServiceErrorCode } from '@main/services/data/database.service';
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
            }),
            searchCodeSymbols: vi.fn().mockResolvedValue([]),
            storeCodeSymbol: vi.fn().mockResolvedValue(undefined),
            storeSemanticFragment: vi.fn().mockResolvedValue(undefined),
            searchSemanticFragments: vi.fn().mockResolvedValue([])
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

    describe('DBSVC query optimization', () => {
        it('should collect query analysis and recommendations', async () => {
            await service.query('SELECT * FROM chats');
            const analysis = service.getQueryAnalysis();
            const recommendations = service.getQueryRecommendations();

            expect(analysis.length).toBeGreaterThan(0);
            expect(analysis[0].calls).toBe(1);
            expect(recommendations.some(r => r.code === 'select-star')).toBe(true);
        });
    });

    describe('DBSVC vector search', () => {
        it('should cache semantic vector search results and track analytics', async () => {
            const dbClient = (service as any).dbClient;
            dbClient.searchSemanticFragments.mockResolvedValue([
                {
                    id: 'frag-1',
                    content: 'test',
                    embedding: [1, 0],
                    source: 'unit',
                    source_id: 'src-1',
                    tags: [],
                    importance: 0.5,
                    project_path: '/project',
                    created_at: Date.now(),
                    updated_at: Date.now()
                }
            ]);

            const vector = [1, 0];
            await service.searchSemanticFragments(vector, 1, '/project');
            await service.searchSemanticFragments(vector, 1, '/project');

            expect(dbClient.searchSemanticFragments).toHaveBeenCalledTimes(1);
            const analytics = service.getVectorSearchAnalytics();
            expect(analytics.semanticFragments.queries).toBe(2);
            expect(analytics.semanticFragments.cacheHits).toBe(1);
        });
    });

    describe('DatabaseServiceErrorCode enum', () => {
        it('should have all expected error code values', () => {
            expect(DatabaseServiceErrorCode.INVALID_ID).toBe('DB_INVALID_ID');
            expect(DatabaseServiceErrorCode.INVALID_QUERY).toBe('DB_INVALID_QUERY');
            expect(DatabaseServiceErrorCode.NOT_INITIALIZED).toBe('DB_NOT_INITIALIZED');
            expect(DatabaseServiceErrorCode.OPERATION_FAILED).toBe('DB_OPERATION_FAILED');
            expect(DatabaseServiceErrorCode.CONNECTION_FAILED).toBe('DB_CONNECTION_FAILED');
        });
    });

    describe('analyzeQueryPlan validation', () => {
        it('should reject empty SQL string', async () => {
            await expect(service.analyzeQueryPlan('')).rejects.toThrow(DatabaseServiceErrorCode.INVALID_QUERY);
        });

        it('should reject non-string input', async () => {
            await expect(service.analyzeQueryPlan(123 as unknown as string)).rejects.toThrow(DatabaseServiceErrorCode.INVALID_QUERY);
        });
    });

    describe('executeBatch validation', () => {
        it('should reject non-array input', async () => {
            await expect(service.executeBatch('not-array' as unknown as Array<{ sql: string }>)).rejects.toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('should return empty results for empty array', async () => {
            const results = await service.executeBatch([]);
            expect(results).toEqual([]);
        });
    });

    describe('bulkDeleteChats validation', () => {
        it('should reject non-array input', async () => {
            await expect(service.bulkDeleteChats('not-array' as unknown as string[])).rejects.toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('should reject array with invalid id', async () => {
            await expect(service.bulkDeleteChats(['valid-id', ''])).rejects.toThrow(DatabaseServiceErrorCode.INVALID_ID);
        });
    });

    describe('bulkDeleteProjects validation', () => {
        it('should reject non-array input', async () => {
            await expect(service.bulkDeleteProjects('not-array' as unknown as string[])).rejects.toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('should reject array with invalid id', async () => {
            await expect(service.bulkDeleteProjects(['valid-id', ''])).rejects.toThrow(DatabaseServiceErrorCode.INVALID_ID);
        });
    });

    describe('DBSVC data archiving', () => {
        it('should archive old chats by cutoff', async () => {
            const now = Date.now();
            vi.spyOn(service, 'getAllChats').mockResolvedValue([
                {
                    id: 'old-chat',
                    title: 'Old',
                    messages: [],
                    createdAt: new Date(now - 20_000),
                    updatedAt: new Date(now - 10_000),
                    metadata: {}
                } as any,
                {
                    id: 'new-chat',
                    title: 'New',
                    messages: [],
                    createdAt: new Date(now),
                    updatedAt: new Date(now),
                    metadata: {}
                } as any
            ]);
            const archiveSpy = vi.spyOn(service, 'archiveChat').mockResolvedValue({ success: true } as any);

            const result = await service.archiveOldChats(now - 5_000);

            expect(result.archived).toBe(1);
            expect(archiveSpy).toHaveBeenCalledWith('old-chat', true);
        });
    });

    describe('query / exec / prepare SQL validation', () => {
        it('query rejects empty SQL', async () => {
            await expect(service.query('')).rejects.toThrow(DatabaseServiceErrorCode.INVALID_QUERY);
        });

        it('query rejects non-string SQL', async () => {
            await expect(service.query(42 as unknown as string)).rejects.toThrow(DatabaseServiceErrorCode.INVALID_QUERY);
        });

        it('exec rejects empty SQL', async () => {
            await expect(service.exec('')).rejects.toThrow(DatabaseServiceErrorCode.INVALID_QUERY);
        });

        it('exec rejects whitespace-only SQL', async () => {
            await expect(service.exec('   ')).rejects.toThrow(DatabaseServiceErrorCode.INVALID_QUERY);
        });

        it('prepare rejects empty SQL', async () => {
            await expect(service.prepare('')).rejects.toThrow(DatabaseServiceErrorCode.INVALID_QUERY);
        });
    });

    describe('bulkArchiveChats validation', () => {
        it('rejects non-array input', async () => {
            await expect(service.bulkArchiveChats('bad' as unknown as string[], true)).rejects.toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('rejects array with empty id', async () => {
            await expect(service.bulkArchiveChats(['valid', ''], true)).rejects.toThrow(DatabaseServiceErrorCode.INVALID_ID);
        });
    });

    describe('bulkArchiveProjects validation', () => {
        it('rejects non-array input', async () => {
            await expect(service.bulkArchiveProjects('bad' as unknown as string[], false)).rejects.toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('rejects array with empty id', async () => {
            await expect(service.bulkArchiveProjects(['valid', ''], false)).rejects.toThrow(DatabaseServiceErrorCode.INVALID_ID);
        });
    });

    describe('deleteMessages validation', () => {
        it('rejects non-array input', async () => {
            await expect(service.deleteMessages('bad' as unknown as string[])).rejects.toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('rejects array with empty id', async () => {
            await expect(service.deleteMessages(['ok', ''])).rejects.toThrow(DatabaseServiceErrorCode.INVALID_ID);
        });
    });

    describe('unarchiveChats validation', () => {
        it('rejects non-array input', async () => {
            await expect(service.unarchiveChats('bad' as unknown as string[])).rejects.toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('rejects array with empty id', async () => {
            await expect(service.unarchiveChats(['ok', ''])).rejects.toThrow(DatabaseServiceErrorCode.INVALID_ID);
        });
    });

    describe('setConnectionPoolConfig validation', () => {
        it('rejects null config', () => {
            expect(() => service.setConnectionPoolConfig(null as unknown as { maxSockets?: number })).toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('rejects non-object config', () => {
            expect(() => service.setConnectionPoolConfig('bad' as unknown as { maxSockets?: number })).toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('accepts valid config', () => {
            const mockClient = (service as unknown as { dbClient: { setPoolLimits: ReturnType<typeof vi.fn> } }).dbClient;
            mockClient.setPoolLimits = vi.fn();
            expect(() => service.setConnectionPoolConfig({ maxSockets: 5 })).not.toThrow();
        });
    });
});
