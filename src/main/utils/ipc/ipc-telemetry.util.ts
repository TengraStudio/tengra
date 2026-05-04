/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * IPC Telemetry Utility (BACKLOG-0055, 0065, 0075)
 * 
 * Provides telemetry tracking for IPC handlers including:
 * - Operation success/failure rates
 * - Operation latency histograms
 * - Error frequency by code
 * 
 * @module @main/utils/ipc-telemetry.util
 */

import { appLogger } from '@main/logging/logger';
import { TelemetryService } from '@main/services/analysis/telemetry.service';
import { AppErrorCode, getErrorMessage } from '@shared/utils/system/error.util';

/**
 * Performance budgets for IPC operations in milliseconds
 * Operations exceeding these budgets will be logged as warnings
 */
export const IPC_PERFORMANCE_BUDGETS: Record<string, number> = {
    // Database operations (BACKLOG-0496)
    'db:query': 250,
    'db:exec': 250,
    'db:getChat': 100,
    'db:createChat': 200,
    'db:updateChat': 200,
    'db:deleteChat': 150,
    'db:getMessages': 100,
    'db:addMessage': 150,
    'db:searchChats': 500,
    'db:getWorkspaces': 100,
    'db:createWorkspace': 200,
    'db:updateWorkspace': 200,
    'db:deleteWorkspace': 300,
    'db:getStats': 300,
    'db:getDetailedStats': 500,
    'db:validateSchema': 1000,
    'db:runMigrations': 30000,
    'db:connectionHealth': 5000,
    'db:vectorSearch': 500,
    'db:codeSymbols': 300,
    'db:semanticFragments': 300,
    'db:archiveOldChats': 5000,
    // SSH operations
    'ssh:connect': 5000,
    'ssh:disconnect': 2000,
    'ssh:execute': 30000,
    'ssh:listDir': 5000,
    'ssh:readFile': 10000,
    'ssh:writeFile': 10000,
    'ssh:upload': 60000,
    'ssh:download': 60000,
    'ssh:createTunnel': 3000,
    'ssh:getSystemStats': 5000,
    // Terminal operations
    'terminal:create': 100,
    'terminal:close': 50,
    'terminal:write': 100,
    'terminal:resize': 50,
    'terminal:getSessions': 50,
    'terminal:exportSession': 1000,
    'terminal:importSession': 1000,
    'terminal:searchScrollback': 500,
    // Git-Advanced operations
    'git:getConflicts': 1000,
    'git:resolveConflict': 2000,
    'git:getStashes': 500,
    'git:createStash': 2000,
    'git:applyStash': 2000,
    'git:getBlame': 3000,
    'git:getRebaseStatus': 500,
    'git:listSubmodules': 1000,
    'git:listHooks': 500,
    'git:runControlledCommand': 30000
};

/**
 * Metrics tracked per IPC channel
 */
interface IpcChannelMetrics {
    calls: number;
    successes: number;
    failures: number;
    totalDurationMs: number;
    maxDurationMs: number;
    minDurationMs: number;
    budgetExceededCount: number;
    lastErrorCode?: string;
    lastErrorTime?: number;
}

/**
 * In-memory metrics store for IPC operations
 */
class IpcMetricsStore {
    private metrics: Map<string, IpcChannelMetrics> = new Map();
    private totalCalls = 0;
    private totalFailures = 0;
    private budgetExceededCount = 0;

    getChannelMetrics(channel: string): IpcChannelMetrics {
        if (!this.metrics.has(channel)) {
            this.metrics.set(channel, {
                calls: 0,
                successes: 0,
                failures: 0,
                totalDurationMs: 0,
                maxDurationMs: 0,
                minDurationMs: Infinity,
                budgetExceededCount: 0
            });
        }
        const channelMetrics = this.metrics.get(channel);
        if (!channelMetrics) {
            throw new Error(`IPC telemetry channel metrics missing after initialization: ${channel}`);
        }
        return channelMetrics;
    }

    recordSuccess(channel: string, durationMs: number): void {
        const metrics = this.getChannelMetrics(channel);
        metrics.calls += 1;
        metrics.successes += 1;
        metrics.totalDurationMs += durationMs;
        metrics.maxDurationMs = Math.max(metrics.maxDurationMs, durationMs);
        metrics.minDurationMs = Math.min(metrics.minDurationMs, durationMs);
        this.totalCalls += 1;

        const budget = IPC_PERFORMANCE_BUDGETS[channel];
        if (budget && durationMs > budget) {
            metrics.budgetExceededCount += 1;
            this.budgetExceededCount += 1;
            appLogger.warn('IpcTelemetry', `[${channel}] Exceeded performance budget: ${durationMs}ms > ${budget}ms`);
        }
    }

