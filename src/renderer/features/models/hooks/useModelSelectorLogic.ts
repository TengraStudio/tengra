/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect, useState } from 'react';

import type { GroupedModels } from '@/types';
import { AppSettings, ClaudeQuota, CodexUsage, CopilotQuota, QuotaResponse } from '@/types';
import type { ModelQuotaItem } from '@/types/quota';

interface UseModelSelectorLogicProps {
    settings?: AppSettings;
    groupedModels?: GroupedModels;
    quotas?: { accounts: QuotaResponse[] } | null;
    codexUsage?: { accounts: { usage: CodexUsage }[] } | null;
    claudeQuota?: { accounts: ClaudeQuota[] } | null;
    copilotQuota?: { accounts: Array<CopilotQuota & { accountId?: string; email?: string; isActive?: boolean }> } | null;
    activeCodexUsage?: { usage: CodexUsage; accountId?: string; email?: string; isActive?: boolean } | null;
    activeClaudeQuota?: ClaudeQuota | null;
    activeCopilotQuota?: (CopilotQuota & { accountId?: string; email?: string; isActive?: boolean }) | null;
    activeAntigravityQuota?: QuotaResponse | null;
}

const ANTIGRAVITY_QUOTA_GROUPS = {
    'claude': [
        'gemini-claude-sonnet-4-5',
        'gemini-claude-sonnet-4-5-thinking',
        'gemini-claude-opus-4-5-thinking'
    ],
    'gemini-3-pro': [
        'gemini-3.1-pro',
        'gemini-3.1-pro-low',
        'gemini-3.1-pro-high',
        'gemini-3-pro-preview',
        'gemini-3-pro-low',
        'gemini-3-pro-high'
    ]
};

function getAntigravityQuotaAliases(lowerModelId: string): string[] {
    if (lowerModelId.includes('gemini-3.1-pro')) {
        return ANTIGRAVITY_QUOTA_GROUPS['gemini-3-pro'].map(model => model.toLowerCase());
    }
    for (const groupModels of Object.values(ANTIGRAVITY_QUOTA_GROUPS)) {
        if (groupModels.some(model => model.toLowerCase() === lowerModelId)) {
            return groupModels.map(model => model.toLowerCase());
        }
    }
    return [lowerModelId];
}

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
    const aliases = new Set([
        lowerModelId,
        modelId.toLowerCase(),
        ...getAntigravityQuotaAliases(lowerModelId)
    ]);
    const foundQuota = quotas.accounts.find(account =>
        account.models.some(model => aliases.has(model.id.toLowerCase()))
    );
    if (!foundQuota) { return null; }

    const matches = foundQuota.models.filter(model => aliases.has(model.id.toLowerCase()));
    if (matches.length === 0) { return null; }
    return matches.reduce((lowest, current) => current.percentage < lowest.percentage ? current : lowest);
}

function canUseAntigravityCredits(modelQuotaItem: ModelQuotaItem | null): boolean {
    const aiCredits = modelQuotaItem?.quotaInfo?.aiCredits;
    if (aiCredits?.useAICredits !== true) {
        return false;
    }
    if (aiCredits.canUseCredits === true) {
        return true;
    }
    if (aiCredits.hasSufficientCredits === false) {
        return false;
    }
    if (
        typeof aiCredits.creditAmount === 'number'
        && typeof aiCredits.minimumCreditAmountForUsage === 'number'
    ) {
        return aiCredits.creditAmount >= aiCredits.minimumCreditAmountForUsage;
    }
    return false;
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

    if (modelQuotaItem.percentage > 0) {
        return false;
    }
    return !canUseAntigravityCredits(modelQuotaItem);
}

