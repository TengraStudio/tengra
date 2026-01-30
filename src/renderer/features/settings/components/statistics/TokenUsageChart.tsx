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
    // 1. Calculate Max for scaling
    const maxTokens = useMemo(() => Math.max(...tokenTimeline.map(d => d.promptTokens + d.completionTokens), 100), [tokenTimeline]);

    // 2. Sort Data
    const sortedData = useMemo(() => [...tokenTimeline].sort((a, b) => a.timestamp - b.timestamp), [tokenTimeline]);

    // 3. Calculate Totals & Cost
    const totalPrompt = useMemo(() => sortedData.reduce((acc, curr) => acc + curr.promptTokens, 0), [sortedData]);
    const totalCompletion = useMemo(() => sortedData.reduce((acc, curr) => acc + curr.completionTokens, 0), [sortedData]);

    // Rough estimate: $2.50/1M input, $10.00/1M output (Avg of GPT-4o / Claude 3.5 Sonnet mixed)
    const estimatedCost = useMemo(() => {
        return ((totalPrompt / 1_000_000) * 2.5) + ((totalCompletion / 1_000_000) * 10);
    }, [totalPrompt, totalCompletion]);

    return (
        <div className="space-y-6">
            {/* Header Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-border/40">
                <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('statistics.totalPrompt')}</span>
                    <div className="text-2xl font-black tabular-nums text-primary">{formatNumber(totalPrompt)}</div>
                </div>
                <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('statistics.totalCompletion')}</span>
                    <div className="text-2xl font-black tabular-nums text-success">{formatNumber(totalCompletion)}</div>
                </div>
                <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                        <Coins className="w-3 h-3 text-warning" />
                        {t('statistics.cost')}
                    </span>
                    <div className="text-2xl font-black tabular-nums text-foreground">
                        ${estimatedCost < 0.01 ? '<0.01' : estimatedCost.toFixed(2)}
                    </div>
                </div>
                <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                        <Activity className="w-3 h-3 text-purple" />
                        Activity
                    </span>
                    <div className="text-2xl font-black tabular-nums text-foreground">
                        {sortedData.filter(d => (d.promptTokens + d.completionTokens) > 0).length} <span className="text-xs text-muted-foreground font-medium">sessions</span>
                    </div>
                </div>
            </div>

            {/* Chart Area */}
            <div className="relative h-[240px] w-full pt-4">
                {/* Legend Overlay */}
                <div className="absolute top-0 right-0 flex items-center gap-4 z-10">
                    <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-background/50 backdrop-blur border border-border/30">
                        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Input</span>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-background/50 backdrop-blur border border-border/30">
                        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Output</span>
                    </div>
                </div>

                {/* Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                    <div className="w-full h-px bg-border/50 border-t border-dashed border-border" />
                    <div className="w-full h-px bg-border/50 border-t border-dashed border-border" />
                    <div className="w-full h-px bg-border/50 border-t border-dashed border-border" />
                    <div className="w-full h-px bg-border/50 border-t border-dashed border-border" />
                    <div className="w-full h-px bg-border/50 border-t border-dashed border-border" />
                </div>

                {/* Bars Container */}
                <div className="absolute inset-0 flex items-end justify-between gap-1 pt-6 pb-6 pl-1 pr-1 overflow-visible">
                    {sortedData.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center">
                            <span className="text-muted-foreground/30 italic font-medium">{t('statistics.noDataForPeriod')}</span>
                        </div>
                    ) : (
                        sortedData.map((data, idx) => {
                            const promptHeight = (data.promptTokens / maxTokens) * 100;
                            const completionHeight = (data.completionTokens / maxTokens) * 100;

                            // Animation delay
                            const delay = Math.min(idx * 0.05, 1.5); // Cap max delay

                            return (
                                <div
                                    key={idx}
                                    className="relative flex-1 group flex flex-col justify-end h-full min-w-[4px] rounded-t-sm hover:bg-white/5 transition-colors duration-200"
                                >
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50">
                                        <div className="bg-popover/90 backdrop-blur-xl border border-border/50 rounded-xl p-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] min-w-[140px] animate-in zoom-in-95 duration-200">
                                            <div className="text-xs font-bold text-foreground mb-2 pb-2 border-b border-border/30 text-center">
                                                {new Date(data.timestamp).toLocaleDateString()}
                                                <span className="block text-[9px] font-normal text-muted-foreground capitalize mt-0.5 opacity-70">
                                                    {getLabel(data.timestamp, period, true)}
                                                </span>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center gap-3">
                                                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Input</span>
                                                    <span className="text-xs font-mono font-bold">{formatNumber(data.promptTokens)}</span>
                                                </div>
                                                <div className="flex justify-between items-center gap-3">
                                                    <span className="text-[10px] font-bold text-success uppercase tracking-wider">Output</span>
                                                    <span className="text-xs font-mono font-bold">{formatNumber(data.completionTokens)}</span>
                                                </div>
                                                {data.modelBreakdown && Object.keys(data.modelBreakdown).length > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-border/20 space-y-1">
                                                        {Object.entries(data.modelBreakdown).map(([model, usage]) => (
                                                            <div key={model} className="flex justify-between items-center gap-2">
                                                                <span className="text-[9px] text-muted-foreground truncate max-w-[80px]" title={model}>{model}</span>
                                                                <span className="text-[9px] font-mono opacity-80">{formatNumber(usage.prompt + usage.completion)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Tooltip Arrow */}
                                        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-popover/80 absolute left-1/2 -translate-x-1/2 -bottom-1.5 backdrop-blur-xl" />
                                    </div>

                                    {/* Stacks */}
                                    <div className="w-full px-[1px] flex flex-col justify-end h-full relative group-hover:scale-y-[1.02] transition-transform origin-bottom duration-300">
                                        <div
                                            className="w-full rounded-t-[2px] bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                                            style={{
                                                height: `${completionHeight}%`,
                                                minHeight: data.completionTokens > 0 ? '2px' : '0',
                                                opacity: 0,
                                                animation: `growUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards ${delay}s`
                                            }}
                                        />
                                        <div
                                            className="w-full rounded-b-[1px] bg-gradient-to-tr from-blue-600 to-cyan-400 shadow-[0_0_10px_rgba(59,130,246,0.2)] mt-[1px]"
                                            style={{
                                                height: `${promptHeight}%`,
                                                minHeight: data.promptTokens > 0 ? '2px' : '0',
                                                opacity: 0,
                                                animation: `growUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards ${delay + 0.1}s`
                                            }}
                                        />
                                    </div>

                                    {/* X-Axis Label (Sparse) */}
                                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 text-[9px] font-medium text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {getSimpleLabel(data.timestamp, period)}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Custom Styles for Animation */}
            <style>{`
                @keyframes growUp {
                    from { height: 0; opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
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
