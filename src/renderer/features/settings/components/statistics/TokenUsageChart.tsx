/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconActivity, IconCoins } from '@tabler/icons-react';
import React, { useMemo } from 'react';

import { formatNumber } from '@/lib/formatters';

/* Batch-02: Extracted Long Classes */
const C_TOKENUSAGECHART_1 = "group relative flex h-full min-w-4 flex-1 flex-col justify-end rounded-t-sm transition-colors duration-200 hover:bg-muted/40";
const C_TOKENUSAGECHART_2 = "absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50";
const C_TOKENUSAGECHART_3 = "absolute -bottom-1.5 left-1/2 h-0 w-0 -translate-x-1/2 border-l-6 border-r-6 border-t-6 border-l-transparent border-r-transparent border-t-popover";
const C_TOKENUSAGECHART_4 = "absolute top-full mt-2 left-1/2 -translate-x-1/2 text-sm font-medium text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity";


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
                    <span className="text-sm font-bold text-muted-foreground">{t('frontend.statistics.totalPrompt')}</span>
                    <div className="text-2xl font-bold tabular-nums text-foreground">{formatNumber(totalPrompt)}</div>
                </div>
                <div className="space-y-1">
                    <span className="text-sm font-bold text-muted-foreground">{t('frontend.statistics.totalCompletion')}</span>
                    <div className="text-2xl font-bold tabular-nums text-foreground">{formatNumber(totalCompletion)}</div>
                </div>
                <div className="space-y-1">
                    <span className="flex items-center gap-1 text-sm font-bold text-muted-foreground">
                        <IconCoins className="w-3 h-3 text-warning" />
                        {t('frontend.statistics.cost')}
                    </span>
                    <div className="text-2xl font-bold tabular-nums text-foreground">
                        ${estimatedCost < 0.01 ? '<0.01' : estimatedCost.toFixed(2)}
                    </div>
                </div>
                <div className="space-y-1">
                    <span className="flex items-center gap-1 text-sm font-bold text-muted-foreground">
                        <IconActivity className="w-3 h-3 text-info" />
                        {t('frontend.statistics.activity')}
                    </span>
                    <div className="text-2xl font-bold tabular-nums text-foreground">
                        {sortedData.filter(d => (d.promptTokens + d.completionTokens) > 0).length} <span className="typo-caption text-muted-foreground font-medium">{t('frontend.statistics.sessions')}</span>
                    </div>
                </div>
            </div>

            <div className="relative h-240 w-full pt-4">
                <div className="absolute right-0 top-0 z-10 flex items-center gap-4">
                    <div className="flex items-center gap-2 rounded-full border border-border/30 bg-background px-2 py-1">
                        <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                        <span className="text-sm font-bold text-muted-foreground">{t('frontend.statistics.input')}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-border/30 bg-background px-2 py-1">
                        <div className="h-2.5 w-2.5 rounded-full bg-success" />
                        <span className="text-sm font-bold text-muted-foreground">{t('frontend.statistics.output')}</span>
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
                            <span className="text-muted-foreground/30 font-medium">{t('frontend.statistics.noDataForPeriod')}</span>
                        </div>
                    ) : (
                        sortedData.map((data) => {
                            const promptHeight = (data.promptTokens / maxTokens) * 100;
                            const completionHeight = (data.completionTokens / maxTokens) * 100;

                            return (
                                <div
                                    key={data.timestamp}
                                    className={C_TOKENUSAGECHART_1}
                                >
                                    <div className={C_TOKENUSAGECHART_2}>
                                        <div className="min-w-140 rounded-xl border border-border/50 bg-popover p-3 shadow-elevated">
                                            <div className="typo-caption font-bold text-foreground mb-2 pb-2 border-b border-border/30 text-center">
                                                {new Date(data.timestamp).toLocaleDateString()}
                                                <span className="block text-sm font-normal text-muted-foreground capitalize mt-0.5 opacity-70">
                                                    {getLabel(data.timestamp, period, true)}
                                                </span>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center gap-3">
                                                    <span className="text-sm font-bold text-primary">{t('frontend.statistics.input')}</span>
                                                    <span className="typo-caption font-mono font-bold">{formatNumber(data.promptTokens)}</span>
                                                </div>
                                                <div className="flex justify-between items-center gap-3">
                                                    <span className="text-sm font-bold text-success">{t('frontend.statistics.output')}</span>
                                                    <span className="typo-caption font-mono font-bold">{formatNumber(data.completionTokens)}</span>
                                                </div>
                                                {data.modelBreakdown && Object.keys(data.modelBreakdown).length > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-border/20 space-y-1">
                                                        {Object.entries(data.modelBreakdown).map(([model, usage]) => (
                                                            <div key={model} className="flex justify-between items-center gap-2">
                                                                <span className="text-sm text-muted-foreground truncate max-w-80" title={model}>{model}</span>
                                                                <span className="text-sm font-mono opacity-80">{formatNumber(usage.prompt + usage.completion)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className={C_TOKENUSAGECHART_3} />
                                    </div>

                                    <div className="relative flex h-full w-full flex-col justify-end px-1px">
                                        <div
                                            className="w-full rounded-t-2px bg-success/85"
                                            style={{
                                                height: `${completionHeight}%`,
                                                minHeight: data.completionTokens > 0 ? '2px' : '0'
                                            }}
                                        />
                                        <div
                                            className="mt-1px w-full rounded-b-1px bg-primary/85"
                                            style={{
                                                height: `${promptHeight}%`,
                                                minHeight: data.promptTokens > 0 ? '2px' : '0'
                                            }}
                                        />
                                    </div>

                                    <div className={C_TOKENUSAGECHART_4}>
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

