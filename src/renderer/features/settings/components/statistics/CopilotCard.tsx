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
import CopilotIcon from '@assets/copilot.svg?url';

interface CopilotCardProps {
    copilotQuota: AccountWrapper<CopilotQuota> | null
}

export const CopilotCard: React.FC<CopilotCardProps> = ({ copilotQuota }) => {
    const { t } = useTranslation();
    if (!copilotQuota?.accounts || copilotQuota.accounts.length === 0) { return null; }

    return (
        <div className="space-y-4">
            {copilotQuota.accounts.map((acc, idx: number) => {
                const status = acc.error ? 'error' : 'active';
                const statusText = acc.error ? t('common.error') : t('frontend.statistics.active');

                const seatInfo = acc.seat_breakdown;
                const limit = seatInfo ? seatInfo.total_seats : acc.limit;
                const remaining = seatInfo ? (limit - seatInfo.active_seats) : acc.remaining;
                const percent = limit > 0 ? Math.round((remaining / limit) * 100) : 0;

                const renderLimitRow = (title: string, subtitle: string, current: number, max: number, resetAt?: string, color: string = 'primary') => {
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
                };

                return (
                    <div key={acc.accountId ?? idx} className="overflow-hidden rounded-2xl border border-border/15 bg-background shadow-sm">
                        <div className="flex items-center justify-between border-b border-border/10 bg-muted/5 px-4 py-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                                <img src={CopilotIcon} alt="Copilot Icon" className="w-6 h-6 invert" />
                            </div>
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="truncate text-sm font-bold text-foreground">
                                    {acc.email ?? t('frontend.statistics.copilotAccount')}
                                </span>
                            </div>
                            <span>{acc.isActive ? t("frontend.statistics.active") : ""}</span>
                            {/* TODO: Check if isActive value coming true or false */}
                        </div>

                        {!acc.error && (
                            <div className="divide-y divide-border/5">
                                {renderLimitRow(
                                    seatInfo ? t('frontend.statistics.seatsStatus') : t('frontend.statistics.usageStatus'),
                                    seatInfo?.plan_type ?? acc.copilot_plan ?? t('frontend.statistics.individual'),
                                    seatInfo ? seatInfo.active_seats : acc.limit - acc.remaining,
                                    limit,
                                    undefined,
                                    percent <= 10 ? 'destructive' : 'primary'
                                )}

                                {acc.rate_limit && renderLimitRow(
                                    t('frontend.statistics.rateLimit'),
                                    t('frontend.statistics.apiUsage'),
                                    acc.rate_limit.limit - acc.rate_limit.remaining,
                                    acc.rate_limit.limit,
                                    acc.rate_limit.reset,
                                    'primary'
                                )}

                                {acc.session_limits?.weekly && renderLimitRow(
                                    t('frontend.statistics.weeklyLimit'),
                                    t('statistics.weeklyQuota'),
                                    acc.session_limits.weekly.current,
                                    acc.session_limits.weekly.limit,
                                    acc.session_limits.weekly.reset_at,
                                    'primary'
                                )}

                                {acc.session_limits?.session && renderLimitRow(
                                    t('frontend.statistics.sessionLimit'),
                                    t('statistics.sessionQuota'),
                                    acc.session_limits.session.current,
                                    acc.session_limits.session.limit,
                                    acc.session_limits.session.reset_at,
                                    'primary'
                                )}

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

