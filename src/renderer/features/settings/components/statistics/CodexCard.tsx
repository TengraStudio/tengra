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
        <div className="col-span-1 h-full space-y-4 rounded-xl border border-border/40 bg-background/30 p-4">
            <div className="text-xs font-black text-muted-foreground/60 uppercase tracking-widest">{t('statistics.codexTitle')}</div>
            <div className="space-y-8">
                {codexUsage.accounts.map((acc, idx: number) => {
                    const status = acc.error ? 'error' : 'active';
                    const statusText = acc.error ? t('common.error') : t('statistics.active');
                    const usage = acc.usage;
                    const dailyRemaining = 100 - (usage?.dailyUsedPercent ?? 0);
                    const weeklyRemaining = 100 - (usage?.weeklyUsedPercent ?? 0);

                    return (
                        <div key={acc.accountId ?? idx} className={cn("space-y-4 rounded-xl border border-border/40 bg-card px-4 py-3", idx > 0 && "pt-6")}>
                            {/* Account Header */}
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="text-sm font-black text-foreground/90 uppercase tracking-widest truncate">
                                    {acc.email ?? t('statistics.codexAccount')}
                                </div>
                                {(acc.error || acc.isActive) && <StatusBadge status={status} text={statusText} />}
                                {acc.error && <span className="text-[9px] text-destructive truncate ml-2">{acc.error}</span>}
                            </div>

                            {/* Limits */}
                            {!acc.error && usage && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 pt-2">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-bold">
                                            <span className="text-muted-foreground truncate pr-2">{t('statistics.dailyStatus')}</span>
                                            <span className="text-foreground/80 tabular-nums shrink-0">{dailyRemaining}%</span>
                                        </div>
                                        <HorizontalProgressBar percentage={dailyRemaining} color={getQuotaColor(dailyRemaining)} />
                                        <div className="text-[9px] font-medium text-muted-foreground/40 mt-1 uppercase tracking-widest">
                                            {formatReset(usage.dailyResetAt, locale)}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-bold">
                                            <span className="text-muted-foreground truncate pr-2">{t('statistics.weeklyStatus')}</span>
                                            <span className="text-foreground/80 tabular-nums shrink-0">{weeklyRemaining}%</span>
                                        </div>
                                        <HorizontalProgressBar percentage={weeklyRemaining} color={getQuotaColor(weeklyRemaining)} />
                                        <div className="text-[9px] font-medium text-muted-foreground/40 mt-1 uppercase tracking-widest">
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

