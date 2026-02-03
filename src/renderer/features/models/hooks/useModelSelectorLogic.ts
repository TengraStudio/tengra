import { useCallback, useEffect, useState } from 'react';

import { AppSettings, CodexUsage, QuotaResponse } from '@/types';

import type { GroupedModels } from '../utils/model-fetcher';

interface UseModelSelectorLogicProps {
    settings?: AppSettings;
    groupedModels?: GroupedModels;
    quotas?: { accounts: QuotaResponse[] } | null;
    codexUsage?: { accounts: { usage: CodexUsage }[] } | null;
}

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

function isCodexModel(lowerModelId: string) {
    return lowerModelId.includes('codex') || lowerModelId.includes('gpt-5') || lowerModelId.includes('o1');
}

function checkCodexWeeklyLimit(usage: { weeklyLimit?: number; weeklyUsedPercent?: number }, codexLimits: { weekly?: { enabled?: boolean; percentage: number } } | undefined, lowerModelId: string) {
    if (!codexLimits?.weekly?.enabled || usage.weeklyLimit === undefined || usage.weeklyLimit <= 0) {
        return false;
    }
    const weeklyRemainingPercent = 100 - (usage.weeklyUsedPercent ?? 0);
    const maxAllowedPercent = codexLimits.weekly.percentage;
    return weeklyRemainingPercent < maxAllowedPercent && isCodexModel(lowerModelId);
}

function checkCodexDailyLimit(usage: { dailyLimit?: number; dailyUsedPercent?: number }, codexLimits: { daily?: { enabled?: boolean; percentage: number } } | undefined, lowerModelId: string) {
    if (!codexLimits?.daily?.enabled || usage.dailyLimit === undefined || usage.dailyLimit <= 0) {
        return false;
    }
    const dailyRemainingPercent = 100 - (usage.dailyUsedPercent ?? 0);
    const maxAllowedPercent = codexLimits.daily.percentage;
    return dailyRemainingPercent < maxAllowedPercent && isCodexModel(lowerModelId);
}

function findAntigravityQuotaModel(quotas: { accounts: QuotaResponse[] }, lowerModelId: string, modelId: string) {
    const foundQuota = quotas.accounts.find(a => a.models.some((m) => m.id.toLowerCase() === lowerModelId));
    if (!foundQuota) { return null; }

    return foundQuota.models.find((m) =>
        m.id.toLowerCase() === lowerModelId || m.id.toLowerCase() === modelId.toLowerCase()
    );
}

function checkAntigravityUserDefinedLimit(modelId: string, lowerModelId: string, quotas: { accounts: QuotaResponse[] } | null, settings?: AppSettings) {
    if (!quotas) { return false; }
    const antigravityLimits = settings?.modelUsageLimits?.antigravity;
    const modelLimit = antigravityLimits?.[modelId] ?? antigravityLimits?.[lowerModelId];

    if (!modelLimit?.enabled) { return false; }

    const modelQuotaItem = findAntigravityQuotaModel(quotas, lowerModelId, modelId);
    if (!modelQuotaItem) { return false; }

    return modelQuotaItem.percentage < modelLimit.percentage;
}

function checkAntigravityGeneralQuota(modelId: string, lowerModelId: string, quotas: { accounts: QuotaResponse[] } | null) {
    if (!quotas) { return false; }

    const modelQuotaItem = findAntigravityQuotaModel(quotas, lowerModelId, modelId);
    if (!modelQuotaItem) { return false; }

    return modelQuotaItem.percentage <= 5;
}

function isGroupQuotaExhausted(gQuota: Record<string, unknown> | { exhausted?: boolean; remaining: number; percentage?: number }): boolean {
    const quotaData = gQuota as unknown as Record<string, unknown>;
    if (quotaData.percentage !== undefined && typeof quotaData.percentage === 'number' && quotaData.percentage <= 5) {
        return true;
    }

    const q = gQuota as { exhausted?: boolean; remaining: number };
    if (q.exhausted ?? q.remaining <= 0) {
        return true;
    }

    return false;
}

function checkAntigravityGroupQuota(lowerModelId: string, agQuota: Record<string, { exhausted?: boolean; remaining: number; percentage?: number }>) {
    for (const [, groupModels] of Object.entries(ANTIGRAVITY_QUOTA_GROUPS)) {
        if (!groupModels.some(m => m.toLowerCase() === lowerModelId)) { continue; }

        for (const groupModel of groupModels) {
            if (!(groupModel in agQuota) && !(groupModel.toLowerCase() in agQuota)) { continue; }
            const gQuota = agQuota[groupModel] ?? agQuota[groupModel.toLowerCase()];

            if (isGroupQuotaExhausted(gQuota)) { return true; }
        }
        return false; // Should break/return if found group? Original code broke after first matching group.
    }
    return false;
}

