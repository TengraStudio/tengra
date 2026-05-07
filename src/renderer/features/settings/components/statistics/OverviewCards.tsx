/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import { formatNumber } from '@/lib/formatters';

import { DetailedStats } from '../../types';

interface OverviewCardsProps {
    t: (key: string) => string;
    statsData: DetailedStats | null;
}

const SimpleStatLabel: React.FC<{
    label: string;
    value: string;
    subtext?: string;
}> = ({ label, value, subtext }) => (
    <div className="rounded-2xl border border-border/30 bg-background px-5 py-4">
        <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground/65">{label}</div>
            <div className="text-3xl font-bold leading-none text-foreground tabular-nums">{value}</div>
            {subtext ? (
                <div className="text-sm font-medium text-muted-foreground/70">
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

export const OverviewCards: React.FC<OverviewCardsProps> = ({ t, statsData }) => {
    const { messageCount, chatCount, totalTokens } = getStatsValues(statsData);

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <SimpleStatLabel
                label={t('frontend.statistics.messages')}
                value={formatNumber(messageCount)}
                subtext={t('frontend.statistics.totalMessages')}
            />
            <SimpleStatLabel
                label={t('frontend.statistics.chats')}
                value={formatNumber(chatCount)}
                subtext={t('frontend.statistics.activeThreads')}
            />
            <SimpleStatLabel
                label={t('frontend.statistics.totalTokens')}
                value={formatNumber(totalTokens)}
                subtext={t('frontend.tokenUsageDashboard.totalTokens')}
            />
        </div>
    );
};

