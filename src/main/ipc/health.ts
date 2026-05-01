import { MemoryContextService } from '@main/services/llm/memory-context.service';
import type { HealthCheckService } from '@main/services/system/health-check.service';
import { ipcMain } from 'electron';

/**
 * Registers IPC handlers for health check endpoints
 */
export function registerHealthIpc(healthCheckService: HealthCheckService) {
    /**
     * Get overall health status of all registered services
     */
    ipcMain.handle('health:status', async () => {
        try {
            return healthCheckService.getStatus();
        } catch (error) {
            return {
                overall: 'unhealthy',
                services: [],
                timestamp: new Date(),
                error: error instanceof Error ? error.message : String(error)
            };
        }
    });

    /**
     * Check a specific service immediately
     */
    ipcMain.handle('health:check', async (_event, serviceName: string) => {
        const name = typeof serviceName === 'string' ? serviceName.trim() : null;
        if (!name) {
            return null;
        }
        return healthCheckService.checkNow(name);
    });

    /**
     * Get health status for a specific service
     */
    ipcMain.handle('health:getService', async (_event, serviceName: string) => {
        if (!serviceName || typeof serviceName !== 'string') {
            return null;
        }
        const status = healthCheckService.getStatus();
        const trimmed = serviceName.trim();
        return status.services.find(s => s.name === trimmed) ?? null;
    });

    /**
     * List all registered service names
     */
    ipcMain.handle('health:listServices', async () => {
        try {
            const status = healthCheckService.getStatus();
            return status.services.map(s => s.name);
        } catch {
            return [];
        }
    });

    /**
     * Get runtime memory-context lookup metrics
     */
    ipcMain.handle('health:memoryContext', async () => {
        return MemoryContextService.getStats();
    });
}
