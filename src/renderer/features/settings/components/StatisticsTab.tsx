import { Loader2 } from 'lucide-react';
import React, { memo, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { formatNumber, formatTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { AppSettings } from '@/types';
import { CodexUsage, CopilotQuota, QuotaResponse } from '@/types/quota';
import { appLogger } from '@/utils/renderer-logger';

import { AccountWrapper, DetailedStats, TimeStats } from '../types';

import { AntigravityCard } from './statistics/AntigravityCard';
import { ClaudeCard } from './statistics/ClaudeCard';
import { CodexCard } from './statistics/CodexCard';
import { CopilotCard } from './statistics/CopilotCard';
import { OverviewCards } from './statistics/OverviewCards';
import { TokenUsageChart } from './statistics/TokenUsageChart';
import { WorkspaceBarChart } from './statistics/WorkspaceBarChart';

type StatsPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
type WorkspaceUsageRow = { id: string; title: string; time: number; share: number };

const PERIODS: StatsPeriod[] = ['daily', 'weekly', 'monthly', 'yearly'];

interface PeriodSelectorProps {
    period: StatsPeriod;
    onChange: (p: StatsPeriod) => void;
    t: (key: string) => string;
}

interface StatisticsTabProps {
    statsLoading: boolean
    statsData: DetailedStats | null
    quotaData: AccountWrapper<QuotaResponse> | null
    copilotQuota: AccountWrapper<CopilotQuota> | null
    codexUsage: AccountWrapper<{ usage: CodexUsage }> | null
    claudeQuota: AccountWrapper<import('@shared/types/quota').ClaudeQuota> | null
    statsPeriod: StatsPeriod
    setStatsPeriod: (p: StatsPeriod) => void
    settings: AppSettings | null
    authStatus: { codex: boolean; claude: boolean; antigravity: boolean }
    setReloadTrigger?: (v: number | ((prev: number) => number)) => void
}

interface CodingTimeCardProps {
    timeStats: TimeStats | null;
    loadingTimeStats: boolean;
    workspaces: WorkspaceUsageRow[];
    statsPeriod: StatsPeriod;
    setStatsPeriod: (p: StatsPeriod) => void;
    t: (key: string) => string;
}

interface TokenUsageCardProps {
    statsLoading: boolean;
    tokenTimeline?: DetailedStats['tokenTimeline'];
    statsPeriod: StatsPeriod;
    setStatsPeriod: (p: StatsPeriod) => void;
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
                    'rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all',
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

const InsightPill: React.FC<{ label: string; value: string; subtext?: string }> = ({ label, value, subtext }) => (
    <div className="rounded-xl border border-border/50 bg-background/40 px-4 py-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/60">{label}</div>
        <div className="mt-2 text-2xl font-black tracking-[-0.04em] text-foreground tabular-nums">{value}</div>
        {subtext ? <div className="mt-1 text-[11px] text-muted-foreground/70">{subtext}</div> : null}
    </div>
);

const StatisticsSummary: React.FC<{
    t: (key: string) => string;
    statsData: DetailedStats | null;
    timeStats: TimeStats | null;
    workspaceCount: number;
}> = ({ t, statsData, timeStats, workspaceCount }) => (
    <SurfaceCard>
        <div className="flex flex-col gap-3 border-b border-border/40 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground/60">{t('statistics.title')}</div>
                <div className="mt-2 text-lg font-semibold text-foreground">{t('statistics.subtitle')}</div>
            </div>
            <div className="text-sm text-muted-foreground/75">{t('statistics.visualizeTokenConsumption')}</div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
            <InsightPill label={t('statistics.onlineTime')} value={formatTime(timeStats?.totalOnlineTime ?? 0)} subtext={t('statistics.totalAppUsage')} />
            <InsightPill label={t('statistics.codingTime')} value={formatTime(timeStats?.totalCodingTime ?? 0)} subtext={t('statistics.timeSpentCoding')} />
            <InsightPill label={t('statistics.codingTimeByWorkspace')} value={formatNumber(workspaceCount)} subtext={t('statistics.timeSpentCodingInEachWorkspace')} />
            <InsightPill label={t('statistics.totalTokens')} value={formatNumber(statsData?.totalTokens ?? 0)} subtext={t('statistics.tokenUsageOverTime')} />
            <InsightPill label={t('statistics.activity')} value={formatNumber(statsData?.tokenTimeline?.filter((item) => (item.promptTokens + item.completionTokens) > 0).length ?? 0)} subtext={t('statistics.sessions')} />
        </div>
    </SurfaceCard>
);

const CodingTimeCard: React.FC<CodingTimeCardProps> = memo(({
    timeStats,
    loadingTimeStats,
    workspaces,
    statsPeriod,
    setStatsPeriod,
    t
}) => {
    const maxTime = useMemo(() => {
        if (workspaces.length === 0) { return 0; }
        return Math.max(...workspaces.map(workspace => workspace.time), 0);
    }, [workspaces]);

    if (!timeStats?.workspaceCodingTime || workspaces.length === 0) {
        return null;
    }

    return (
        <div className="space-y-6">
            <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                        <div className="text-xs font-black uppercase tracking-[0.26em] text-muted-foreground/60">{t('statistics.codingTimeByWorkspace')}</div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <InsightPill label={t('statistics.codingTime')} value={formatTime(timeStats.totalCodingTime)} />
                            <InsightPill label={t('statistics.onlineTime')} value={formatTime(timeStats.totalOnlineTime)} />
                            <InsightPill label={t('statistics.activeThreads')} value={String(workspaces.length)} />
                        </div>
                    </div>
                    <PeriodSelector period={statsPeriod} onChange={setStatsPeriod} t={t} />
                </div>

                <div className="rounded-xl border border-border/40 bg-background/30 p-4">
                    {loadingTimeStats ? (
                        <div className="flex h-64 items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                    ) : (
                        <WorkspaceBarChart workspaces={workspaces.slice(0, 6)} maxTime={maxTime} />
                    )}
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {workspaces.slice(0, 6).map((workspace, index) => (
                        <div key={workspace.id} className="rounded-xl border border-border/40 bg-card px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/50">
                                        #{index + 1}
                                    </div>
                                    <div className="mt-1 text-sm font-medium text-foreground">{workspace.title}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-semibold text-foreground">{formatTime(workspace.time)}</div>
                                    <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/55">
                                        {workspace.share}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});
CodingTimeCard.displayName = 'CodingTimeCard';

const TokenUsageCard: React.FC<TokenUsageCardProps> = memo(({ statsLoading, tokenTimeline, statsPeriod, setStatsPeriod, t }) => (
    <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-xs font-black uppercase tracking-[0.26em] text-muted-foreground/60">
                {t('statistics.tokenUsageOverTime')}
            </div>
            <PeriodSelector period={statsPeriod} onChange={setStatsPeriod} t={t} />
        </div>
        <div className="min-h-[300px] pt-6">
            {statsLoading ? (
                <div className="flex h-64 items-center justify-center">
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
    const [timeStats, setTimeStats] = useState<TimeStats | null>(null);
    const [loadingTimeStats, setLoadingTimeStats] = useState(false);
    const [workspaces, setWorkspaces] = useState<Array<{ id: string; title: string }>>([]);
    const [activeAntigravityAccount, setActiveAntigravityAccount] = useState<{ id?: string; email?: string } | null>(null);

    useEffect(() => {
        const loadTimeStats = async () => {
            setLoadingTimeStats(true);
            try {
                const stats = await window.electron.db.getTimeStats();
                setTimeStats(stats);
            } catch (error) {
                appLogger.error('StatisticsTab', 'Failed to load time stats', error as Error);
            } finally {
                setLoadingTimeStats(false);
            }
        };

        const loadWorkspaces = async () => {
            try {
                const savedWorkspaces = await window.electron.db.getWorkspaces();
                setWorkspaces(savedWorkspaces);
            } catch (error) {
                appLogger.error('StatisticsTab', 'Failed to load workspaces', error as Error);
            }
        };

        const loadActiveAntigravityAccount = async () => {
            try {
                const account = await window.electron.getActiveLinkedAccount('antigravity')
                    .catch(() => window.electron.getActiveLinkedAccount('google'));
                setActiveAntigravityAccount(account ? { id: account.id, email: account.email } : null);
            } catch (error) {
                appLogger.error('StatisticsTab', 'Failed to load active Antigravity account', error as Error);
            }
        };

        void loadTimeStats();
        void loadWorkspaces();
        void loadActiveAntigravityAccount();
    }, []);

    const locale = useMemo(() =>
        settings?.general.language === 'tr' ? 'tr-TR' : 'en-US',
        [settings?.general.language]
    );

    const workspaceUsageRows = useMemo(() => {
        const workspaceTimes = timeStats?.workspaceCodingTime ?? {};
        const totalWorkspaceTime = Object.values(workspaceTimes).reduce((sum, duration) => sum + duration, 0);
        return Object.entries(workspaceTimes)
            .sort(([, left], [, right]) => right - left)
            .map(([workspaceId, duration]) => {
                const matchedWorkspace = workspaces.find(workspace => workspace.id === workspaceId);
                return {
                    id: workspaceId,
                    title: matchedWorkspace?.title ?? t('statistics.unknownWorkspace'),
                    time: duration,
                    share: totalWorkspaceTime > 0 ? Math.round((duration / totalWorkspaceTime) * 100) : 0
                };
            });
    }, [timeStats?.workspaceCodingTime, workspaces, t]);

    if (statsLoading && !statsData) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-6 w-full">
            <SurfaceCard className="space-y-6">
                <div className="space-y-4">
                    <div className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground/60">{t('statistics.title')}</div>
                    <div className="text-base text-muted-foreground/75">{t('statistics.subtitle')}</div>
                </div>

                <StatisticsSummary
                    t={t}
                    statsData={statsData}
                    timeStats={timeStats}
                    workspaceCount={workspaceUsageRows.length}
                />

                <OverviewCards t={t} statsData={statsData} timeStats={timeStats} />

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                    <SurfaceCard className="space-y-0 border-border/40 bg-background/20">
                        <CodingTimeCard
                            timeStats={timeStats}
                            loadingTimeStats={loadingTimeStats}
                            workspaces={workspaceUsageRows}
                            statsPeriod={statsPeriod}
                            setStatsPeriod={setStatsPeriod}
                            t={t}
                        />
                    </SurfaceCard>

                    <SurfaceCard className="border-border/40 bg-background/20">
                        <TokenUsageCard
                            statsLoading={statsLoading}
                            tokenTimeline={statsData?.tokenTimeline}
                            statsPeriod={statsPeriod}
                            setStatsPeriod={setStatsPeriod}
                            t={t}
                        />
                    </SurfaceCard>
                </div>
            </SurfaceCard>

            <SurfaceCard className="h-full w-full">
                <div className="space-y-3">
                    <div className="text-xs font-black uppercase tracking-[0.26em] text-muted-foreground/60">{t('statistics.connectedAppsUsage')}</div>
                    <div className="max-w-sm text-sm text-muted-foreground/75">{t('statistics.usageStatistics')}</div>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
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
            </SurfaceCard>
        </div>
    );
});

StatisticsTab.displayName = 'StatisticsTab';
