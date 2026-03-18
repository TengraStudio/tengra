import React from 'react';

import { formatNumber, formatTime } from '@/lib/formatters';

import { DetailedStats, TimeStats } from '../../types';

interface OverviewCardsProps {
    t: (key: string) => string;
    statsData: DetailedStats | null;
    timeStats: TimeStats | null;
}

const SimpleStatLabel: React.FC<{
    label: string;
    value: string;
    subtext?: string;
}> = ({ label, value, subtext }) => (
    <div className="rounded-2xl border border-border/50 bg-card px-5 py-4">
        <div className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/65">{label}</div>
            <div className="text-3xl font-black leading-none tracking-[-0.04em] text-foreground tabular-nums">{value}</div>
            {subtext ? (
                <div className="text-[11px] font-medium text-muted-foreground/70">
                    {subtext}
                </div>
            ) : null}
        </div>
    </div>
);

const DEFAULT_STATS = { messageCount: 0, chatCount: 0, totalTokens: 0 };
function getStatsValues(statsData: DetailedStats | null) {
    if (!statsData) { return DEFAULT_STATS; }
    return {
        messageCount: statsData.messageCount,
        chatCount: statsData.chatCount,
        totalTokens: statsData.totalTokens,
    };
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({ t, statsData, timeStats }) => {
    const { messageCount, chatCount, totalTokens } = getStatsValues(statsData);
    const onlineTime = timeStats ? formatTime(timeStats.totalOnlineTime) : '0s';
    const codingTime = timeStats ? formatTime(timeStats.totalCodingTime) : '0s';

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SimpleStatLabel
                label={t('statistics.messages')}
                value={formatNumber(messageCount)}
                subtext={t('statistics.totalMessages')}
            />
            <SimpleStatLabel
                label={t('statistics.chats')}
                value={formatNumber(chatCount)}
                subtext={t('statistics.activeThreads')}
            />
            <SimpleStatLabel
                label={t('statistics.totalTokens')}
                value={formatNumber(totalTokens)}
                subtext={t('tokenUsageDashboard.totalTokens')}
            />
            <SimpleStatLabel
                label={t('statistics.onlineTime')}
                value={onlineTime}
                subtext={codingTime === '0s' ? t('statistics.totalAppUsage') : `${t('statistics.codingTime')} ${codingTime}`}
            />
        </div>
    );
};

