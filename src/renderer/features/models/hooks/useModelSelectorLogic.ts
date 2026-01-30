import { useCallback, useEffect, useState } from 'react';

import { AppSettings, CodexUsage, QuotaResponse } from '@/types';

import type { GroupedModels } from '../utils/model-fetcher';

interface UseModelSelectorLogicProps {
    settings?: AppSettings;
    groupedModels?: GroupedModels;
    quotas?: { accounts: QuotaResponse[] } | null;
    codexUsage?: { accounts: { usage: CodexUsage }[] } | null;
}

export function useModelSelectorLogic({
    settings,
    groupedModels,
    quotas,
    codexUsage
}: UseModelSelectorLogicProps) {
    const [usageLimitChecks, setUsageLimitChecks] = useState<Record<string, { allowed: boolean; reason?: string }>>({});

    const ANTIGRAVITY_QUOTA_GROUPS = {
        'claude': [
            'gemini-claude-sonnet-4-5',
            'gemini-claude-sonnet-4-5-thinking',
            'gemini-claude-opus-4-5-thinking'
        ],
        'gemini-3-pro': [
            'gemini-3-pro-preview',
            'gemini-3-pro-low',
            'gemini-3-pro-high'
        ]
    };

    useEffect(() => {
        if (!settings?.modelUsageLimits) { return; }

        const checkLimits = async () => {
            const checks: Record<string, { allowed: boolean; reason?: string }> = {};

            if (groupedModels) {
                for (const [provider, group] of Object.entries(groupedModels)) {
                    if (!group?.models) { continue; }
                    for (const model of group.models) {
                        const modelId = model.id ?? '';
                        if (!modelId) { continue; }
                        const key = `${provider}:${modelId}`;
                        try {
                            const result = await window.electron.checkUsageLimit(provider, modelId);
                            checks[key] = result;
                        } catch {
                            checks[key] = { allowed: true };
                        }
                    }
                }
            }

            setUsageLimitChecks(checks);
        };

        void checkLimits();
    }, [settings?.modelUsageLimits, groupedModels]);

    const isCodexModel = useCallback((lowerModelId: string) => {
        return lowerModelId.includes('codex') || lowerModelId.includes('gpt-5') || lowerModelId.includes('o1');
    }, []);

    const checkCodexWeeklyLimit = useCallback((usage: { weeklyLimit?: number; weeklyUsedPercent?: number }, codexLimits: { weekly?: { enabled?: boolean; percentage: number } } | undefined, lowerModelId: string) => {
        if (!codexLimits?.weekly?.enabled || usage.weeklyLimit === undefined || usage.weeklyLimit <= 0) {
            return false;
        }
        const weeklyRemainingPercent = 100 - (usage.weeklyUsedPercent ?? 0);
        const maxAllowedPercent = codexLimits.weekly.percentage;
        return weeklyRemainingPercent < maxAllowedPercent && isCodexModel(lowerModelId);
    }, [isCodexModel]);

    const checkCodexDailyLimit = useCallback((usage: { dailyLimit?: number; dailyUsedPercent?: number }, codexLimits: { daily?: { enabled?: boolean; percentage: number } } | undefined, lowerModelId: string) => {
        if (!codexLimits?.daily?.enabled || usage.dailyLimit === undefined || usage.dailyLimit <= 0) {
            return false;
        }
        const dailyRemainingPercent = 100 - (usage.dailyUsedPercent ?? 0);
        const maxAllowedPercent = codexLimits.daily.percentage;
        return dailyRemainingPercent < maxAllowedPercent && isCodexModel(lowerModelId);
    }, [isCodexModel]);

    const checkAntigravityUserDefinedLimit = useCallback((modelId: string, lowerModelId: string) => {
        const antigravityLimits = settings?.modelUsageLimits?.antigravity;
        const modelLimit = antigravityLimits?.[modelId] ?? antigravityLimits?.[lowerModelId];

        if (!modelLimit?.enabled) { return false; }

        const foundQuota = quotas?.accounts?.find(a => a.models?.some((m) => m.id.toLowerCase() === lowerModelId));
        if (!foundQuota?.models) { return false; }

        const modelQuotaItem = foundQuota.models.find((m) =>
            m.id.toLowerCase() === lowerModelId || m.id.toLowerCase() === modelId.toLowerCase()
        );

        if (!modelQuotaItem) { return false; }

        const modelRemainingPercent = (modelQuotaItem.percentage ?? (modelQuotaItem.quotaInfo?.remainingFraction ?? 1) * 100);
        return modelRemainingPercent < modelLimit.percentage;
    }, [quotas, settings]);

    const checkAntigravityGeneralQuota = useCallback((modelId: string, lowerModelId: string) => {
        if (!quotas?.accounts) { return false; }
        const generalQuota = quotas.accounts.find(a => a.models?.some((m) => m.id.toLowerCase() === lowerModelId));
        if (!generalQuota?.models) { return false; }

        const modelQuotaItem = generalQuota.models.find((m) =>
            m.id.toLowerCase() === lowerModelId || m.id.toLowerCase() === modelId.toLowerCase()
        );

        if (!modelQuotaItem) { return false; }

        const percentage = modelQuotaItem.percentage ?? (modelQuotaItem.quotaInfo?.remainingFraction ?? 1) * 100;
        return percentage <= 5;
    }, [quotas]);

    const checkAntigravityGroupQuota = useCallback((lowerModelId: string, agQuota: Record<string, { exhausted?: boolean; remaining: number; percentage?: number }>) => {
        for (const [, groupModels] of Object.entries(ANTIGRAVITY_QUOTA_GROUPS)) {
            if (!groupModels.some(m => m.toLowerCase() === lowerModelId)) { continue; }

            for (const groupModel of groupModels) {
                const gQuota = agQuota[groupModel] ?? agQuota[groupModel.toLowerCase()];
                if (!gQuota) { continue; }

                const quotaData = gQuota as unknown as Record<string, unknown>;
                if (quotaData.percentage !== undefined && typeof quotaData.percentage === 'number' && quotaData.percentage <= 5) {
                    return true;
                }
                if (gQuota.exhausted ?? gQuota.remaining <= 0) {
                    return true;
                }
            }
            break;
        }
        return false;
    }, [ANTIGRAVITY_QUOTA_GROUPS]);

    const isModelDisabled = useCallback((modelId: string, provider: string) => {
        if (!quotas && !codexUsage && !settings?.modelUsageLimits) { return false; }
        const lowerModelId = modelId.toLowerCase();

        const limitKey = `${provider}:${modelId}`;
        const limitCheck = usageLimitChecks[limitKey];
        if (limitCheck && !limitCheck.allowed) { return true; }

        if (provider === 'codex' || provider === 'openai') {
            const codex = codexUsage?.accounts?.[0];
            const usage = codex?.usage;
            if (usage) {
                const codexLimits = settings?.modelUsageLimits?.codex;
                if (checkCodexWeeklyLimit(usage, codexLimits, lowerModelId)) { return true; }
                if (checkCodexDailyLimit(usage, codexLimits, lowerModelId)) { return true; }
                if (usage.weeklyLimit === 0 && isCodexModel(lowerModelId)) { return true; }
                if ((usage.dailyUsedPercent ?? 0) >= 100 && isCodexModel(lowerModelId)) { return true; }
            }
        }

        if (provider === 'copilot') {
            const copilotQuota = quotas?.accounts?.find(a => a.copilot)?.copilot;
            if (copilotQuota) {
                const q = copilotQuota as { remaining: number; limit: number };
                if (q.remaining <= 5 && q.limit > 0) { return true; }
            }
        }

        if (provider === 'claude' || provider === 'anthropic') {
            const claudeQuota = quotas?.accounts?.find(a => a.claudeQuota)?.claudeQuota;
            if (claudeQuota) {
                const q = claudeQuota as { fiveHour?: { utilization: number }; sevenDay?: { utilization: number } };
                if ((q.fiveHour && q.fiveHour.utilization >= 1.0) || (q.sevenDay && q.sevenDay.utilization >= 1.0)) {
                    return true;
                }
            }
        }

        if (provider === 'antigravity') {
            if (checkAntigravityUserDefinedLimit(modelId, lowerModelId)) { return true; }
            if (checkAntigravityGeneralQuota(modelId, lowerModelId)) { return true; }

            const agAccount = quotas?.accounts?.find(a => 'antigravity' in a);
            const agQuota = agAccount && 'antigravity' in agAccount ? (agAccount as Record<string, unknown>).antigravity as Record<string, { exhausted?: boolean; remaining: number; percentage?: number }> | undefined : undefined;
            if (agQuota) {
                const modelQuota = agQuota[modelId] ?? agQuota[lowerModelId];
                if (modelQuota) {
                    if (modelQuota.percentage !== undefined && modelQuota.percentage <= 5) { return true; }
                    if (modelQuota.exhausted ?? modelQuota.remaining <= 0) { return true; }
                }
                if (checkAntigravityGroupQuota(lowerModelId, agQuota)) { return true; }
            }
        }

        return false;
    }, [quotas, codexUsage, settings, usageLimitChecks, isCodexModel, checkCodexWeeklyLimit, checkCodexDailyLimit, checkAntigravityUserDefinedLimit, checkAntigravityGeneralQuota, checkAntigravityGroupQuota]);

    return { isModelDisabled };
}
