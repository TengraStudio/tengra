import React from 'react';

import { useTranslation } from '@/i18n';
import { WorkspaceStats } from '@/types';

interface WorkspaceStatsCardsProps {
    stats: WorkspaceStats | null;
    moduleCount: number;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) { return '0 B'; }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">
                {value}
            </div>
        </div>
    );
}

export const WorkspaceStatsCards: React.FC<WorkspaceStatsCardsProps> = ({ stats, moduleCount }) => {
    const { t } = useTranslation();

    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
                label={t('frontend.workspaceDashboard.fileCount')}
                value={stats?.fileCount ?? 0}
            />
            <StatCard
                label={t('frontend.workspaceDashboard.loc')}
                value={`~${new Intl.NumberFormat().format(stats?.loc ?? 0)}`}
            />
            <StatCard
                label={t('frontend.workspaceDashboard.modules')}
                value={moduleCount}
            />
            <StatCard
                label={t('frontend.workspaceDashboard.totalSize')}
                value={stats ? formatBytes(stats.totalSize) : '0 B'}
            />
        </div>
    );
};
