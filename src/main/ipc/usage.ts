import { ProxyService } from '@main/services/proxy/proxy.service'
import { SettingsService } from '@main/services/settings.service'
import { UsageTrackingService } from '@main/services/usage-tracking.service'
import { ipcMain } from 'electron'

export function registerUsageIpc(usageTrackingService: UsageTrackingService, settingsService: SettingsService, proxyService: ProxyService) {
    ipcMain.handle('usage:checkLimit', async (_event, provider: string, model: string) => {
        const settings = settingsService.getSettings()
        let quota: { remaining: number; limit: number } | undefined = undefined
        
        if (provider === 'copilot') {
            try {
                const copilotQuota = await proxyService.getCopilotQuota()
                if (copilotQuota && copilotQuota.success) {
                    quota = {
                        remaining: copilotQuota.remaining || 0,
                        limit: copilotQuota.limit || 0
                    }
                }
            } catch (error) {
                console.debug('[UsageIPC] Failed to get copilot quota:', error)
            }
        }
        
        return usageTrackingService.checkLimit(settings, provider, model, quota)
    })

    ipcMain.handle('usage:getUsageCount', async (_event, period: 'hourly' | 'daily' | 'weekly', provider?: string, model?: string) => {
        return usageTrackingService.getUsageCount(period, provider, model)
    })

    ipcMain.handle('usage:recordUsage', async (_event, provider: string, model: string) => {
        usageTrackingService.recordUsage(provider, model)
        return { success: true }
    })
}
