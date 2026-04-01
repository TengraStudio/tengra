import { appLogger } from '@main/logging/logger';
import { LinkedAccount } from '@main/services/data/database.service';
import { JsonObject } from '@shared/types/common';
import { ModelQuotaItem, QuotaInfo, QuotaResponse } from '@shared/types/quota';
import axios from 'axios';

export class AntigravityHandler {
    private static readonly BLOCKED_MODEL_IDS = new Set([
        'chat_23310',
        'chat_20706',
        'rev19-uic3-1p',
        'tab_flash_lite_preview',
        'tab_jump_flash_lite_preview'
    ]);

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
                appLogger.debug('QuotaService', 'Antigravity quota request returned 401; refresh is owned by tengra-proxy.');
            }
        }
        return null;
    }

    parseQuotaResponse(data: { models?: Record<string, { displayName?: string; quotaInfo?: QuotaInfo }> }): QuotaResponse | null {
        if (!data.models) { return null; }

        const parsedModels: ModelQuotaItem[] = Object.entries(data.models)
            .filter(([key, value]) => !this.isBlockedModel(key, value.displayName))
            .map(([key, val]) => this.mapAntigravityModel(key, val));
        const models = this.dedupeModels(parsedModels);

        return {
            status: models.length > 0 ? `${Math.round(models.reduce((sum, m) => sum + m.percentage, 0) / models.length)}%` : 'Available',
            next_reset: models.length > 0 ? models[0].reset : '-',
            models: models.sort((a, b) => a.name.localeCompare(b.name))
        };
    }

    private isBlockedModel(key: string, displayName?: string): boolean {
        if (AntigravityHandler.BLOCKED_MODEL_IDS.has(key)) {
            return true;
        }
        const normalizedKey = key.toLowerCase();
        const normalizedName = (displayName ?? '').toLowerCase();
        return normalizedKey.includes('gemini-3-pro') || normalizedName.includes('gemini 3 pro');
    }

    private mapAntigravityModel(key: string, val: { displayName?: string; quotaInfo?: QuotaInfo }): ModelQuotaItem {
        let percentage = 0;
        let reset = '-';
        let quotaInfo: QuotaInfo | undefined;

        if (val.quotaInfo) {
            const q = val.quotaInfo;
            percentage = this.resolvePercentage(q);

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

    private resolvePercentage(quotaInfo: QuotaInfo): number {
        if (Number.isFinite(quotaInfo.remainingFraction)) {
            return this.clampPercentage(Math.round(quotaInfo.remainingFraction * 100));
        }
        if (quotaInfo.totalQuota > 0 && Number.isFinite(quotaInfo.remainingQuota)) {
            return this.clampPercentage(Math.round((quotaInfo.remainingQuota / quotaInfo.totalQuota) * 100));
        }
        return 0;
    }

    private clampPercentage(value: number): number {
        if (!Number.isFinite(value)) {
            return 0;
        }
        return Math.max(0, Math.min(100, value));
    }

    private dedupeModels(models: ModelQuotaItem[]): ModelQuotaItem[] {
        const deduped = new Map<string, ModelQuotaItem>();

        for (const model of models) {
            const key = this.normalizeModelName(model.name);
            const existing = deduped.get(key);
            if (!existing || this.shouldReplaceModel(existing, model)) {
                deduped.set(key, model);
            }
        }

        return Array.from(deduped.values());
    }

    private normalizeModelName(name: string): string {
        return name.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    private shouldReplaceModel(existing: ModelQuotaItem, candidate: ModelQuotaItem): boolean {
        const duplicateFamilyKey = this.getDuplicateFamilyKey(existing.name);
        if (duplicateFamilyKey !== null && duplicateFamilyKey === this.getDuplicateFamilyKey(candidate.name)) {
            if (candidate.percentage !== existing.percentage) {
                return candidate.percentage < existing.percentage;
            }
        }

        if (candidate.percentage !== existing.percentage) {
            return candidate.percentage < existing.percentage;
        }

        const existingHasQuotaInfo = existing.quotaInfo !== undefined;
        const candidateHasQuotaInfo = candidate.quotaInfo !== undefined;
        if (candidateHasQuotaInfo !== existingHasQuotaInfo) {
            return candidateHasQuotaInfo;
        }

        return candidate.id.localeCompare(existing.id) < 0;
    }

    private getDuplicateFamilyKey(name: string): string | null {
        const normalized = this.normalizeModelName(name);
        if (normalized.includes('gemini 3.1 pro')) {
            return 'gemini-3.1-pro';
        }
        return null;
    }
}
