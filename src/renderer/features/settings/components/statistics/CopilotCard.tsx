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
import { cn } from '@/lib/utils';
import { CopilotQuota } from '@/types/quota';

import { AccountWrapper } from '../../types';

import { getQuotaColor, HorizontalProgressBar, StatusBadge } from './SharedComponents';

interface CopilotCardProps {
    copilotQuota: AccountWrapper<CopilotQuota> | null
}

export const CopilotCard: React.FC<CopilotCardProps> = ({ copilotQuota }) => {
    const { t } = useTranslation();
    if (!copilotQuota?.accounts || copilotQuota.accounts.length === 0) { return null; }

    return (
        <div className="col-span-1 space-y-3 rounded-2xl border border-border/20 bg-background p-4">
            <div className="text-sm font-medium text-foreground">{t('statistics.copilotTitle')}</div>
            <div className="space-y-3">
                {copilotQuota.accounts.map((acc, idx: number) => {
                    const status = acc.error ? 'error' : 'active';
                    const statusText = acc.error ? t('common.error') : t('statistics.active');

                    const seatInfo = acc.seat_breakdown;
                    const limit = seatInfo ? seatInfo.total_seats : acc.limit;
                    const remaining = seatInfo ? (limit - seatInfo.active_seats) : acc.remaining;
                    const percent = limit > 0 ? Math.round((remaining / limit) * 100) : 0;

                    return (
                        <div key={acc.accountId ?? idx} className={cn('space-y-3 rounded-xl border border-border/15 bg-muted/4 px-4 py-3', idx > 0 && 'mt-2')}>
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="truncate text-sm font-medium text-foreground/90">
                                    {acc.email ?? t('statistics.copilotAccount')}
                                </div>
                                {(acc.error || acc.isActive) && <StatusBadge status={status} text={statusText} />}
                                {acc.error && <span className="typo-overline text-destructive truncate ml-2">{acc.error}</span>}
                            </div>

                            {!acc.error && (
                                <div className="grid grid-cols-1 gap-x-6 gap-y-5 pt-2 md:grid-cols-2 xl:grid-cols-3">
                                    <div className="space-y-2">
                                        <div className="typo-overline flex items-center justify-between font-medium">
                                            <span className="text-muted-foreground truncate pr-2">{seatInfo ? t('statistics.seatsStatus') : t('statistics.usageStatus')}</span>
                                            <span className="text-foreground/80 tabular-nums shrink-0">{remaining} / {limit}</span>
                                        </div>
                                        <HorizontalProgressBar percentage={percent} color={getQuotaColor(percent)} />
                                        <div className="typo-overline font-medium text-muted-foreground/40 mt-1">
                                            {seatInfo?.plan_type ?? acc.copilot_plan ?? t('statistics.individual')}
                                        </div>
                                    </div>

                                    {acc.rate_limit && (
                                        <div className="space-y-2">
                                            <div className="typo-overline flex items-center justify-between font-medium">
                                                <span className="text-muted-foreground truncate pr-2">{t('statistics.rateLimit')}</span>
                                                <span className="text-foreground/80 tabular-nums shrink-0">{acc.rate_limit.remaining} / {acc.rate_limit.limit}</span>
                                            </div>
                                            <HorizontalProgressBar
                                                percentage={Math.round((acc.rate_limit.remaining / acc.rate_limit.limit) * 100)}
                                                color={getQuotaColor(Math.round((acc.rate_limit.remaining / acc.rate_limit.limit) * 100))}
                                            />
                                            <div className="typo-overline font-medium text-muted-foreground/40 mt-1">
                                                {t('statistics.apiUsage')}
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

