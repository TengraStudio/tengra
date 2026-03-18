import React from 'react';

import { useTranslation } from '@/i18n';
import { WorkspaceStats } from '@/types';

interface WorkspaceStatsCardsProps {
    stats: WorkspaceStats | null;
    type: string;
    moduleCount: number;
}

const formatBytes = (bytes: number) => {
    if (bytes === 0) { return '0 B'; }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const WorkspaceStatsCards: React.FC<WorkspaceStatsCardsProps> = ({ stats, type, moduleCount }) => {
    const { t } = useTranslation();

    const formattedSize = React.useMemo(() => {
        return stats ? formatBytes(stats.totalSize) : '0 B';
    }, [stats]);

    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-premium hover:shadow-md">
                <div className="text-xxs font-bold uppercase text-muted-foreground mb-1 tracking-wider">
                    {t('workspaceDashboard.fileCount')}
                </div>
                <div className="text-2xl font-black text-foreground">{stats?.fileCount ?? 0}</div>
            </div>
            <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-premium hover:shadow-md">
                <div className="text-xxs font-bold uppercase text-muted-foreground mb-1 tracking-wider">
                    {t('workspaceDashboard.loc')}
                </div>
                <div className="text-2xl font-black text-foreground">~{stats?.loc ?? 0}</div>
            </div>
            <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-premium hover:shadow-md">
                <div className="text-xxs font-bold uppercase text-muted-foreground mb-1 tracking-wider">
                    {t('workspaceDashboard.totalSize')}
                </div>
                <div className="text-2xl font-black text-foreground">{formattedSize}</div>
            </div>
            <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-premium hover:shadow-md">
                <div className="text-xxs font-bold uppercase text-muted-foreground mb-1 tracking-wider">
                    {t('workspaceDashboard.modules')}
                </div>
                <div className="text-2xl font-black text-foreground">{moduleCount}</div>
            </div>
            <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-premium hover:shadow-md">
                <div className="text-xxs font-bold uppercase text-muted-foreground mb-1 tracking-wider">
                    {t('workspaceDashboard.type')}
                </div>
                <div className="text-2xl font-black text-primary capitalize">{type}</div>
            </div>
        </div>
    );
};
