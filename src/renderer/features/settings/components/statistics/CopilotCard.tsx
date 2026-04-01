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
        <div className="col-span-1 h-max space-y-4 rounded-xl border border-border/40 bg-background/30 p-4">
            <div className="text-xs font-black text-muted-foreground/60 uppercase tracking-widest">{t('statistics.copilotTitle')}</div>
            <div className="space-y-8">
                {copilotQuota.accounts.map((acc, idx: number) => {
                    const status = acc.error ? 'error' : 'active';
                    const statusText = acc.error ? t('common.error') : t('statistics.active');

                    const seatInfo = acc.seat_breakdown;
                    const limit = seatInfo ? seatInfo.total_seats : acc.limit;
                    const remaining = seatInfo ? (limit - seatInfo.active_seats) : acc.remaining;
                    const percent = limit > 0 ? Math.round((remaining / limit) * 100) : 0;

                    return (
                        <div key={acc.accountId ?? idx} className={cn("space-y-4 rounded-xl border border-border/40 bg-card px-4 py-3", idx > 0 && "pt-6")}>
                            {/* Account Header */}
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="text-sm font-black text-foreground/90 uppercase tracking-widest truncate">
                                    {acc.email ?? t('statistics.copilotAccount')}
                                </div>
                                {(acc.error || acc.isActive) && <StatusBadge status={status} text={statusText} />}
                                {acc.error && <span className="tw-text-9 text-destructive truncate ml-2">{acc.error}</span>}
                            </div>

                            {/* Limits */}
                            {!acc.error && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 pt-2">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between tw-text-10 uppercase tracking-widest font-bold">
                                            <span className="text-muted-foreground truncate pr-2">{seatInfo ? t('statistics.seatsStatus') : t('statistics.usageStatus')}</span>
                                            <span className="text-foreground/80 tabular-nums shrink-0">{remaining} / {limit}</span>
                                        </div>
                                        <HorizontalProgressBar percentage={percent} color={getQuotaColor(percent)} />
                                        <div className="tw-text-9 font-medium text-muted-foreground/40 mt-1 uppercase tracking-widest">
                                            {seatInfo?.plan_type ?? acc.copilot_plan ?? t('statistics.individual')}
                                        </div>
                                    </div>

                                    {acc.rate_limit && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between tw-text-10 uppercase tracking-widest font-bold">
                                                <span className="text-muted-foreground truncate pr-2">{t('statistics.rateLimit')}</span>
                                                <span className="text-foreground/80 tabular-nums shrink-0">{acc.rate_limit.remaining} / {acc.rate_limit.limit}</span>
                                            </div>
                                            <HorizontalProgressBar 
                                                percentage={Math.round((acc.rate_limit.remaining / acc.rate_limit.limit) * 100)} 
                                                color={getQuotaColor(Math.round((acc.rate_limit.remaining / acc.rate_limit.limit) * 100))} 
                                            />
                                            <div className="tw-text-9 font-medium text-muted-foreground/40 mt-1 uppercase tracking-widest">
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

