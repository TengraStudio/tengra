import { Activity, Coins } from 'lucide-react';
import React, { useMemo } from 'react';

import { formatNumber } from '@/lib/formatters';

interface TokenUsageChartProps {
    tokenTimeline: Array<{
        timestamp: number;
        promptTokens: number;
        completionTokens: number;
        modelBreakdown?: Record<string, { prompt: number; completion: number }>
    }>
    t: (key: string) => string
    period: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export const TokenUsageChart: React.FC<TokenUsageChartProps> = ({ tokenTimeline, t, period }) => {
    const maxTokens = useMemo(() => Math.max(...tokenTimeline.map(d => d.promptTokens + d.completionTokens), 100), [tokenTimeline]);
    const sortedData = useMemo(() => [...tokenTimeline].sort((a, b) => a.timestamp - b.timestamp), [tokenTimeline]);
    const totalPrompt = useMemo(() => sortedData.reduce((acc, curr) => acc + curr.promptTokens, 0), [sortedData]);
    const totalCompletion = useMemo(() => sortedData.reduce((acc, curr) => acc + curr.completionTokens, 0), [sortedData]);
    const estimatedCost = useMemo(() => {
        return ((totalPrompt / 1_000_000) * 2.5) + ((totalCompletion / 1_000_000) * 10);
    }, [totalPrompt, totalCompletion]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 border-b border-border/40 pb-4 md:grid-cols-4">
                <div className="space-y-1">
                    <span className="text-xxs font-bold uppercase tracking-widest text-muted-foreground">{t('statistics.totalPrompt')}</span>
                    <div className="text-2xl font-black tabular-nums text-foreground">{formatNumber(totalPrompt)}</div>
                </div>
                <div className="space-y-1">
                    <span className="text-xxs font-bold uppercase tracking-widest text-muted-foreground">{t('statistics.totalCompletion')}</span>
                    <div className="text-2xl font-black tabular-nums text-foreground">{formatNumber(totalCompletion)}</div>
                </div>
                <div className="space-y-1">
                    <span className="flex items-center gap-1 text-xxs font-bold uppercase tracking-widest text-muted-foreground">
                        <Coins className="w-3 h-3 text-warning" />
                        {t('statistics.cost')}
                    </span>
                    <div className="text-2xl font-black tabular-nums text-foreground">
                        ${estimatedCost < 0.01 ? '<0.01' : estimatedCost.toFixed(2)}
                    </div>
                </div>
                <div className="space-y-1">
                    <span className="flex items-center gap-1 text-xxs font-bold uppercase tracking-widest text-muted-foreground">
                        <Activity className="w-3 h-3 text-info" />
                        {t('statistics.activity')}
                    </span>
                    <div className="text-2xl font-black tabular-nums text-foreground">
                        {sortedData.filter(d => (d.promptTokens + d.completionTokens) > 0).length} <span className="text-xs text-muted-foreground font-medium">{t('statistics.sessions')}</span>
                    </div>
                </div>
            </div>

            <div className="relative h-[240px] w-full pt-4">
                <div className="absolute right-0 top-0 z-10 flex items-center gap-4">
                    <div className="flex items-center gap-2 rounded-full border border-border/30 bg-background px-2 py-1">
                        <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                        <span className="text-xxs font-bold uppercase tracking-wider text-muted-foreground">{t('statistics.input')}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-border/30 bg-background px-2 py-1">
                        <div className="h-2.5 w-2.5 rounded-full bg-success" />
                        <span className="text-xxs font-bold uppercase tracking-wider text-muted-foreground">{t('statistics.output')}</span>
                    </div>
                </div>

                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                    <div className="w-full h-px bg-border/50 border-t border-dashed border-border" />
                    <div className="w-full h-px bg-border/50 border-t border-dashed border-border" />
                    <div className="w-full h-px bg-border/50 border-t border-dashed border-border" />
                    <div className="w-full h-px bg-border/50 border-t border-dashed border-border" />
                    <div className="w-full h-px bg-border/50 border-t border-dashed border-border" />
                </div>

                <div className="absolute inset-0 flex items-end justify-between gap-1 pt-6 pb-6 pl-1 pr-1 overflow-visible">
                    {sortedData.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center">
                            <span className="text-muted-foreground/30 italic font-medium">{t('statistics.noDataForPeriod')}</span>
                        </div>
                    ) : (
                        sortedData.map((data) => {
                            const promptHeight = (data.promptTokens / maxTokens) * 100;
                            const completionHeight = (data.completionTokens / maxTokens) * 100;

                            return (
                                <div
                                    key={data.timestamp}
                                    className="group relative flex h-full min-w-[4px] flex-1 flex-col justify-end rounded-t-sm transition-colors duration-200 hover:bg-white/5"
                                >
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50">
                                        <div className="min-w-[140px] rounded-xl border border-border/50 bg-popover p-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                                            <div className="text-xs font-bold text-foreground mb-2 pb-2 border-b border-border/30 text-center">
                                                {new Date(data.timestamp).toLocaleDateString()}
                                                <span className="block text-xxxs font-normal text-muted-foreground capitalize mt-0.5 opacity-70">
                                                    {getLabel(data.timestamp, period, true)}
                                                </span>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center gap-3">
                                                    <span className="text-xxs font-bold text-primary uppercase tracking-wider">{t('statistics.input')}</span>
                                                    <span className="text-xs font-mono font-bold">{formatNumber(data.promptTokens)}</span>
                                                </div>
                                                <div className="flex justify-between items-center gap-3">
                                                    <span className="text-xxs font-bold text-success uppercase tracking-wider">{t('statistics.output')}</span>
                                                    <span className="text-xs font-mono font-bold">{formatNumber(data.completionTokens)}</span>
                                                </div>
                                                {data.modelBreakdown && Object.keys(data.modelBreakdown).length > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-border/20 space-y-1">
                                                        {Object.entries(data.modelBreakdown).map(([model, usage]) => (
                                                            <div key={model} className="flex justify-between items-center gap-2">
                                                                <span className="text-xxxs text-muted-foreground truncate max-w-[80px]" title={model}>{model}</span>
                                                                <span className="text-xxxs font-mono opacity-80">{formatNumber(usage.prompt + usage.completion)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="absolute -bottom-1.5 left-1/2 h-0 w-0 -translate-x-1/2 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-popover" />
                                    </div>

                                    <div className="relative flex h-full w-full flex-col justify-end px-[1px]">
                                        <div
                                            className="w-full rounded-t-[2px] bg-success/85"
                                            style={{
                                                height: `${completionHeight}%`,
                                                minHeight: data.completionTokens > 0 ? '2px' : '0'
                                            }}
                                        />
                                        <div
                                            className="mt-[1px] w-full rounded-b-[1px] bg-primary/85"
                                            style={{
                                                height: `${promptHeight}%`,
                                                minHeight: data.promptTokens > 0 ? '2px' : '0'
                                            }}
                                        />
                                    </div>

                                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 text-xxxs font-medium text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {getSimpleLabel(data.timestamp, period)}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

function getLabel(ts: number, period: string, full = false) {
    const d = new Date(ts);
    if (period === 'daily') { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    if (period === 'weekly') { return d.toLocaleDateString(undefined, { weekday: full ? 'long' : 'short' }); }
    if (period === 'monthly') { return d.getDate().toString(); }
    return d.toLocaleDateString(undefined, { month: full ? 'long' : 'short' });
}

function getSimpleLabel(ts: number, period: string) {
    const d = new Date(ts);
    if (period === 'daily') { return d.getHours(); }
    if (period === 'weekly') { return d.getDate(); }
    return d.getDate();
}
