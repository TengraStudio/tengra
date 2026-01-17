
import { GitBranch, Info, Play, Search, Terminal } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

interface DashboardTabsProps {
    dashboardTab: 'overview' | 'terminal' | 'files' | 'tasks' | 'search' | 'council' | 'git' | 'editor';
    onDashboardTabChange?: (tab: 'overview' | 'terminal' | 'files' | 'tasks' | 'search' | 'council' | 'git' | 'editor') => void;
    handleRunProject: () => void;
    t: (key: string) => string;
}

export const DashboardTabs: React.FC<DashboardTabsProps> = ({
    dashboardTab,
    onDashboardTabChange,
    handleRunProject,
    t
}) => {
    return (
        <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/5 shadow-sm gap-0.5">
            <button
                onClick={() => onDashboardTabChange?.('overview')}
                className={cn("p-1.5 rounded-md transition-all", dashboardTab === 'overview' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/10 hover:text-white")}
                title={t('projectDashboard.overview')}
            >
                <Info className="w-3.5 h-3.5" />
            </button>
            <button
                onClick={() => onDashboardTabChange?.('terminal')}
                className={cn("p-1.5 rounded-md transition-all", dashboardTab === 'terminal' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/10 hover:text-white")}
                title={t('projectDashboard.terminal')}
            >
                <Terminal className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleRunProject} className="p-1.5 rounded-md hover:bg-white/10 text-emerald-400 transition-colors" title={t('workspace.run')}>
                <Play className="w-3.5 h-3.5 fill-current" />
            </button>
            <button
                onClick={() => onDashboardTabChange?.('search')}
                className={cn("p-1.5 rounded-md transition-all", dashboardTab === 'search' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/10 hover:text-white")}
                title={t('projectDashboard.search')}
            >
                <Search className="w-3.5 h-3.5" />
            </button>
            <button
                onClick={() => onDashboardTabChange?.('git')}
                className={cn("p-1.5 rounded-md transition-all", dashboardTab === 'git' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-white/10 hover:text-white")}
                title={t('projectDashboard.git')}
            >
                <GitBranch className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};
