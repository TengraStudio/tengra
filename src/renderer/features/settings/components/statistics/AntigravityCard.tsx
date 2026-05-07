/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import AntigravityIcon from '@assets/antigravity.svg?url';
import React from 'react';

import { formatReset } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { ModelQuotaItem, QuotaResponse } from '@/types/quota';

import { AccountWrapper } from '../../types';

import { getQuotaColor, HorizontalProgressBar, StatusBadge } from './SharedComponents';

interface AntigravityCardProps {
    t: (key: string, options?: Record<string, string | number>) => string
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
        <div className="col-span-full space-y-4">
            {quotaData.accounts.map((acc, idx: number) => { 
                const isActiveAccount = acc.isActive === true;  
                
                const models = dedupeAccountModels(acc.models); 
                
                const creditAmount = acc.antigravityAiCredits?.creditAmount;

                return (
                    <div key={acc.accountId ?? idx} className="overflow-hidden rounded-2xl border border-border/15 bg-background shadow-sm">
                        {/* Account Header */}
                        <div className="flex items-center justify-between border-b border-border/10 bg-muted/5 px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                                    <img src={AntigravityIcon} alt="Antigravity Icon" className="w-6 h-6" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="truncate text-sm font-semibold text-foreground">
                                        {acc.email ?? t('frontend.statistics.defaultAccount')}
                                    </span>
                                    <span className="text-sm text-muted-foreground">#{idx+1}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {typeof creditAmount === 'number' && (
                                    <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-background/50 border border-border/10 px-2 py-0.5 text-sm font-bold text-muted-foreground">
                                        <span className="text-primary">{Math.max(0, Math.round(creditAmount))}</span>
                                        <span>{t('frontend.models.creditsShort')}</span>
                                    </div>
                                )}
                                 <span>{isActiveAccount ? t('frontend.statistics.active') : ""}</span>
                            </div>
                        </div>

                        {/* Models List */}
                        {acc.success !== false && (
                            <div className="divide-y divide-border/5">
                                {models.length > 0 ? (
                                    models.map((m: ModelQuotaItem) => (
                                        <div key={m.id} className="flex flex-col gap-2.5 px-4 py-3.5 hover:bg-muted/5 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col gap-0.5 min-w-0">
                                                    <span className="truncate text-sm font-medium text-foreground/90">{m.name || m.id}</span>
                                                    <span className="text-sm font-medium text-muted-foreground/60 tabular-nums">
                                                        {t('frontend.statistics.resetsAt', { time: formatReset(m.reset, locale) })}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 tabular-nums">
                                                    <span className={cn(
                                                        "text-sm font-bold",
                                                        m.percentage <= 10 ? "text-destructive" : "text-foreground/80"
                                                    )}>
                                                        {Math.round(m.percentage || 0)}%
                                                    </span>
                                                </div>
                                            </div>
                                            <HorizontalProgressBar percentage={m.percentage || 0} color={getQuotaColor(m.percentage || 0)} />
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-4 py-8 text-center">
                                        <p className="text-sm text-muted-foreground/60">{t('frontend.statistics.noModelsAvailable')}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};


