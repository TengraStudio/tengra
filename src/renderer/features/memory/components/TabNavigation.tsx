/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { Icon } from '@tabler/icons-react';
import { IconArchive, IconCircleCheck, IconClock, IconGauge, IconLayoutGrid } from '@tabler/icons-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

type TabType = 'pending' | 'confirmed' | 'archived' | 'stats' | 'visualization';

interface TabNavigationProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    pendingCount: number;
    confirmedCount: number;
    archivedCount: number;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
    activeTab,
    onTabChange,
    pendingCount,
    confirmedCount,
    archivedCount,
}) => {
    const { t } = useTranslation();

    const tabs: Array<{
        id: TabType;
        label: string;
        icon: Icon;
        count?: number;
    }> = [
        { id: 'pending', label: t('frontend.memory.tabs.pending'), icon: IconClock, count: pendingCount },
        { id: 'confirmed', label: t('frontend.memory.tabs.confirmed'), icon: IconCircleCheck, count: confirmedCount },
        { id: 'archived', label: t('frontend.memory.tabs.archived'), icon: IconArchive, count: archivedCount },
        { id: 'visualization', label: t('frontend.memory.tabs.visualization'), icon: IconLayoutGrid },
        { id: 'stats', label: t('frontend.memory.tabs.stats'), icon: IconGauge },
    ];

    return (
        <div className="w-full overflow-x-auto">
            <div className="inline-flex min-w-full gap-1 rounded-2xl border border-border/40 bg-card/80 p-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onTabChange(tab.id)}
                        className={cn(
                            'inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                            activeTab === tab.id
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                        )}
                    >
                        <tab.icon className="h-4 w-4" />
                        <span>{tab.label}</span>
                        {tab.count !== undefined && (
                            <span className={cn(
                                'ml-1 rounded-full px-2 py-0.5 text-xs',
                                activeTab === tab.id
                                    ? 'bg-primary-foreground/15 text-primary-foreground'
                                    : 'bg-muted text-muted-foreground'
                            )}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};
