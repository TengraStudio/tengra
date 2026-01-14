import { ipcMain } from 'electron'
import { HealthCheckService, HealthCheckResult, HealthStatus } from '@main/services/health-check.service'
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util'

/**
 * Registers IPC handlers for health check endpoints
 */
export function registerHealthIpc(healthCheckService: HealthCheckService) {
    /**
     * Get overall health status of all registered services
     */
    ipcMain.handle('health:status', createSafeIpcHandler('health:status', async (): Promise<HealthCheckResult> => {
        return healthCheckService.getStatus()
    }, {
        overall: 'unhealthy',
        services: [],
        timestamp: new Date()
    } as HealthCheckResult))

    /**
     * Check a specific service immediately
     */
    ipcMain.handle('health:check', createSafeIpcHandler('health:check', async (_event, serviceName: string): Promise<HealthStatus | null> => {
        if (typeof serviceName !== 'string' || !serviceName.trim()) {
            throw new Error('Service name must be a non-empty string')
        }
        return await healthCheckService.checkNow(serviceName.trim())
    }, null))

    /**
     * Get health status for a specific service
     */
    ipcMain.handle('health:getService', createSafeIpcHandler('health:getService', async (_event, serviceName: string): Promise<HealthStatus | null> => {
        if (typeof serviceName !== 'string' || !serviceName.trim()) {
            throw new Error('Service name must be a non-empty string')
        }
        const status = healthCheckService.getStatus()
        return status.services.find(s => s.name === serviceName.trim()) || null
    }, null))

    /**
     * List all registered service names
     */
    ipcMain.handle('health:listServices', createSafeIpcHandler('health:listServices', async (): Promise<string[]> => {
        const status = healthCheckService.getStatus()
        return status.services.map(s => s.name)
    }, []))
}
