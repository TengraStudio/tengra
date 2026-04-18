/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Minus, Plus } from 'lucide-react';

import { DiffStats, GitData, GitFile } from './types';

interface ChangeStatsProps {
    diffStats: DiffStats;
    gitData: GitData;
    handleStageFile: (path: string) => Promise<void>;
    handleUnstageFile: (path: string) => Promise<void>;
    getStatusIcon: (status: string) => React.ReactNode;
    t: (key: string) => string;
}

export const GitChangeStats: React.FC<ChangeStatsProps> = ({ diffStats, gitData, handleStageFile, handleUnstageFile, getStatusIcon, t }) => (
    <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-6 flex flex-col gap-6">
        <h3 className="text-sm font-bold text-foreground">{t('workspaceDashboard.changesStats')}</h3>

        <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/30 rounded-xl p-4">
                <div className="typo-caption text-muted-foreground mb-1">{t('workspaceDashboard.filesChanged')}</div>
                <div className="text-2xl font-bold text-foreground">{diffStats.total.files}</div>
            </div>
            <div className="bg-muted/30 rounded-xl p-4">
                <div className="typo-caption text-muted-foreground mb-1">{t('workspaceDashboard.linesAdded')}</div>
                <div className="text-2xl font-bold text-success">+{diffStats.total.added}</div>
            </div>
            <div className="bg-muted/30 rounded-xl p-4">
                <div className="typo-caption text-muted-foreground mb-1">{t('workspaceDashboard.linesDeleted')}</div>
                <div className="text-2xl font-bold text-destructive">-{diffStats.total.deleted}</div>
            </div>
        </div>

        {gitData.changedFiles.length > 0 && (
            <div className="flex flex-col gap-4">
                <h4 className="typo-caption font-bold text-muted-foreground">{t('workspaceDashboard.changedFiles')}</h4>

                {gitData.stagedFiles.length > 0 && (
                    <div className="space-y-2">
                        <div className="typo-caption font-semibold text-success px-2">{t('workspaceDashboard.stagedFiles')}</div>
                        <div className="space-y-1">
                            {gitData.stagedFiles.map((file: GitFile, i: number) => (
                                <div
                                    key={`staged-${file.path}-${i}`}
                                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors typo-caption"
                                >
                                    {getStatusIcon(file.status)}
                                    <span className="flex-1 truncate text-foreground">{file.path}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            void handleUnstageFile(file.path);
                                        }}
                                        className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-warning"
                                        title={t('workspaceDashboard.unstage')}
                                    >
                                        <Minus className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {gitData.unstagedFiles.length > 0 && (
                    <div className="space-y-2">
                        <div className="typo-caption font-semibold text-warning px-2">{t('workspaceDashboard.unstagedFiles')}</div>
                        <div className="space-y-1">
                            {gitData.unstagedFiles.map((file: GitFile, i: number) => (
                                <div
                                    key={`unstaged-${file.path}-${i}`}
                                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors typo-caption"
                                >
                                    {getStatusIcon(file.status)}
                                    <span className="flex-1 truncate text-foreground">{file.path}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            void handleStageFile(file.path);
                                        }}
                                        className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-success"
                                        title={t('workspaceDashboard.stage')}
                                    >
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}
    </div>
);
