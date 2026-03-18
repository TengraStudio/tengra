import { TimeTrackingService } from '@main/services/analysis/time-tracking.service';
import { DatabaseClientService } from '@main/services/data/database-client.service';
import { WORKSPACE_COMPAT_SCHEMA_VALUES } from '@shared/constants';
import { DbQueryRequest, DbQueryResponse } from '@shared/types/db-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock uuid
vi.mock('uuid', () => ({
    v4: vi.fn(() => 'test-uuid-1234'),
}));

// Mock the logger
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

const WORKSPACE_COMPAT_CODING_TYPE = WORKSPACE_COMPAT_SCHEMA_VALUES.CODING_TABLE;
const WORKSPACE_COMPAT_ID_COLUMN = WORKSPACE_COMPAT_SCHEMA_VALUES.ID_COLUMN;

/**
 * Creates a mock DatabaseClientService with a controllable executeQuery stub.
 */
function createMockDatabaseClient(): DatabaseClientService {
    return {
        executeQuery: vi.fn<(req: DbQueryRequest) => Promise<DbQueryResponse>>()
            .mockResolvedValue({ rows: [], affected_rows: 0 }),
    } as never as DatabaseClientService;
}

function getInsertCalls(mockDbClient: DatabaseClientService) {
    return vi.mocked(mockDbClient.executeQuery).mock.calls
        .map(([request]) => request)
        .filter((request) => request.sql.includes('INSERT INTO time_tracking'));
}

