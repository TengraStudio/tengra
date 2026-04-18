/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { FileText, GitBranch, Layout, ListTodo, Play, Search, Settings } from 'lucide-react';
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
        { id: 'overview', icon: Layout, title: t('workspaceDashboard.overview') },
        { id: 'tasks', icon: ListTodo, title: t('workspaceDashboard.todoList') },
        { id: 'search', icon: Search, title: t('workspaceDashboard.search') },
        { id: 'git', icon: GitBranch, title: t('workspaceDashboard.git') },
        { id: 'env', icon: Settings, title: t('workspaceDashboard.environment') },
        { id: 'logs', icon: FileText, title: t('workspaceDashboard.logs') },
        { id: 'settings', icon: Settings, title: t('workspaceDashboard.settings') },
    ] as const;

    return (
        <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/30 shadow-sm gap-0.5">
            {tabs.map((tab, idx) => {
                const Icon = tab.icon;
                const isActive = dashboardTab === tab.id;

                return (
                    <React.Fragment key={tab.id}>
                        {idx === 2 && (
                            <button
                                onClick={handleRunWorkspace}
                                data-testid="workspace-run-button"
                                className="p-1.5 rounded-md hover:bg-muted/60 text-success transition-colors"
                                title={t('workspace.run')}
                            >
                                <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                        )}
                        <button
                            onClick={() => onDashboardTabChange?.(tab.id)}
                            className={cn(
                                "p-1.5 rounded-md transition-all",
                                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            )}
                            title={tab.title}
                        >
                            <Icon className="w-3.5 h-3.5" />
                        </button>
                    </React.Fragment>
                );
            })}
        </div>
    );
};
