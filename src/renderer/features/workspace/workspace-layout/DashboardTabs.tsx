/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconGitBranch, IconLayout, IconListCheck, IconPlayerPlay, IconSearch, IconSettings } from '@tabler/icons-react';
import React from 'react';

import { cn } from '@/lib/utils';
import { WorkspaceDashboardTab } from '@/types';

interface DashboardTabsProps {
    dashboardTab: WorkspaceDashboardTab;
    onDashboardTabChange?: (tab: WorkspaceDashboardTab) => void;
    handleRunWorkspace: () => void;
    t: (key: string) => string;
}

export const DashboardTabs: React.FC<DashboardTabsProps> = ({
    dashboardTab,
    onDashboardTabChange,
    handleRunWorkspace,
    t
}) => {
    const tabs = [
        { id: 'overview', icon: IconLayout, title: t('frontend.workspaceDashboard.overview') },
        { id: 'tasks', icon: IconListCheck, title: t('frontend.workspaceDashboard.todoList') },
        { id: 'search', icon: IconSearch, title: t('frontend.workspaceDashboard.search') },
        { id: 'git', icon: IconGitBranch, title: t('frontend.workspaceDashboard.git') },
        { id: 'settings', icon: IconSettings, title: t('frontend.workspaceDashboard.settings') },
    ] as const;

    return (
        <div className="flex items-center bg-muted/40 rounded-xl p-1 border border-border/30 shadow-sm gap-1">
            {tabs.map((tab, idx) => {
                const Icon = tab.icon;
                const isActive = dashboardTab === tab.id;

                return (
                    <React.Fragment key={tab.id}>
                        {idx === 2 && (
                            <button
                                onClick={handleRunWorkspace}
                                data-testid="workspace-run-button"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-success/10 text-success transition-all font-medium"
                                title={t('frontend.workspace.run')}
                            >
                                <IconPlayerPlay className="w-4 h-4 fill-current" />
                                <span className="text-xs">{t('frontend.workspace.run')}</span>
                            </button>
                        )}
                        <button
                            onClick={() => onDashboardTabChange?.(tab.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all",
                                isActive 
                                    ? "bg-primary text-primary-foreground shadow-sm" 
                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            )}
                            title={tab.title}
                        >
                            <Icon className="w-4 h-4" />
                            {isActive && <span className="text-xs font-medium">{tab.title}</span>}
                        </button>
                    </React.Fragment>
                );
            })}
        </div>
    );
};
