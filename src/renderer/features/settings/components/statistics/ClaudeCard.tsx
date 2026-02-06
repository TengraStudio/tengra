import { Activity } from 'lucide-react';
import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
        <Card className="border-border/40 bg-card backdrop-blur-md overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Activity className="w-12 h-12 text-orange" />
            </div>
            <CardHeader>
                <CardTitle className="text-sm font-black text-foreground/90 uppercase tracking-tighter">{t('statistics.claudeTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {claudeQuota.accounts.map((acc, idx: number) => {
                    if (acc.error) {
                        return (
                            <div key={acc.accountId ?? idx} className={cn("space-y-4", idx > 0 && "pt-6 border-t border-border/50")}>
                                <div className="text-xs font-bold text-orange truncate">{acc.email ?? t('statistics.claudeAccount')}</div>
                                <div className="text-xxs font-medium p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-destructive" />
                                    {t('common.error')}: {acc.error}
                                </div>
                            </div>
                        );
                    }
                    return (
                        <div key={acc.accountId ?? idx} className={cn("space-y-4", idx > 0 && "pt-6 border-t border-border/50")}>
                            <div className="text-xs font-black text-orange/80 uppercase tracking-widest">{acc.email ?? t('statistics.claudeAccount')}</div>
                            <div className="flex items-center gap-8">
                                {acc.fiveHour && (
                                    <div className="flex items-center gap-4">
                                        <QuotaRing value={100 - acc.fiveHour.utilization} color="hsl(var(--purple))" size="sm" />
                                        <div>
                                            <div className="text-xxs font-black uppercase text-muted-foreground tracking-tighter">{t('statistics.fiveHourStatus')}</div>
                                            <div className="text-xxs font-bold text-foreground/80 tabular-nums">{100 - acc.fiveHour.utilization}% {t('statistics.left')}</div>
                                            <div className="text-xxxs text-muted-foreground/60 mt-0.5">{formatReset(acc.fiveHour.resetsAt, locale)}</div>
                                        </div>
                                    </div>
                                )}
                                {acc.sevenDay && (
                                    <div className="flex items-center gap-4">
                                        <QuotaRing value={100 - acc.sevenDay.utilization} color="hsl(var(--purple))" size="sm" />
                                        <div>
                                            <div className="text-xxs font-black uppercase text-muted-foreground tracking-tighter">{t('statistics.sevenDayStatus')}</div>
                                            <div className="text-xxs font-bold text-foreground/80 tabular-nums">{100 - acc.sevenDay.utilization}% {t('statistics.left')}</div>
                                            <div className="text-xxxs text-muted-foreground/60 mt-0.5">{formatReset(acc.sevenDay.resetsAt, locale)}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
};
