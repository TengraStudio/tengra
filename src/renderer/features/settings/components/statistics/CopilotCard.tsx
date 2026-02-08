import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { CopilotQuota } from '@/types/quota';

import { AccountWrapper } from '../../types';

import { QuotaRing } from './QuotaRing';

interface CopilotCardProps {
    copilotQuota: AccountWrapper<CopilotQuota> | null
}

type ExtendedCopilotQuota = CopilotQuota & { accountId?: string; email?: string; error?: string };

interface AccountData {
    idx: number
    acc: ExtendedCopilotQuota
}

const AccountError: React.FC<{ email?: string; error: string; t: (k: string) => string }> = ({ email, error, t }) => (
    <div className="space-y-4">
        <div className="text-xs font-bold text-success truncate">{email ?? t('statistics.copilotAccount')}</div>
        <div className="text-[10px] font-medium p-3 rounded-2xl bg-destructive/5 border border-destructive/20 text-destructive flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-destructive shadow-[0_0_8px_rgba(var(--destructive-rgb),0.5)]" />
            {t('common.error')}: {error}
        </div>
    </div>
);

const AccountStats: React.FC<{ acc: ExtendedCopilotQuota; t: (k: string) => string }> = ({ acc, t }) => {
    const seatInfo = acc.seat_breakdown;
    const limit = seatInfo ? seatInfo.total_seats : acc.limit;
    const remaining = seatInfo ? (limit - seatInfo.active_seats) : acc.remaining;
    const percent = limit > 0 ? Math.round((remaining / limit) * 100) : 0;

    return (
        <div className="space-y-6">
            <div className="text-xs font-black uppercase tracking-widest">{acc.email ?? t('statistics.copilotAccount')}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                <div className="flex items-center gap-5">
                    <QuotaRing value={percent} color="hsl(var(--primary))" size="sm" />
                    <div>
                        <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{seatInfo ? t('statistics.seatsStatus') : t('statistics.usageStatus')}</div>
                        <div className="text-xs font-bold text-foreground/80 tabular-nums">{remaining} / {limit} {t('statistics.left')}</div>
                        <div className="text-[10px] font-medium text-muted-foreground/50 uppercase mt-1 tracking-widest">{seatInfo?.plan_type ?? acc.copilot_plan ?? t('statistics.individual')}</div>
                    </div>
                </div>
                {acc.rate_limit && (
                    <div className="flex items-center gap-5">
                        <QuotaRing value={Math.round((acc.rate_limit.remaining / acc.rate_limit.limit) * 100)} color="hsl(var(--primary))" size="sm" />
                        <div>
                            <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('statistics.rateLimit')}</div>
                            <div className="text-xs font-bold text-foreground/80 tabular-nums">{acc.rate_limit.remaining} / {acc.rate_limit.limit}</div>
                            <div className="text-[10px] font-medium text-muted-foreground/50 uppercase mt-1 tracking-widest">{t('statistics.apiUsage')}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const AccountItem: React.FC<AccountData & { t: (k: string) => string }> = ({ idx, acc, t }) => (
    <div key={acc.accountId ?? idx} className={cn("space-y-6 relative", idx > 0 && "pt-8 border-t border-border/10")}>
        {acc.error
            ? <AccountError email={acc.email} error={acc.error} t={t} />
            : <AccountStats acc={acc} t={t} />
        }
    </div>
);

export const CopilotCard: React.FC<CopilotCardProps> = ({ copilotQuota }) => {
    const { t } = useTranslation();
    if (!copilotQuota?.accounts || copilotQuota.accounts.length === 0) { return null; }

    return (
        <div className="premium-glass p-8 space-y-8 relative group overflow-hidden">
            <div className="flex flex-row items-center justify-between relative z-10">
                <div>
                    <div className="text-base font-black text-foreground uppercase tracking-tight">{t('statistics.copilotTitle')}</div>
                    <div className="text-xs font-medium text-muted-foreground/70">{t('statistics.usageOverview')}</div>
                </div>
            </div>

            <div className="space-y-8 relative z-10">
                {copilotQuota.accounts.map((acc, idx: number) => (
                    <AccountItem key={acc.accountId ?? idx} idx={idx} acc={acc} t={t} />
                ))}
            </div>
        </div>
    );
};
