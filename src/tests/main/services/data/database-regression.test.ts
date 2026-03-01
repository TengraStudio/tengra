/**
 * Database Regression Tests (B-0492)
 *
 * End-to-end flows and critical path regression coverage for DatabaseService.
 * Validates that key operations compose correctly and error handling is consistent.
 */
import { TimeTrackingService } from '@main/services/analysis/time-tracking.service';
import { DataService } from '@main/services/data/data.service';
import {
    DATABASE_PERFORMANCE_BUDGETS,
    DatabaseService,
    DatabaseServiceErrorCode,
    DatabaseServiceTelemetryEvent
} from '@main/services/data/database.service';
import { DatabaseClientService } from '@main/services/data/database-client.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

const mockQuery = vi.fn().mockImplementation(async () => ({ rows: [], affectedRows: 0 }));

function buildMocks() {
    const dataService = { getPath: vi.fn().mockReturnValue('/mock') } as unknown as DataService;
    const eventBus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as EventBusService;
    const dbClient = {
        initialize: vi.fn().mockResolvedValue(undefined),
        isConnected: vi.fn().mockReturnValue(true),
        executeQuery: vi.fn().mockImplementation(async (req: { sql: string }) => {
            const res = await mockQuery(req.sql);
            return { rows: res.rows, affected_rows: res.affectedRows ?? 0 };
        }),
        searchCodeSymbols: vi.fn().mockResolvedValue([]),
        storeCodeSymbol: vi.fn().mockResolvedValue(undefined),
        storeSemanticFragment: vi.fn().mockResolvedValue(undefined),
        searchSemanticFragments: vi.fn().mockResolvedValue([]),
        testConnection: vi.fn().mockResolvedValue({ healthy: true, latencyMs: 2 }),
        getConnectionPoolMetrics: vi.fn().mockReturnValue({
            maxSockets: 10, maxFreeSockets: 5, pendingRequests: 0,
            maxPendingRequests: 200, totalRequests: 0, failedRequests: 0, errorRate: 0
        }),
        getHealth: vi.fn().mockResolvedValue({ success: true, data: { status: 'healthy' } }),
        setPoolLimits: vi.fn(),
        recycleConnectionPool: vi.fn().mockResolvedValue(undefined)
    } as unknown as DatabaseClientService;
    const timeTracking = {
        getTimeStats: vi.fn().mockResolvedValue({ totalOnlineTime: 0, totalCodingTime: 0, projectCodingTime: {} })
    } as unknown as TimeTrackingService;
    return { dataService, eventBus, dbClient, timeTracking };
}

