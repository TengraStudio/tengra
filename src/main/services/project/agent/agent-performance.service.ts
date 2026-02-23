import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { AgentPerformanceMetrics } from '@shared/types/project-agent';
import { safeJsonParse } from '@shared/utils/sanitize.util';

/**
 * AGENT-08: Service for tracking and analyzing agent performance metrics
 * Monitors error rates, resource usage, and execution performance
 */
export class AgentPerformanceService extends BaseService {
    private metricsMap: Map<string, AgentPerformanceMetrics> = new Map();
    private resourceMonitorInterval?: NodeJS.Timeout;

    constructor(private readonly databaseService?: DatabaseService) {
        super('AgentPerformanceService');
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing AgentPerformanceService...');
        // Start resource monitoring every 5 seconds
        this.resourceMonitorInterval = setInterval(() => {
            this.updateResourceMetrics();
        }, 5000);
        this.logInfo('AgentPerformanceService initialized successfully');
    }

    async cleanup(): Promise<void> {
        this.logInfo('Cleaning up AgentPerformanceService...');
        if (this.resourceMonitorInterval) {
            clearInterval(this.resourceMonitorInterval);
        }
        for (const taskId of this.metricsMap.keys()) {
            await this.saveMetrics(taskId);
        }
    }

    /**
     * Initialize metrics for a new task
     */
    public initializeMetrics(taskId: string): AgentPerformanceMetrics {
        const metrics: AgentPerformanceMetrics = {
            taskId,
            completionRate: 0,
            avgStepExecutionTimeMs: 0,
            stepsCompleted: 0,
            stepsFailed: 0,
            errors: {
                totalErrors: 0,
                errorRate: 0,
                errorsByType: {},
                recentErrors: [],
            },
            resources: {
                memoryUsageMb: 0,
                peakMemoryMb: 0,
                cpuUsagePercent: 0,
                totalExecutionTimeMs: 0,
                apiCallCount: 0,
                totalTokensUsed: 0,
                totalCostUsd: 0,
            },
            alerts: [],
            lastUpdatedAt: Date.now(),
        };

        this.metricsMap.set(taskId, metrics);
        return metrics;
    }

    /**
     * AGENT-08.3: Record an error for error rate monitoring
     */
    public recordError(
        taskId: string,
        error: { type: string; message: string; stepId?: string }
    ): void {
        const metrics = this.metricsMap.get(taskId);
        if (!metrics) {
            this.logWarn(`No metrics found for task ${taskId}`);
            return;
        }

        metrics.errors.totalErrors++;
        metrics.errors.errorsByType[error.type] =
            (metrics.errors.errorsByType[error.type] || 0) + 1;
        metrics.errors.recentErrors.push({
            timestamp: Date.now(),
            type: error.type,
            message: error.message,
            stepId: error.stepId,
        });
        metrics.errors.lastErrorAt = Date.now();

        // Keep only last 50 errors
        if (metrics.errors.recentErrors.length > 50) {
            metrics.errors.recentErrors = metrics.errors.recentErrors.slice(-50);
        }

        // Calculate error rate
        const totalSteps = metrics.stepsCompleted + metrics.stepsFailed;
        metrics.errors.errorRate =
            totalSteps > 0 ? (metrics.stepsFailed / totalSteps) * 100 : 0;

        // Check for error rate alerts
        if (metrics.errors.errorRate > 50) {
            this.addAlert(taskId, {
                type: 'error_rate',
                severity: 'critical',
                message: `Error rate is ${metrics.errors.errorRate.toFixed(1)}% (critical threshold exceeded)`,
                timestamp: Date.now(),
            });
        } else if (metrics.errors.errorRate > 25) {
            this.addAlert(taskId, {
                type: 'error_rate',
                severity: 'high',
                message: `Error rate is ${metrics.errors.errorRate.toFixed(1)}% (high threshold exceeded)`,
                timestamp: Date.now(),
            });
        }

        metrics.lastUpdatedAt = Date.now();
        this.logInfo(`Recorded error for task ${taskId}: ${error.type}`);
    }

    /**
     * AGENT-08.4: Update resource usage metrics
     */
    public updateResourceUsage(
        taskId: string,
        usage: {
            memoryMb?: number;
            cpuPercent?: number;
            apiCalls?: number;
            tokensUsed?: number;
            costUsd?: number;
        }
    ): void {
        const metrics = this.metricsMap.get(taskId);
        if (!metrics) {
            return;
        }

        if (usage.memoryMb !== undefined) {
            metrics.resources.memoryUsageMb = usage.memoryMb;
            metrics.resources.peakMemoryMb = Math.max(
                metrics.resources.peakMemoryMb,
                usage.memoryMb
            );

            // Check for memory alerts
            if (usage.memoryMb > 1024) {
                // > 1GB
                this.addAlert(taskId, {
                    type: 'resource_usage',
                    severity: 'high',
                    message: `Memory usage is ${usage.memoryMb.toFixed(0)}MB (high threshold exceeded)`,
                    timestamp: Date.now(),
                });
            }
        }

        if (usage.cpuPercent !== undefined) {
            metrics.resources.cpuUsagePercent = usage.cpuPercent;

            // Check for CPU alerts
            if (usage.cpuPercent > 80) {
                this.addAlert(taskId, {
                    type: 'resource_usage',
                    severity: 'medium',
                    message: `CPU usage is ${usage.cpuPercent.toFixed(1)}% (high threshold exceeded)`,
                    timestamp: Date.now(),
                });
            }
        }

        if (usage.apiCalls !== undefined) {
            metrics.resources.apiCallCount += usage.apiCalls;
        }

        if (usage.tokensUsed !== undefined) {
            metrics.resources.totalTokensUsed += usage.tokensUsed;
        }

        if (usage.costUsd !== undefined) {
            metrics.resources.totalCostUsd += usage.costUsd;

            // Check for cost alerts
            if (metrics.resources.totalCostUsd > 10) {
                // > $10
                this.addAlert(taskId, {
                    type: 'cost_threshold',
                    severity: 'high',
                    message: `Total cost is $${metrics.resources.totalCostUsd.toFixed(2)} (threshold exceeded)`,
                    timestamp: Date.now(),
                });
            }
        }

        metrics.lastUpdatedAt = Date.now();
    }

