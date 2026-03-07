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

    describe('Workspace Operations', () => {
        it('should create and get a project', async () => {
            // mockQuery already returns default project for SELECT by id
            const project = await service.createWorkspace('Test', '/path');
            expect(project.title).toBe('Test');
        });

        it('should archive a project', async () => {
            const updateSpy = vi.spyOn((service as any)._projects, 'updateWorkspace').mockResolvedValue({
                id: '1',
                title: 'ToArchive',
                path: '/path',
                status: 'archived',
            });

            const archived = await service.archiveWorkspace('1', true);

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

    describe('bulkDeleteWorkspaces validation', () => {
        it('should reject non-array input', async () => {
            await expect(service.bulkDeleteWorkspaces('not-array' as unknown as string[])).rejects.toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('should reject array with invalid id', async () => {
            await expect(service.bulkDeleteWorkspaces(['valid-id', ''])).rejects.toThrow(DatabaseServiceErrorCode.INVALID_ID);
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

    describe('bulkArchiveWorkspaces validation', () => {
        it('rejects non-array input', async () => {
            await expect(service.bulkArchiveWorkspaces('bad' as unknown as string[], false)).rejects.toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('rejects array with empty id', async () => {
            await expect(service.bulkArchiveWorkspaces(['valid', ''], false)).rejects.toThrow(DatabaseServiceErrorCode.INVALID_ID);
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

    // B-0491: Edge case tests for compression
    describe('compression roundtrip', () => {
        it('vector embedding compresses and decompresses correctly', () => {
            const vector = [0.1, 0.2, 0.3, -0.5, 1.0];
            const compressed = service.compressVectorEmbedding(vector);
            const decompressed = service.decompressVectorEmbedding(compressed);
            expect(decompressed.length).toBe(vector.length);
            decompressed.forEach((val, i) => {
                expect(val).toBeCloseTo(vector[i], 4);
            });
        });

        it('empty vector compresses to non-empty string', () => {
            const compressed = service.compressVectorEmbedding([]);
            expect(compressed.length).toBeGreaterThan(0);
            const decompressed = service.decompressVectorEmbedding(compressed);
            expect(decompressed).toEqual([]);
        });

        it('message history compresses and decompresses correctly', () => {
            const messages = [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }];
            const compressed = service.compressMessageHistory(messages);
            const decompressed = service.decompressMessageHistory(compressed);
            expect(decompressed).toEqual(messages);
        });

        it('compression metrics track operations', () => {
            service.compressVectorEmbedding([1, 2, 3]);
            const metrics = service.getCompressionMetrics();
            expect(metrics.operations).toBeGreaterThanOrEqual(1);
            expect(metrics.rawBytes).toBeGreaterThan(0);
            expect(metrics.ratio).toBeGreaterThan(0);
        });
    });

    // B-0491: Replication and sharding config edge cases
    describe('replication config', () => {
        it('returns default config', () => {
            const config = service.getReplicationConfig();
            expect(config.enabled).toBe(false);
            expect(config.lagThresholdMs).toBe(5_000);
        });

        it('merges partial config', () => {
            const updated = service.setReplicationConfig({ enabled: true });
            expect(updated.enabled).toBe(true);
            expect(updated.lagThresholdMs).toBe(5_000);
        });
    });

    describe('sharding config', () => {
        it('returns default config', () => {
            const config = service.getShardingConfig();
            expect(config.enabled).toBe(false);
            expect(config.shardCount).toBe(1);
        });

        it('clamps shardCount to minimum of 1', () => {
            const updated = service.setShardingConfig({ shardCount: 0 });
            expect(updated.shardCount).toBe(1);
        });

        it('getShardForKey returns deterministic shard index', () => {
            service.setShardingConfig({ shardCount: 4 });
            const shard1 = service.getShardForKey('test-key');
            const shard2 = service.getShardForKey('test-key');
            expect(shard1).toBe(shard2);
            expect(shard1).toBeGreaterThanOrEqual(0);
            expect(shard1).toBeLessThan(4);
        });
    });

    // B-0491: Vector cache eviction
    describe('vector cache eviction', () => {
        it('clearVectorSearchCache resets analytics', () => {
            service.clearVectorSearchCache();
            const analytics = service.getVectorSearchAnalytics();
            expect(analytics.codeSymbols.queries).toBe(0);
            expect(analytics.semanticFragments.queries).toBe(0);
        });
    });

    // B-0491: Connection health proxy
    describe('connection health', () => {
        it('delegates to dbClient.testConnection', async () => {
            const dbClient = (service as unknown as { dbClient: { testConnection: ReturnType<typeof vi.fn> } }).dbClient;
            dbClient.testConnection = vi.fn().mockResolvedValue({ healthy: true, latencyMs: 5 });
            const result = await service.getConnectionHealth(3_000);
            expect(dbClient.testConnection).toHaveBeenCalledWith(3_000);
            expect(result.healthy).toBe(true);
        });
    });

    // B-0494: Performance budgets are defined
    describe('performance budgets', () => {
        it('DATABASE_PERFORMANCE_BUDGETS has all required keys', async () => {
            const { DATABASE_PERFORMANCE_BUDGETS: budgets } = await import('@main/services/data/database.service');
            expect(budgets.QUERY_MS).toBe(5000);
            expect(budgets.BATCH_MS).toBe(10000);
            expect(budgets.BACKUP_MS).toBe(30000);
            expect(budgets.MIGRATION_MS).toBe(60000);
            expect(budgets.INITIALIZE_MS).toBe(10000);
            expect(budgets.CLEANUP_MS).toBe(5000);
        });
    });

    // B-0495: Telemetry event enum completeness
    describe('telemetry events', () => {
        it('DatabaseServiceTelemetryEvent has all expected events', async () => {
            const { DatabaseServiceTelemetryEvent: evt } = await import('@main/services/data/database.service');
            expect(evt.QUERY_EXECUTED).toBe('db_query_executed');
            expect(evt.QUERY_FAILED).toBe('db_query_failed');
            expect(evt.BATCH_EXECUTED).toBe('db_batch_executed');
            expect(evt.BACKUP_CREATED).toBe('db_backup_created');
            expect(evt.MIGRATION_RUN).toBe('db_migration_run');
            expect(evt.CONNECTION_OPENED).toBe('db_connection_opened');
            expect(evt.CONNECTION_CLOSED).toBe('db_connection_closed');
        });
    });
});
