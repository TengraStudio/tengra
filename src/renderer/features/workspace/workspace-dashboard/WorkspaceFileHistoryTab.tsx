/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertCircle, IconHistory, IconRefresh } from '@tabler/icons-react';
import React, { useEffect, useState } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { GitCommitHistory } from '@/features/workspace/components/git';
import type { GitFileHistoryItem } from '@/features/workspace/components/git/types';
import { useGitData } from '@/features/workspace/hooks/useGitData';
import type { Workspace } from '@/types';

interface WorkspaceFileHistoryTabProps {
    workspace: Workspace;
    t: (key: string) => string;
    activeTab: string;
}

export const WorkspaceFileHistoryTab: React.FC<WorkspaceFileHistoryTabProps> = ({ workspace, t, activeTab }) => {
    const {
        gitData,
        selectedCommit,
        commitDiff,
        loadingDiff,
        handleCommitSelect,
        fetchGitData
    } = useGitData(workspace);

    const [fileHistoryPath, setFileHistoryPath] = useState<string | null>(null);
    const [fileHistoryCommits, setFileHistoryCommits] = useState<GitFileHistoryItem[]>([]);
    const [loadingFileHistory, setLoadingFileHistory] = useState(false);

    useEffect(() => {
        const historyHandler = (e: Event) => {
            const customEvent = e as CustomEvent<{ path?: string }>;
            const targetPath = typeof customEvent.detail?.path === 'string' ? customEvent.detail.path : '';
            if (!targetPath) {return;}

            setFileHistoryPath(targetPath);
            setLoadingFileHistory(true);
            window.electron.git.getFileHistory(workspace.path || '', targetPath, 50).then(result => {
                if (result.success && result.commits) {
                    setFileHistoryCommits(result.commits);
                }
                setLoadingFileHistory(false);
            });
        };
        window.addEventListener('tengra:workspace-git-open-file-history', historyHandler);
        return () => {
            window.removeEventListener('tengra:workspace-git-open-file-history', historyHandler);
        };
    }, [workspace.path]);

    useEffect(() => {
        if (activeTab === 'file_history' && workspace.path) {
            void fetchGitData();
        }
    }, [activeTab, workspace.path, fetchGitData]);

    if (!gitData.isRepository) {
        return (
            <div className="flex flex-1 items-center justify-center p-12">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mx-auto mb-6">
                        <IconAlertCircle className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <h3 className="text-lg font-medium">{t('frontend.workspaceDashboard.notAGitRepo')}</h3>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-background select-none">
            <div className="flex items-center justify-between px-6 h-14 border-b border-border/40 shrink-0">
                <div className="flex items-center gap-2">
                    <IconHistory className="w-5 h-5 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">File History</h2>
                    {fileHistoryPath && (
                        <>
                            <div className="h-4 w-px bg-border/40 mx-2" />
                            <span className="text-sm font-mono text-muted-foreground">{fileHistoryPath}</span>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col min-w-0">
                    <ScrollArea className="flex-1">
                        <div className="p-6 pb-20 max-w-5xl mx-auto w-full">
                            {!fileHistoryPath ? (
                                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                    <IconHistory className="w-12 h-12 text-muted-foreground/30 mb-4" />
                                    <p className="text-sm">Select a file to view its history</p>
                                </div>
                            ) : loadingFileHistory ? (
                                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                                    <IconRefresh className="w-8 h-8 text-muted-foreground/40 animate-spin mb-4" />
                                    <p className="text-sm text-muted-foreground">Fetching file history...</p>
                                </div>
                            ) : fileHistoryCommits.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                    <IconAlertCircle className="w-8 h-8 text-muted-foreground/30 mb-4" />
                                    <p className="text-sm">No history found for this file.</p>
                                </div>
                            ) : (
                                <GitCommitHistory
                                    gitData={{ ...gitData, recentCommits: fileHistoryCommits as GitFileHistoryItem[] }}
                                    selectedCommit={selectedCommit}
                                    loadingDiff={loadingDiff}
                                    commitDiff={commitDiff}
                                    isLoadingMore={false}
                                    hasMoreCommits={false}
                                    handleCommitSelect={handleCommitSelect}
                                    handleLoadMoreCommits={async () => {}}
                                    fetchGitData={async () => {}}
                                    t={t}
                                />
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
};
