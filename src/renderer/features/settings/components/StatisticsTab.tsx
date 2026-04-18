/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Badge } from '@renderer/components/ui/badge';
import {
    Activity,
    BarChart3,
    Calendar,
    Clock,
    Loader2,
    TrendingUp
} from 'lucide-react';
import React, { memo } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { AppSettings } from '@/types';

import { DetailedStats } from '../types';

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
    statsLoading: boolean;
    statsData: DetailedStats | null;
    statsPeriod: StatisticsPeriod;
    setStatsPeriod: (p: StatisticsPeriod) => void;
    settings: AppSettings | null;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = memo(
    ({ period, onChange, t }) => (
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/20 bg-muted/10 p-1.5">
            {PERIODS.map(value => {
                const isActive = period === value;
                return (
                    <button
                        key={value}
                        onClick={() => onChange(value)}
                        className={cn(
                            'relative h-9 overflow-hidden rounded-xl px-4 typo-body font-medium transition-colors',
                            isActive
                                ? 'bg-background text-primary'
                                : 'text-muted-foreground/60 hover:bg-muted/20 hover:text-foreground'
                        )}
                    >
                        {isActive && (
                            <div className="absolute inset-0 bg-primary/10 animate-in fade-in zoom-in duration-500" />
                        )}
                        <span className="relative z-10">{t(`statistics.${value}`)}</span>
                        {isActive && (
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-primary rounded-full" />
                        )}
                    </button>
                );
            })}
        </div>
    )
);
PeriodSelector.displayName = 'PeriodSelector';

export const StatisticsTab: React.FC<StatisticsTabProps> = memo(
    ({ statsLoading, statsData, statsPeriod, setStatsPeriod, settings }) => {
        const { t } = useTranslation(settings?.general.language ?? 'en');

        if (statsLoading && !statsData) {
            return (
                <div className="flex flex-col h-96 items-center justify-center space-y-6">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <div className="typo-body font-medium text-muted-foreground/50 animate-pulse">
                        {t('statistics.synchronizingMetrics')}
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out pb-16">
                <div className="flex flex-col gap-6 px-1 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="mb-3 flex items-center gap-4">
                            <div className="rounded-2xl bg-primary/10 p-3.5 text-primary">
                                <BarChart3 className="w-7 h-7" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-semibold text-foreground leading-none">
                                    {t('statistics.title')}
                                </h3>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="h-1 w-8 bg-primary rounded-full" />
                                    <p className="typo-body font-medium text-muted-foreground opacity-60">
                                        {t('statistics.telemetryAnalytics')}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <p className="max-w-lg text-sm leading-relaxed text-muted-foreground/70">
                            {t('statistics.visualizeTokenConsumption')}
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 px-1">
                            <Calendar className="w-3 h-3 text-primary/60" />
                            <span className="typo-body font-medium text-muted-foreground/60">{t('statistics.temporalFilter')}</span>
                        </div>
                        <PeriodSelector
                            period={statsPeriod}
                            onChange={setStatsPeriod}
                            t={t}
                        />
                    </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-border/30 bg-card p-6 sm:p-8">
                    <div className="relative z-10 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <Activity className="w-4 h-4 text-primary" />
                            <h4 className="typo-body font-medium text-muted-foreground/60">{t('statistics.consumptionMatrix')}</h4>
                        </div>
                        <Badge variant="outline" className="h-5 border-primary/20 px-2 typo-body font-medium text-primary">{t('statistics.liveFeed')}</Badge>
                    </div>

                    <div className="relative z-10 mt-6">
                        <OverviewCards t={t} statsData={statsData} />
                    </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-border/30 bg-card p-6 sm:p-8">
                    <div className="relative z-10 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="w-4 h-4 text-primary" />
                            <h4 className="typo-body font-medium text-muted-foreground/60">{t('statistics.propagationCurve')}</h4>
                        </div>
                        <div className="flex items-center gap-2 typo-body font-medium text-muted-foreground/60">
                            <Clock className="w-3 h-3" />
                            <span>{t('statistics.realtimeTracking')}</span>
                        </div>
                    </div>

                    <div className="relative z-10 mt-6 min-h-80">
                        {statsLoading ? (
                            <div className="flex h-80 items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
                            </div>
                        ) : (
                            <div className="group/graph relative">
                                <div className="relative rounded-3xl border border-border/20 bg-muted/5 p-4 sm:p-6">
                                    <TokenUsageChart
                                        tokenTimeline={statsData?.tokenTimeline ?? []}
                                        t={t}
                                        period={statsPeriod}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }
);

StatisticsTab.displayName = 'StatisticsTab';
