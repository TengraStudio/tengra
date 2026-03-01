/**
 * Token Usage Dashboard (IDEA-064)
 * Displays token usage statistics, estimated costs, and usage by provider.
 */

import React, { useMemo } from 'react';

import { useTranslation } from '@/i18n';

/** Token usage record for a single provider */
interface ProviderUsage {
    provider: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
}

interface TokenUsageDashboardProps {
    /** Usage data grouped by provider */
    providerUsages: ProviderUsage[];
    /** Daily token totals for trend display (last 7 entries) */
    dailyTrend: Array<{ label: string; tokens: number }>;
}

/** Format large numbers with K/M suffixes */
function formatTokenCount(count: number): string {
    if (count >= 1_000_000) {
        return `${(count / 1_000_000).toFixed(1)}M`;
    }
    if (count >= 1_000) {
        return `${(count / 1_000).toFixed(1)}K`;
    }
    return count.toString();
}

/** Format USD cost for display */
function formatCost(costUsd: number): string {
    if (costUsd < 0.0001) {
        return '<$0.0001';
    }
    if (costUsd < 0.01) {
        return `$${costUsd.toFixed(4)}`;
    }
    if (costUsd < 1) {
        return `$${costUsd.toFixed(3)}`;
    }
    return `$${costUsd.toFixed(2)}`;
}

const PROVIDER_COLORS: Record<string, string> = {
    openai: 'bg-green-500',
    anthropic: 'bg-orange-500',
    google: 'bg-blue-500',
    meta: 'bg-indigo-500',
    mistral: 'bg-purple-500',
    deepseek: 'bg-cyan-500',
    unknown: 'bg-muted-foreground',
};

function getProviderColor(provider: string): string {
    return PROVIDER_COLORS[provider.toLowerCase()] ?? PROVIDER_COLORS.unknown;
}

const TokenUsageDashboard: React.FC<TokenUsageDashboardProps> = ({ providerUsages, dailyTrend }) => {
    const { t } = useTranslation();

    const totals = useMemo(() => {
        let inputTokens = 0;
        let outputTokens = 0;
        let costUsd = 0;
        for (const u of providerUsages) {
            inputTokens += u.inputTokens;
            outputTokens += u.outputTokens;
            costUsd += u.estimatedCostUsd;
        }
        return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, costUsd };
    }, [providerUsages]);

    const maxTrend = useMemo(() => Math.max(...dailyTrend.map(d => d.tokens), 1), [dailyTrend]);
    const maxProviderTokens = useMemo(
        () => Math.max(...providerUsages.map(u => u.inputTokens + u.outputTokens), 1),
        [providerUsages]
    );

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-foreground">{t('tokenUsageDashboard.title')}</h3>
                <p className="text-xs text-muted-foreground">{t('tokenUsageDashboard.subtitle')}</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryCard label={t('tokenUsageDashboard.inputTokens')} value={formatTokenCount(totals.inputTokens)} />
                <SummaryCard label={t('tokenUsageDashboard.outputTokens')} value={formatTokenCount(totals.outputTokens)} />
                <SummaryCard label={t('tokenUsageDashboard.totalTokens')} value={formatTokenCount(totals.totalTokens)} />
                <SummaryCard label={t('tokenUsageDashboard.estimatedCost')} value={formatCost(totals.costUsd)} />
            </div>

            {/* Usage by provider */}
            <div className="rounded-xl border border-border/40 bg-card/50 p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">{t('tokenUsageDashboard.byProvider')}</h4>
                {providerUsages.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('tokenUsageDashboard.noData')}</p>
                ) : (
                    <div className="space-y-2">
                        {providerUsages.map((u) => {
                            const total = u.inputTokens + u.outputTokens;
                            const pct = Math.round((total / maxProviderTokens) * 100);
                            return (
                                <div key={u.provider} className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="font-medium text-foreground capitalize">{u.provider}</span>
                                        <span className="text-muted-foreground">
                                            {formatTokenCount(total)} &middot; {formatCost(u.estimatedCostUsd)}
                                        </span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted/20 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${getProviderColor(u.provider)} transition-all`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Usage trend */}
            <div className="rounded-xl border border-border/40 bg-card/50 p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">{t('tokenUsageDashboard.usageTrend')}</h4>
                {dailyTrend.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('tokenUsageDashboard.noData')}</p>
                ) : (
                    <div className="flex items-end gap-1 h-24">
                        {dailyTrend.map((day) => {
                            const heightPct = Math.max((day.tokens / maxTrend) * 100, 2);
                            return (
                                <div key={day.label} className="flex-1 flex flex-col items-center gap-1">
                                    <div
                                        className="w-full rounded-t bg-primary/80 transition-all"
                                        style={{ height: `${heightPct}%` }}
                                        title={`${day.label}: ${formatTokenCount(day.tokens)}`}
                                    />
                                    <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                                        {day.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

/** Small summary card for top-level metrics */
const SummaryCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="rounded-xl border border-border/40 bg-card/50 p-3 text-center">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</p>
        <p className="text-lg font-black text-foreground mt-1">{value}</p>
    </div>
);

export default TokenUsageDashboard;
