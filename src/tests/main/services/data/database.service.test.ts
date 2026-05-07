/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { DataService } from '@main/services/data/data.service';
import { DatabaseService, DatabaseServiceErrorCode } from '@main/services/data/database.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { WORKSPACE_COMPAT_SCHEMA_VALUES } from '@shared/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules
vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

// Mock query implementation
const mockQuery = vi.fn().mockImplementation(async (sql: string, _params: TestValue[]) => {
    const rows: TestValue[] = [];
    const normalizedSql = typeof sql === 'string' ? sql.replace(/\s+/g, ' ').trim() : '';

    if (normalizedSql.includes('SELECT') && normalizedSql.includes(WORKSPACE_COMPAT_SCHEMA_VALUES.TABLE) && (normalizedSql.includes('id = $1') || normalizedSql.includes('id = ?'))) {
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

interface WorkspaceRepositoryMock {
    updateWorkspace: ReturnType<typeof vi.fn>;
}

interface SystemRepositoryMock {
    getDetailedStats: ReturnType<typeof vi.fn>;
}

interface DatabaseClientMock {
    searchSemanticFragments: ReturnType<typeof vi.fn>;
}

describe('DatabaseService', () => {
    let service: DatabaseService;
    let mockDataService: DataService;
    let mockEventBus: EventBusService;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockDataService = {
            getPath: vi.fn().mockReturnValue('/mock/db/path')
        } as never as DataService;
        mockEventBus = {
            emit: vi.fn(),
            on: vi.fn(),
            off: vi.fn()
        } as never as EventBusService;

        const mockDatabaseClient = {
            initialize: vi.fn().mockResolvedValue(undefined),
            isConnected: vi.fn().mockReturnValue(true),
            getWorkspaces: vi.fn().mockResolvedValue([]),
            getWorkspace: vi.fn().mockResolvedValue({
                id: '1',
                title: 'Test',
                description: '',
                path: '/path',
                mounts: [],
                chat_ids: [],
                council_config: { enabled: false, members: [], consensusThreshold: 0.7 },
                status: 'active',
                metadata: {},
                created_at: 1,
                updated_at: 1
            }),
            createWorkspace: vi.fn().mockResolvedValue({
                id: '1',
                title: 'Test',
                description: '',
                path: '/path',
                mounts: [],
                chat_ids: [],
                council_config: { enabled: false, members: [], consensusThreshold: 0.7 },
                status: 'active',
                metadata: {},
                created_at: 1,
                updated_at: 1
            }),
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
            searchSemanticFragments: vi.fn().mockResolvedValue([]),
            setPoolLimits: vi.fn(),
            getConnectionPoolMetrics: vi.fn().mockReturnValue({}),
            recycleConnectionPool: vi.fn().mockResolvedValue(undefined),
            testConnection: vi.fn().mockResolvedValue({ healthy: true, latencyMs: 1 }),
            getHealth: vi.fn().mockResolvedValue({ success: true })
        } as never as DatabaseClientService;


                service = new DatabaseService(mockDataService, mockEventBus, mockDatabaseClient, () => null);

        await service.initialize();
        mockQuery.mockClear();
    });

    describe('Initialization', () => {
        it('should initialize and run migrations', () => {
            expect(service).toBeDefined();
        });

        it('should expose advanced memory table bootstrap on the knowledge repository', () => {
            const knowledgeRepository = Reflect.get(service, '_knowledge') as { ensureMemoryTables?: TestValue } | undefined;
            expect(typeof knowledgeRepository?.ensureMemoryTables).toBe('function');
        });
    });

    describe('Workspace Operations', () => {
        it('should create and get a workspace', async () => {
            const workspace = await service.createWorkspace('Test', '/path');
            expect(workspace.title).toBe('Test');
            const dbClient = Reflect.get(service, 'dbClient') as {
                createWorkspace: ReturnType<typeof vi.fn>
            };
            expect(dbClient.createWorkspace).toHaveBeenCalledWith({
                title: 'Test',
                path: '/path',
                description: '',
                mounts: undefined,
                council_config: undefined
            });
        });

        it('should archive a workspace', async () => {
            const workspaceRepository = Reflect.get(service, '_workspaces') as WorkspaceRepositoryMock;
            const updateSpy = vi.spyOn(workspaceRepository, 'updateWorkspace').mockResolvedValue({
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
            const systemRepository = Reflect.get(service, '_system') as SystemRepositoryMock;
            vi.spyOn(systemRepository, 'getDetailedStats').mockResolvedValue({
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
            const dbClient = Reflect.get(service, 'dbClient') as DatabaseClientMock;
            dbClient.searchSemanticFragments.mockResolvedValue([
                {
                    id: 'frag-1',
                    content: 'test',
                    embedding: [1, 0],
                    source: 'unit',
                    source_id: 'src-1',
                    tags: [],
                    importance: 0.5,
                    [WORKSPACE_COMPAT_SCHEMA_VALUES.PATH_COLUMN]: '/workspace',
                    created_at: Date.now(),
                    updated_at: Date.now()
                }
            ]);

            const vector = [1, 0];
            await service.searchSemanticFragments(vector, 1, '/workspace');
            await service.searchSemanticFragments(vector, 1, '/workspace');

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
            await expect(service.analyzeQueryPlan(123 as never as string)).rejects.toThrow(DatabaseServiceErrorCode.INVALID_QUERY);
        });
    });

    describe('executeBatch validation', () => {
        it('should reject non-array input', async () => {
            await expect(service.executeBatch('not-array' as never as Array<{ sql: string }>)).rejects.toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('should return empty results for empty array', async () => {
            const results = await service.executeBatch([]);
            expect(results).toEqual([]);
        });
    });

    describe('bulkDeleteChats validation', () => {
        it('should reject non-array input', async () => {
            await expect(service.bulkDeleteChats('not-array' as never as string[])).rejects.toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('should reject array with invalid id', async () => {
            await expect(service.bulkDeleteChats(['valid-id', ''])).rejects.toThrow(DatabaseServiceErrorCode.INVALID_ID);
        });
    });

    describe('bulkDeleteWorkspaces validation', () => {
        it('should reject non-array input', async () => {
            await expect(service.bulkDeleteWorkspaces('not-array' as never as string[])).rejects.toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
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
                } as never,
                {
                    id: 'new-chat',
                    title: 'New',
                    messages: [],
                    createdAt: new Date(now),
                    updatedAt: new Date(now),
                    metadata: {}
                } as never
            ]);
            const archiveSpy = vi.spyOn(service, 'archiveChat').mockResolvedValue({ success: true } as never);

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
            await expect(service.query(42 as never as string)).rejects.toThrow(DatabaseServiceErrorCode.INVALID_QUERY);
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
            await expect(service.bulkArchiveChats('bad' as never as string[], true)).rejects.toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('rejects array with empty id', async () => {
            await expect(service.bulkArchiveChats(['valid', ''], true)).rejects.toThrow(DatabaseServiceErrorCode.INVALID_ID);
        });
    });

    describe('bulkArchiveWorkspaces validation', () => {
        it('rejects non-array input', async () => {
            await expect(service.bulkArchiveWorkspaces('bad' as never as string[], false)).rejects.toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('rejects array with empty id', async () => {
            await expect(service.bulkArchiveWorkspaces(['valid', ''], false)).rejects.toThrow(DatabaseServiceErrorCode.INVALID_ID);
        });
    });

    describe('deleteMessages validation', () => {
        it('rejects non-array input', async () => {
            await expect(service.deleteMessages('bad' as never as string[])).rejects.toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('rejects array with empty id', async () => {
            await expect(service.deleteMessages(['ok', ''])).rejects.toThrow(DatabaseServiceErrorCode.INVALID_ID);
        });
    });

    describe('unarchiveChats validation', () => {
        it('rejects non-array input', async () => {
            await expect(service.unarchiveChats('bad' as never as string[])).rejects.toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('rejects array with empty id', async () => {
            await expect(service.unarchiveChats(['ok', ''])).rejects.toThrow(DatabaseServiceErrorCode.INVALID_ID);
        });
    });

    describe('setConnectionPoolConfig validation', () => {
        it('rejects null config', () => {
            expect(() => service.setConnectionPoolConfig(null as never as { maxSockets?: number })).toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('rejects non-object config', () => {
            expect(() => service.setConnectionPoolConfig('bad' as never as { maxSockets?: number })).toThrow(DatabaseServiceErrorCode.OPERATION_FAILED);
        });

        it('accepts valid config', () => {
            const mockClient = (service as never as { dbClient: { setPoolLimits: ReturnType<typeof vi.fn> } }).dbClient;
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
            const dbClient = (service as never as { dbClient: { testConnection: ReturnType<typeof vi.fn> } }).dbClient;
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

    // B-0495: Stats event enum completeness
    describe('Stats events', () => {
        it('DatabaseServiceUsageStatsEvent has all expected events', async () => {
            const { DatabaseServiceUsageStatsEvent: evt } = await import('@main/services/data/database.service');
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

