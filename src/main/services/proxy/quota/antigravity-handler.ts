import { appLogger } from '@main/logging/logger';
import { LinkedAccount } from '@main/services/data/database.service';
import { TokenService } from '@main/services/security/token.service';
import { JsonObject } from '@shared/types/common';
import { ModelQuotaItem, QuotaInfo, QuotaResponse } from '@shared/types/quota';
import axios from 'axios';

export class AntigravityHandler {
    constructor(private tokenService: TokenService) { }

    async fetchAntigravityUpstreamForToken(account: LinkedAccount): Promise<JsonObject | null> {
        const accessToken = account.accessToken;
        if (!accessToken) { return null; }

        const upstreamUrl = 'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels';
        try {
            const response = await axios.post(upstreamUrl, {}, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'antigravity/1.104.0 darwin/arm64'
                },
                timeout: 8000
            });
            if (response.status === 200 && response.data) { return response.data as JsonObject; }
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                appLogger.warn('QuotaService', 'Antigravity token invalid/expired (401). Triggering forced refresh.');
                void this.tokenService.ensureFreshToken(account.provider, true);
            }
        }
        return null;
    }

    parseQuotaResponse(data: { models?: Record<string, { displayName?: string; quotaInfo?: QuotaInfo }> }): QuotaResponse | null {
        if (!data.models) { return null; }

        const models: ModelQuotaItem[] = Object.entries(data.models)
            .filter(([key]) => !['chat_23310', 'chat_20706', 'rev19-uic3-1p', 'tab_flash_lite_preview'].includes(key))
            .map(([key, val]) => this.mapAntigravityModel(key, val));

        return {
            status: models.length > 0 ? `${Math.round(models.reduce((sum, m) => sum + m.percentage, 0) / models.length)}%` : 'Available',
            next_reset: models.length > 0 ? models[0].reset : '-',
            models: models.sort((a, b) => a.name.localeCompare(b.name))
        };
    }

    private mapAntigravityModel(key: string, val: { displayName?: string; quotaInfo?: QuotaInfo }): ModelQuotaItem {
        let percentage = 100;
        let reset = '-';
        let quotaInfo: QuotaInfo | undefined;

        if (val.quotaInfo) {
            const q = val.quotaInfo;
            // remainingFraction is the primary source for percentage
            percentage = Math.round(q.remainingFraction * 100);

            // Fallback to manual calculation if fraction seems empty (0 is valid)
            if (percentage === 0 && q.totalQuota > 0 && q.remainingQuota > 0) {
                percentage = Math.round((q.remainingQuota / q.totalQuota) * 100);
            }

            if (q.resetTime) {
                try {
                    reset = new Date(q.resetTime).toLocaleString('tr-TR', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    });
                } catch { /* ignore */ }
            }
            quotaInfo = { ...q };
        }

        return {
            id: key,
            name: val.displayName ?? key,
            object: 'model',
            owned_by: 'antigravity',
            provider: 'antigravity',
            percentage,
            reset,
            permission: [],
            quotaInfo
        };
    }
}
