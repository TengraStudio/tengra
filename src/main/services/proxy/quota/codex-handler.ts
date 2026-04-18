/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { AuthService } from '@main/services/security/auth.service';
import { SettingsService } from '@main/services/system/settings.service';
import { JsonObject, JsonValue } from '@shared/types/common';
import { CodexUsage, QuotaResponse } from '@shared/types/quota';
import { getErrorMessage } from '@shared/utils/error.util';
import axios from 'axios';
import { session } from 'electron';

import { QuotaUtils } from './quota-utils';

export class CodexHandler {
    constructor(
        private settingsService: SettingsService,
        private authService: AuthService
    ) { }

    async fetchCodexUsage(): Promise<JsonObject | null> {
        const settings = this.settingsService.getSettings();
        let token = settings.openai?.accessToken ?? settings.openai?.apiKey;

        if (!token || token === 'connected') {
            const dbToken = await this.authService.getActiveToken('codex');
            if (dbToken) { token = dbToken; }
        }

        if (!token || token === 'connected') {
            try {
                const cookies = await session.defaultSession.cookies.get({ url: 'https://chatgpt.com' });
                if (cookies.length > 0) {
                    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
                    const sessionRes = await axios.get('https://chatgpt.com/api/auth/session', {
                        headers: {
                            'Cookie': cookieHeader,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        }
                    });
                    const sessionData = sessionRes.data as { accessToken?: string } | null;
                    if (sessionData?.accessToken) { token = sessionData.accessToken; }
                }
            } catch (error) {
                appLogger.debug('CodexHandler', `Failed to fetch ChatGPT session: ${getErrorMessage(error)}`);
            }
        }

        if (!token || token === 'connected') { return null; }

        return this.fetchCodexUsageFromWham(token);
    }

    private async fetchCodexUsageFromWham(accessToken: string): Promise<JsonObject | null> {
        const endpoints = ['https://chatgpt.com/backend-api/wham/usage', 'https://chat.openai.com/backend-api/wham/usage'];
        for (const endpoint of endpoints) {
            try {
                const response = await axios.get(endpoint, {
                    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
                    timeout: 10000
                });
                if (response.data && typeof response.data === 'object') { return response.data as JsonObject; }
            } catch (e) {
                if (axios.isAxiosError(e) && (e.response?.status === 401 || e.response?.status === 403)) { break; }
            }
        }
        return null;
    }

    parseCodexUsageToQuota(data: JsonObject): QuotaResponse {
        const rateLimit = QuotaUtils.asObject(data.rate_limit);
        const primaryWindow = QuotaUtils.asObject(rateLimit?.primary_window);
        const secondaryWindow = QuotaUtils.asObject(rateLimit?.secondary_window);
        const planType = typeof data.plan_type === 'string' ? data.plan_type : '';
        const dailyUsedPercent = QuotaUtils.calculatePercentage(
            QuotaUtils.toNumber(primaryWindow?.used ?? null),
            QuotaUtils.toNumber(primaryWindow?.limit ?? null)
        ) ?? QuotaUtils.normalizePercent(QuotaUtils.toNumber(primaryWindow?.used_percent ?? null)) ?? 0;
        const weeklyUsedPercent = QuotaUtils.calculatePercentage(
            QuotaUtils.toNumber(secondaryWindow?.used ?? null),
            QuotaUtils.toNumber(secondaryWindow?.limit ?? null)
        ) ?? QuotaUtils.normalizePercent(QuotaUtils.toNumber(secondaryWindow?.used_percent ?? null)) ?? 0;
        return {
            success: true,
            status: 'ChatGPT Usage',
            next_reset: primaryWindow?.reset_at ? String(primaryWindow.reset_at) : '-',
            models: [],
            usage: {
                dailyUsedPercent,
                weeklyUsedPercent,
                dailyResetAt: primaryWindow?.reset_at ? String(primaryWindow.reset_at) : undefined,
                weeklyResetAt: secondaryWindow?.reset_at ? String(secondaryWindow.reset_at) : undefined,
                planType: String(planType || 'Free').toLowerCase().includes('plus') ? 'Plus' : (planType ? planType.charAt(0).toUpperCase() + planType.slice(1) : 'Free')
            }
        };
    }

