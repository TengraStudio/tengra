import React, { useMemo } from 'react';

import { cn } from '@/lib/utils';

interface ContributionGridProps {
    commitCounts: Record<string, number>
    className?: string
}

export const ContributionGrid: React.FC<ContributionGridProps> = ({ commitCounts, className }) => {
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
                count: (commitCounts[dateStr] ?? 0) as number
            };
        });

        // Find max commits for color intensity
        const max = Math.max(...data.map(d => d.count), 1);

        return { gridData: data, maxCommits: max };
    }, [commitCounts]);

    // Group by weeks (7 days per row)
    const weeks = useMemo(() => {
        type DayData = { date: string; dateObj: Date; count: number }
        const weeksArray: DayData[][] = [];
        for (let i = 0; i < gridData.length; i += 7) {
            weeksArray.push(gridData.slice(i, i + 7));
        }
        return weeksArray;
    }, [gridData]);

    // Get month labels
    const monthLabels = useMemo(() => {
        const labels: { month: string; index: number }[] = [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
    }, [weeks]);

    // Get color intensity based on commit count
    const getColorIntensity = (count: number): string => {
        if (count === 0) { return 'bg-muted/10 border border-muted/20'; }

        const intensity = Math.min(count / maxCommits, 1);

        if (intensity < 0.25) { return 'bg-success/20 border border-success/30'; }
        if (intensity < 0.5) { return 'bg-success/40 border border-success/50'; }
        if (intensity < 0.75) { return 'bg-success/60 border border-success/70'; }
        return 'bg-success border border-emerald-400';
    };

    const totalContributions = Object.values(commitCounts).reduce((sum, count) => sum + count, 0);

    return (
        <div className={cn("space-y-4", className)}>
            <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">
                    {totalContributions} contributions in the last year
                </div>
            </div>

            <div className="flex gap-1 items-start">
                {/* Day labels */}
                <div className="flex flex-col gap-1 pt-2.5 pr-2">
                    <div className="h-2.5" /> {/* Spacer for month labels */}
                    {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((day, i) => (
                        <div key={i} className="text-xs text-muted-foreground h-2.5 leading-tight">
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
                                <div className="h-2.5 text-xs text-muted-foreground">
                                    {monthLabels.find(m => m.index === weekIndex)?.month ?? ''}
                                </div>
                                {/* Week days */}
                                {week.map((day, dayIndex) => (
                                    <div
                                        key={`${day.date}-${dayIndex}`}
                                        className={cn(
                                            "w-2.5 h-2.5 rounded-sm transition-all hover:scale-125 hover:z-10 relative cursor-pointer",
                                            getColorIntensity(day.count)
                                        )}
                                        title={`${day.count} contribution${day.count !== 1 ? 's' : ''} on ${day.date}`}
                                    />
                                ))}
                                {/* Fill remaining days if week is incomplete */}
                                {week.length < 7 && (
                                    <div className="flex-1" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Less</span>
                <div className="flex gap-0.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-muted/10 border border-muted/20" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-success/20 border border-success/30" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-success/40 border border-success/50" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-success/60 border border-success/70" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-success border border-emerald-400" />
                </div>
                <span>More</span>
            </div>
        </div>
    );
};
