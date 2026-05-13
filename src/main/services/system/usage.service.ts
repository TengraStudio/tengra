/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ipc } from '@main/core/ipc-decorators';
import { BaseService } from '@main/services/base.service';
import { SettingsService } from '@main/services/system/settings.service';
import { USAGE_CHANNELS } from '@shared/constants/ipc-channels';
import { AppSettings } from '@shared/types/settings';

export type UsagePeriod = 'hourly' | 'daily' | 'weekly';

export interface UsageRecord {
    provider: string;
    model: string;
    timestamp: number;
}

export class UsageService extends BaseService {
    static readonly serviceName = 'usageService';
    static readonly dependencies = ['settingsService'] as const;
    private usageRecords: UsageRecord[] = [];
    private readonly MAX_USAGE_RECORDS = 2000;

    constructor(private settingsService: SettingsService) {
        super('UsageService');
    }

    @ipc(USAGE_CHANNELS.CHECK_LIMIT)
    async checkLimitIpc(provider: string, model: string) {
        return this.checkUsageLimit(this.settingsService.getSettings(), provider, model);
    }

    @ipc(USAGE_CHANNELS.GET_USAGE_COUNT)
    async getUsageCountIpc(period: UsagePeriod, provider?: string, model?: string) {
        return this.getUsageCount(period, provider, model);
    }

    @ipc(USAGE_CHANNELS.RECORD_USAGE)
    async recordUsageIpc(provider: string, model: string) {
        this.usageRecords.push({
            provider: this.normalizeProvider(provider),
            model: this.normalizeModel(model),
            timestamp: Date.now(),
        });
        this.pruneUsageRecords();
        return { success: true };
    }

    private normalizeProvider(provider: string): string {
        return provider.trim().toLowerCase();
    }

    private normalizeModel(model: string): string {
        return model.trim().toLowerCase();
    }

    private pruneUsageRecords(): void {
        if (this.usageRecords.length <= this.MAX_USAGE_RECORDS) {
            return;
        }
        this.usageRecords.splice(0, this.usageRecords.length - this.MAX_USAGE_RECORDS);
    }

    private getUsageWindowStart(period: UsagePeriod): number {
        const now = Date.now();
        if (period === 'hourly') {
            return now - 60 * 60 * 1000;
        }
        if (period === 'daily') {
            return now - 24 * 60 * 60 * 1000;
        }
        return now - 7 * 24 * 60 * 60 * 1000;
    }

    private getUsageCount(period: UsagePeriod, provider?: string, model?: string): number {
        const windowStart = this.getUsageWindowStart(period);
        const normalizedProvider = provider ? this.normalizeProvider(provider) : '';
        const normalizedModel = model ? this.normalizeModel(model) : '';

        return this.usageRecords.filter(record => {
            if (record.timestamp < windowStart) {
                return false;
            }
            if (normalizedProvider !== '' && record.provider !== normalizedProvider) {
                return false;
            }
            if (normalizedModel !== '' && record.model !== normalizedModel) {
                return false;
            }
            return true;
        }).length;
    }

    private checkCopilotRequestLimit(
        settings: AppSettings,
        period: UsagePeriod
    ): { allowed: boolean; reason?: string } | null {
        const limitConfig = settings.modelUsageLimits?.copilot?.[period];
        if (!limitConfig?.enabled || limitConfig.type !== 'requests' || limitConfig.value <= 0) {
            return null;
        }

        const currentUsage = this.getUsageCount(period, 'copilot');
        if (currentUsage >= limitConfig.value) {
            return {
                allowed: false,
                reason: `copilot_${period}_request_limit_reached`,
            };
        }

        return { allowed: true };
    }

    private checkUsageLimit(settings: AppSettings, provider: string, model: string): { allowed: boolean; reason?: string } {
        const normalizedProvider = this.normalizeProvider(provider);
        const normalizedModel = this.normalizeModel(model);

        if (normalizedProvider === 'copilot') {
            const hourly = this.checkCopilotRequestLimit(settings, 'hourly');
            if (hourly && !hourly.allowed) {
                return hourly;
            }
            const daily = this.checkCopilotRequestLimit(settings, 'daily');
            if (daily && !daily.allowed) {
                return daily;
            }
            const weekly = this.checkCopilotRequestLimit(settings, 'weekly');
            if (weekly && !weekly.allowed) {
                return weekly;
            }
        }

        const antigravityLimit = settings.modelUsageLimits?.antigravity?.[model]
            ?? settings.modelUsageLimits?.antigravity?.[normalizedModel];
        if (normalizedProvider === 'antigravity' && antigravityLimit?.enabled && antigravityLimit.percentage <= 0) {
            return { allowed: false, reason: 'antigravity_limit_reached' };
        }

        if (normalizedProvider === 'codex' || normalizedProvider === 'openai') {
            if (settings.modelUsageLimits?.codex?.daily?.enabled && settings.modelUsageLimits.codex.daily.percentage <= 0) {
                return { allowed: false, reason: 'codex_daily_limit_reached' };
            }
            if (settings.modelUsageLimits?.codex?.weekly?.enabled && settings.modelUsageLimits.codex.weekly.percentage <= 0) {
                return { allowed: false, reason: 'codex_weekly_limit_reached' };
            }
        }

        return { allowed: true };
    }
}

