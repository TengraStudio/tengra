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

export const WorkspaceStatsCards: React.FC<WorkspaceStatsCardsProps> = ({ stats, moduleCount }) => {
    const { t } = useTranslation();

    const formattedSize = React.useMemo(() => {
        return stats ? formatBytes(stats.totalSize) : '0 B';
    }, [stats]);
    
    const formattedLoc = React.useMemo(() => {
        const loc = stats?.loc ?? 0;
        return new Intl.NumberFormat().format(loc);
    }, [stats?.loc]);

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
                { label: t('workspaceDashboard.fileCount'), value: stats?.fileCount ?? 0 },
                { label: t('workspaceDashboard.loc'), value: `~${formattedLoc}` },
                { label: t('workspaceDashboard.modules'), value: moduleCount },
                { label: t('workspaceDashboard.totalSize'), value: formattedSize }
            ].map((stat, i) => (
                <div key={i} className="group px-5 py-4 rounded-2xl border border-border/5 bg-muted/5 transition-all hover:bg-muted/10">
                    <div className="text-[11px] font-bold text-muted-foreground/30 tracking-wider mb-1.5 transition-colors group-hover:text-primary/40">
                        {stat.label.toLowerCase()}
                    </div>
                    <div className="text-2xl font-bold text-foreground/80 tracking-tight">
                        {stat.value}
                    </div>
                </div>
            ))}
        </div>
    );
};
