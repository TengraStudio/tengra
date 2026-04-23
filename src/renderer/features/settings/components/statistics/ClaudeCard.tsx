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

interface ClaudeCardProps {
    claudeQuota: AccountWrapper<ClaudeQuota> | null
    locale?: string
}

export const ClaudeCard: React.FC<ClaudeCardProps> = ({ claudeQuota, locale = 'en-US' }) => {
    const { t } = useTranslation();
    if (!claudeQuota?.accounts || claudeQuota.accounts.length === 0) { return null; }

    return (
        <div className="col-span-1 space-y-3 rounded-2xl border border-border/20 bg-background p-4">
            <div className="text-sm font-medium text-foreground">{t('statistics.claudeTitle')}</div>
            <div className="space-y-3">
                {claudeQuota.accounts.map((acc, idx: number) => {
                    const status = acc.error ? 'error' : 'active';
                    const statusText = acc.error ? t('common.error') : t('statistics.active');

                    return (
                        <div key={acc.accountId ?? idx} className={cn('space-y-3 rounded-xl border border-border/15 bg-muted/4 px-4 py-3', idx > 0 && 'mt-2')}>
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="truncate text-sm font-medium text-foreground/90">
                                    {acc.email ?? t('statistics.claudeAccount')}
                                </div>
                                {(acc.error || acc.isActive) && <StatusBadge status={status} text={statusText} />}
                                {acc.error && <span className="typo-overline text-destructive truncate ml-2">{acc.error}</span>}
                            </div>

                            {!acc.error && (
                                <div className="grid grid-cols-1 gap-x-6 gap-y-5 pt-2 md:grid-cols-2 xl:grid-cols-3">
                                    {acc.fiveHour && (
                                        <div className="space-y-2">
                                            <div className="typo-overline flex items-center justify-between font-medium">
                                                <span className="text-muted-foreground truncate pr-2">{t('statistics.fiveHourStatus')}</span>
                                                <span className="text-foreground/80 tabular-nums shrink-0">{100 - acc.fiveHour.utilization}%</span>
                                            </div>
                                            <HorizontalProgressBar percentage={100 - acc.fiveHour.utilization} color={getQuotaColor(100 - acc.fiveHour.utilization)} />
                                            <div className="typo-overline font-medium text-muted-foreground/40 mt-1">
                                                {formatReset(acc.fiveHour.resetsAt, locale)}
                                            </div>
                                        </div>
                                    )}
                                    {acc.sevenDay && (
                                        <div className="space-y-2">
                                            <div className="typo-overline flex items-center justify-between font-medium">
                                                <span className="text-muted-foreground truncate pr-2">{t('statistics.sevenDayStatus')}</span>
                                                <span className="text-foreground/80 tabular-nums shrink-0">{100 - acc.sevenDay.utilization}%</span>
                                            </div>
                                            <HorizontalProgressBar percentage={100 - acc.sevenDay.utilization} color={getQuotaColor(100 - acc.sevenDay.utilization)} />
                                            <div className="typo-overline font-medium text-muted-foreground/40 mt-1">
                                                {formatReset(acc.sevenDay.resetsAt, locale)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

