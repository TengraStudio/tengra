import { Activity } from 'lucide-react';
import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <>
        <div className="text-xs font-bold text-primary truncate">{email ?? t('statistics.codexAccount')}</div>
        <div className="text-xxs font-medium p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-destructive" />
            {t('common.error')}: {error}
        </div>
    </>
);

const UsageStats: React.FC<{ acc: ExtendedCodexAccount; t: (k: string) => string; locale: string }> = ({ acc, t, locale }) => {
    const usage = acc.usage;
    const dailyRemaining = 100 - (usage.dailyUsedPercent ?? 0);
    const weeklyRemaining = 100 - (usage.weeklyUsedPercent ?? 0);

    return (
        <>
            <div className="text-xs font-black text-primary/80 uppercase tracking-widest">{acc.email ?? t('statistics.codexAccount')}</div>
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-4">
                    <QuotaRing value={dailyRemaining} color="hsl(var(--primary))" size="sm" />
                    <div>
                        <div className="text-xxs font-black uppercase text-muted-foreground tracking-tighter">{t('statistics.dailyStatus')}</div>
                        <div className="text-xxs font-bold text-foreground/80 tabular-nums">{dailyRemaining}% {t('statistics.left')}</div>
                        <div className="text-xxxs text-muted-foreground/60 truncate mt-0.5">{formatReset(usage.dailyResetAt, locale)}</div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <QuotaRing value={weeklyRemaining} color="hsl(var(--purple))" size="sm" />
                    <div>
                        <div className="text-xxs font-black uppercase text-muted-foreground tracking-tighter">{t('statistics.weeklyStatus')}</div>
                        <div className="text-xxs font-bold text-foreground/80 tabular-nums">{weeklyRemaining}% {t('statistics.left')}</div>
                        <div className="text-xxxs text-muted-foreground/60 truncate mt-0.5">{formatReset(usage.weeklyResetAt, locale)}</div>
                    </div>
                </div>
            </div>
        </>
    );
};

export const CodexCard: React.FC<CodexCardProps> = ({ codexUsage, locale = 'en-US' }) => {
    const { t } = useTranslation();
    if (!codexUsage?.accounts || codexUsage.accounts.length === 0) { return null; }

    return (
        <Card className="border-border/40 bg-card backdrop-blur-md overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Activity className="w-12 h-12 text-primary" />
            </div>
            <CardHeader>
                <CardTitle className="text-sm font-black text-foreground/90 uppercase tracking-tighter">{t('statistics.codexTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {codexUsage.accounts.map((acc, idx: number) => (
                    <div key={acc.accountId ?? idx} className={cn("space-y-4", idx > 0 && "pt-6 border-t border-border/50")}>
                        {acc.error
                            ? <AccountError email={acc.email} error={acc.error} t={t} />
                            : <UsageStats acc={acc} t={t} locale={locale} />
                        }
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};
