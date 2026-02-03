import { appLogger } from '@main/logging/logger';
import { Loader2 } from 'lucide-react';
import React, { memo, useEffect, useMemo, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { AppSettings } from '@/types';
import { CodexUsage, CopilotQuota, QuotaResponse } from '@/types/quota';

import { AccountWrapper, DetailedStats, TimeStats } from '../types';

import { AntigravityCard } from './statistics/AntigravityCard';
import { ClaudeCard } from './statistics/ClaudeCard';
import { CodexCard } from './statistics/CodexCard';
import { CopilotCard } from './statistics/CopilotCard';
import { OverviewCards } from './statistics/OverviewCards';
import { ProjectBarChart } from './statistics/ProjectBarChart';
import { TokenUsageChart } from './statistics/TokenUsageChart';

type StatsPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
const PERIODS: StatsPeriod[] = ['daily', 'weekly', 'monthly', 'yearly'];

interface PeriodSelectorProps {
    period: StatsPeriod;
    onChange: (p: StatsPeriod) => void;
    t: (key: string) => string;
}

// PERF-002-3: Memoize PeriodSelector to prevent unnecessary re-renders
const PeriodSelector: React.FC<PeriodSelectorProps> = memo(({ period, onChange, t }) => (
    <div className="flex bg-muted/20 rounded-lg p-1 border border-border/40">
        {PERIODS.map((p) => (
            <button
                key={p}
                onClick={() => onChange(p)}
                className={cn(
                    "px-3 py-1 text-xs rounded-md capitalize transition-all",
                    period === p
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'hover:bg-muted/30 text-muted-foreground'
                )}
            >
                {t(`statistics.${p}`)}
            </button>
        ))}
    </div>
));
PeriodSelector.displayName = 'PeriodSelector';

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
    projects: Array<{ id: string; title: string }>;
    statsPeriod: StatsPeriod;
    setStatsPeriod: (p: StatsPeriod) => void;
    t: (key: string) => string;
}

// PERF-002-3: Memoize CodingTimeCard to prevent unnecessary re-renders
const CodingTimeCard: React.FC<CodingTimeCardProps> = memo(({ timeStats, loadingTimeStats, projects, statsPeriod, setStatsPeriod, t }) => {
    // PERF-002-3: Memoize expensive computation of sorted projects with time
    const projectsWithTime = useMemo(() => {
        if (!timeStats?.projectCodingTime) { return []; }
        return Object.entries(timeStats.projectCodingTime)
            .sort(([, a], [, b]) => b - a)
            .map(([projectId, time]) => ({
                id: projectId,
                title: projects.find(p => p.id === projectId)?.title ?? t('statistics.unknownProject'),
                time
            }));
    }, [timeStats, projects, t]);

    // PERF-002-3: Memoize max time calculation
    const maxTime = useMemo(() => {
        if (!timeStats?.projectCodingTime) { return 0; }
        return Math.max(...Object.values(timeStats.projectCodingTime), 0);
    }, [timeStats]);

    if (!timeStats?.projectCodingTime || Object.keys(timeStats.projectCodingTime).length === 0) {
        return null;
    }

    return (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-lg font-semibold">{t('statistics.codingTimeByProject')}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{t('statistics.timeSpentCodingInEachProject')}</p>
                </div>
                <PeriodSelector period={statsPeriod} onChange={setStatsPeriod} t={t} />
            </CardHeader>
            <CardContent>
                {loadingTimeStats ? (
                    <div className="h-64 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                ) : (
                    <ProjectBarChart
                        projects={projectsWithTime}
                        maxTime={maxTime}
                    />
                )}
            </CardContent>
        </Card>
    );
});
CodingTimeCard.displayName = 'CodingTimeCard';

interface TokenUsageCardProps {
    statsLoading: boolean;
    tokenTimeline?: DetailedStats['tokenTimeline'];
    statsPeriod: StatsPeriod;
    setStatsPeriod: (p: StatsPeriod) => void;
    t: (key: string) => string;
}

// PERF-002-3: Memoize TokenUsageCard to prevent unnecessary re-renders
const TokenUsageCard: React.FC<TokenUsageCardProps> = memo(({ statsLoading, tokenTimeline, statsPeriod, setStatsPeriod, t }) => (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="text-lg font-semibold">{t('statistics.tokenUsageOverTime')}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{t('statistics.visualizeTokenConsumption')}</p>
            </div>
            <PeriodSelector period={statsPeriod} onChange={setStatsPeriod} t={t} />
        </CardHeader>
        <CardContent className="min-h-[300px]">
            {statsLoading ? (
                <div className="h-64 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
            ) : (
                <TokenUsageChart tokenTimeline={tokenTimeline ?? []} t={t} period={statsPeriod} />
            )}
        </CardContent>
    </Card>
));
TokenUsageCard.displayName = 'TokenUsageCard';

export const StatisticsTab: React.FC<StatisticsTabProps> = memo(({
    statsLoading, statsData, quotaData, copilotQuota, codexUsage, claudeQuota, statsPeriod, setStatsPeriod, settings, setReloadTrigger
}) => {
    const { t } = useTranslation(settings?.general.language ?? 'en');
    const [timeStats, setTimeStats] = useState<TimeStats | null>(null);
    const [loadingTimeStats, setLoadingTimeStats] = useState(false);
    const [projects, setProjects] = useState<Array<{ id: string; title: string }>>([]);

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
        void loadTimeStats();

        const loadProjects = async () => {
            try {
                const projs = await window.electron.db.getProjects();
                setProjects(projs);
            } catch (error) {
                appLogger.error('StatisticsTab', 'Failed to load projects', error as Error);
            }
        };
        void loadProjects();
    }, []);

    // PERF-002-3: Memoize locale to prevent re-computation on every render
    const locale = useMemo(() =>
        settings?.general.language === 'tr' ? 'tr-TR' : 'en-US',
        [settings?.general.language]
    );

    if (statsLoading && !statsData) {
        return <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <OverviewCards
                t={t}
                statsData={statsData}
                timeStats={timeStats}
                loadingTimeStats={loadingTimeStats}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AntigravityCard t={t} quotaData={quotaData} setReloadTrigger={setReloadTrigger} locale={locale} />
                <ClaudeCard claudeQuota={claudeQuota} locale={locale} />
                <CopilotCard copilotQuota={copilotQuota} />
                <CodexCard codexUsage={codexUsage} locale={locale} />
            </div>

            <CodingTimeCard
                timeStats={timeStats}
                loadingTimeStats={loadingTimeStats}
                projects={projects}
                statsPeriod={statsPeriod}
                setStatsPeriod={setStatsPeriod}
                t={t}
            />

            <TokenUsageCard
                statsLoading={statsLoading}
                tokenTimeline={statsData?.tokenTimeline}
                statsPeriod={statsPeriod}
                setStatsPeriod={setStatsPeriod}
                t={t}
            />
        </div>
    );
});

StatisticsTab.displayName = 'StatisticsTab';
