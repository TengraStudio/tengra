/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { HealthCheckResult, HealthCheckService, HealthStatus } from '@main/services/system/health-check.service';
import { MemoryContextService } from '@main/services/llm/memory-context.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';

/**
 * Registers IPC handlers for health check endpoints
 */
export function registerHealthIpc(healthCheckService: HealthCheckService) {
    /**
     * Get overall health status of all registered services
     */
    ipcMain.handle('health:status', createSafeIpcHandler('health:status', async (): Promise<HealthCheckResult> => {
        return healthCheckService.getStatus();
    }, {
        overall: 'unhealthy',
        services: [],
        timestamp: new Date()
    } as HealthCheckResult));

    /**
     * Check a specific service immediately
     */
    ipcMain.handle('health:check', createSafeIpcHandler('health:check', async (_event, serviceName: string): Promise<HealthStatus | null> => {
        if (typeof serviceName !== 'string' || !serviceName.trim()) {
            throw new Error('Service name must be a non-empty string');
        }
        return await healthCheckService.checkNow(serviceName.trim());
    }, null));

    /**
     * Get health status for a specific service
     */
    ipcMain.handle('health:getService', createSafeIpcHandler('health:getService', async (_event, serviceName: string): Promise<HealthStatus | null> => {
        if (typeof serviceName !== 'string' || !serviceName.trim()) {
            throw new Error('Service name must be a non-empty string');
        }
        const status = healthCheckService.getStatus();
        return status.services.find(s => s.name === serviceName.trim()) ?? null;
    }, null));

    /**
     * List all registered service names
     */
    ipcMain.handle('health:listServices', createSafeIpcHandler('health:listServices', async (): Promise<string[]> => {
        const status = healthCheckService.getStatus();
        return status.services.map(s => s.name);
    }, []));

    /**
     * Get runtime memory-context lookup metrics
     */
    ipcMain.handle('health:memoryContext', createSafeIpcHandler('health:memoryContext', async () => {
        return MemoryContextService.getStats();
    }, {
        cacheHits: 0,
        cacheMisses: 0,
        inflightReuseCount: 0,
        lookupCount: 0,
        lookupTimeoutCount: 0,
        lookupFailureCount: 0,
        lastLookupDurationMs: 0,
        averageLookupDurationMs: 0,
        cacheSize: 0,
        inflightSize: 0,
    }));
}
