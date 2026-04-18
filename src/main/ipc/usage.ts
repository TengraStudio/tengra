/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { SettingsService } from '@main/services/system/settings.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { AppSettings } from '@shared/types/settings';
import { ipcMain } from 'electron';

type UsagePeriod = 'hourly' | 'daily' | 'weekly';

interface UsageRecord {
    provider: string;
    model: string;
    timestamp: number;
}

const usageRecords: UsageRecord[] = [];
const MAX_USAGE_RECORDS = 2000;

function normalizeProvider(provider: string): string {
    return provider.trim().toLowerCase();
}

function normalizeModel(model: string): string {
    return model.trim().toLowerCase();
}

function pruneUsageRecords(): void {
    if (usageRecords.length <= MAX_USAGE_RECORDS) {
        return;
    }
    usageRecords.splice(0, usageRecords.length - MAX_USAGE_RECORDS);
}

function getUsageWindowStart(period: UsagePeriod): number {
    const now = Date.now();
    if (period === 'hourly') {
        return now - 60 * 60 * 1000;
    }
    if (period === 'daily') {
        return now - 24 * 60 * 60 * 1000;
    }
    return now - 7 * 24 * 60 * 60 * 1000;
}

function getUsageCount(period: UsagePeriod, provider?: string, model?: string): number {
    const windowStart = getUsageWindowStart(period);
    const normalizedProvider = provider ? normalizeProvider(provider) : '';
    const normalizedModel = model ? normalizeModel(model) : '';

    return usageRecords.filter(record => {
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

function checkCopilotRequestLimit(
    settings: AppSettings,
    period: UsagePeriod
): { allowed: boolean; reason?: string } | null {
    const limitConfig = settings.modelUsageLimits?.copilot?.[period];
    if (!limitConfig?.enabled || limitConfig.type !== 'requests' || limitConfig.value <= 0) {
        return null;
    }

    const currentUsage = getUsageCount(period, 'copilot');
    if (currentUsage >= limitConfig.value) {
        return {
            allowed: false,
            reason: `copilot_${period}_request_limit_reached`,
        };
    }

    return { allowed: true };
}

function checkUsageLimit(settings: AppSettings, provider: string, model: string): { allowed: boolean; reason?: string } {
    const normalizedProvider = normalizeProvider(provider);
    const normalizedModel = normalizeModel(model);

    if (normalizedProvider === 'copilot') {
        const hourly = checkCopilotRequestLimit(settings, 'hourly');
        if (hourly && !hourly.allowed) {
            return hourly;
        }
        const daily = checkCopilotRequestLimit(settings, 'daily');
        if (daily && !daily.allowed) {
            return daily;
        }
        const weekly = checkCopilotRequestLimit(settings, 'weekly');
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

export function registerUsageIpc(settingsService: SettingsService): void {
    ipcMain.handle('usage:checkLimit', createIpcHandler(
        'usage:checkLimit',
        async (_event, provider: string, model: string) => {
            return checkUsageLimit(settingsService.getSettings(), provider, model);
        },
        { wrapResponse: false }
    ));

    ipcMain.handle('usage:getUsageCount', createIpcHandler(
        'usage:getUsageCount',
        async (_event, period: UsagePeriod, provider?: string, model?: string) => {
            return getUsageCount(period, provider, model);
        },
        { wrapResponse: false }
    ));

    ipcMain.handle('usage:recordUsage', createIpcHandler(
        'usage:recordUsage',
        async (_event, provider: string, model: string) => {
            usageRecords.push({
                provider: normalizeProvider(provider),
                model: normalizeModel(model),
                timestamp: Date.now(),
            });
            pruneUsageRecords();
            return { success: true };
        },
        { wrapResponse: false }
    ));
}
