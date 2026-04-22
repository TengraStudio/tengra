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

import { useTranslation } from '@/i18n';
import { formatReset } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { CodexUsage } from '@/types/quota';

import { AccountWrapper } from '../../types';

import { getQuotaColor, HorizontalProgressBar, StatusBadge } from './SharedComponents';

interface CodexCardProps {
    codexUsage: AccountWrapper<{ usage: CodexUsage }> | null
    locale?: string
}

export const CodexCard: React.FC<CodexCardProps> = ({ codexUsage, locale = 'en-US' }) => {
    const { t } = useTranslation();
    if (!codexUsage?.accounts || codexUsage.accounts.length === 0) { return null; }

    return (
        <div className="col-span-1 space-y-3 rounded-2xl border border-border/20 bg-background p-4">
            <div className="text-sm font-medium text-foreground">{t('statistics.codexTitle')}</div>
            <div className="space-y-3">
                {codexUsage.accounts.map((acc, idx: number) => {
                    const usage = acc.usage as CodexUsage & { error?: string };
                    const usageError = typeof usage?.error === 'string' ? usage.error : null;
                    const status = usageError ? 'error' : 'active';
                    const statusText = usageError ? t('common.error') : t('statistics.active');
                    const percentFromRequests =
                        typeof usage?.remainingRequests === 'number'
                        && typeof usage?.totalRequests === 'number'
                        && usage.totalRequests > 0
                            ? Math.max(0, Math.min(100, Math.round((usage.remainingRequests / usage.totalRequests) * 100)))
                            : null;
                    const dailyRemaining = typeof usage?.dailyUsedPercent === 'number'
                        ? Math.max(0, Math.min(100, Math.round(100 - usage.dailyUsedPercent)))
                        : (percentFromRequests ?? 0);
                    const weeklyRemaining = typeof usage?.weeklyUsedPercent === 'number'
                        ? Math.max(0, Math.min(100, Math.round(100 - usage.weeklyUsedPercent)))
                        : (percentFromRequests ?? dailyRemaining);

                    return (
                        <div key={acc.accountId ?? idx} className={cn('space-y-3 rounded-xl border border-border/15 bg-muted/4 px-4 py-3', idx > 0 && 'mt-2')}>
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="truncate text-sm font-medium text-foreground/90">
                                    {acc.email ?? t('statistics.codexAccount')}
                                </div>
                                {(usageError || acc.isActive) && <StatusBadge status={status} text={statusText} />}
                                {usageError && <span className="text-9 text-destructive truncate ml-2">{usageError}</span>}
                            </div>

                            {!usageError && usage && (
                                <div className="grid grid-cols-1 gap-x-6 gap-y-5 pt-2 md:grid-cols-2 xl:grid-cols-3">
                                    <div className="space-y-2">
                                        <div className="text-10 flex items-center justify-between font-medium">
                                            <span className="text-muted-foreground truncate pr-2">{t('statistics.dailyStatus')}</span>
                                            <span className="text-foreground/80 tabular-nums shrink-0">{dailyRemaining}%</span>
                                        </div>
                                        <HorizontalProgressBar percentage={dailyRemaining} color={getQuotaColor(dailyRemaining)} />
                                        <div className="text-9 font-medium text-muted-foreground/40 mt-1">
                                            {formatReset(usage.dailyResetAt, locale)}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-10 flex items-center justify-between font-medium">
                                            <span className="text-muted-foreground truncate pr-2">{t('statistics.weeklyStatus')}</span>
                                            <span className="text-foreground/80 tabular-nums shrink-0">{weeklyRemaining}%</span>
                                        </div>
                                        <HorizontalProgressBar percentage={weeklyRemaining} color={getQuotaColor(weeklyRemaining)} />
                                        <div className="text-9 font-medium text-muted-foreground/40 mt-1">
                                            {formatReset(usage.weeklyResetAt, locale)}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

