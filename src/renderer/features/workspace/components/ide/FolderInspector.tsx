/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { WorkspaceStats } from '@shared/types/workspace';
import { IconActivity, IconFolder, IconPackage } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
import type { IpcValue } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

interface DirectoryAnalysis {
    hasPackageJson: boolean;
    pkg: Record<string, IpcValue>;
    stats: WorkspaceStats;
}

interface FolderInspectorProps {
    folderPath: string | null;
    rootPath: string;
}

type ScriptsRecord = Record<string, IpcValue>;
type DependenciesRecord = Record<string, IpcValue>;

const EmptyStateView = ({ t }: { t: (key: string) => string }) => (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
        <IconFolder className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm">{t('inspector.selectFolder')}</p>
    </div>
);

const LoadingView = ({ t }: { t: (key: string) => string }) => (
    <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
        <IconActivity className="w-4 h-4 animate-spin" />
        {t('inspector.analyzing')}
    </div>
);

const StatsSection = ({ fileCount, totalSize }: { fileCount: number; totalSize: number }) => {
    const { t } = useTranslation();
    return (
        <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-accent/20 border border-border/50">
                <div className="text-sm text-muted-foreground mb-1">
                    {t('workspaceDashboard.folderInspector.files')}
                </div>
                <div className="text-xl font-bold">{fileCount}</div>
            </div>
            <div className="p-3 rounded-lg bg-accent/20 border border-border/50">
                <div className="text-sm text-muted-foreground mb-1">
                    {t('workspaceDashboard.folderInspector.size')}
                </div>
                <div className="text-xl font-bold">{(totalSize / 1024).toFixed(1)} KB</div>
            </div>
        </div>
    );
};

const ScriptsSection = ({ scripts }: { scripts: ScriptsRecord }) => {
    const { t } = useTranslation();
    const scriptKeys = Object.keys(scripts);
    const hasScripts = scriptKeys.length > 0;

    if (!hasScripts) {
        return null;
    }

    return (
        <div className="pt-2 border-t border-border/50 mt-2">
            <div className="text-sm text-muted-foreground mb-2">
                {t('workspaceDashboard.folderInspector.scripts')}
            </div>
            <div className="grid grid-cols-1 gap-1">
                {scriptKeys.slice(0, 5).map(name => (
                    <div
                        key={name}
                        className="flex items-center justify-between group p-1.5 hover:bg-accent/20 rounded transition-colors cursor-pointer"
                    >
                        <span className="font-mono typo-caption text-info-light font-bold">{name}</span>
                        <span
                            className="font-mono text-sm text-muted-foreground truncate max-w-120"
                            title={String(scripts[name])}
                        >
                            {String(scripts[name])}
                        </span>
                    </div>
                ))}
                {scriptKeys.length > 5 && (
                    <div className="text-sm text-muted-foreground px-1 pt-1">
                        {t('workspaceDashboard.folderInspector.moreScripts', {
                            count: scriptKeys.length - 5,
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

const DependenciesSection = ({ dependencies }: { dependencies: DependenciesRecord }) => {
    const { t } = useTranslation();
    const depKeys = Object.keys(dependencies);
    const hasDeps = depKeys.length > 0;

    if (!hasDeps) {
        return null;
    }

    return (
        <div className="pt-2 border-t border-border/50 mt-2">
            <div className="text-sm text-muted-foreground mb-2">
                {t('workspaceDashboard.folderInspector.dependencies')}
            </div>
            <div className="flex flex-wrap gap-1">
                {depKeys.slice(0, 8).map(dep => (
                    <span
                        key={dep}
                        className="px-1.5 py-0.5 rounded text-sm bg-accent/20 border border-border/50 text-muted-foreground"
                    >
                        {dep}
                    </span>
                ))}
            </div>
        </div>
    );
};

const PackageInfoSection = ({ pkg }: { pkg: Record<string, IpcValue> }) => {
    const { t } = useTranslation();
    return (
        <div className="space-y-3">
            <h3 className="typo-caption font-bold text-muted-foreground flex items-center gap-2">
                <IconPackage className="w-3.5 h-3.5" />{' '}
                {t('workspaceDashboard.folderInspector.packageTitle')}
            </h3>
            <div className="bg-muted/30 rounded-lg p-3 border border-border/50 space-y-2">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                        {t('workspaceDashboard.folderInspector.packageName')}
                    </span>
                    <span className="font-mono text-success">{String(pkg.name)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                        {t('workspaceDashboard.folderInspector.packageVersion')}
                    </span>
                    <span className="font-mono">{String(pkg.version)}</span>
                </div>

                {pkg.scripts && Object.keys(pkg.scripts).length > 0 && (
                    <ScriptsSection scripts={pkg.scripts as ScriptsRecord} />
                )}

                {pkg.dependencies && Object.keys(pkg.dependencies).length > 0 && (
                    <DependenciesSection dependencies={pkg.dependencies as DependenciesRecord} />
                )}
            </div>
        </div>
    );
};

const FolderContentView = ({
    data,
    folderPath,
    rootPath,
}: {
    data: DirectoryAnalysis;
    folderPath: string;
    rootPath: string;
}) => {
    const { t } = useTranslation();
    const relativePath = folderPath.replace(rootPath, '') || '/';
    const displayPath =
        relativePath === '/' ? t('workspaceDashboard.folderInspector.root') : relativePath;

    return (
        <div className="h-full flex flex-col bg-card rounded-xl border border-border/50 overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-border/50 bg-muted/30 backdrop-blur-sm">
                <div className="flex items-center gap-2 font-medium text-foreground truncate text-sm">
                    <IconFolder className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate" title={relativePath}>
                        {displayPath}
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <StatsSection fileCount={data.stats.fileCount} totalSize={data.stats.totalSize} />

                {data.hasPackageJson && <PackageInfoSection pkg={data.pkg} />}


            </div>
        </div>
    );
};

export const FolderInspector = ({ folderPath, rootPath }: FolderInspectorProps) => {
    const { t } = useTranslation();
    const [data, setData] = useState<DirectoryAnalysis | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            if (!folderPath) {
                setData(null);
                return;
            }
            setLoading(true);
            try {
                const res = await window.electron.workspace.analyzeDirectory(folderPath);
                setData(res);
            } catch (error) {
                appLogger.error('FolderInspector', 'Failed to analyze folder', error as Error);
            } finally {
                setLoading(false);
            }
        };
        void loadData();
    }, [folderPath]);

    if (!folderPath) {
        return <EmptyStateView t={t} />;
    }

    if (loading) {
        return <LoadingView t={t} />;
    }

    if (!data) {
        return null;
    }

    return <FolderContentView data={data} folderPath={folderPath} rootPath={rootPath} />;
};
