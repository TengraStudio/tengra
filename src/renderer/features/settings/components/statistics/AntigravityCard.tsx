/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import { formatReset } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { ModelQuotaItem, QuotaResponse } from '@/types/quota';

import { AccountWrapper } from '../../types';

import { getQuotaColor, HorizontalProgressBar, StatusBadge } from './SharedComponents';

interface AntigravityCardProps {
    t: (key: string) => string
    quotaData: AccountWrapper<QuotaResponse> | null
    locale?: string
    activeAccountId?: string | null
    activeAccountEmail?: string | null
}

function normalizeEmail(email?: string | null): string | null {
    if (typeof email !== 'string') {
        return null;
    }
    return email.trim().toLowerCase();
}

function normalizeModelLabel(label: string): string {
    return label.toLowerCase().replace(/\s+/g, ' ').trim();
}

function dedupeAccountModels(models: ModelQuotaItem[]): ModelQuotaItem[] {
    const deduped = new Map<string, ModelQuotaItem>();

    for (const model of models) {
        const key = normalizeModelLabel(model.name || model.id);
        const existing = deduped.get(key);
        if (!existing || shouldReplaceModel(existing, model)) {
            deduped.set(key, model);
        }
    }

    return Array.from(deduped.values());
}

function shouldReplaceModel(existing: ModelQuotaItem, candidate: ModelQuotaItem): boolean {
    const duplicateFamilyKey = getDuplicateFamilyKey(existing.name || existing.id);
    if (duplicateFamilyKey !== null && duplicateFamilyKey === getDuplicateFamilyKey(candidate.name || candidate.id)) {
        if (candidate.percentage !== existing.percentage) {
            return candidate.percentage < existing.percentage;
        }
    }

    if (candidate.percentage !== existing.percentage) {
        return candidate.percentage < existing.percentage;
    }

    const existingHasReset = existing.reset !== '-';
    const candidateHasReset = candidate.reset !== '-';
    if (candidateHasReset !== existingHasReset) {
        return candidateHasReset;
    }

    const existingHasQuotaInfo = existing.quotaInfo !== undefined;
    const candidateHasQuotaInfo = candidate.quotaInfo !== undefined;
    if (candidateHasQuotaInfo !== existingHasQuotaInfo) {
        return candidateHasQuotaInfo;
    }

    return candidate.id.localeCompare(existing.id) < 0;
}

function getDuplicateFamilyKey(label: string): string | null {
    const normalizedLabel = normalizeModelLabel(label);
    if (normalizedLabel.includes('gemini 3.1 pro')) {
        return 'gemini-3.1-pro';
    }
    return null;
}

export const AntigravityCard: React.FC<AntigravityCardProps> = ({
    t,
    quotaData,
    locale = 'en-US',
    activeAccountId,
    activeAccountEmail
}) => {
    if (!quotaData?.accounts || quotaData.accounts.length === 0) { return null; }

    return (
        <div className="col-span-1 space-y-3 rounded-2xl border border-border/20 bg-background p-4">
            <div className="text-sm font-medium text-foreground">{t('statistics.antigravityQuotas')}</div>
            <div className="space-y-3">
                {quotaData.accounts.map((acc, idx: number) => {
                    const isActiveAccount = acc.isActive === true
                        || (activeAccountId !== null && acc.accountId === activeAccountId)
                        || (activeAccountEmail !== null && normalizeEmail(acc.email) === normalizeEmail(activeAccountEmail));
                    const status = acc.success === false
                        ? (acc.authExpired ? 'expired' : 'error')
                        : 'active';
                    const models = dedupeAccountModels(acc.models);
                    const statusText = acc.success === false
                        ? (acc.authExpired ? t('errors.quota.authExpired') : t(`statistics.status${acc.status ?? 'Error'}`))
                        : t('statistics.active');
                    const creditAmount = acc.antigravityAiCredits?.creditAmount;
                    const creditLabel = typeof creditAmount === 'number'
                        ? `${t('models.creditsLeft')}: ${Math.max(0, Math.round(creditAmount))}`
                        : null;

                    return (
                        <div key={acc.accountId ?? idx} className={cn('space-y-3 rounded-xl border border-border/15 bg-muted/4 px-4 py-3', idx > 0 && 'mt-2')}>
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="truncate text-sm font-medium text-foreground/90">
                                    {acc.email ?? t('statistics.defaultAccount')}
                                </div>
                                {acc.success === false && <StatusBadge status={status} text={statusText} />}
                                {acc.success !== false && isActiveAccount && <StatusBadge status={status} text={statusText} />}
                                {creditLabel && (
                                    <div className="typo-overline rounded-full border border-border/20 bg-background/70 px-2.5 py-0.5 font-bold text-muted-foreground">
                                        {creditLabel}
                                    </div>
                                )}
                            </div>

                            {acc.success !== false && (
                                <div className="grid grid-cols-1 gap-x-6 gap-y-5 pt-2 md:grid-cols-2 xl:grid-cols-3">
                                    {models.map((m: ModelQuotaItem) => (
                                        <div key={m.id} className="space-y-2">
                                            <div className="typo-overline flex items-center justify-between font-medium">
                                                <span className="text-muted-foreground truncate pr-2">{m.name || m.id}</span>
                                                <span className="text-foreground/80 tabular-nums shrink-0">{Math.round(m.percentage || 0)}%</span>
                                            </div>
                                            <HorizontalProgressBar percentage={m.percentage || 0} color={getQuotaColor(m.percentage || 0)} />
                                            <div className="typo-overline font-medium text-muted-foreground/40 mt-1">
                                                {formatReset(m.reset, locale)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

