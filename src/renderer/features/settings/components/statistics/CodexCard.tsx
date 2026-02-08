import React from 'react';

import { useTranslation } from '@/i18n';
import { formatReset } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { CodexUsage } from '@/types/quota';

import { AccountWrapper } from '../../types';

import { QuotaRing } from './QuotaRing';

interface CodexCardProps {
    codexUsage: AccountWrapper<{ usage: CodexUsage }> | null
    locale?: string
}

type ExtendedCodexAccount = { usage: CodexUsage } & { accountId?: string; email?: string; error?: string };

const AccountError: React.FC<{ email?: string; error: string; t: (k: string) => string }> = ({ email, error, t }) => (
    <div className="space-y-4">
        <div className="text-xs font-bold text-primary truncate">{email ?? t('statistics.codexAccount')}</div>
        <div className="text-[10px] font-medium p-3 rounded-2xl bg-destructive/5 border border-destructive/20 text-destructive flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-destructive shadow-[0_0_8px_rgba(var(--destructive-rgb),0.5)]" />
            {t('common.error')}: {error}
        </div>
    </div>
);

const UsageStats: React.FC<{ acc: ExtendedCodexAccount; t: (k: string) => string; locale: string }> = ({ acc, t, locale }) => {
    const usage = acc.usage;
    const dailyRemaining = 100 - (usage.dailyUsedPercent ?? 0);
    const weeklyRemaining = 100 - (usage.weeklyUsedPercent ?? 0);

    return (
        <div className="space-y-6">
            <div className="text-xs font-black uppercase tracking-widest">{acc.email ?? t('statistics.codexAccount')}</div>
            <div className="flex flex-wrap items-center gap-10">
                <div className="flex items-center gap-5">
                    <QuotaRing value={dailyRemaining} color="hsl(var(--primary))" size="sm" />
                    <div>
                        <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('statistics.dailyStatus')}</div>
                        <div className="text-xs font-bold text-foreground/80 tabular-nums">{dailyRemaining}% {t('statistics.left')}</div>
                        <div className="text-[10px] font-medium text-muted-foreground/50 mt-1 tracking-tight truncate">{formatReset(usage.dailyResetAt, locale)}</div>
                    </div>
                </div>
                <div className="flex items-center gap-5">
                    <QuotaRing value={weeklyRemaining} color="hsl(var(--primary))" size="sm" />
                    <div>
                        <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t('statistics.weeklyStatus')}</div>
                        <div className="text-xs font-bold text-foreground/80 tabular-nums">{weeklyRemaining}% {t('statistics.left')}</div>
                        <div className="text-[10px] font-medium text-muted-foreground/50 mt-1 tracking-tight truncate">{formatReset(usage.weeklyResetAt, locale)}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const CodexCard: React.FC<CodexCardProps> = ({ codexUsage, locale = 'en-US' }) => {
    const { t } = useTranslation();
    if (!codexUsage?.accounts || codexUsage.accounts.length === 0) { return null; }

    return (
        <div className="premium-glass p-8 space-y-8 relative group overflow-hidden">
            <div className="flex flex-row items-center justify-between relative z-10">
                <div>
                    <div className="text-base font-black text-foreground uppercase tracking-tight">{t('statistics.codexTitle')}</div>
                    <div className="text-xs font-medium text-muted-foreground/70">{t('statistics.usageOverview')}</div>
                </div>
            </div>

            <div className="space-y-8 relative z-10">
                {codexUsage.accounts.map((acc, idx: number) => (
                    <div key={acc.accountId ?? idx} className={cn("space-y-6 relative", idx > 0 && "pt-8 border-t border-border/10")}>
                        {acc.error
                            ? <AccountError email={acc.email} error={acc.error} t={t} />
                            : <UsageStats acc={acc} t={t} locale={locale} />
                        }
                    </div>
                ))}
            </div>
        </div>
    );
};
