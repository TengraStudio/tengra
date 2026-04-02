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
        <div className="col-span-1 space-y-3 rounded-2xl border border-border/20 bg-background p-4">
            <div className="text-sm font-medium text-foreground">{t('statistics.codexTitle')}</div>
            <div className="space-y-3">
                {codexUsage.accounts.map((acc, idx: number) => {
                    const status = acc.error ? 'error' : 'active';
                    const statusText = acc.error ? t('common.error') : t('statistics.active');
                    const usage = acc.usage;
                    const dailyRemaining = 100 - (usage?.dailyUsedPercent ?? 0);
                    const weeklyRemaining = 100 - (usage?.weeklyUsedPercent ?? 0);

                    return (
                        <div key={acc.accountId ?? idx} className={cn('space-y-3 rounded-xl border border-border/15 bg-muted/4 px-4 py-3', idx > 0 && 'mt-2')}>
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="truncate text-sm font-medium text-foreground/90">
                                    {acc.email ?? t('statistics.codexAccount')}
                                </div>
                                {(acc.error || acc.isActive) && <StatusBadge status={status} text={statusText} />}
                                {acc.error && <span className="tw-text-9 text-destructive truncate ml-2">{acc.error}</span>}
                            </div>

                            {!acc.error && usage && (
                                <div className="grid grid-cols-1 gap-x-6 gap-y-5 pt-2 md:grid-cols-2 xl:grid-cols-3">
                                    <div className="space-y-2">
                                        <div className="tw-text-10 flex items-center justify-between font-medium">
                                            <span className="text-muted-foreground truncate pr-2">{t('statistics.dailyStatus')}</span>
                                            <span className="text-foreground/80 tabular-nums shrink-0">{dailyRemaining}%</span>
                                        </div>
                                        <HorizontalProgressBar percentage={dailyRemaining} color={getQuotaColor(dailyRemaining)} />
                                        <div className="tw-text-9 font-medium text-muted-foreground/40 mt-1">
                                            {formatReset(usage.dailyResetAt, locale)}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="tw-text-10 flex items-center justify-between font-medium">
                                            <span className="text-muted-foreground truncate pr-2">{t('statistics.weeklyStatus')}</span>
                                            <span className="text-foreground/80 tabular-nums shrink-0">{weeklyRemaining}%</span>
                                        </div>
                                        <HorizontalProgressBar percentage={weeklyRemaining} color={getQuotaColor(weeklyRemaining)} />
                                        <div className="tw-text-9 font-medium text-muted-foreground/40 mt-1">
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

