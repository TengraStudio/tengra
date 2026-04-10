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
    const formattedLoc = React.useMemo(() => {
        const loc = stats?.loc ?? 0;
        return new Intl.NumberFormat().format(loc);
    }, [stats?.loc]);

    const largestDirectories = stats?.largestDirectories ?? [];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-premium hover:shadow-md">
                    <div className="text-xxs font-bold text-muted-foreground mb-1">
                        {t('workspaceDashboard.fileCount')}
                    </div>
                    <div className="text-2xl font-bold text-foreground">{stats?.fileCount ?? 0}</div>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-premium hover:shadow-md">
                    <div className="text-xxs font-bold text-muted-foreground mb-1">
                        {t('workspaceDashboard.loc')}
                    </div>
                    <div className="text-2xl font-bold text-foreground">~{formattedLoc}</div>
                    <div className="mt-1 tw-text-10 text-muted-foreground/70">
                        {t('workspaceDashboard.locHint')}
                    </div>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-premium hover:shadow-md">
                    <div className="text-xxs font-bold text-muted-foreground mb-1">
                        {t('workspaceDashboard.modules')}
                    </div>
                    <div className="text-2xl font-bold text-foreground">{moduleCount}</div>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border hover:border-primary/20 transition-premium hover:shadow-md">
                    <div className="text-xxs font-bold text-muted-foreground mb-1">
                        {t('workspaceDashboard.type')}
                    </div>
                    <div className="text-2xl font-bold text-primary capitalize">{type}</div>
                </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-4 hover:border-primary/20 transition-premium hover:shadow-md">
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <div className="text-xxs font-bold text-muted-foreground">
                            {t('workspaceDashboard.totalSize')}
                        </div>
                        <div className="mt-1 text-3xl font-bold text-foreground">{formattedSize}</div>
                    </div>
                    <div className="tw-text-10 text-muted-foreground/70">
                        {t('workspaceDashboard.scannedStorageOnly')}
                    </div>
                </div>

                {largestDirectories.length > 0 && (
                    <>
                        <div className="mb-3 text-xxs font-bold text-muted-foreground">
                            {t('workspaceDashboard.storageBreakdown')}
                        </div>
                        <div className="space-y-2">
                            {largestDirectories.map(entry => (
                            <div
                                key={entry.path}
                                className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-muted/10 px-3 py-2"
                            >
                                <div className="min-w-0">
                                    <div className="truncate font-mono typo-caption text-foreground">
                                        {entry.path}
                                    </div>
                                    <div className="tw-text-10 text-muted-foreground/70">
                                        {t('workspaceDashboard.storageFiles', { count: entry.fileCount })}
                                    </div>
                                </div>
                                <div className="shrink-0 text-sm font-semibold text-primary">
                                    {formatBytes(entry.size)}
                                </div>
                            </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
