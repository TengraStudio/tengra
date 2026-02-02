import { Activity } from 'lucide-react';
import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { CopilotQuota } from '@/types/quota';

import { AccountWrapper } from '../../types';

import { getQuotaColor, QuotaRing } from './QuotaRing';

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
        <div className="text-[10px] font-medium p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-destructive" />
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
        <div className="space-y-4">
            <div className="text-xs font-black text-success/80 uppercase tracking-widest">{acc.email ?? t('statistics.copilotAccount')}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex items-center gap-4">
                    <QuotaRing value={percent} color={getQuotaColor(percent)} size="sm" />
                    <div>
                        <div className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">{seatInfo ? t('statistics.seatsStatus') : t('statistics.usageStatus')}</div>
                        <div className="text-[10px] font-bold text-foreground/80 tabular-nums">{remaining} / {limit} {t('statistics.left')}</div>
                        <div className="text-[9px] text-muted-foreground/50 uppercase mt-0.5 tracking-wide">{seatInfo?.plan_type ?? acc.copilot_plan ?? t('statistics.individual')}</div>
                    </div>
                </div>
                {acc.rate_limit && (
                    <div className="flex items-center gap-4">
                        <QuotaRing value={Math.round((acc.rate_limit.remaining / acc.rate_limit.limit) * 100)} color="hsl(var(--success))" size="sm" />
                        <div>
                            <div className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">{t('statistics.rateLimit')}</div>
                            <div className="text-[10px] font-bold text-foreground/80 tabular-nums">{acc.rate_limit.remaining} / {acc.rate_limit.limit}</div>
                            <div className="text-[9px] text-muted-foreground/50 uppercase mt-0.5 tracking-wide">{t('statistics.apiUsage')}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const AccountItem: React.FC<AccountData & { t: (k: string) => string }> = ({ idx, acc, t }) => (
    <div key={acc.accountId ?? idx} className={cn("space-y-4", idx > 0 && "pt-6 border-t border-border/50")}>
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
        <Card className="border-border/40 bg-card backdrop-blur-md overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Activity className="w-12 h-12 text-success" />
            </div>
            <CardHeader>
                <CardTitle className="text-sm font-black text-foreground/90 uppercase tracking-tighter">GitHub Copilot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {copilotQuota.accounts.map((acc, idx: number) => (
                    <AccountItem key={acc.accountId ?? idx} idx={idx} acc={acc} t={t} />
                ))}
            </CardContent>
        </Card>
    );
};
