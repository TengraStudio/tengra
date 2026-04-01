import { Loader2 } from 'lucide-react';
import React, { memo, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { AppSettings } from '@/types';
import { CodexUsage, CopilotQuota, QuotaResponse } from '@/types/quota';
import { appLogger } from '@/utils/renderer-logger';

import { AccountWrapper, DetailedStats } from '../types';

import { AntigravityCard } from './statistics/AntigravityCard';
import { ClaudeCard } from './statistics/ClaudeCard';
import { CodexCard } from './statistics/CodexCard';
import { CopilotCard } from './statistics/CopilotCard';
import { OverviewCards } from './statistics/OverviewCards';
import { TokenUsageChart } from './statistics/TokenUsageChart';

type StatisticsPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

const PERIODS: StatisticsPeriod[] = ['daily', 'weekly', 'monthly', 'yearly'];

interface PeriodSelectorProps {
    period: StatisticsPeriod;
    onChange: (p: StatisticsPeriod) => void;
    t: (key: string) => string;
}

interface StatisticsTabProps {
    statsLoading: boolean
    statsData: DetailedStats | null
    quotaData: AccountWrapper<QuotaResponse> | null
    copilotQuota: AccountWrapper<CopilotQuota> | null
    codexUsage: AccountWrapper<{ usage: CodexUsage }> | null
    claudeQuota: AccountWrapper<import('@shared/types/quota').ClaudeQuota> | null
    statsPeriod: StatisticsPeriod
    setStatsPeriod: (p: StatisticsPeriod) => void
    settings: AppSettings | null
    authStatus: { codex: boolean; claude: boolean; antigravity: boolean }
    setReloadTrigger?: (v: number | ((prev: number) => number)) => void
}

interface TokenUsageCardProps {
    statsLoading: boolean;
    tokenTimeline?: DetailedStats['tokenTimeline'];
    statsPeriod: StatisticsPeriod;
    t: (key: string) => string;
}

const SurfaceCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <section className={cn(
        'rounded-2xl border border-border/50 bg-card p-6',
        className
    )}>
        {children}
    </section>
);

const PeriodSelector: React.FC<PeriodSelectorProps> = memo(({ period, onChange, t }) => (
    <div className="flex flex-wrap gap-2">
        {PERIODS.map((value) => (
            <button
                key={value}
                onClick={() => onChange(value)}
                className={cn(
                    'rounded-full border px-3 py-1.5 text-xxxs font-black uppercase tracking-widest transition-all',
                    period === value
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border/50 bg-transparent text-muted-foreground/60 hover:text-foreground'
                )}
            >
                {t(`statistics.${value}`)}
            </button>
        ))}
    </div>
));
PeriodSelector.displayName = 'PeriodSelector';


const StatisticsHeader: React.FC<{
    t: (key: string) => string;
    statsPeriod: StatisticsPeriod;
    setStatsPeriod: (p: StatisticsPeriod) => void;
}> = ({ t, statsPeriod, setStatsPeriod }) => (
    <div className="flex flex-col gap-6 border-b border-border/40 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <div className="text-xxxs font-black uppercase tracking-widest text-primary">{t('statistics.title')}</div>
            </div>
            <div className="text-2xl font-black tracking-tight text-foreground">{t('statistics.subtitle')}</div>
            <div className="text-sm text-muted-foreground/70 font-medium">{t('statistics.visualizeTokenConsumption')}</div>
        </div>
        <div className="flex items-center gap-4">
            <div className="text-xxxs font-bold uppercase tracking-widest text-muted-foreground/40">{t('common.period') || 'Period'}</div>
            <PeriodSelector period={statsPeriod} onChange={setStatsPeriod} t={t} />
        </div>
    </div>
);

const TokenUsageCard: React.FC<TokenUsageCardProps> = memo(({ statsLoading, tokenTimeline, statsPeriod, t }) => (
    <div className="space-y-6">
        <div className="text-xxxs font-black uppercase tracking-widest text-muted-foreground/60">
            {t('statistics.tokenUsageOverTime')}
        </div>
        <div className="min-h-80">
            {statsLoading ? (
                <div className="flex h-80 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
            ) : (
                <TokenUsageChart tokenTimeline={tokenTimeline ?? []} t={t} period={statsPeriod} />
            )}
        </div>
    </div>
));
TokenUsageCard.displayName = 'TokenUsageCard';

export const StatisticsTab: React.FC<StatisticsTabProps> = memo(({
    statsLoading,
    statsData,
    quotaData,
    copilotQuota,
    codexUsage,
    claudeQuota,
    statsPeriod,
    setStatsPeriod,
    settings
}) => {
    const { t } = useTranslation(settings?.general.language ?? 'en');
    const [activeAntigravityAccount, setActiveAntigravityAccount] = useState<{ id?: string; email?: string } | null>(null);

    useEffect(() => {
        const loadActiveAntigravityAccount = async () => {
            try {
                const account = await window.electron.getActiveLinkedAccount('antigravity')
                    .catch(() => window.electron.getActiveLinkedAccount('google'));
                setActiveAntigravityAccount(account ? { id: account.id, email: account.email } : null);
            } catch (error) {
                appLogger.error('StatisticsTab', 'Failed to load active Antigravity account', error as Error);
            }
        };

        void loadActiveAntigravityAccount();
    }, []);

    const locale = useMemo(() =>
        settings?.general.language === 'tr' ? 'tr-TR' : 'en-US',
        [settings?.general.language]
    );

    if (statsLoading && !statsData) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10 w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
            <SurfaceCard className="p-8 space-y-10">
                <StatisticsHeader
                    t={t}
                    statsPeriod={statsPeriod}
                    setStatsPeriod={setStatsPeriod}
                />

                <div className="space-y-4">
                    <div className="text-xxxs font-black uppercase tracking-widest text-muted-foreground/60">{t('statistics.usageOverview')}</div>
                    <OverviewCards t={t} statsData={statsData} />
                </div>

                <div className="pt-4">
                    <TokenUsageCard
                        statsLoading={statsLoading}
                        tokenTimeline={statsData?.tokenTimeline}
                        statsPeriod={statsPeriod}
                        t={t}
                    />
                </div>
            </SurfaceCard>

            <div className="space-y-6">
                <div className="flex flex-col gap-2 px-1">
                    <div className="text-xxxs font-black uppercase tracking-widest text-primary/70">{t('statistics.connectedAppsUsage')}</div>
                    <div className="text-sm text-muted-foreground/60 font-medium">{t('statistics.usageStatistics')}</div>
                </div>
                
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <AntigravityCard
                        t={t}
                        quotaData={quotaData}
                        locale={locale}
                        activeAccountId={activeAntigravityAccount?.id ?? null}
                        activeAccountEmail={activeAntigravityAccount?.email ?? null}
                    />
                    <ClaudeCard claudeQuota={claudeQuota} locale={locale} />
                    <CopilotCard copilotQuota={copilotQuota} />
                    <CodexCard codexUsage={codexUsage} locale={locale} />
                </div>
            </div>
        </div>
    );
});

StatisticsTab.displayName = 'StatisticsTab';
