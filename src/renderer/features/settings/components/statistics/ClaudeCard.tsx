import React from 'react';
import { useTranslation } from '@/i18n';
import { formatReset } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { ClaudeQuota } from '@/types/quota';

import { AccountWrapper } from '../../types';

import { QuotaRing } from './QuotaRing';

interface ClaudeCardProps {
    claudeQuota: AccountWrapper<ClaudeQuota> | null
    locale?: string
}

export const ClaudeCard: React.FC<ClaudeCardProps> = ({ claudeQuota, locale = 'en-US' }) => {
    const { t } = useTranslation();
    if (!claudeQuota?.accounts || claudeQuota.accounts.length === 0) { return null; }

    return (
        <div className="premium-glass p-8 space-y-8 relative group overflow-hidden">
            <div className="flex flex-row items-center justify-between relative z-10">
                <div>
                    <div className="text-base font-black text-foreground uppercase tracking-tight">{t('statistics.claudeTitle')}</div>
                    <div className="text-xs font-medium text-muted-foreground/70">{t('statistics.usageOverview')}</div>
                </div>
            </div>

            <div className="space-y-8 relative z-10">
                {claudeQuota.accounts.map((acc, idx: number) => {
                    if (acc.error) {
                        return (
                            <div key={acc.accountId ?? idx} className={cn("space-y-4", idx > 0 && "pt-8 border-t border-border/10")}>
                                <div className="text-xs font-bold text-orange truncate">{acc.email ?? t('statistics.claudeAccount')}</div>
                                <div className="text-[10px] font-medium p-3 rounded-2xl bg-destructive/5 border border-destructive/20 text-destructive flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-destructive shadow-[0_0_8px_rgba(var(--destructive-rgb),0.5)]" />
                                    {t('common.error')}: {acc.error}
                                </div>
                            </div>
                        );
                    }
                    return (
                        <div key={acc.accountId ?? idx} className={cn("space-y-6", idx > 0 && "pt-8 border-t border-border/10")}>
                            <div className="text-xs font-black text-orange/80 uppercase tracking-widest">{acc.email ?? t('statistics.claudeAccount')}</div>
                            <div className="flex flex-wrap items-center gap-10">
                                {acc.fiveHour && (
                                    <div className="flex items-center gap-5">
                                        <QuotaRing value={100 - acc.fiveHour.utilization} color="hsl(var(--primary))" size="sm" />
                                        <div>
                                            <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('statistics.fiveHourStatus')}</div>
                                            <div className="text-xs font-bold text-foreground/80 tabular-nums">{100 - acc.fiveHour.utilization}% {t('statistics.left')}</div>
                                            <div className="text-[10px] font-medium text-muted-foreground/50 mt-1 tracking-tight">{formatReset(acc.fiveHour.resetsAt, locale)}</div>
                                        </div>
                                    </div>
                                )}
                                {acc.sevenDay && (
                                    <div className="flex items-center gap-5">
                                        <QuotaRing value={100 - acc.sevenDay.utilization} color="hsl(var(--primary))" size="sm" />
                                        <div>
                                            <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('statistics.sevenDayStatus')}</div>
                                            <div className="text-xs font-bold text-foreground/80 tabular-nums">{100 - acc.sevenDay.utilization}% {t('statistics.left')}</div>
                                            <div className="text-[10px] font-medium text-muted-foreground/50 mt-1 tracking-tight">{formatReset(acc.sevenDay.resetsAt, locale)}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
