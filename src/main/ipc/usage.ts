import { appLogger } from '@main/logging/logger';
import { UsageTrackingService } from '@main/services/analysis/usage-tracking.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { SettingsService } from '@main/services/system/settings.service';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import { getErrorMessage } from '@shared/utils/error.util';
import { ipcMain } from 'electron';

export function registerUsageIpc(usageTrackingService: UsageTrackingService, settingsService: SettingsService, proxyService: ProxyService) {
    ipcMain.handle('usage:checkLimit', async (_event, provider: string, model: string) => {
        const settings = settingsService.getSettings();
        let quota: { remaining: number; limit: number } | undefined = undefined;

        if (provider === 'copilot') {
            try {
                const copilotQuota = await proxyService.getCopilotQuota();
                const activeAccount = copilotQuota.accounts[0];
                quota = {
                    remaining: activeAccount.remaining,
                    limit: activeAccount.limit
                };
            } catch (error) {
                appLogger.warn('UsageIPC', `Failed to get copilot quota: ${getErrorMessage(error)}`);
            }
        }

        return usageTrackingService.checkLimit(settings, provider, model, quota);
    });

    ipcMain.handle('usage:getUsageCount', async (_event, period: 'hourly' | 'daily' | 'weekly', provider?: string, model?: string) => {
        return usageTrackingService.getUsageCount(period, provider, model);
    });

    ipcMain.handle('usage:recordUsage', async (_event, provider: string, model: string) => {
        await withRateLimit('db', () => usageTrackingService.recordUsage(provider, model));
        return { success: true };
    });
}
