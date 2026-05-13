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

import { ProviderIcon } from '@/components/shared/ProviderIcon';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { CopilotQuota } from '@/types/quota';

import { AccountWrapper } from '../../types';

import { getQuotaColor, HorizontalProgressBar } from './SharedComponents';

type RenderLimitRowOptions = {
    title: string;
    subtitle: string;
    current: number;
    max: number;
    resetAt?: string;
    color?: string;
};

function renderLimitRow(t: (key: string) => string, options: RenderLimitRowOptions): JSX.Element {
    const { title, subtitle, current, max, resetAt, color = 'primary' } = options;
    const rowPercent = max > 0 ? Math.round(((max - current) / max) * 100) : 0;

    return (
        <div className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/5 transition-colors">
            <div className="flex items-center justify-between">
                <div className="flex flex-col min-w-0">
                    <span className="truncate text-sm font-bold text-foreground">
                        {title}
                    </span>
                    {resetAt ? (
                        <span className="text-sm text-muted-foreground/60 tabular-nums">
                            {t('frontend.statistics.resetsAt')} {resetAt}
                        </span>
                    ) : (
                        <span className="text-sm text-muted-foreground/40 font-medium">
                            {subtitle}
                        </span>
                    )}
                </div>
                <div className="flex flex-col items-end shrink-0">
                    <span className={cn("text-sm font-bold", color === 'destructive' ? "text-destructive" : `text-${color}`)}>
                        {rowPercent}%
                    </span>
                    <span className="text-sm font-medium text-muted-foreground/60 tabular-nums">
                        {current.toLocaleString()} / {max.toLocaleString()}
                    </span>
                </div>
            </div>
            <HorizontalProgressBar
                percentage={rowPercent}
                color={color === 'primary' ? 'bg-primary' : (color === 'destructive' ? 'bg-destructive' : getQuotaColor(rowPercent))}
            />
        </div>
    );
}

interface CopilotCardProps {
    copilotQuota: AccountWrapper<CopilotQuota> | null
    activeAccountId?: string | null
    activeAccountEmail?: string | null
}

export const CopilotCard: React.FC<CopilotCardProps> = ({ copilotQuota, activeAccountId, activeAccountEmail }) => {
    const { t } = useTranslation();
    if (!copilotQuota?.accounts || copilotQuota.accounts.length === 0) { return null; }

    return (
        <div className="space-y-4">
            {copilotQuota.accounts.map((acc, idx: number) => {
                const isActiveAccount = (
                    (activeAccountId && acc.accountId === activeAccountId) ||
                    (activeAccountEmail && acc.email === activeAccountEmail) ||
                    acc.isActive === true
                );
                const seatInfo = acc.seat_breakdown;
                const limit = seatInfo ? seatInfo.total_seats : acc.limit;
                const remaining = seatInfo ? (limit - seatInfo.active_seats) : acc.remaining;
                const percent = limit > 0 ? Math.round((remaining / limit) * 100) : 0;

                return (
                    <div key={acc.accountId ?? idx} className="overflow-hidden rounded-2xl border border-border/15 bg-background shadow-sm">
                        <div className="flex items-center justify-between border-b border-border/10 bg-muted/5 px-4 py-3">
                            <ProviderIcon 
                                provider="copilot" 
                                variant="minimal" 
                                size="100%"
                                containerClassName="w-8 h-8 p-1"
                            />
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="truncate text-sm font-bold text-foreground">
                                    {acc.email ?? t('frontend.statistics.copilotAccount')}
                                </span>
                            </div>
                            <span>{isActiveAccount ? t("frontend.statistics.active") : ""}</span>
                        </div>

                        {!acc.error && (
                            <div className="divide-y divide-border/5">
                                {renderLimitRow(t, {
                                    title: seatInfo ? t('frontend.statistics.seatsStatus') : t('frontend.statistics.usageStatus'),
                                    subtitle: seatInfo?.plan_type ?? acc.copilot_plan ?? t('frontend.statistics.individual'),
                                    current: seatInfo ? seatInfo.active_seats : acc.limit - acc.remaining,
                                    max: limit,
                                    color: percent <= 10 ? 'destructive' : 'primary',
                                })}

                                {acc.rate_limit && renderLimitRow(t, {
                                    title: t('frontend.statistics.rateLimit'),
                                    subtitle: t('frontend.statistics.apiUsage'),
                                    current: acc.rate_limit.limit - acc.rate_limit.remaining,
                                    max: acc.rate_limit.limit,
                                    resetAt: acc.rate_limit.reset,
                                })}

                                {acc.session_limits?.weekly && renderLimitRow(t, {
                                    title: t('frontend.statistics.weeklyLimit'),
                                    subtitle: t('frontend.statistics.weeklyQuota'),
                                    current: acc.session_limits.weekly.current,
                                    max: acc.session_limits.weekly.limit,
                                    resetAt: acc.session_limits.weekly.reset_at,
                                })}

                                {acc.session_limits?.session && renderLimitRow(t, {
                                    title: t('frontend.statistics.sessionLimit'),
                                    subtitle: t('frontend.statistics.sessionQuota'),
                                    current: acc.session_limits.session.current,
                                    max: acc.session_limits.session.limit,
                                    resetAt: acc.session_limits.session.reset_at,
                                })}

                                {acc.session_usage && (
                                    <div className="px-4 py-4 bg-muted/5">
                                        <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm font-bold text-muted-foreground/60 uppercase ">{t('frontend.statistics.cacheEfficiency')}</span>
                                                <span className="text-sm font-bold text-foreground">
                                                    {acc.session_usage.input_tokens > 0
                                                        ? Math.round((acc.session_usage.cache_read_tokens / acc.session_usage.input_tokens) * 100)
                                                        : 0}%
                                                </span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm font-bold text-muted-foreground/60 uppercase ">{t('frontend.statistics.reasoning')}</span>
                                                <span className="text-sm font-bold text-foreground">
                                                    {acc.session_usage.reasoning_tokens?.toLocaleString() ?? 0}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {acc.error && (
                            <div className="px-4 py-3 bg-destructive/5">
                                <span className="text-sm text-destructive font-bold">{acc.error}</span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
