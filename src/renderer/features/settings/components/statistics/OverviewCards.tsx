import { Activity, Clock, Loader2, LucideIcon, MessageSquare, TrendingUp } from 'lucide-react';
import React from 'react';

import { formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';

import { DetailedStats, TimeStats } from '../../types';

import { TimeBarChart } from './TimeBarChart';

interface OverviewCardsProps {
    t: (key: string) => string
    statsData: DetailedStats | null
    timeStats: TimeStats | null
    loadingTimeStats: boolean
}

interface StatCardProps {
    Icon: LucideIcon
    iconColor: string
    title: string
    children: React.ReactNode
}

const StatCard: React.FC<StatCardProps> = ({ Icon, iconColor, title, children }) => (
    <div className="premium-glass p-6 relative group overflow-hidden hover:bg-muted/5 transition-all duration-300">
        <div className="absolute -right-4 -bottom-4 opacity-[0.05] group-hover:opacity-[0.1] transition-all duration-500 group-hover:scale-110">
            <Icon className="w-20 h-20 text-primary" />
        </div>
        <div className="space-y-4 relative z-10">
            <div className="flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</div>
                <div className={cn("p-2 rounded-xl bg-muted/10 border border-border/40 transition-colors group-hover:bg-primary/10 group-hover:border-primary/20", iconColor)}>
                    <Icon className="w-3.5 h-3.5" />
                </div>
            </div>
            <div>{children}</div>
        </div>
    </div>
);

const MessagesCard: React.FC<{ t: (k: string) => string; count: number }> = ({ t, count }) => (
    <StatCard Icon={MessageSquare} iconColor="text-primary" title={t('statistics.messages')}>
        <div className="text-3xl font-black text-foreground leading-none tracking-tighter tabular-nums">{count}</div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-2 tracking-widest leading-none opacity-60">{t('statistics.totalMessages')}</p>
    </StatCard>
);

const ChatsCard: React.FC<{ t: (k: string) => string; count: number }> = ({ t, count }) => (
    <StatCard Icon={Activity} iconColor="text-success" title={t('statistics.chats')}>
        <div className="text-3xl font-black text-foreground leading-none tracking-tighter tabular-nums">{count}</div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-2 tracking-widest leading-none opacity-60">{t('statistics.activeThreads')}</p>
    </StatCard>
);

interface TokensCardProps {
    t: (k: string) => string;
    total: number;
    prompt: number;
    completion: number;
}

const TokensCard: React.FC<TokensCardProps> = ({ t, total, prompt, completion }) => (
    <StatCard Icon={TrendingUp} iconColor="text-primary" title={t('statistics.totalTokens')}>
        <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
                <div className="text-3xl font-black text-foreground leading-none tracking-tighter tabular-nums">{formatNumber(total)}</div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/10">
                <div>
                    <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">{t('statistics.tokensIn')}</div>
                    <div className="text-xs font-bold text-primary tabular-nums mt-1">{formatNumber(prompt)}</div>
                </div>
                <div>
                    <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">{t('statistics.tokensOut')}</div>
                    <div className="text-xs font-bold text-success tabular-nums mt-1">{formatNumber(completion)}</div>
                </div>
            </div>
        </div>
    </StatCard>
);

interface TimeCardProps {
    t: (k: string) => string;
    loading: boolean;
    timeStats: TimeStats | null;
}

const TimeCard: React.FC<TimeCardProps> = ({ t, loading, timeStats }) => (
    <StatCard Icon={Clock} iconColor="text-info" title={t('statistics.onlineTime')}>
        <div className="pt-2">
            {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
                <TimeBarChart
                    value={timeStats?.totalOnlineTime ?? 0}
                    maxValue={Math.max(timeStats?.totalOnlineTime ?? 0, 86400000)}
                    label={t('statistics.totalAppUsage')}
                    color="linear-gradient(90deg, hsl(var(--info)), hsl(var(--primary)))"
                />
            )}
        </div>
    </StatCard>
);

const DEFAULT_STATS = {
    messageCount: 0,
    chatCount: 0,
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0
};

function getStatsValues(statsData: DetailedStats | null) {
    if (!statsData) { return DEFAULT_STATS; }
    return {
        messageCount: statsData.messageCount,
        chatCount: statsData.chatCount,
        totalTokens: statsData.totalTokens,
        promptTokens: statsData.promptTokens,
        completionTokens: statsData.completionTokens
    };
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({ t, statsData, timeStats, loadingTimeStats }) => {
    const { messageCount, chatCount, totalTokens, promptTokens, completionTokens } = getStatsValues(statsData);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MessagesCard t={t} count={messageCount} />
            <ChatsCard t={t} count={chatCount} />
            <TokensCard t={t} total={totalTokens} prompt={promptTokens} completion={completionTokens} />
            <TimeCard t={t} loading={loadingTimeStats} timeStats={timeStats} />
        </div>
    );
};
