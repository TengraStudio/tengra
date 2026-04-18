/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { LinkedAccount } from '@main/services/data/database.service';
import { CopilotQuota } from '@shared/types/quota';
import axios from 'axios';

export class CopilotHandler {
    async fetchCopilotQuotaForToken(account: LinkedAccount): Promise<CopilotQuota | null> {
        const githubToken = account.accessToken;
        if (!githubToken) { return null; }

        try {
            const billingRes = await axios.get('https://api.github.com/copilot_internal/user', {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github+json',
                    'User-Agent': 'GithubCopilot/1.250.0'
                }
            });

            const data = billingRes.data as {
                quota_snapshots?: { premium_interactions?: { entitlement?: number; remaining?: number } };
                copilot_plan?: string;
                quota_reset_date?: string;
            };
            const premium = data.quota_snapshots?.premium_interactions;
            const quota: CopilotQuota = {
                copilot_plan: data.copilot_plan ?? 'unknown',
                limit: premium?.entitlement ?? 0,
                remaining: premium?.remaining ?? 0,
                reset: data.quota_reset_date ?? undefined,
            };

            try {
                const rateLimitRes = await axios.get('https://api.github.com/rate_limit', {
                    headers: {
                        'Authorization': `token ${githubToken}`,
                        'Accept': 'application/vnd.github+json',
                        'User-Agent': 'GithubCopilot/1.250.0'
                    }
                });
                const rl = rateLimitRes.data as { resources: { core: { limit: number; remaining: number; reset: number } } };
                quota.rate_limit = {
                    limit: rl.resources.core.limit,
                    remaining: rl.resources.core.remaining,
                    reset: new Date(rl.resources.core.reset * 1000).toISOString()
                };
            } catch { /* ignore rate limit errors */ }

            return quota;
        } catch (e) {
            return { error: (e instanceof Error ? e.message : String(e)), remaining: 0, limit: 0, copilot_plan: 'unknown' };
        }
    }
}
