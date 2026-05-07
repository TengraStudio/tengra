/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconActivity, IconCalendar, IconChartBar, IconClock, IconLoader2, IconTrendingUp } from '@tabler/icons-react';
import React, { memo } from 'react';

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { AppSettings } from '@/types';

import { DetailedStats } from '../types';

import { OverviewCards } from './statistics/OverviewCards';
import { TokenUsageChart } from './statistics/TokenUsageChart';
import {
    SettingsPanel,
    SettingsTabHeader,
    SettingsTabLayout,
} from './SettingsPrimitives';

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
                    <IconLoader2 className="h-12 w-12 animate-spin text-primary" />
                    <div className="typo-body font-medium text-muted-foreground/50 animate-pulse">
                        {t('frontend.statistics.synchronizingMetrics')}
                    </div>
                </div>
            );
        }

        return (
            <SettingsTabLayout className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <SettingsTabHeader
                    title={t('frontend.statistics.title')}
                    description={t('frontend.statistics.visualizeTokenConsumption')}
                    icon={IconChartBar}
                    actions={(
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 px-1">
                                <IconCalendar className="h-3 w-3 text-primary/60" />
                                <span className="text-sm font-medium text-muted-foreground/65">{t('frontend.statistics.temporalFilter')}</span>
                            </div>
                            <PeriodSelector
                                period={statsPeriod}
                                onChange={setStatsPeriod}
                                t={t}
                            />
                        </div>
                    )}
                />

                <SettingsPanel
                    title={t('frontend.statistics.consumptionMatrix')}
                    icon={IconActivity}
                    actions={<Badge variant="outline" className="h-5 border-primary/20 px-2 text-xs font-medium text-primary">{t('frontend.statistics.liveFeed')}</Badge>}
                >
                    <OverviewCards t={t} statsData={statsData} />
                </SettingsPanel>

                <SettingsPanel
                    title={t('frontend.statistics.propagationCurve')}
                    icon={IconTrendingUp}
                    actions={(
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground/65">
                            <IconClock className="h-3 w-3" />
                            <span>{t('frontend.statistics.realtimeTracking')}</span>
                        </div>
                    )}
                >
                    <div className="min-h-80">
                        {statsLoading ? (
                            <div className="flex h-80 items-center justify-center">
                                <IconLoader2 className="h-6 w-6 animate-spin text-primary/40" />
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-border/15 bg-muted/10 p-4 sm:p-6">
                                <TokenUsageChart
                                    tokenTimeline={statsData?.tokenTimeline ?? []}
                                    t={t}
                                    period={statsPeriod}
                                />
                            </div>
                        )}
                    </div>
                </SettingsPanel>
            </SettingsTabLayout>
        );
    }
);

StatisticsTab.displayName = 'StatisticsTab';

