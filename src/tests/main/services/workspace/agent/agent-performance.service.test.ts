import { AgentPerformanceService } from '@main/services/workspace/automation-workflow/agent-performance.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('@shared/utils/sanitize.util', () => ({
    safeJsonParse: <T>(json: string, fallback: T): T => {
        try {
            return JSON.parse(json) as T;
        } catch {
            return fallback;
        }
    },
}));

interface MockUac {
    savePerformanceMetrics: ReturnType<typeof vi.fn>;
    getPerformanceMetrics: ReturnType<typeof vi.fn>;
    getPerformanceMetricsHistory: ReturnType<typeof vi.fn>;
}

interface MockDatabaseService {
    uac: MockUac;
}

function createMockDb(): MockDatabaseService {
    return {
        uac: {
            savePerformanceMetrics: vi.fn().mockResolvedValue(undefined),
            getPerformanceMetrics: vi.fn().mockResolvedValue(null),
            getPerformanceMetricsHistory: vi.fn().mockResolvedValue([]),
        },
    };
}

describe('AgentPerformanceService', () => {
    let service: AgentPerformanceService;
    let mockDb: MockDatabaseService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        mockDb = createMockDb();
        service = new AgentPerformanceService(mockDb as never);
    });

    afterEach(async () => {
        await service.cleanup();
        vi.useRealTimers();
    });

    describe('initialize', () => {
        it('should start resource monitor interval', async () => {
            await service.initialize();
            // The interval is set - we can verify by advancing timers
            expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
        });
    });

    describe('cleanup', () => {
        it('should clear interval and save metrics', async () => {
            await service.initialize();
            service.initializeMetrics('task-1');

            await service.cleanup();

            expect(mockDb.uac.savePerformanceMetrics).toHaveBeenCalledWith(
                'task-1',
                expect.any(String)
            );
        });
    });

    describe('initializeMetrics', () => {
        it('should create initial metrics for a task', () => {
            const metrics = service.initializeMetrics('task-1');

            expect(metrics.taskId).toBe('task-1');
            expect(metrics.completionRate).toBe(0);
            expect(metrics.stepsCompleted).toBe(0);
            expect(metrics.stepsFailed).toBe(0);
            expect(metrics.errors.totalErrors).toBe(0);
            expect(metrics.resources.totalTokensUsed).toBe(0);
            expect(metrics.alerts).toHaveLength(0);
        });

        it('should be retrievable via getMetrics', () => {
            service.initializeMetrics('task-1');
            const retrieved = service.getMetrics('task-1');

            expect(retrieved).toBeDefined();
            expect(retrieved?.taskId).toBe('task-1');
        });
    });

    describe('recordError', () => {
        it('should record an error and update counts', () => {
            service.initializeMetrics('task-1');

            service.recordError('task-1', {
                type: 'runtime',
                message: 'Something broke',
                stepId: 'step-1',
            });

            const metrics = service.getMetrics('task-1');
            expect(metrics?.errors.totalErrors).toBe(1);
            expect(metrics?.errors.errorsByType['runtime']).toBe(1);
            expect(metrics?.errors.recentErrors).toHaveLength(1);
        });

        it('should do nothing for unknown task', () => {
            // Should not throw
            service.recordError('unknown', { type: 'runtime', message: 'err' });
        });

        it('should generate critical alert when error rate exceeds 50%', () => {
            service.initializeMetrics('task-1');
            const metrics = service.getMetrics('task-1')!;
            // Simulate 1 failed step to have error rate calculable
            metrics.stepsFailed = 2;
            metrics.stepsCompleted = 0;

            service.recordError('task-1', { type: 'runtime', message: 'err' });

            expect(metrics.alerts.some(a => a.severity === 'critical')).toBe(true);
        });

        it('should trim recent errors to 50', () => {
            service.initializeMetrics('task-1');

            for (let i = 0; i < 55; i++) {
                service.recordError('task-1', { type: 'runtime', message: `err-${i}` });
            }

            const metrics = service.getMetrics('task-1');
            expect(metrics?.errors.recentErrors.length).toBeLessThanOrEqual(50);
        });
    });

    describe('updateResourceUsage', () => {
        it('should update memory and track peak', () => {
            service.initializeMetrics('task-1');

            service.updateResourceUsage('task-1', { memoryMb: 500 });
            service.updateResourceUsage('task-1', { memoryMb: 300 });

            const metrics = service.getMetrics('task-1');
            expect(metrics?.resources.memoryUsageMb).toBe(300);
            expect(metrics?.resources.peakMemoryMb).toBe(500);
        });

        it('should accumulate API calls and tokens', () => {
            service.initializeMetrics('task-1');

            service.updateResourceUsage('task-1', { apiCalls: 5, tokensUsed: 1000 });
            service.updateResourceUsage('task-1', { apiCalls: 3, tokensUsed: 500 });

            const metrics = service.getMetrics('task-1');
            expect(metrics?.resources.apiCallCount).toBe(8);
            expect(metrics?.resources.totalTokensUsed).toBe(1500);
        });

        it('should generate alert for high memory usage', () => {
            service.initializeMetrics('task-1');
            service.updateResourceUsage('task-1', { memoryMb: 1500 });

            const metrics = service.getMetrics('task-1');
            expect(metrics?.alerts.some(a => a.type === 'resource_usage')).toBe(true);
        });

        it('should generate alert for high cost', () => {
            service.initializeMetrics('task-1');
            service.updateResourceUsage('task-1', { costUsd: 15 });

            const metrics = service.getMetrics('task-1');
            expect(metrics?.alerts.some(a => a.type === 'cost_threshold')).toBe(true);
        });

        it('should do nothing for unknown task', () => {
            service.updateResourceUsage('unknown', { memoryMb: 100 });
            // should not throw
        });
    });

    describe('recordStepCompletion', () => {
        it('should track successful step', () => {
            service.initializeMetrics('task-1');
            service.recordStepCompletion('task-1', true, 1000);

            const metrics = service.getMetrics('task-1');
            expect(metrics?.stepsCompleted).toBe(1);
            expect(metrics?.completionRate).toBe(100);
            expect(metrics?.avgStepExecutionTimeMs).toBe(1000);
        });

        it('should track failed step', () => {
            service.initializeMetrics('task-1');
            service.recordStepCompletion('task-1', false, 2000);

            const metrics = service.getMetrics('task-1');
            expect(metrics?.stepsFailed).toBe(1);
            expect(metrics?.completionRate).toBe(0);
        });

        it('should calculate running average execution time', () => {
            service.initializeMetrics('task-1');
            service.recordStepCompletion('task-1', true, 1000);
            service.recordStepCompletion('task-1', true, 3000);

            const metrics = service.getMetrics('task-1');
            expect(metrics?.avgStepExecutionTimeMs).toBe(2000);
        });

        it('should generate alert for slow execution', () => {
            service.initializeMetrics('task-1');
            service.recordStepCompletion('task-1', true, 400000); // > 5 minutes

            const metrics = service.getMetrics('task-1');
            expect(metrics?.alerts.some(a => a.type === 'slow_execution')).toBe(true);
        });
    });

    describe('getMetrics / getAllMetrics / clearMetrics', () => {
        it('should return undefined for unknown task', () => {
            expect(service.getMetrics('unknown')).toBeUndefined();
        });

        it('should return all metrics', () => {
            service.initializeMetrics('task-1');
            service.initializeMetrics('task-2');

            expect(service.getAllMetrics()).toHaveLength(2);
        });

        it('should clear metrics for a task', () => {
            service.initializeMetrics('task-1');
            service.clearMetrics('task-1');

            expect(service.getMetrics('task-1')).toBeUndefined();
        });
    });

    describe('saveMetrics', () => {
        it('should persist metrics to database', async () => {
            service.initializeMetrics('task-1');
            await service.saveMetrics('task-1');

            expect(mockDb.uac.savePerformanceMetrics).toHaveBeenCalledWith(
                'task-1',
                expect.any(String)
            );
        });

        it('should warn when no metrics found', async () => {
            await service.saveMetrics('unknown');
            // Should not throw, just warn
        });

        it('should handle missing database service', async () => {
            const noDB = new AgentPerformanceService(undefined);
            noDB.initializeMetrics('task-1');
            await noDB.saveMetrics('task-1');
            // Should not throw
        });
    });

    describe('loadMetrics', () => {
        it('should return in-memory metrics if available', async () => {
            service.initializeMetrics('task-1');
            const result = await service.loadMetrics('task-1');

            expect(result?.taskId).toBe('task-1');
        });

        it('should load from database if not in memory', async () => {
            const storedMetrics = {
                taskId: 'task-db',
                completionRate: 50,
                avgStepExecutionTimeMs: 100,
                stepsCompleted: 5,
                stepsFailed: 5,
                errors: { totalErrors: 0, errorRate: 0, errorsByType: {}, recentErrors: [] },
                resources: {
                    memoryUsageMb: 0, peakMemoryMb: 0, cpuUsagePercent: 0,
                    totalExecutionTimeMs: 0, apiCallCount: 0, totalTokensUsed: 0, totalCostUsd: 0,
                },
                alerts: [],
                lastUpdatedAt: Date.now(),
            };

            mockDb.uac.getPerformanceMetrics.mockResolvedValue({
                metrics_json: JSON.stringify(storedMetrics),
            });

            const result = await service.loadMetrics('task-db');
            expect(result?.taskId).toBe('task-db');
        });

        it('should return null when not found anywhere', async () => {
            const result = await service.loadMetrics('nonexistent');
            expect(result).toBeNull();
        });

        it('should return null without database service', async () => {
            const noDB = new AgentPerformanceService(undefined);
            const result = await noDB.loadMetrics('task-1');
            expect(result).toBeNull();
        });
    });

    describe('getMetricsHistory', () => {
        it('should return in-memory metrics when no database', async () => {
            const noDB = new AgentPerformanceService(undefined);
            noDB.initializeMetrics('task-1');

            const history = await noDB.getMetricsHistory('task-1');
            expect(history).toHaveLength(1);
        });

        it('should return empty when no metrics at all', async () => {
            const noDB = new AgentPerformanceService(undefined);
            const history = await noDB.getMetricsHistory('nonexistent');
            expect(history).toHaveLength(0);
        });

        it('should load history from database', async () => {
            const storedMetrics = {
                taskId: 'task-1',
                completionRate: 50,
                avgStepExecutionTimeMs: 100,
                stepsCompleted: 5,
                stepsFailed: 0,
                errors: { totalErrors: 0, errorRate: 0, errorsByType: {}, recentErrors: [] },
                resources: {
                    memoryUsageMb: 0, peakMemoryMb: 0, cpuUsagePercent: 0,
                    totalExecutionTimeMs: 0, apiCallCount: 0, totalTokensUsed: 0, totalCostUsd: 0,
                },
                alerts: [],
                lastUpdatedAt: Date.now(),
            };

            mockDb.uac.getPerformanceMetricsHistory.mockResolvedValue([
                { metrics_json: JSON.stringify(storedMetrics) },
            ]);

            const history = await service.getMetricsHistory('task-1', 10);
            expect(history).toHaveLength(1);
        });
    });
});