function checkAntigravitySpecificQuota(modelId: string, lowerModelId: string, agQuota: Record<string, { exhausted?: boolean; remaining: number; percentage?: number }>) {
    const hasModelQuota = modelId in agQuota || lowerModelId in agQuota;
    if (!hasModelQuota) { return false; }

    const modelQuota = agQuota[modelId] ?? agQuota[lowerModelId];
    if (modelQuota.percentage !== undefined && modelQuota.percentage <= 5) { return true; }
    if (modelQuota.exhausted ?? modelQuota.remaining <= 0) { return true; }
    return false;
}

function checkCodexUsageStatus(codexAccount: { usage: CodexUsage }, lowerModelId: string, settings?: AppSettings) {
    const usage = codexAccount.usage;
    const codexLimits = settings?.modelUsageLimits?.codex;

    if (checkCodexWeeklyLimit(usage, codexLimits, lowerModelId)) { return true; }
    if (checkCodexDailyLimit(usage, codexLimits, lowerModelId)) { return true; }

    if (!isCodexModel(lowerModelId)) { return false; }

    if (usage.weeklyLimit === 0) { return true; }
    if ((usage.dailyUsedPercent ?? 0) >= 100) { return true; }

    return false;
}

function isOpenAIProvider(p: string) {
    return p === 'codex' || p === 'openai';
}

function isClaudeProvider(p: string) {
    return p === 'claude' || p === 'anthropic';
}

export function useModelSelectorLogic({
    settings,
    groupedModels,
    quotas,
    codexUsage
}: UseModelSelectorLogicProps) {
    const [usageLimitChecks, setUsageLimitChecks] = useState<Record<string, { allowed: boolean; reason?: string }>>({});

    useEffect(() => {
        if (!settings?.modelUsageLimits) { return; }
        const checkLimits = async () => {
            const checks: Record<string, { allowed: boolean; reason?: string }> = {};
            if (groupedModels) {
                for (const [provider, group] of Object.entries(groupedModels)) {
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

    const isCodexDisabled = useCallback((_modelId: string, lowerModelId: string) => {
        const codexAccount = codexUsage?.accounts[0];
        if (!codexAccount) { return false; }
        return checkCodexUsageStatus(codexAccount, lowerModelId, settings);
    }, [codexUsage, settings]);

    const isCopilotDisabled = useCallback(() => {
        if (!quotas) { return false; }
        const copilotQuota = quotas.accounts.find(a => a.copilot)?.copilot;
        if (copilotQuota) {
            const q = copilotQuota as { remaining: number; limit: number };
            if (q.remaining <= 5 && q.limit > 0) { return true; }
        }
        return false;
    }, [quotas]);

    const isClaudeDisabled = useCallback(() => {
        if (!quotas) { return false; }
        const claudeQuota = quotas.accounts.find(a => a.claudeQuota)?.claudeQuota;
        if (claudeQuota) {
            const q = claudeQuota as { fiveHour?: { utilization: number }; sevenDay?: { utilization: number } };
            if ((q.fiveHour && q.fiveHour.utilization >= 1.0) || (q.sevenDay && q.sevenDay.utilization >= 1.0)) {
                return true;
            }
        }
        return false;
    }, [quotas]);

    const isAntigravityDisabled = useCallback((modelId: string, lowerModelId: string) => {
        if (!quotas) { return false; }
        if (checkAntigravityUserDefinedLimit(modelId, lowerModelId, quotas, settings)) { return true; }
        if (checkAntigravityGeneralQuota(modelId, lowerModelId, quotas)) { return true; }

        const agAccount = quotas.accounts.find(a => 'antigravity' in a);
        const agQuota = agAccount && 'antigravity' in agAccount ? (agAccount as Record<string, unknown>).antigravity as Record<string, { exhausted?: boolean; remaining: number; percentage?: number }> | undefined : undefined;

        if (agQuota) {
            if (checkAntigravitySpecificQuota(modelId, lowerModelId, agQuota)) { return true; }
            if (checkAntigravityGroupQuota(lowerModelId, agQuota)) { return true; }
        }
        return false;
    }, [quotas, settings]);

    const isProviderSpecificDisabled = useCallback((p: string, modelId: string, lowerModelId: string) => {
        if (isOpenAIProvider(p)) { return isCodexDisabled(modelId, lowerModelId); }
        if (p === 'copilot') { return isCopilotDisabled(); }
        if (isClaudeProvider(p)) { return isClaudeDisabled(); }
        if (p === 'antigravity') { return isAntigravityDisabled(modelId, lowerModelId); }
        if (['local', 'lm_studio', 'ollama', 'gemini'].includes(p)) { return false; }
        return false;
    }, [isCodexDisabled, isCopilotDisabled, isClaudeDisabled, isAntigravityDisabled]);

    // handleModelChange removed as unused

    const isModelDisabled = useCallback((modelId: string, provider: string) => {
        const p = provider.toLowerCase();
        const lowerModelId = modelId.toLowerCase();

        // Check generic usage limits if enabled
        const limitKey = `${provider}:${modelId}`;
        if (limitKey in usageLimitChecks && !usageLimitChecks[limitKey].allowed) { return true; }

        return isProviderSpecificDisabled(p, modelId, lowerModelId);
    }, [usageLimitChecks, isProviderSpecificDisabled]);

    return { isModelDisabled };
}
