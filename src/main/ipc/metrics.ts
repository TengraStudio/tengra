import { appLogger } from '@main/logging/logger';
import { getMetricsService } from '@main/services/analysis/metrics.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain, IpcMainInvokeEvent } from 'electron';

/** Maximum provider name length */
const MAX_PROVIDER_LENGTH = 64;

/**
 * Validates a provider name
 */
function validateProvider(value: RuntimeValue): string | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_PROVIDER_LENGTH) {
        return undefined;
    }
    return trimmed;
}

/**
 * Registers IPC handlers for metrics operations
 */
export function registerMetricsIpc(): void {
    appLogger.info('MetricsIPC', 'Registering metrics IPC handlers');

    ipcMain.handle(
        'metrics:get-provider-stats',
        createSafeIpcHandler(
            'metrics:get-provider-stats',
            async (_event: IpcMainInvokeEvent, providerRaw: RuntimeValue) => {
                const metrics = getMetricsService();
                const provider = validateProvider(providerRaw);
                if (provider) {
                    return metrics.getProviderStats(provider);
                }
                return metrics.getAllProviderStats();
            },
            {}
        )
    );

    ipcMain.handle(
        'metrics:get-summary',
        createSafeIpcHandler(
            'metrics:get-summary',
            async () => {
                return getMetricsService().getSummary();
            },
            { totalRequests: 0, successRate: 0, avgLatencyMs: 0, providers: [] }
        )
    );

    ipcMain.handle(
        'metrics:reset',
        createSafeIpcHandler(
            'metrics:reset',
            async () => {
                getMetricsService().reset();
                appLogger.info('MetricsIPC', 'Metrics reset');
                return true;
            },
            false
        )
    );
}
