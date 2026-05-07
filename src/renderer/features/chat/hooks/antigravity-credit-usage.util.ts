/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { LinkedAccountInfo } from '@/electron.d';
import { AppSettings } from '@/types';
import type { ModelQuotaItem, QuotaResponse } from '@/types/quota';
import type { AntigravityCreditUsageMode } from '@/types/settings';

const ANTIGRAVITY_QUOTA_GROUPS: Record<string, string[]> = {
    'gemini-3-pro': [
        'gemini-3.1-pro',
        'gemini-3.1-pro-low',
        'gemini-3.1-pro-high',
        'gemini-3-pro-preview',
        'gemini-3-pro-low',
        'gemini-3-pro-high',
    ],
};

function normalizeEmail(email?: string): string | null {
    if (typeof email !== 'string') {
        return null;
    }
    const normalized = email.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
}

function getQuotaAliases(modelId: string): string[] {
    const normalizedModelId = modelId
        .replace(/^antigravity\//i, '')
        .replace(/-antigravity$/i, '')
        .trim()
        .toLowerCase();
    if (normalizedModelId.includes('gemini-3.1-pro')) {
        return ANTIGRAVITY_QUOTA_GROUPS['gemini-3-pro'].map(item => item.toLowerCase());
    }
    for (const groupModels of Object.values(ANTIGRAVITY_QUOTA_GROUPS)) {
        if (groupModels.some(item => item.toLowerCase() === normalizedModelId)) {
            return groupModels.map(item => item.toLowerCase());
        }
    }
    return [normalizedModelId];
}

function resolveBaseQuotaExhausted(modelQuota: ModelQuotaItem | null): boolean {
    if (!modelQuota) {
        return false;
    }
    const remainingFraction = modelQuota.quotaInfo?.remainingFraction;
    if (typeof remainingFraction === 'number' && Number.isFinite(remainingFraction)) {
        return remainingFraction <= 0;
    }
    const remainingQuota = modelQuota.quotaInfo?.remainingQuota;
    const totalQuota = modelQuota.quotaInfo?.totalQuota;
    if (
        typeof remainingQuota === 'number'
        && Number.isFinite(remainingQuota)
        && typeof totalQuota === 'number'
        && Number.isFinite(totalQuota)
        && totalQuota > 0
    ) {
        return remainingQuota <= 0;
    }
    return typeof modelQuota.percentage === 'number' && Number.isFinite(modelQuota.percentage)
        ? modelQuota.percentage <= 0
        : false;
}

function resolveCreditsUsable(modelQuota: ModelQuotaItem | null, quotaAccount: QuotaResponse | null): boolean {
    const aiCredits = modelQuota?.quotaInfo?.aiCredits ?? quotaAccount?.antigravityAiCredits;
    if (!aiCredits) {
        return false;
    }
    if (aiCredits.useAICredits === false) {
        return false;
    }
    if (aiCredits.canUseCredits === true) {
        return true;
    }
    if (aiCredits.hasSufficientCredits === false) {
        return false;
    }
    return typeof aiCredits.creditAmount === 'number'
        && typeof aiCredits.minimumCreditAmountForUsage === 'number'
        && aiCredits.creditAmount >= aiCredits.minimumCreditAmountForUsage;
}

export function findMatchingQuotaAccount(
    account: LinkedAccountInfo,
    quotaData: { accounts: QuotaResponse[] } | null | undefined
): QuotaResponse | null {
    if (!quotaData?.accounts?.length) {
        return null;
    }

    const normalizedEmail = normalizeEmail(account.email);
    const idMatch = quotaData.accounts.find(quotaAccount => quotaAccount.accountId === account.id);
    if (idMatch) {
        return idMatch;
    }

    if (normalizedEmail === null) {
        return null;
    }

    return quotaData.accounts.find(quotaAccount => normalizeEmail(quotaAccount.email) === normalizedEmail) ?? null;
}

export function getActiveAntigravityAccount(accounts: LinkedAccountInfo[] | undefined): LinkedAccountInfo | null {
    if (!Array.isArray(accounts)) {
        return null;
    }
    return accounts.find(account => account.isActive && (
        account.provider === 'antigravity'
        || account.provider === 'google'
        || account.provider === 'gemini'
    )) ?? null;
}

export function getAntigravityCreditUsageMode(
    settings: AppSettings | undefined,
    accountId: string,
    quotaAccount: QuotaResponse | null
): AntigravityCreditUsageMode {
    const savedMode = settings?.antigravity?.creditUsageModeByAccount?.[accountId];
    if (savedMode) {
        return savedMode;
    }
    return quotaAccount?.antigravityAiCredits?.useAICredits === true ? 'auto' : 'ask-every-time';
}

export function findAntigravityQuotaModel(
    quotaAccount: QuotaResponse | null,
    modelId: string
): ModelQuotaItem | null {
    if (!quotaAccount) {
        return null;
    }
    const aliases = new Set(getQuotaAliases(modelId));
    const matches = quotaAccount.models.filter(model => aliases.has(model.id.toLowerCase()));
    if (matches.length === 0) {
        return null;
    }
    return matches.reduce((lowest, current) =>
        current.percentage < lowest.percentage ? current : lowest
    );
}

export function shouldConfirmAntigravityCreditUsage(params: {
    provider: string;
    model: string;
    settings: AppSettings | undefined;
    linkedAccounts: LinkedAccountInfo[] | undefined;
    quotaData: { accounts: QuotaResponse[] } | null | undefined;
}): {
    account: LinkedAccountInfo;
    quotaAccount: QuotaResponse;
    creditAmount: number | null;
    minimumCreditAmountForUsage: number | null;
} | null {
    if (params.provider.trim().toLowerCase() !== 'antigravity') {
        return null;
    }

    const activeAccount = getActiveAntigravityAccount(params.linkedAccounts);
    if (!activeAccount) {
        return null;
    }

    const quotaAccount = findMatchingQuotaAccount(activeAccount, params.quotaData);
    if (!quotaAccount) {
        return null;
    }

    const mode = getAntigravityCreditUsageMode(params.settings, activeAccount.id, quotaAccount);
    if (mode !== 'ask-every-time') {
        return null;
    }

    const modelQuota = findAntigravityQuotaModel(quotaAccount, params.model);
    if (!resolveBaseQuotaExhausted(modelQuota)) {
        return null;
    }
    if (!resolveCreditsUsable(modelQuota, quotaAccount)) {
        return null;
    }

    const aiCredits = modelQuota?.quotaInfo?.aiCredits ?? quotaAccount.antigravityAiCredits;
    return {
        account: activeAccount,
        quotaAccount,
        creditAmount: typeof aiCredits?.creditAmount === 'number' ? aiCredits.creditAmount : null,
        minimumCreditAmountForUsage: typeof aiCredits?.minimumCreditAmountForUsage === 'number'
            ? aiCredits.minimumCreditAmountForUsage
            : null,
    };
}

