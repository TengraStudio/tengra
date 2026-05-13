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
import { ClaudeQuota } from '@/types/quota';

import { AccountWrapper } from '../../types';

import { getQuotaColor, HorizontalProgressBar, StatusBadge } from './SharedComponents';

type UnsafeValue = ReturnType<typeof JSON.parse>;

interface ClaudeCardProps {
    claudeQuota: AccountWrapper<ClaudeQuota> | null
    locale?: string
    activeAccountId?: string | null
    activeAccountEmail?: string | null
}

export const ClaudeCard: React.FC<ClaudeCardProps> = ({ claudeQuota, locale = 'en-US', activeAccountId, activeAccountEmail }) => {
    const { t } = useTranslation();
    if (!claudeQuota?.accounts || claudeQuota.accounts.length === 0) { return null; }

    return (
        <div className="space-y-4">
            {claudeQuota.accounts.map((acc, idx: number) => {
                const status = acc.error ? 'error' : 'active';
                const statusText = acc.error ? t('common.error') : t('frontend.statistics.active');
                const isActiveAccount = (
                    (activeAccountId && acc.accountId === activeAccountId) ||
                    (activeAccountEmail && acc.email === activeAccountEmail) ||
                    acc.isActive === true
                );

                return (
                    <div key={acc.accountId ?? idx} className="overflow-hidden rounded-2xl border border-border/15 bg-background shadow-sm">
                        <div className="flex items-center justify-between border-b border-border/10 bg-muted/5 px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="truncate text-sm font-semibold text-foreground">
                                    {acc.email ?? t('frontend.statistics.claudeAccount')}
                                </span>
                            </div>
                            {isActiveAccount ? (
                                <StatusBadge status={status} text={statusText} />
                            ) : (
                                <span className="text-sm font-medium text-muted-foreground/60">
                                    {t('frontend.statistics.inactive')}
                                </span>
                            )}
                        </div>

                        {!acc.error && (
                            <div className="divide-y divide-border/5">
                                {[
                                    acc.fiveHour && { id: '5h', name: t('frontend.statistics.fiveHourStatus'), ...acc.fiveHour },
                                    acc.sevenDay && { id: '7d', name: t('frontend.statistics.sevenDayStatus'), ...acc.sevenDay }
                                ].filter(Boolean).map((q: UnsafeValue) => {
                                    const percentage = 100 - (q.utilization || 0);
                                    return (
                                        <div key={q.id} className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/5 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="truncate text-sm font-medium text-foreground/90">{q.name}</span>
                                                    <span className="text-sm font-medium text-muted-foreground/60 tabular-nums">
                                                        {t('frontend.statistics.resetsAt', { time: formatReset(q.resetsAt, locale) })}
                                                    </span>
                                                </div>
                                                <span className={cn(
                                                    "text-sm font-bold",
                                                    percentage <= 10 ? "text-destructive" : "text-foreground/80"
                                                )}>
                                                    {Math.round(percentage)}%
                                                </span>
                                            </div>
                                            <HorizontalProgressBar percentage={percentage} color={getQuotaColor(percentage)} />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {acc.error && (
                            <div className="px-4 py-3 bg-destructive/5">
                                <span className="text-sm text-destructive font-medium">{acc.error}</span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};