    recordFailure(channel: string, durationMs: number, errorCode?: string): void {
        const metrics = this.getChannelMetrics(channel);
        metrics.calls += 1;
        metrics.failures += 1;
        metrics.totalDurationMs += durationMs;
        metrics.maxDurationMs = Math.max(metrics.maxDurationMs, durationMs);
        metrics.minDurationMs = Math.min(metrics.minDurationMs, durationMs);
        metrics.lastErrorCode = errorCode;
        metrics.lastErrorTime = Date.now();
        this.totalCalls += 1;
        this.totalFailures += 1;
    }

    getSummary(): {
        totalCalls: number;
        totalFailures: number;
        errorRate: number;
        budgetExceededCount: number;
        channels: Record<string, IpcChannelMetrics & { avgDurationMs: number; successRate: number }>;
    } {
        const channels: Record<string, IpcChannelMetrics & { avgDurationMs: number; successRate: number }> = {};

        for (const [channel, metrics] of this.metrics) {
            const avgDurationMs = metrics.calls > 0 ? metrics.totalDurationMs / metrics.calls : 0;
            const successRate = metrics.calls > 0 ? metrics.successes / metrics.calls : 0;
            channels[channel] = {
                ...metrics,
                avgDurationMs: Math.round(avgDurationMs * 100) / 100,
                successRate: Math.round(successRate * 10000) / 100
            };
        }

        const errorRate = this.totalCalls > 0 ? this.totalFailures / this.totalCalls : 0;

        return {
            totalCalls: this.totalCalls,
            totalFailures: this.totalFailures,
            errorRate: Math.round(errorRate * 10000) / 100,
            budgetExceededCount: this.budgetExceededCount,
            channels
        };
    }

    reset(): void {
        this.metrics.clear();
        this.totalCalls = 0;
        this.totalFailures = 0;
        this.budgetExceededCount = 0;
    }
}

// Global metrics store instance
export const ipcMetricsStore = new IpcMetricsStore();

/**
 * Wraps an IPC handler with telemetry tracking
 * 
 * @param channel - The IPC channel name
 * @param handler - The handler function to wrap
 * @param telemetryService - Optional telemetry service for external tracking
 * @returns Wrapped handler function
 * 
 * @example
 * ```typescript
 * const wrappedHandler = withIpcTelemetry('ssh:connect', async (connection) => {
 *     return await sshService.connect(connection);
 * }, telemetryService);
 * ```
 */
export function withIpcTelemetry<TArgs extends RuntimeValue[], TResult>(
    channel: string,
    handler: (...args: TArgs) => Promise<TResult>,
    telemetryService?: TelemetryService
): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs): Promise<TResult> => {
        const startTime = Date.now();

        try {
            const result = await handler(...args);
            const duration = Date.now() - startTime;

            // Record success metrics
            ipcMetricsStore.recordSuccess(channel, duration);

            // Track to external telemetry if available
            if (telemetryService) {
                telemetryService.track(`ipc.${channel}.success`, {
                    duration,
                    channel
                });
            }

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = getErrorMessage(error);
            const errorCode = error instanceof Error && 'code' in error
                ? String((error as { code?: string }).code)
                : AppErrorCode.UNKNOWN;

            // Record failure metrics
            ipcMetricsStore.recordFailure(channel, duration, errorCode);

            // Track to external telemetry if available
            if (telemetryService) {
                telemetryService.track(`ipc.${channel}.failure`, {
                    duration,
                    channel,
                    errorCode,
                    errorMessage
                });
            }

            throw error;
        }
    };
}

/**
 * Gets the current IPC metrics summary
 */
export function getIpcMetricsSummary(): ReturnType<IpcMetricsStore['getSummary']> {
    return ipcMetricsStore.getSummary();
}

/**
 * Resets all IPC metrics
 */
export function resetIpcMetrics(): void {
    ipcMetricsStore.reset();
}

/**
 * Gets the performance budget for a channel
 */
export function getPerformanceBudget(channel: string): number | undefined {
    return IPC_PERFORMANCE_BUDGETS[channel];
}

/**
 * Checks if an operation exceeded its performance budget
 */
export function isBudgetExceeded(channel: string, durationMs: number): boolean {
    const budget = IPC_PERFORMANCE_BUDGETS[channel];
    return budget !== undefined && durationMs > budget;
}