function isGroupQuotaExhausted(gQuota: Record<string, RendererDataValue> | { exhausted?: boolean; remaining: number; percentage?: number }): boolean {
    const quotaData = gQuota as TypeAssertionValue as Record<string, RendererDataValue>;
    if (quotaData.percentage !== undefined && typeof quotaData.percentage === 'number' && quotaData.percentage <= 0) {
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
    if (modelQuota.percentage !== undefined && modelQuota.percentage <= 0) { return true; }
    if (modelQuota.exhausted ?? modelQuota.remaining <= 0) { return true; }
    return false;
}

function checkCodexUsageStatus(codexAccount: { usage: CodexUsage }, lowerModelId: string, settings?: AppSettings) {
    const usage = codexAccount.usage;
    const codexLimits = settings?.modelUsageLimits?.codex;

    if (checkCodexWeeklyLimit(usage, codexLimits, lowerModelId)) { return true; }
    if (checkCodexDailyLimit(usage, codexLimits, lowerModelId)) { return true; }

    if (!isCodexModel(lowerModelId)) { return false; }

    const dailyRemaining = typeof usage.dailyUsedPercent === 'number' ? 100 - usage.dailyUsedPercent : undefined;
    const weeklyRemaining = typeof usage.weeklyUsedPercent === 'number' ? 100 - usage.weeklyUsedPercent : undefined;
    if (usage.weeklyLimit === 0 || usage.dailyLimit === 0) { return true; }
    if (dailyRemaining !== undefined && dailyRemaining <= 0) { return true; }
    if (weeklyRemaining !== undefined && weeklyRemaining <= 0) { return true; }

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
    codexUsage,
    claudeQuota,
    copilotQuota,
    activeCodexUsage,
    activeClaudeQuota,
    activeCopilotQuota,
    activeAntigravityQuota
}: UseModelSelectorLogicProps) {
    const [usageLimitChecks, setUsageLimitChecks] = useState<Record<string, { allowed: boolean; reason?: string }>>({});

    useEffect(() => {
        if (!settings?.modelUsageLimits) { return; }
        const checkLimits = async () => {
            const checks: Record<string, { allowed: boolean; reason?: string }> = {};
            if (groupedModels) {
                for (const [provider, group] of Object.entries(groupedModels)) {
                    if (!group || !Array.isArray(group.models)) { continue; }
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
        const codexAccount = activeCodexUsage ?? codexUsage?.accounts[0];
        if (!codexAccount) { return false; }
        return checkCodexUsageStatus(codexAccount, lowerModelId, settings);
    }, [activeCodexUsage, codexUsage, settings]);

    const isCopilotDisabled = useCallback(() => {
        if (activeCopilotQuota) {
            const seatLimit = activeCopilotQuota.seat_breakdown?.total_seats ?? activeCopilotQuota.limit ?? 0;
            const seatRemaining = activeCopilotQuota.seat_breakdown
                ? seatLimit - activeCopilotQuota.seat_breakdown.active_seats
                : activeCopilotQuota.remaining;
            if ((seatLimit > 0 && seatRemaining <= 0) || (activeCopilotQuota.rate_limit?.remaining ?? 1) <= 0) {
                return true;
            }
        }

        // Priority 1: Direct Copilot Quota
        if (copilotQuota?.accounts && copilotQuota.accounts.length > 0) {
            for (const acc of copilotQuota.accounts) {
                if (acc.remaining <= 0 && acc.limit > 0) { return true; }
            }
        }

        // Priority 2: Embedded in Antigravity Quota (legacy/proxy)
        if (quotas?.accounts) {
            const embedded = quotas.accounts.find(a => a.copilot)?.copilot;
            if (embedded) {
                const q = embedded as { remaining: number; limit: number };
                if (q.remaining <= 0 && q.limit > 0) { return true; }
            }
        }
        return false;
    }, [activeCopilotQuota, copilotQuota, quotas]);

    const isClaudeDisabled = useCallback(() => {
        const UTILIZATION_THRESHOLD = 100;

        const checkClaudeQuotaExhausted = (quota: ClaudeQuota): boolean => {
            const now = Date.now();

            // Check if 5-hour quota is exhausted
            const fiveHourExhausted = quota.fiveHour && quota.fiveHour.utilization >= UTILIZATION_THRESHOLD;
            const fiveHourResetPassed = quota.fiveHour?.resetsAt ? new Date(quota.fiveHour.resetsAt).getTime() <= now : false;

            // Check if 7-day quota is exhausted
            const sevenDayExhausted = quota.sevenDay && quota.sevenDay.utilization >= UTILIZATION_THRESHOLD;
            const sevenDayResetPassed = quota.sevenDay?.resetsAt ? new Date(quota.sevenDay.resetsAt).getTime() <= now : false;

            // If 7-day quota is exhausted and reset hasn't passed, model is disabled
            if (sevenDayExhausted && !sevenDayResetPassed) {
                return true;
            }

            // If 5-hour quota is exhausted but reset has passed, model is available
            if (fiveHourExhausted && fiveHourResetPassed) {
                return false;
            }

            // If 5-hour quota is exhausted and reset hasn't passed, disabled until reset
            if (fiveHourExhausted && !fiveHourResetPassed) {
                return true;
            }

            return false;
        };

        // First check dedicated claudeQuota prop (preferred source)
        if (activeClaudeQuota && checkClaudeQuotaExhausted(activeClaudeQuota)) {
            return true;
        }
        if (claudeQuota?.accounts && claudeQuota.accounts.length > 0) {
            for (const quota of claudeQuota.accounts) {
                if (checkClaudeQuotaExhausted(quota)) {
                    return true;
                }
            }
        }
        // Fallback: check claudeQuota embedded in quotas.accounts
        if (quotas?.accounts) {
            const embeddedQuota = quotas.accounts.find(a => a.claudeQuota)?.claudeQuota;
            if (embeddedQuota && checkClaudeQuotaExhausted(embeddedQuota as ClaudeQuota)) {
                return true;
            }
        }
        return false;
    }, [activeClaudeQuota, claudeQuota, quotas]);

    const isAntigravityDisabled = useCallback((modelId: string, lowerModelId: string) => {
        const quotaSource = activeAntigravityQuota ? { accounts: [activeAntigravityQuota] } : quotas;
        if (!quotaSource) { return false; }
        if (checkAntigravityUserDefinedLimit(modelId, lowerModelId, quotaSource, settings)) { return true; }
        if (checkAntigravityGeneralQuota(modelId, lowerModelId, quotaSource)) { return true; }

        const agAccount = quotaSource.accounts.find(a => 'antigravity' in a);
        const agQuota = agAccount && 'antigravity' in agAccount ? (agAccount as Record<string, RendererDataValue>).antigravity as Record<string, { exhausted?: boolean; remaining: number; percentage?: number }> | undefined : undefined;

        if (agQuota) {
            if (checkAntigravitySpecificQuota(modelId, lowerModelId, agQuota)) { return true; }
            if (checkAntigravityGroupQuota(lowerModelId, agQuota)) { return true; }
        }
        return false;
    }, [activeAntigravityQuota, quotas, settings]);

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