describe('TimeTrackingService', () => {
    let service: TimeTrackingService;
    let mockDbClient: DatabaseClientService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        mockDbClient = createMockDatabaseClient();
        service = new TimeTrackingService(mockDbClient);
    });

    afterEach(async () => {
        await service.cleanup();
        vi.useRealTimers();
    });

    describe('initialize', () => {
        it('should start app tracking on initialize', async () => {
            // Act
            await service.initialize();

            // Assert - service is tracking (verified via getTimeStats returning current active time)
            vi.advanceTimersByTime(1000);
            const stats = await service.getTimeStats();
            expect(stats.totalOnlineTime).toBeGreaterThanOrEqual(1000);
        });

        it('should set up periodic save interval', async () => {
            // Act
            await service.initialize();

            // Assert - verify interval fires after 60s without throwing
            vi.advanceTimersByTime(60000);
            // No error means the interval callback ran successfully
        });
    });

    describe('cleanup', () => {
        it('should stop app tracking and save on cleanup', async () => {
            // Arrange
            await service.initialize();
            vi.advanceTimersByTime(5000);

            // Act
            await service.cleanup();

            // Assert - recordTime should have been called with app_online type
            const executeQuery = vi.mocked(mockDbClient.executeQuery);
            expect(executeQuery).toHaveBeenCalled();
            const insertCall = executeQuery.mock.calls.find(
                (call) => (call[0].params as (string | number | null)[])?.[1] === 'app_online'
            );
            expect(insertCall).toBeDefined();
        });

        it('should clear save interval on cleanup', async () => {
            // Arrange
            await service.initialize();

            // Act
            await service.cleanup();

            // Assert - advancing timers should not trigger more saves
            const callCountAfterCleanup = vi.mocked(mockDbClient.executeQuery).mock.calls.length;
            vi.advanceTimersByTime(120000);
            expect(vi.mocked(mockDbClient.executeQuery).mock.calls.length).toBe(callCountAfterCleanup);
        });

        it('should be safe to call cleanup when not tracking', async () => {
            // Act & Assert - should not throw
            await expect(service.cleanup()).resolves.not.toThrow();
        });
    });

    describe('startAppTracking', () => {
        it('should start tracking app online time', () => {
            // Act
            service.startAppTracking();
            vi.advanceTimersByTime(2000);

            // Assert - verified via getTimeStats
            const statsPromise = service.getTimeStats();
            return statsPromise.then((stats) => {
                expect(stats.totalOnlineTime).toBeGreaterThanOrEqual(2000);
            });
        });

        it('should be idempotent when already tracking', async () => {
            // Arrange
            service.startAppTracking();
            vi.advanceTimersByTime(3000);

            // Act - calling again should not reset the start time
            service.startAppTracking();
            vi.advanceTimersByTime(2000);

            // Assert - total time should be 5000ms, not 2000ms
            const stats = await service.getTimeStats();
            expect(stats.totalOnlineTime).toBe(5000);
        });
    });

    describe('stopAppTracking', () => {
        it('should record duration when stopping', async () => {
            // Arrange
            service.startAppTracking();
            vi.advanceTimersByTime(10000);

            // Act
            await service.stopAppTracking();

            // Assert
            const insertCalls = getInsertCalls(mockDbClient);
            expect(insertCalls).toHaveLength(1);
            const params = insertCalls[0].params as (string | number | null)[];
            expect(params[1]).toBe('app_online'); // type
            expect(params[5]).toBe(10000); // durationMs
        });

        it('should be a no-op when not tracking', async () => {
            // Act
            await service.stopAppTracking();

            // Assert
            expect(vi.mocked(mockDbClient.executeQuery)).not.toHaveBeenCalled();
        });

        it('should reset tracking state after stop', async () => {
            // Arrange
            service.startAppTracking();
            vi.advanceTimersByTime(5000);

            // Act
            await service.stopAppTracking();

            // Assert - calling stop again should be a no-op
            await service.stopAppTracking();
            expect(getInsertCalls(mockDbClient)).toHaveLength(1);
        });
    });

    describe('startCodingTracking', () => {
        it('should start generic coding tracking without workspaceId', async () => {
            // Arrange
            service.startCodingTracking();
            vi.advanceTimersByTime(3000);

            // Act
            await service.stopCodingTracking();

            // Assert
            const insertCalls = getInsertCalls(mockDbClient);
            expect(insertCalls).toHaveLength(1);
            const params = insertCalls[0].params as (string | number | null)[];
            expect(params[1]).toBe('coding');
            expect(params[5]).toBe(3000);
        });

        it('should start workspace-specific coding tracking with workspaceId', async () => {
            // Arrange
            const workspaceId = 'workspace-abc';
            service.startCodingTracking(workspaceId);
            vi.advanceTimersByTime(7000);

            // Act
            await service.stopCodingTracking(workspaceId);

            // Assert
            const insertCalls = getInsertCalls(mockDbClient);
            expect(insertCalls).toHaveLength(1);
            const params = insertCalls[0].params as (string | number | null)[];
            expect(params[1]).toBe(WORKSPACE_COMPAT_CODING_TYPE);
            expect(params[2]).toBe(workspaceId);
            expect(params[5]).toBe(7000);
        });

        it('should track multiple workspaces simultaneously', async () => {
            // Arrange
            service.startCodingTracking('workspace-1');
            vi.advanceTimersByTime(2000);
            service.startCodingTracking('workspace-2');
            vi.advanceTimersByTime(3000);

            // Act
            await service.stopCodingTracking('workspace-1');
            await service.stopCodingTracking('workspace-2');

            // Assert
            const insertCalls = getInsertCalls(mockDbClient);
            expect(insertCalls).toHaveLength(2);

            const params1 = insertCalls[0].params as (string | number | null)[];
            expect(params1[2]).toBe('workspace-1');
            expect(params1[5]).toBe(5000); // 2000 + 3000

            const params2 = insertCalls[1].params as (string | number | null)[];
            expect(params2[2]).toBe('workspace-2');
            expect(params2[5]).toBe(3000);
        });
    });

    describe('stopCodingTracking', () => {
        it('should be a no-op when stopping generic coding without active session', async () => {
            // Act
            await service.stopCodingTracking();

            // Assert
            expect(vi.mocked(mockDbClient.executeQuery)).not.toHaveBeenCalled();
        });

        it('should be a no-op when stopping workspace coding without active session', async () => {
            // Act
            await service.stopCodingTracking('non-existent-workspace');

            // Assert
            expect(vi.mocked(mockDbClient.executeQuery)).not.toHaveBeenCalled();
        });

        it('should clear coding state after stop', async () => {
            // Arrange
            service.startCodingTracking();
            vi.advanceTimersByTime(1000);
            await service.stopCodingTracking();

            // Act - second stop should be a no-op
            await service.stopCodingTracking();

            // Assert
            expect(getInsertCalls(mockDbClient)).toHaveLength(1);
        });

        it('should clear workspace state after stop', async () => {
            // Arrange
            service.startCodingTracking('proj-1');
            vi.advanceTimersByTime(1000);
            await service.stopCodingTracking('proj-1');

            // Act - second stop should be a no-op
            await service.stopCodingTracking('proj-1');

            // Assert
            expect(getInsertCalls(mockDbClient)).toHaveLength(1);
        });
    });

    describe('getTimeStats', () => {
        it('should return zero stats when nothing tracked', async () => {
            // Arrange
            vi.mocked(mockDbClient.executeQuery).mockResolvedValue({
                rows: [{ total: 0 }],
                affected_rows: 0,
            });

            // Act
            const stats = await service.getTimeStats();

            // Assert
            expect(stats.totalOnlineTime).toBe(0);
            expect(stats.totalCodingTime).toBe(0);
            expect(stats.workspaceCodingTime).toEqual({});
        });

        it('should include persisted times from database', async () => {
            // Arrange
            const executeQuery = vi.mocked(mockDbClient.executeQuery);
            executeQuery.mockImplementation(async (req: DbQueryRequest) => {
                if (req.params?.[0] === 'app_online') {
                    return { rows: [{ total: 50000 }], affected_rows: 0 };
                }
                if (req.params?.[0] === 'coding') {
                    return { rows: [{ total: 30000 }], affected_rows: 0 };
                }
                // workspace_coding query
                return {
                    rows: [{ [WORKSPACE_COMPAT_ID_COLUMN]: 'p1', total: 20000 }],
                    affected_rows: 0,
                };
            });

            // Act
            const stats = await service.getTimeStats();

            // Assert
            expect(stats.totalOnlineTime).toBe(50000);
            expect(stats.totalCodingTime).toBe(30000);
            expect(stats.workspaceCodingTime).toEqual({ p1: 20000 });
        });

        it('should include active tracking time in stats', async () => {
            // Arrange
            vi.mocked(mockDbClient.executeQuery).mockResolvedValue({
                rows: [{ total: 0 }],
                affected_rows: 0,
            });
            service.startAppTracking();
            service.startCodingTracking();
            service.startCodingTracking('proj-x');
            vi.advanceTimersByTime(4000);

            // Act
            const stats = await service.getTimeStats();

            // Assert
            expect(stats.totalOnlineTime).toBe(4000);
            expect(stats.totalCodingTime).toBe(4000);
            expect(stats.workspaceCodingTime).toEqual({ 'proj-x': 4000 });
        });

        it('should combine persisted and active workspace times', async () => {
            // Arrange
            const executeQuery = vi.mocked(mockDbClient.executeQuery);
            executeQuery.mockImplementation(async (req: DbQueryRequest) => {
                if (req.sql.includes('GROUP BY')) {
                    return {
                        rows: [{ [WORKSPACE_COMPAT_ID_COLUMN]: 'proj-x', total: 10000 }],
                        affected_rows: 0,
                    };
                }
                return { rows: [{ total: 0 }], affected_rows: 0 };
            });
            service.startCodingTracking('proj-x');
            vi.advanceTimersByTime(5000);

            // Act
            const stats = await service.getTimeStats();

            // Assert - 10000 persisted + 5000 active
            expect(stats.workspaceCodingTime['proj-x']).toBe(15000);
        });

        it('should return fallback stats on database error', async () => {
            // Arrange
            vi.mocked(mockDbClient.executeQuery).mockRejectedValue(new Error('DB connection failed'));

            // Act
            const stats = await service.getTimeStats();

            // Assert
            expect(stats).toEqual({
                totalOnlineTime: 0,
                totalCodingTime: 0,
                workspaceCodingTime: {},
            });
        });
    });

    describe('duration calculation', () => {
        it('should accurately measure duration for app tracking', async () => {
            // Arrange
            service.startAppTracking();
            vi.advanceTimersByTime(42000);

            // Act
            await service.stopAppTracking();

            // Assert
            const params = (getInsertCalls(mockDbClient)[0].params) as (string | number | null)[];
            expect(params[5]).toBe(42000);
        });

        it('should record correct start and end times', async () => {
            // Arrange
            const startTimestamp = Date.now();
            service.startAppTracking();
            vi.advanceTimersByTime(15000);

            // Act
            await service.stopAppTracking();

            // Assert
            const params = (getInsertCalls(mockDbClient)[0].params) as (string | number | null)[];
            expect(params[3]).toBe(startTimestamp); // startTime
            expect(params[4]).toBe(startTimestamp + 15000); // endTime
        });

        it('should handle zero-duration sessions', async () => {
            // Arrange
            service.startCodingTracking();
            // No time advance

            // Act
            await service.stopCodingTracking();

            // Assert
            const params = (getInsertCalls(mockDbClient)[0].params) as (string | number | null)[];
            expect(params[5]).toBe(0); // durationMs = 0
        });
    });

    describe('persistence (recordTime)', () => {
        it('should insert correct fields into database for app_online', async () => {
            // Arrange
            service.startAppTracking();
            vi.advanceTimersByTime(8000);

            // Act
            await service.stopAppTracking();

            // Assert
            const insertCalls = getInsertCalls(mockDbClient);
            expect(insertCalls).toHaveLength(1);
            const call = insertCalls[0];
            expect(call.sql).toContain('INSERT INTO time_tracking');
            const params = call.params as (string | number | null)[];
            expect(params[0]).toBe('test-uuid-1234'); // id
            expect(params[1]).toBe('app_online'); // type
            expect(params[2]).toBeNull(); // workspaceId
            expect(typeof params[3]).toBe('number'); // startTime
            expect(typeof params[4]).toBe('number'); // endTime
            expect(params[5]).toBe(8000); // durationMs
            expect(typeof params[6]).toBe('number'); // createdAt
            expect(typeof params[7]).toBe('number'); // updatedAt
        });

        it('should insert correct fields for workspace_coding', async () => {
            // Arrange
            service.startCodingTracking('my-workspace');
            vi.advanceTimersByTime(6000);

            // Act
            await service.stopCodingTracking('my-workspace');

            // Assert
            const params = (getInsertCalls(mockDbClient)[0].params) as (string | number | null)[];
            expect(params[1]).toBe(WORKSPACE_COMPAT_CODING_TYPE);
            expect(params[2]).toBe('my-workspace');
            expect(params[5]).toBe(6000);
        });

        it('should handle database insert failure gracefully', async () => {
            // Arrange
            vi.mocked(mockDbClient.executeQuery).mockRejectedValue(new Error('Insert failed'));
            service.startAppTracking();
            vi.advanceTimersByTime(1000);

            // Act & Assert - should not throw
            await expect(service.stopAppTracking()).resolves.not.toThrow();
        });
    });

    describe('edge cases', () => {
        it('should handle rapid start/stop cycles', async () => {
            // Arrange & Act
            for (let i = 0; i < 5; i++) {
                service.startCodingTracking();
                vi.advanceTimersByTime(100);
                await service.stopCodingTracking();
            }

            // Assert
            expect(getInsertCalls(mockDbClient)).toHaveLength(5);
        });

        it('should handle starting workspace tracking after overwriting the same workspace', async () => {
            // Arrange - start the same workspace twice (overwrites start time).
            service.startCodingTracking('workspace-1');
            vi.advanceTimersByTime(3000);
            service.startCodingTracking('workspace-1'); // overwrites
            vi.advanceTimersByTime(2000);

            // Act
            await service.stopCodingTracking('workspace-1');

            // Assert - duration should be from the second start
            const params = (getInsertCalls(mockDbClient)[0].params) as (string | number | null)[];
            expect(params[5]).toBe(2000);
        });

        it('should handle cleanup when periodic save had errors', async () => {
            // Arrange
            await service.initialize();
            vi.mocked(mockDbClient.executeQuery).mockRejectedValueOnce(new Error('periodic save error'));
            vi.advanceTimersByTime(60000); // trigger periodic save

            // Act - cleanup should still work
            vi.mocked(mockDbClient.executeQuery).mockResolvedValue({ rows: [], affected_rows: 0 });
            await expect(service.cleanup()).resolves.not.toThrow();
        });

        it('should handle getTimeStats with null total from database', async () => {
            // Arrange
            vi.mocked(mockDbClient.executeQuery).mockResolvedValue({
                rows: [{ total: null }],
                affected_rows: 0,
            });

            // Act
            const stats = await service.getTimeStats();

            // Assert - should fallback to 0
            expect(stats.totalOnlineTime).toBe(0);
            expect(stats.totalCodingTime).toBe(0);
        });

        it('should handle getTimeStats with empty rows from database', async () => {
            // Arrange
            vi.mocked(mockDbClient.executeQuery).mockResolvedValue({
                rows: [],
                affected_rows: 0,
            });

            // Act
            const stats = await service.getTimeStats();

            // Assert
            expect(stats.totalOnlineTime).toBe(0);
            expect(stats.totalCodingTime).toBe(0);
            expect(stats.workspaceCodingTime).toEqual({});
        });

        it('should handle concurrent app and coding tracking', async () => {
            // Arrange
            vi.mocked(mockDbClient.executeQuery).mockResolvedValue({
                rows: [{ total: 0 }],
                affected_rows: 0,
            });
            service.startAppTracking();
            service.startCodingTracking();
            service.startCodingTracking('proj-a');
            vi.advanceTimersByTime(10000);

            // Act
            const stats = await service.getTimeStats();

            // Assert - all three should be active
            expect(stats.totalOnlineTime).toBe(10000);
            expect(stats.totalCodingTime).toBe(10000);
            expect(stats.workspaceCodingTime['proj-a']).toBe(10000);
        });
    });
});