    /**
     * Record step completion
     */
    public recordStepCompletion(
        taskId: string,
        success: boolean,
        executionTimeMs: number
    ): void {
        const metrics = this.metricsMap.get(taskId);
        if (!metrics) {
            return;
        }

        if (success) {
            metrics.stepsCompleted++;
        } else {
            metrics.stepsFailed++;
        }

        // Update average execution time
        const totalSteps = metrics.stepsCompleted + metrics.stepsFailed;
        metrics.avgStepExecutionTimeMs =
            (metrics.avgStepExecutionTimeMs * (totalSteps - 1) + executionTimeMs) / totalSteps;

        // Update completion rate
        metrics.completionRate =
            totalSteps > 0 ? (metrics.stepsCompleted / totalSteps) * 100 : 0;

        // Update total execution time
        metrics.resources.totalExecutionTimeMs += executionTimeMs;

        // Check for slow execution alerts
        if (executionTimeMs > 300000) {
            // > 5 minutes
            this.addAlert(taskId, {
                type: 'slow_execution',
                severity: 'medium',
                message: `Step took ${(executionTimeMs / 1000).toFixed(1)}s to execute (slow threshold exceeded)`,
                timestamp: Date.now(),
            });
        }

        metrics.lastUpdatedAt = Date.now();
    }

    /**
     * Get metrics for a task
     */
    public getMetrics(taskId: string): AgentPerformanceMetrics | undefined {
        return this.metricsMap.get(taskId);
    }

    /**
     * Get all metrics
     */
    public getAllMetrics(): AgentPerformanceMetrics[] {
        return Array.from(this.metricsMap.values());
    }

    /**
     * Clear metrics for a task
     */
    public clearMetrics(taskId: string): void {
        this.metricsMap.delete(taskId);
    }

    /**
     * Add an alert to metrics
     */
    private addAlert(
        taskId: string,
        alert: AgentPerformanceMetrics['alerts'][0]
    ): void {
        const metrics = this.metricsMap.get(taskId);
        if (!metrics) {
            return;
        }

        metrics.alerts.push(alert);

        // Keep only last 20 alerts
        if (metrics.alerts.length > 20) {
            metrics.alerts = metrics.alerts.slice(-20);
        }
    }

    /**
     * Update resource metrics for all active tasks
     */
    private updateResourceMetrics(): void {
        const memUsage = process.memoryUsage();
        const memUsageMb = memUsage.heapUsed / 1024 / 1024;

        // Update all active task metrics
        for (const [taskId, metrics] of this.metricsMap.entries()) {
            // Only update if task is still active (updated in last 5 minutes)
            if (Date.now() - metrics.lastUpdatedAt < 300000) {
                this.updateResourceUsage(taskId, {
                    memoryMb: memUsageMb,
                });
            }
        }
    }

    /**
     * Save metrics to database for persistence
     */
    public async saveMetrics(taskId: string): Promise<void> {
        const metrics = this.metricsMap.get(taskId);
        if (!metrics) {
            this.logWarn(`No metrics found for task ${taskId}`);
            return;
        }

        if (!this.databaseService) {
            this.logWarn(
                `Database service unavailable; metrics for task ${taskId} remain in memory only`
            );
            return;
        }

        try {
            const metricsJson = JSON.stringify(metrics);
            await this.databaseService.uac.savePerformanceMetrics(taskId, metricsJson);
            this.logInfo(`Metrics persisted for task ${taskId}`);
        } catch (error) {
            this.logError(`Failed to persist metrics for task ${taskId}`, error as Error);
        }
    }

    /**
     * Load metrics from database
     */
    public async loadMetrics(taskId: string): Promise<AgentPerformanceMetrics | null> {
        const inMemoryMetrics = this.metricsMap.get(taskId);
        if (inMemoryMetrics) {
            return inMemoryMetrics;
        }

        if (!this.databaseService) {
            return null;
        }

        try {
            const record = await this.databaseService.uac.getPerformanceMetrics(taskId);
            if (!record) {
                return null;
            }

            const parsed = safeJsonParse<AgentPerformanceMetrics | null>(record.metrics_json, null);
            if (!parsed) {
                this.logWarn(`Invalid metrics JSON for task ${taskId}`);
                return null;
            }

            this.metricsMap.set(taskId, parsed);
            return parsed;
        } catch (error) {
            this.logError(`Failed to load metrics for task ${taskId}`, error as Error);
            return null;
        }
    }

    /**
     * Get metrics history for a task
     */
    public async getMetricsHistory(
        taskId: string,
        limit: number = 10
    ): Promise<AgentPerformanceMetrics[]> {
        const inMemoryMetrics = this.metricsMap.get(taskId);

        if (!this.databaseService) {
            return inMemoryMetrics ? [inMemoryMetrics] : [];
        }

        const records = await this.databaseService.uac.getPerformanceMetricsHistory(taskId, limit);
        const history: AgentPerformanceMetrics[] = [];
        for (const record of records) {
            const parsed = safeJsonParse<AgentPerformanceMetrics | null>(record.metrics_json, null);
            if (parsed) {
                history.push(parsed);
            }
        }

        if (history.length === 0 && inMemoryMetrics) {
            return [inMemoryMetrics];
        }

        return history;
    }
}
