/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import CodexIcon from '@assets/chatgpt.svg?url';
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
        <div className="space-y-4">
            {codexUsage.accounts.map((acc, idx: number) => {
                const usage = acc.usage as CodexUsage & { error?: string };
                const usageError = typeof usage?.error === 'string' ? usage.error : null;
                const status = usageError ? 'error' : 'active';
                const statusText = usageError ? t('common.error') : t('frontend.statistics.active');

                const percentFromRequests =
                    typeof usage?.remainingRequests === 'number'
                        && typeof usage?.totalRequests === 'number'
                        ? (usage.totalRequests > 0
                            ? Math.max(0, Math.min(100, Math.round((usage.remainingRequests / usage.totalRequests) * 100)))
                            : 0)
                        : null;
                const dailyRemaining = typeof usage?.dailyUsedPercent === 'number'
                    ? Math.max(0, Math.min(100, Math.round(100 - usage.dailyUsedPercent)))
                    : (percentFromRequests ?? 0);
                const weeklyRemaining = typeof usage?.weeklyUsedPercent === 'number'
                    ? Math.max(0, Math.min(100, Math.round(100 - usage.weeklyUsedPercent)))
                    : (percentFromRequests ?? dailyRemaining);

                return (
                    <div key={acc.accountId ?? idx} className="overflow-hidden rounded-2xl border border-border/15 bg-background shadow-sm">
                        <div className="flex items-center justify-between border-b border-border/10 bg-muted/5 px-4 py-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                                <img src={CodexIcon} alt="Codex Icon" className="w-6 h-6 invert" />
                            </div>
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="truncate text-sm font-semibold text-foreground">
                                    {acc.email ?? t('frontend.statistics.codexAccount')}
                                </span>
                            </div>
                            <span>{acc.isActive ? t('frontend.statistics.active') : ""}</span>
                        </div>

                        {!usageError && usage && (
                            <div className="divide-y divide-border/5">
                                <div className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/5 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col min-w-0">
                                            <span className="truncate text-sm font-medium text-foreground/90">{t('frontend.statistics.dailyStatus')}</span>
                                            <span className="text-sm font-medium text-muted-foreground/60 tabular-nums">
                                                {t('frontend.statistics.resetsAt', { time: formatReset(usage.dailyResetAt, locale) })}
                                            </span>
                                        </div>
                                        <span className={cn("text-sm font-bold", dailyRemaining <= 10 ? "text-destructive" : "text-foreground/80")}>
                                            {dailyRemaining}%
                                        </span>
                                    </div>
                                    <HorizontalProgressBar percentage={dailyRemaining} color={getQuotaColor(dailyRemaining)} />
                                </div>

                                <div className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/5 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col min-w-0">
                                            <span className="truncate text-sm font-medium text-foreground/90">{t('frontend.statistics.weeklyStatus')}</span>
                                            <span className="text-sm font-medium text-muted-foreground/60 tabular-nums">
                                                {t('frontend.statistics.resetsAt', { time: formatReset(usage.weeklyResetAt, locale) })}
                                            </span>
                                        </div>
                                        <span className={cn("text-sm font-bold", weeklyRemaining <= 10 ? "text-destructive" : "text-foreground/80")}>
                                            {weeklyRemaining}%
                                        </span>
                                    </div>
                                    <HorizontalProgressBar percentage={weeklyRemaining} color={getQuotaColor(weeklyRemaining)} />
                                </div>
                            </div>
                        )}
                        {usageError && (
                            <div className="px-4 py-3 bg-destructive/5">
                                <span className="text-sm text-destructive font-bold">{usageError}</span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

