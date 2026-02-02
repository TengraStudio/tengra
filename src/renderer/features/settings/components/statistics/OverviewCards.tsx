import { Activity, Clock, Loader2, LucideIcon, MessageSquare, TrendingUp } from 'lucide-react';
import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/formatters';

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
    <Card className="border-border/40 bg-card backdrop-blur-md overflow-hidden relative group hover:bg-card/90 transition-all duration-300">
        <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover:opacity-[0.07] transition-all duration-500 group-hover:scale-110">
            <Icon className="w-24 h-24 text-primary" />
        </div>
        <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{title}</CardTitle>
                <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
    </Card>
);

const MessagesCard: React.FC<{ t: (k: string) => string; count: number }> = ({ t, count }) => (
    <StatCard Icon={MessageSquare} iconColor="text-primary/50" title={t('statistics.messages')}>
        <div className="text-4xl font-black text-foreground leading-none tracking-tighter tabular-nums">{count}</div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-2 tracking-widest leading-none">Total messages</p>
    </StatCard>
);

const ChatsCard: React.FC<{ t: (k: string) => string; count: number }> = ({ t, count }) => (
    <StatCard Icon={Activity} iconColor="text-success/50" title={t('statistics.chats')}>
        <div className="text-4xl font-black text-foreground leading-none tracking-tighter tabular-nums">{count}</div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-2 tracking-widest leading-none">Active threads</p>
    </StatCard>
);

interface TokensCardProps {
    t: (k: string) => string;
    total: number;
    prompt: number;
    completion: number;
}

const TokensCard: React.FC<TokensCardProps> = ({ t, total, prompt, completion }) => (
    <StatCard Icon={TrendingUp} iconColor="text-primary/50" title={t('statistics.totalTokens')}>
        <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
                <div className="text-4xl font-black text-foreground leading-none tracking-tighter tabular-nums">{formatNumber(total)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                <div>
                    <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">In</div>
                    <div className="text-xs font-bold text-primary tabular-nums">{formatNumber(prompt)}</div>
                </div>
                <div>
                    <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Out</div>
                    <div className="text-xs font-bold text-success tabular-nums">{formatNumber(completion)}</div>
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
    <StatCard Icon={Clock} iconColor="text-purple/50" title={t('statistics.onlineTime')}>
        <div className="pt-2">
            {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
                <TimeBarChart
                    value={timeStats?.totalOnlineTime ?? 0}
                    maxValue={Math.max(timeStats?.totalOnlineTime ?? 0, 86400000)}
                    label={t('statistics.totalAppUsage')}
                    color="linear-gradient(90deg, #a855f7, #ec4899)"
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
