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
        <div className="col-span-1 h-full space-y-4 rounded-xl border border-border/40 bg-background/30 p-4">
            <div className="text-xs font-black text-muted-foreground/60 uppercase tracking-widest">{t('statistics.claudeTitle')}</div>
            <div className="space-y-8">
                {claudeQuota.accounts.map((acc, idx: number) => {
                    const status = acc.error ? 'error' : 'active';
                    const statusText = acc.error ? t('common.error') : t('statistics.active');

                    return (
                        <div key={acc.accountId ?? idx} className={cn("space-y-4 rounded-xl border border-border/40 bg-card px-4 py-3", idx > 0 && "pt-6")}>
                            {/* Account Header */}
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="text-sm font-black text-foreground/90 uppercase tracking-widest truncate">
                                    {acc.email ?? t('statistics.claudeAccount')}
                                </div>
                                {(acc.error || acc.isActive) && <StatusBadge status={status} text={statusText} />}
                                {acc.error && <span className="text-[9px] text-destructive truncate ml-2">{acc.error}</span>}
                            </div>

                            {/* Limits */}
                            {!acc.error && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 pt-2">
                                    {acc.fiveHour && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-bold">
                                                <span className="text-muted-foreground truncate pr-2">{t('statistics.fiveHourStatus')}</span>
                                                <span className="text-foreground/80 tabular-nums shrink-0">{100 - acc.fiveHour.utilization}%</span>
                                            </div>
                                            <HorizontalProgressBar percentage={100 - acc.fiveHour.utilization} color={getQuotaColor(100 - acc.fiveHour.utilization)} />
                                            <div className="text-[9px] font-medium text-muted-foreground/40 mt-1 uppercase tracking-widest">
                                                {formatReset(acc.fiveHour.resetsAt, locale)}
                                            </div>
                                        </div>
                                    )}
                                    {acc.sevenDay && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-bold">
                                                <span className="text-muted-foreground truncate pr-2">{t('statistics.sevenDayStatus')}</span>
                                                <span className="text-foreground/80 tabular-nums shrink-0">{100 - acc.sevenDay.utilization}%</span>
                                            </div>
                                            <HorizontalProgressBar percentage={100 - acc.sevenDay.utilization} color={getQuotaColor(100 - acc.sevenDay.utilization)} />
                                            <div className="text-[9px] font-medium text-muted-foreground/40 mt-1 uppercase tracking-widest">
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

