import { IPerformanceService } from '@main/types/services';
import { ipcMain } from 'electron';

export function registerPerformanceIpc(performanceService: IPerformanceService): void {
    ipcMain.handle('performance:get-memory-stats', () => {
        return performanceService.getMemoryStats();
    });

    ipcMain.handle('performance:detect-leak', async () => {
        return await performanceService.detectLeak();
    });

    ipcMain.handle('performance:trigger-gc', () => {
        return performanceService.triggerGC();
    });
}