    extractCodexUsageFromWham(data: JsonValue): CodexUsage | null {
        if (!data || typeof data !== 'object') { return null; }
        const d = data as JsonObject;
        const rateLimit = QuotaUtils.asObject(d.rate_limit);
        const primaryWindow = rateLimit ? QuotaUtils.asObject(rateLimit.primary_window) : null;
        const secondaryWindow = rateLimit ? QuotaUtils.asObject(rateLimit.secondary_window) : null;

        const dailyUsedPercent = QuotaUtils.calculatePercentage(
            QuotaUtils.toNumber(primaryWindow?.used ?? null),
            QuotaUtils.toNumber(primaryWindow?.limit ?? null)
        ) ?? QuotaUtils.normalizePercent(QuotaUtils.toNumber(primaryWindow?.used_percent ?? null)) ??
            QuotaUtils.normalizePercent(QuotaUtils.findNumberByKeys(d, ['rate_limit.primary_window.used_percent']));
        const weeklyUsedPercent = QuotaUtils.calculatePercentage(
            QuotaUtils.toNumber(secondaryWindow?.used ?? null),
            QuotaUtils.toNumber(secondaryWindow?.limit ?? null)
        ) ?? QuotaUtils.normalizePercent(QuotaUtils.toNumber(secondaryWindow?.used_percent ?? null)) ??
            QuotaUtils.normalizePercent(QuotaUtils.findNumberByKeys(d, ['rate_limit.secondary_window.used_percent']));

        const result: Record<string, number | string | undefined | null> = {
            totalRequests: QuotaUtils.findNumberByKeys(d, ['total_requests', 'totalRequests', 'request_count', 'requests_used', 'requests']),
            totalTokens: QuotaUtils.findNumberByKeys(d, ['total_tokens', 'totalTokens', 'token_count', 'tokens_used', 'tokens']),
            remainingRequests: QuotaUtils.findNumberByKeys(d, ['remaining_requests', 'remainingRequests', 'requests_remaining']),
            remainingTokens: QuotaUtils.findNumberByKeys(d, ['remaining_tokens', 'remainingTokens', 'tokens_remaining']),
            dailyUsage: QuotaUtils.findNumberByKeys(d, ['daily_usage', 'dailyUsage', 'daily_used', 'usage_daily', 'requests_daily', 'requests_today', 'cap_usage', 'usage']),
            dailyLimit: QuotaUtils.findNumberByKeys(d, ['daily_limit', 'dailyLimit', 'limit_daily', 'daily_quota', 'cap_limit', 'limit']),
            weeklyUsage: QuotaUtils.findNumberByKeys(d, ['weekly_usage', 'weeklyUsage', 'weekly_used', 'usage_weekly', 'requests_weekly']),
            weeklyLimit: QuotaUtils.findNumberByKeys(d, ['weekly_limit', 'weeklyLimit', 'limit_weekly', 'weekly_quota']),
            dailyUsedPercent,
            weeklyUsedPercent,
            dailyResetAt: QuotaUtils.normalizeResetAt(primaryWindow?.reset_at ?? QuotaUtils.findNumberByKeys(d, ['rate_limit.primary_window.reset_at'])),
            weeklyResetAt: QuotaUtils.normalizeResetAt(secondaryWindow?.reset_at ?? QuotaUtils.findNumberByKeys(d, ['rate_limit.secondary_window.reset_at'])),
            resetAt: QuotaUtils.normalizeResetAt(
                QuotaUtils.findStringByKeys(d, ['reset_at', 'resetAt', 'reset_time', 'resetTime', 'next_reset', 'renew_at', 'renewAt']) ??
                QuotaUtils.findNumberByKeys(d, ['reset_at', 'resetAt', 'reset_time', 'resetTime', 'next_reset', 'renew_at', 'renewAt'])
            ),
        };

        const filtered = Object.fromEntries(
            Object.entries(result).filter(([, v]) => v !== undefined)
        ) as CodexUsage;

        return Object.keys(filtered).length > 0 ? filtered : null;
    }
}
