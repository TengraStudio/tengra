import { getMetricsService } from '@main/services/metrics.service';
import { ipcMain } from 'electron';

export function registerMetricsIpc(): void {
    ipcMain.handle('metrics:get-provider-stats', (_event, provider?: string) => {
        const metrics = getMetricsService();
        if (provider) {
            return metrics.getProviderStats(provider);
        }
        return metrics.getAllProviderStats();
    });

    ipcMain.handle('metrics:get-summary', (_event) => {
        return getMetricsService().getSummary();
    });

    ipcMain.handle('metrics:reset', (_event) => {
        getMetricsService().reset();
        return true;
    });
}
