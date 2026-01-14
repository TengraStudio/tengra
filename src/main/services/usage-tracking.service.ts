import * as fs from 'fs'
import * as path from 'path'

import { AppSettings } from '@shared/types/settings'
import { app } from 'electron'

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
    private usageFile: string
    private stats: UsageStats = {
        hourly: [],
        daily: [],
        weekly: []
    }

    constructor() {
        const userDataPath = app.getPath('userData')
        this.usageFile = path.join(userDataPath, 'usage-tracking.json')
        this.loadStats()
        this.cleanupOldRecords()
    }

    private loadStats(): void {
        try {
            if (fs.existsSync(this.usageFile)) {
                const data = fs.readFileSync(this.usageFile, 'utf8')
                this.stats = JSON.parse(data)
            }
        } catch (error) {
            console.error('[UsageTrackingService] Failed to load stats:', error)
            this.stats = { hourly: [], daily: [], weekly: [] }
        }
    }

    private saveStats(): void {
        try {
            fs.writeFileSync(this.usageFile, JSON.stringify(this.stats, null, 2))
        } catch (error) {
            console.error('[UsageTrackingService] Failed to save stats:', error)
        }
    }

    private cleanupOldRecords(): void {
        const now = Date.now()
        const oneHourAgo = now - 60 * 60 * 1000
        const oneDayAgo = now - 24 * 60 * 60 * 1000
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000

        this.stats.hourly = this.stats.hourly.filter(r => r.timestamp > oneHourAgo)
        this.stats.daily = this.stats.daily.filter(r => r.timestamp > oneDayAgo)
        this.stats.weekly = this.stats.weekly.filter(r => r.timestamp > oneWeekAgo)
        this.saveStats()
    }

    recordUsage(provider: string, model: string): void {
        const record: UsageRecord = {
            timestamp: Date.now(),
            provider,
            model
        }

        this.stats.hourly.push(record)
        this.stats.daily.push(record)
        this.stats.weekly.push(record)

        this.cleanupOldRecords()
        this.saveStats()
    }

    getUsageCount(period: 'hourly' | 'daily' | 'weekly', provider?: string, model?: string): number {
        this.cleanupOldRecords()
        const records = this.stats[period]

        if (provider && model) {
            return records.filter(r => r.provider === provider && r.model === model).length
        } else if (provider) {
            return records.filter(r => r.provider === provider).length
        }
        return records.length
    }

    checkLimit(settings: AppSettings, provider: string, _model: string, currentQuota?: { remaining: number; limit: number }): { allowed: boolean; reason?: string } {
        const limits = settings.modelUsageLimits
        if (!limits) {return { allowed: true }}

        // Check Copilot limits
        if (provider === 'copilot' && limits.copilot) {
            const copilotLimits = limits.copilot

            // Check hourly limit
            if (copilotLimits.hourly?.enabled) {
                const hourlyUsage = this.getUsageCount('hourly', 'copilot')
                const limit = copilotLimits.hourly.type === 'requests'
                    ? copilotLimits.hourly.value
                    : currentQuota ? Math.round(currentQuota.remaining * (copilotLimits.hourly.value / 100)) : 0

                if (hourlyUsage >= limit) {
                    return { allowed: false, reason: `Hourly limit reached: ${hourlyUsage}/${limit} ${copilotLimits.hourly.type === 'requests' ? 'requests' : '%'}` }
                }
            }

            // Check daily limit
            if (copilotLimits.daily?.enabled) {
                const dailyUsage = this.getUsageCount('daily', 'copilot')
                const limit = copilotLimits.daily.type === 'requests'
                    ? copilotLimits.daily.value
                    : currentQuota ? Math.round(currentQuota.remaining * (copilotLimits.daily.value / 100)) : 0

                if (dailyUsage >= limit) {
                    return { allowed: false, reason: `Daily limit reached: ${dailyUsage}/${limit} ${copilotLimits.daily.type === 'requests' ? 'requests' : '%'}` }
                }
            }

            // Check weekly limit
            if (copilotLimits.weekly?.enabled) {
                const weeklyUsage = this.getUsageCount('weekly', 'copilot')
                const limit = copilotLimits.weekly.type === 'requests'
                    ? copilotLimits.weekly.value
                    : currentQuota ? Math.round(currentQuota.remaining * (copilotLimits.weekly.value / 100)) : 0

                if (weeklyUsage >= limit) {
                    return { allowed: false, reason: `Weekly limit reached: ${weeklyUsage}/${limit} ${copilotLimits.weekly.type === 'requests' ? 'requests' : '%'}` }
                }
            }
        }

        // Check Antigravity limits
        // Note: Antigravity limits are percentage-based and checked in ModelSelector
        // where we have quota info. This service just tracks usage counts.

        // Check Codex limits
        // Note: Codex limits are percentage-based and checked in ModelSelector
        // where we have codexUsage info. This service just tracks usage counts.

        return { allowed: true }
    }
}