describe('Database Regression Tests', () => {
    let service: DatabaseService;
    let mocks: ReturnType<typeof buildMocks>;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockQuery.mockImplementation(async () => ({ rows: [], affectedRows: 0 }));
        mocks = buildMocks();
        service = new DatabaseService(mocks.dataService, mocks.eventBus, mocks.dbClient, mocks.timeTracking);
        await service.initialize();
        mockQuery.mockClear();
    });

    // B-0492: Critical flow — query analytics accumulation
    describe('query analytics accumulate across calls', () => {
        it('tracks multiple queries and returns sorted analysis', async () => {
            await service.query('SELECT id FROM chats');
            await service.query('SELECT id FROM chats');
            await service.query('SELECT * FROM projects');

            const analysis = service.getQueryAnalysis();
            expect(analysis.length).toBe(2);
            const chatEntry = analysis.find(a => a.sql.includes('chats'));
            expect(chatEntry?.calls).toBe(2);
        });

        it('clearQueryAnalytics resets all tracking', async () => {
            await service.query('SELECT 1');
            service.clearQueryAnalytics();
            expect(service.getQueryAnalysis()).toHaveLength(0);
            expect(service.getSlowQueries()).toHaveLength(0);
        });
    });

    // B-0492: Regression — executeBatch mixed success/failure
    describe('executeBatch handles mixed results', () => {
        it('reports per-statement success/failure', async () => {
            let callCount = 0;
            mockQuery.mockImplementation(async () => {
                callCount += 1;
                if (callCount === 2) {throw new Error('constraint violation');}
                return { rows: [], affectedRows: 1 };
            });

            const results = await service.executeBatch([
                { sql: 'INSERT INTO chats VALUES (1)' },
                { sql: 'INSERT INTO chats VALUES (1)' }, // will fail
                { sql: 'INSERT INTO chats VALUES (2)' }
            ]);

            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(false);
            expect(results[1].error).toContain('constraint violation');
            expect(results[2].success).toBe(true);
        });
    });

    // B-0492: Regression — schema validation flow
    describe('schema validation', () => {
        it('reports missing tables as invalid', async () => {
            mockQuery.mockImplementation(async (sql: string) => {
                if (sql.includes('prompts')) {throw new Error('no such table');}
                return { rows: [{ count: 1 }], affectedRows: 0 };
            });

            const result = await service.validateSchema(['chats', 'prompts']);
            expect(result.valid).toBe(false);
            expect(result.tablesMissing).toContain('prompts');
            expect(result.tablesPresent).toContain('chats');
        });

        it('reports all tables present as valid', async () => {
            mockQuery.mockImplementation(async () => ({ rows: [{ count: 1 }], affectedRows: 0 }));
            const result = await service.validateSchema(['chats', 'messages']);
            expect(result.valid).toBe(true);
            expect(result.tablesMissing).toHaveLength(0);
        });
    });

    // B-0492: Regression — diffSchema detects changes
    describe('schema diff', () => {
        it('detects removed tables', async () => {
            mockQuery.mockImplementation(async (sql: string) => {
                if (sql.includes('legacy_table')) {throw new Error('no such table');}
                return { rows: [{ count: 1 }], affectedRows: 0 };
            });

            const diff = await service.diffSchema(['chats', 'legacy_table']);
            expect(diff.removedTables).toContain('legacy_table');
        });
    });

    // B-0494: Error codes are consistently prefixed
    describe('error code consistency', () => {
        it('all error codes use DB_ prefix', () => {
            const values = Object.values(DatabaseServiceErrorCode);
            for (const code of values) {
                expect(code).toMatch(/^DB_/);
            }
        });

        it('error messages include error code in brackets', async () => {
            try {
                await service.query('');
            } catch (error) {
                expect((error as Error).message).toContain(`[${DatabaseServiceErrorCode.INVALID_QUERY}]`);
            }
        });
    });

    // B-0494: Retry/fallback — connection pool overflow returns error
    describe('connection pool config validation', () => {
        it('setConnectionPoolConfig delegates to dbClient', () => {
            service.setConnectionPoolConfig({ maxSockets: 20, maxFreeSockets: 10 });
            expect(mocks.dbClient.setPoolLimits).toHaveBeenCalledWith({ maxSockets: 20, maxFreeSockets: 10 });
        });

        it('recycleConnectionPool delegates to dbClient', async () => {
            await service.recycleConnectionPool();
            expect(mocks.dbClient.recycleConnectionPool).toHaveBeenCalled();
        });
    });

    // B-0495: Telemetry event enum completeness
    describe('telemetry event definitions', () => {
        it('covers 8 telemetry events', () => {
            const events = Object.values(DatabaseServiceTelemetryEvent);
            expect(events.length).toBe(8);
        });

        it('all events use db_ prefix', () => {
            for (const event of Object.values(DatabaseServiceTelemetryEvent)) {
                expect(event).toMatch(/^db_/);
            }
        });
    });

    // B-0496: Performance budgets are positive integers
    describe('performance budgets', () => {
        it('all budgets are positive numbers', () => {
            for (const [key, value] of Object.entries(DATABASE_PERFORMANCE_BUDGETS)) {
                expect(value, `${key} should be positive`).toBeGreaterThan(0);
            }
        });

        it('query budget is less than batch budget', () => {
            expect(DATABASE_PERFORMANCE_BUDGETS.QUERY_MS).toBeLessThan(DATABASE_PERFORMANCE_BUDGETS.BATCH_MS);
        });

        it('migration budget is the largest', () => {
            const max = Math.max(...Object.values(DATABASE_PERFORMANCE_BUDGETS));
            expect(DATABASE_PERFORMANCE_BUDGETS.MIGRATION_MS).toBe(max);
        });
    });

    // B-0492: Regression — replication lag metrics
    describe('replication lag metrics', () => {
        it('returns healthy when service is available', async () => {
            const metrics = await service.getReplicationLagMetrics();
            expect(metrics.healthy).toBe(true);
            expect(metrics.lagMs).toBeGreaterThanOrEqual(0);
        });

        it('failoverToPrimary disables replication', async () => {
            service.setReplicationConfig({ enabled: true });
            const result = await service.failoverToPrimary();
            expect(result.success).toBe(true);
            expect(service.getReplicationConfig().enabled).toBe(false);
        });
    });

    // B-0492: Regression — queryAcrossShards
    describe('queryAcrossShards', () => {
        it('queries each shard and returns results', async () => {
            service.setShardingConfig({ shardCount: 3 });
            mockQuery.mockResolvedValue({ rows: [{ id: '1' }], affectedRows: 0 });

            const results = await service.queryAcrossShards('SELECT id FROM chats LIMIT 5');
            expect(results.length).toBe(3);
            results.forEach((r, i) => {
                expect(r.shard).toBe(i);
                expect(r.rows.length).toBeGreaterThanOrEqual(0);
            });
        });

        it('rejects empty SQL', async () => {
            await expect(service.queryAcrossShards('')).rejects.toThrow(DatabaseServiceErrorCode.INVALID_QUERY);
        });
    });
});
