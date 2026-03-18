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
        <div className="col-span-1 h-full space-y-4 rounded-xl border border-border/40 bg-background/30 p-4">
            <div className="text-xs font-black text-muted-foreground/60 uppercase tracking-widest">{t('statistics.antigravityQuotas')}</div>
            <div className="space-y-8">
                {quotaData.accounts.map((acc, idx: number) => {
                    const isActiveAccount = acc.isActive === true
                        || (activeAccountId !== null && acc.accountId === activeAccountId)
                        || (activeAccountEmail !== null && normalizeEmail(acc.email) === normalizeEmail(activeAccountEmail));
                    const status = acc.success === false 
                        ? (acc.authExpired ? 'expired' : 'error') 
                        : 'active';
                    const models = dedupeAccountModels(acc.models);
                    const statusText = acc.success === false 
                        ? (acc.authExpired ? t('quota.authExpired') : t(`statistics.status${acc.status ?? 'Error'}`)) 
                        : t('statistics.active');

                    return (
                        <div key={acc.accountId ?? idx} className={cn("space-y-4 rounded-xl border border-border/40 bg-card px-4 py-3", idx > 0 && "pt-6")}>
                            {/* Account Header */}
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="text-sm font-black text-foreground/90 uppercase tracking-widest truncate">
                                    {acc.email ?? t('statistics.defaultAccount')}
                                </div>
                                {acc.success === false && <StatusBadge status={status} text={statusText} />}
                                {acc.success !== false && isActiveAccount && <StatusBadge status={status} text={statusText} />}
                            </div>

                            {/* Models */}
                            {acc.success !== false && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 pt-2">
                                    {models.map((m: ModelQuotaItem) => (
                                        <div key={m.id} className="space-y-2">
                                            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-bold">
                                                <span className="text-muted-foreground truncate pr-2">{m.name || m.id}</span>
                                                <span className="text-foreground/80 tabular-nums shrink-0">{Math.round(m.percentage || 0)}%</span>
                                            </div>
                                            <HorizontalProgressBar percentage={m.percentage || 0} color={getQuotaColor(m.percentage || 0)} />
                                            <div className="text-[9px] font-medium text-muted-foreground/40 mt-1 uppercase tracking-widest">
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

