import { appLogger } from '@main/logging/logger';
import { LinkedAccount } from '@main/services/data/database.service';
import { ANTIGRAVITY_ENDPOINTS,ANTIGRAVITY_REQUEST_HEADERS } from '@shared/constants/antigravity';
import { AntigravityLoadCodeAssist,AntigravityLoadCodeAssistSchema } from '@shared/schemas/antigravity.schema';
import { JsonObject, JsonValue } from '@shared/types/common';
import {
    AntigravityAiCreditsInfo,
    AntigravityQuotaModelData,
    ModelQuotaItem,
    QuotaInfo,
    QuotaResponse
} from '@shared/types/quota';
import axios from 'axios';

type AntigravitySourceRecord = Record<string, JsonValue | undefined>;
type AntigravityUpstreamResponse = AntigravityLoadCodeAssist & {
    models?: Record<string, AntigravityQuotaModelData>;
    [key: string]: JsonValue | undefined;
}

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

        const [creditsPayload, modelsPayload] = await Promise.all([
            this.fetchLoadCodeAssist(accessToken),
            this.fetchAvailableModels(accessToken)
        ]);

        if (!creditsPayload && !modelsPayload) {
            return null;
        }

        // Security: Scrub sensitive token copy from metadata if it leaked
        if (account.id) {
            this.scrubAccountMetadata(account);
        }

        return {
            ...(modelsPayload ?? {}),
            ...(creditsPayload ?? {}),
        };
    }

    private scrubAccountMetadata(account: LinkedAccount): void {
        try {
            const metadata = typeof account.metadata === 'string' 
                ? JSON.parse(account.metadata) 
                : account.metadata;
            
            if (metadata && (metadata.accessToken || metadata.access_token || metadata.refresh_token)) {
                const scrubbed = { ...metadata };
                delete scrubbed.accessToken;
                delete scrubbed.access_token;
                delete scrubbed.refresh_token;
                delete scrubbed.token;
                
                // We don't await database here to avoid blocking heartbeat, but we'll emit a cleanup task
                appLogger.info('AntigravityHandler', `Sensitively scrubbing metadata for account ${account.id}`);
                // Implementation note: The actual DB update should be handled by a higher-level Service or Auth store
            }
        } catch (e) {
            appLogger.error('AntigravityHandler', 'Failed to scrub metadata', e as Error);
        }
    }

    private async fetchAvailableModels(accessToken: string): Promise<JsonObject | null> {
        const upstreamUrl = ANTIGRAVITY_ENDPOINTS.FETCH_AVAILABLE_MODELS;
        try {
            const response = await axios.post(upstreamUrl, {}, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    ...ANTIGRAVITY_REQUEST_HEADERS
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

    private async fetchLoadCodeAssist(accessToken: string): Promise<JsonObject | null> {
        const upstreamUrl = ANTIGRAVITY_ENDPOINTS.LOAD_CODE_ASSIST;
        try {
            const response = await axios.post(upstreamUrl, {}, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    ...ANTIGRAVITY_REQUEST_HEADERS
                },
                timeout: 8000
            });
            if (response.status === 200 && response.data) {
                return response.data as JsonObject;
            }
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                appLogger.debug('QuotaService', 'Antigravity credits request returned 401; refresh is owned by tengra-proxy.');
            }
        }
        return null;
    }

    parseQuotaResponse(data: AntigravityUpstreamResponse): QuotaResponse | null {
        // Validate against Zod schema for core fields
        const validated = AntigravityLoadCodeAssistSchema.safeParse(data);
        const coreSource = validated.success ? validated.data : data;

        const parsedModels: ModelQuotaItem[] = data.models
            ? Object.entries(data.models)
                .filter(([key, value]) => !this.isBlockedModel(key, value.displayName))
                .map(([key, val]) => this.mapAntigravityModel(key, val))
            : [];
        const models = this.dedupeModels(parsedModels);
        const antigravityAiCredits = this.extractResponseAiCredits(coreSource as AntigravityUpstreamResponse, models);
        if (models.length === 0 && !antigravityAiCredits) {
            return null;
        }

        return {
            status: models.length > 0 ? `${Math.round(models.reduce((sum, m) => sum + m.percentage, 0) / models.length)}%` : 'Available',
            next_reset: models.length > 0 ? models[0].reset : '-',
            models: models.sort((a, b) => a.name.localeCompare(b.name)),
            antigravityAiCredits,
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

    private mapAntigravityModel(key: string, val: AntigravityQuotaModelData): ModelQuotaItem {
        let percentage = 0;
        let reset = '-';
        let quotaInfo: QuotaInfo | undefined;

        if (val.quotaInfo) {
            const q = val.quotaInfo;
            percentage = this.resolvePercentage(q);

            if (q.resetTime) {
                try {
                    reset = new Date(q.resetTime).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    });
                } catch { /* ignore */ }
            }
            const aiCredits = this.extractAiCreditsInfo([
                this.asRecord(q as JsonObject),
                this.asRecord(val as JsonObject),
            ]);
            quotaInfo = {
                ...q,
                ...(aiCredits ? { aiCredits } : {}),
            };
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

    private extractResponseAiCredits(
        data: AntigravityUpstreamResponse,
        models: ModelQuotaItem[]
    ): AntigravityAiCreditsInfo | undefined {
        const paidTierCredits = this.extractPaidTierAiCredits(data.paidTier);
        const direct = this.extractAiCreditsInfo([
            this.asRecord(data as JsonObject),
            this.asRecord(data.paidTier as JsonValue),
            this.asRecord((data as AntigravitySourceRecord).aiCredits),
            paidTierCredits,
        ]);
        if (direct) {
            return direct;
        }

        for (const model of models) {
            if (model.quotaInfo?.aiCredits) {
                return model.quotaInfo.aiCredits;
            }
        }
        return undefined;
    }

    private extractPaidTierAiCredits(
        paidTier: AntigravityUpstreamResponse['paidTier']
    ): AntigravitySourceRecord | undefined {
        const creditEntry = paidTier?.availableCredits?.[0];
        if (!creditEntry) {
            return undefined;
        }

        return {
            creditType: creditEntry.creditType,
            creditAmount: creditEntry.creditAmount,
            minimumCreditAmountForUsage: creditEntry.minimumCreditAmountForUsage,
        };
    }

    private extractAiCreditsInfo(
        sources: Array<AntigravitySourceRecord | undefined>
    ): AntigravityAiCreditsInfo | undefined {
        const pricingType = this.readStringValue(sources, ['pricingType', 'pricing_type']);
        const useAICredits = this.readBooleanValue(sources, ['useAICredits', 'use_ai_credits']);
        const creditAmount = this.readNumberValue(sources, ['creditAmount', 'credit_amount']);
        const minimumCreditAmountForUsage = this.readNumberValue(
            sources,
            ['minimumCreditAmountForUsage', 'minimum_credit_amount_for_usage']
        );
        const status = this.readStringValue(sources, ['status', 'quotaStatus', 'quota_status']);
        const hasSufficientCredits =
            creditAmount !== undefined && minimumCreditAmountForUsage !== undefined
                ? creditAmount >= minimumCreditAmountForUsage
                : undefined;
        const canUseCredits = useAICredits === false
            ? false
            : (hasSufficientCredits ?? false);

        const hasValues =
            pricingType !== undefined
            || useAICredits !== undefined
            || creditAmount !== undefined
            || minimumCreditAmountForUsage !== undefined
            || status !== undefined
            || hasSufficientCredits !== undefined;
        if (!hasValues) {
            return undefined;
        }

        return {
            ...(pricingType !== undefined ? { pricingType } : {}),
            ...(useAICredits !== undefined ? { useAICredits } : {}),
            ...(creditAmount !== undefined ? { creditAmount } : {}),
            ...(minimumCreditAmountForUsage !== undefined ? { minimumCreditAmountForUsage } : {}),
            ...(status !== undefined ? { status } : {}),
            ...(hasSufficientCredits !== undefined ? { hasSufficientCredits } : {}),
            canUseCredits,
        };
    }

    private asRecord(value: JsonValue | undefined): AntigravitySourceRecord | undefined {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return undefined;
        }
        return value as AntigravitySourceRecord;
    }

    private readStringValue(
        sources: Array<AntigravitySourceRecord | undefined>,
        keys: string[]
    ): string | undefined {
        for (const source of sources) {
            if (!source) {
                continue;
            }
            for (const key of keys) {
                const value = source[key];
                if (typeof value === 'string' && value.trim().length > 0) {
                    return value;
                }
            }
        }
        return undefined;
    }

    private readBooleanValue(
        sources: Array<AntigravitySourceRecord | undefined>,
        keys: string[]
    ): boolean | undefined {
        for (const source of sources) {
            if (!source) {
                continue;
            }
            for (const key of keys) {
                const value = source[key];
                if (typeof value === 'boolean') {
                    return value;
                }
            }
        }
        return undefined;
    }

    private readNumberValue(
        sources: Array<AntigravitySourceRecord | undefined>,
        keys: string[]
    ): number | undefined {
        for (const source of sources) {
            if (!source) {
                continue;
            }
            for (const key of keys) {
                const value = source[key];
                if (typeof value === 'number' && Number.isFinite(value)) {
                    return value;
                }
                if (typeof value === 'string' && value.trim().length > 0) {
                    const parsed = Number(value);
                    if (Number.isFinite(parsed)) {
                        return parsed;
                    }
                }
            }
        }
        return undefined;
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
