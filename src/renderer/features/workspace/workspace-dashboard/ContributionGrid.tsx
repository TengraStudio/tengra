/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React, { useMemo } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface ContributionGridProps {
    commitCounts: Record<string, number>;
    className?: string;
}

export const ContributionGrid: React.FC<ContributionGridProps> = ({ commitCounts, className }) => {
    const { t } = useTranslation();
    // Generate dates for the last 365 days
    const { gridData, maxCommits } = useMemo(() => {
        const today = new Date();
        const dates: Date[] = [];

        // Generate 365 days
        for (let i = 364; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            dates.push(date);
        }

        // Get commit counts per date
        const data = dates.map(date => {
            const dateStr = date.toISOString().split('T')[0];
            return {
                date: dateStr,
                dateObj: date,
                count: (commitCounts[dateStr] ?? 0) as number,
            };
        });

        // Find max commits for color intensity
        const max = Math.max(...data.map(d => d.count), 1);

        return { gridData: data, maxCommits: max };
    }, [commitCounts]);

    // Group by weeks (7 days per row)
    const weeks = useMemo(() => {
        type DayData = { date: string; dateObj: Date; count: number };
        const weeksArray: DayData[][] = [];
        for (let i = 0; i < gridData.length; i += 7) {
            weeksArray.push(gridData.slice(i, i + 7));
        }
        return weeksArray;
    }, [gridData]);

    // Get month labels
    const monthLabels = useMemo(() => {
        const monthNames = [
            t('frontend.workspaceDashboard.contributions.months.jan'),
            t('frontend.workspaceDashboard.contributions.months.feb'),
            t('frontend.workspaceDashboard.contributions.months.mar'),
            t('frontend.workspaceDashboard.contributions.months.apr'),
            t('frontend.workspaceDashboard.contributions.months.may'),
            t('frontend.workspaceDashboard.contributions.months.jun'),
            t('frontend.workspaceDashboard.contributions.months.jul'),
            t('frontend.workspaceDashboard.contributions.months.aug'),
            t('frontend.workspaceDashboard.contributions.months.sep'),
            t('frontend.workspaceDashboard.contributions.months.oct'),
            t('frontend.workspaceDashboard.contributions.months.nov'),
            t('frontend.workspaceDashboard.contributions.months.dec'),
        ];
        const labels: { month: string; index: number }[] = [];
        let lastMonth = -1;

        weeks.forEach((week, weekIndex) => {
            if (week.length > 0) {
                const firstDay = week[0].dateObj;
                const month = firstDay.getMonth();
                if (month !== lastMonth) {
                    labels.push({ month: monthNames[month], index: weekIndex });
                    lastMonth = month;
                }
            }
        });

        return labels;
    }, [weeks, t]);

    // Get color intensity based on commit count
    const getColorIntensity = (count: number): string => {
        if (count === 0) {
            return 'bg-muted/10 border border-muted/20';
        }

        const intensity = Math.min(count / maxCommits, 1);

        if (intensity < 0.25) {
            return 'bg-success/20 border border-success/30';
        }
        if (intensity < 0.5) {
            return 'bg-success/40 border border-success/50';
        }
        if (intensity < 0.75) {
            return 'bg-success/60 border border-success/70';
        }
        return 'bg-success border border-success';
    };

    const totalContributions = Object.values(commitCounts).reduce((sum, count) => sum + count, 0);

    return (
        <div className={cn('space-y-4', className)}>
            <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">
                    {t('frontend.workspaceDashboard.contributions.lastYear', { count: totalContributions })}
                </div>
            </div>

            <div className="flex gap-1 items-start">
                {/* Day labels */}
                <div className="flex flex-col gap-1 pt-2.5 pr-2">
                    <div className="h-2.5" /> {/* Spacer for month labels */}
                    {[
                        t('frontend.workspaceDashboard.contributions.days.mon'),
                        '',
                        t('frontend.workspaceDashboard.contributions.days.wed'),
                        '',
                        t('frontend.workspaceDashboard.contributions.days.fri'),
                        '',
                        t('frontend.workspaceDashboard.contributions.days.sun'),
                    ].map((day, i) => (
                        <div key={i} className="typo-caption text-muted-foreground h-2.5 leading-tight">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-x-auto">
                    <div className="flex gap-1">
                        {weeks.map((week, weekIndex) => (
                            <div key={weekIndex} className="flex flex-col gap-1">
                                {/* Month label */}
                                <div className="h-2.5 typo-caption text-muted-foreground">
                                    {monthLabels.find(m => m.index === weekIndex)?.month ?? ''}
                                </div>
                                {/* Week days */}
                                {week.map((day, dayIndex) => (
                                    <div
                                        key={`${day.date}-${dayIndex}`}
                                        className={cn(
                                            'w-2.5 h-2.5 rounded-sm transition-all hover:scale-125 hover:z-10 relative cursor-pointer',
                                            getColorIntensity(day.count)
                                        )}
                                        title={t('frontend.workspaceDashboard.contributions.tooltip', {
                                            count: day.count,
                                            date: day.date,
                                        })}
                                    />
                                ))}
                                {/* Fill remaining days if week is incomplete */}
                                {week.length < 7 && <div className="flex-1" />}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 typo-caption text-muted-foreground">
                <span>{t('frontend.workspaceDashboard.contributions.legendLess')}</span>
                <div className="flex gap-0.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-muted/10 border border-muted/20" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-success/20 border border-success/30" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-success/40 border border-success/50" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-success/60 border border-success/70" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-success border border-success" />
                </div>
                <span>{t('frontend.workspaceDashboard.contributions.legendMore')}</span>
            </div>
        </div>
    );
};
