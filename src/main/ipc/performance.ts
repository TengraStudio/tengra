import { appLogger } from '@main/logging/logger';
import { IPerformanceService } from '@main/types/services';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';

/**
 * Registers IPC handlers for performance monitoring operations
 */
export function registerPerformanceIpc(performanceService: IPerformanceService): void {
    appLogger.info('PerformanceIPC', 'Registering performance IPC handlers');

    ipcMain.handle(
        'performance:get-memory-stats',
        createSafeIpcHandler(
            'performance:get-memory-stats',
            async () => {
                return performanceService.getMemoryStats();
            },
            { success: false, data: { main: process.memoryUsage(), timestamp: 0 } }
        )
    );

    ipcMain.handle(
        'performance:detect-leak',
        createSafeIpcHandler(
            'performance:detect-leak',
            async () => {
                return await performanceService.detectLeak();
            },
            { success: false, data: { isPossibleLeak: false, trend: [] } }
        )
    );

    ipcMain.handle(
        'performance:trigger-gc',
        createSafeIpcHandler(
            'performance:trigger-gc',
            async () => {
                return performanceService.triggerGC();
            },
            { success: false, data: { success: false } }
        )
    );
}
