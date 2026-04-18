/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ContributionGrid } from '@renderer/features/workspace/components/ContributionGrid';
import { RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';

import { GitCommitCard } from './GitCommitCard';
import { GitCommitDiffView } from './GitCommitDiffView';
import { GitCommitInfo, GitData } from './types';

interface CommitHistoryProps {
    gitData: GitData;
    selectedCommit: GitCommitInfo | null;
    commitStats: Record<string, number>;
    loadingDiff: boolean;
    commitDiff: string | null;
    handleCommitSelect: (commit: GitCommitInfo | null) => Promise<void>;
    fetchGitData: () => Promise<void>;
    t: (key: string) => string;
}

export const GitCommitHistory: React.FC<CommitHistoryProps> = ({
    gitData,
    selectedCommit,
    commitStats,
    loadingDiff,
    commitDiff,
    handleCommitSelect,
    fetchGitData,
    t,
}) => (
    <>
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground">
                {t('workspaceDashboard.recentCommits')}
            </h3>
            <div className="flex items-center gap-2">
                {selectedCommit && (
                    <button
                        onClick={() => {
                            void handleCommitSelect(null);
                        }}
                        className="typo-caption text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/50 transition-colors"
                    >
                        {t('workspaceDashboard.clearSelection')}
                    </button>
                )}
                <button
                    onClick={() => {
                        void fetchGitData();
                    }}
                    className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    title={t('common.refresh')}
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>
        </div>

        {Object.keys(commitStats).length > 0 && !selectedCommit && (
            <div className="mb-6">
                <ContributionGrid commitCounts={commitStats} />
            </div>
        )}

        {gitData.recentCommits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
                {t('workspaceDashboard.noCommits')}
            </div>
        ) : (
            <div
                className={cn(
                    'grid gap-4',
                    selectedCommit ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                )}
            >
                {gitData.recentCommits.map((commit: GitCommitInfo) => (
                    <GitCommitCard
                        key={commit.hash}
                        commit={commit}
                        isSelected={selectedCommit?.hash === commit.hash}
                        onSelect={c => {
                            void handleCommitSelect(c);
                        }}
                    />
                ))}
            </div>
        )}

        {selectedCommit && (
            <GitCommitDiffView
                selectedCommit={selectedCommit}
                loadingDiff={loadingDiff}
                commitDiff={commitDiff}
                t={t}
            />
        )}
    </>
);
