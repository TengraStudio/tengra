import * as fs from 'fs/promises';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { DatabaseService } from '@main/services/data/database.service';
import { AppSettings } from '@shared/types/settings';
import { getErrorMessage } from '@shared/utils/error.util';
import { app } from 'electron';

interface UsageRecord {
    timestamp: number
    provider: string
    model: string
}

interface UsageStats {
    hourly: UsageRecord[]
    daily: UsageRecord[]
    weekly: UsageRecord[]
}

export class UsageTrackingService {
    private legacyUsageFile: string

    constructor(private databaseService: DatabaseService) {
        const userDataPath = app.getPath('userData')
        this.legacyUsageFile = path.join(userDataPath, 'usage-tracking.json')
        void this.initialize()
    }

    private async initialize() {
        await this.migrateLegacyData()
        await this.cleanupOldRecords()
    }

    private async migrateLegacyData() {
        try {
            const exists = await fs.access(this.legacyUsageFile).then(() => true).catch(() => false)
            if (exists) {
                appLogger.info('UsageTrackingService', 'Migrating legacy usage data...')
                const data = await fs.readFile(this.legacyUsageFile, 'utf8')
                const stats: UsageStats = JSON.parse(data)

                const records = (stats as Partial<UsageStats>).weekly ?? []

                for (const r of records) {
                    await this.databaseService.addUsageRecord({
                        provider: r.provider,
                        model: r.model,
                        timestamp: r.timestamp
                    })
                }

                await fs.rename(this.legacyUsageFile, this.legacyUsageFile + '.migrated')
                appLogger.info('UsageTrackingService', 'Migration completed.')
            }
        } catch (error) {
            appLogger.error('UsageTrackingService', `Failed to migrate legacy data: ${getErrorMessage(error)}`)
        }
    }

    private async cleanupOldRecords() {
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        await this.databaseService.cleanupUsageRecords(oneWeekAgo)
    }

    async recordUsage(provider: string, model: string): Promise<void> {
        await this.databaseService.addUsageRecord({
            provider,
            model,
            timestamp: Date.now()
        })
    }

    async getUsageCount(period: 'hourly' | 'daily' | 'weekly', provider?: string, model?: string): Promise<number> {
        const now = Date.now()
        let since = 0

        switch (period) {
            case 'hourly':
                since = now - 60 * 60 * 1000
                break
            case 'daily':
                since = now - 24 * 60 * 60 * 1000
                break
            case 'weekly':
                since = now - 7 * 24 * 60 * 60 * 1000
                break
        }

        return this.databaseService.getUsageCount(since, provider, model)
    }

    private getLimitValue(periodLimit: { type: string; value: number }, currentQuota?: { remaining: number; limit: number }): number {
        return periodLimit.type === 'requests'
            ? periodLimit.value
            : currentQuota ? Math.round(currentQuota.remaining * (periodLimit.value / 100)) : 0
    }

    async checkLimit(settings: AppSettings, provider: string, _model: string, currentQuota?: { remaining: number; limit: number }): Promise<{ allowed: boolean; reason?: string }> {
        const limits = settings.modelUsageLimits
        if (!limits || provider !== 'copilot' || !limits.copilot) {
            return { allowed: true }
        }

        const copilotLimits = limits.copilot
        const periods: ('hourly' | 'daily' | 'weekly')[] = ['hourly', 'daily', 'weekly']

        for (const period of periods) {
            const periodLimit = copilotLimits[period]
            if (periodLimit?.enabled) {
                const usage = await this.getUsageCount(period, 'copilot')
                const limitValue = this.getLimitValue(periodLimit, currentQuota)

                if (usage >= limitValue) {
                    return {
                        allowed: false,
                        reason: `${period.charAt(0).toUpperCase() + period.slice(1)} limit reached: ${usage}/${limitValue} ${periodLimit.type === 'requests' ? 'requests' : '%'}`
                    }
                }
            }
        }

        return { allowed: true }
    }
}
