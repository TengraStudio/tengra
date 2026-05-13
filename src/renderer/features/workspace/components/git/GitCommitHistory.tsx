import { IconAlertCircle, IconArrowDownCircle, IconChevronDown, IconChevronRight, IconHistory, IconLoader2, IconRefresh } from '@tabler/icons-react';
import React from 'react';
import { Virtuoso } from 'react-virtuoso';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { GitCommitDiffView } from './GitCommitDiffView';
import { GitCommitInfo, GitData } from './types';

interface CommitHistoryProps {
    gitData: GitData;
    selectedCommit: GitCommitInfo | null;
    loadingDiff: boolean;
    commitDiff: string | null;
    hasMoreCommits: boolean;
    isLoadingMore: boolean;
    handleCommitSelect: (commit: GitCommitInfo | null) => Promise<void>;
    handleLoadMoreCommits: () => Promise<void>;
    fetchGitData: () => Promise<void>;
    t: (key: string) => string;
}

const HistoryRow = React.memo(({
    commit,
    isSelected,
    onSelect,
    loadingDiff,
    commitDiff,
    t
}: {
    commit: GitCommitInfo;
    isSelected: boolean;
    onSelect: (commit: GitCommitInfo | null) => void;
    loadingDiff: boolean;
    commitDiff: string | null;
    t: (key: string) => string;
}) => {
    const date = new Date(commit.date);

    return (
        <div className="flex flex-col border-b border-border/10 last:border-0">
            <div
                onClick={() => onSelect(commit)}
                className={cn(
                    "flex items-center gap-3 py-2.5 px-4 cursor-pointer transition-colors duration-150 group",
                    isSelected
                        ? "bg-primary/5"
                        : "hover:bg-muted/40"
                )}
            >
                <div className="flex-1 min-w-0 flex items-center gap-3">
                    <span className={cn(
                        "text-sm truncate",
                        isSelected ? "text-primary font-medium" : "text-foreground/90"
                    )}>
                        {commit.message}
                    </span>
                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                        <span className="text-[10px] font-mono text-muted-foreground/50">
                            {commit.hash.substring(0, 7)}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/40 font-normal whitespace-nowrap">
                            <span>{commit.author}</span>
                            <span>{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        </div>
                        {isSelected ? (
                            <IconChevronDown className="w-3.5 h-3.5 text-primary" />
                        ) : (
                            <IconChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                    </div>
                </div>
            </div>

            {isSelected && (
                <div className="px-4 py-3 bg-muted/5 animate-in fade-in slide-in-from-top-1 duration-200">
                    {loadingDiff ? (
                        <div className="flex items-center justify-center py-10">
                            <IconLoader2 className="w-5 h-5 animate-spin text-primary/60 mr-3" />
                            <span className="text-sm text-muted-foreground">{t('common.loading')}</span>
                        </div>
                    ) : commitDiff ? (
                        <GitCommitDiffView
                            selectedCommit={commit}
                            loadingDiff={loadingDiff}
                            commitDiff={commitDiff}
                            t={t}
                        />
                    ) : (
                        <div className="py-10 flex flex-col items-center justify-center text-muted-foreground/40">
                            <IconAlertCircle className="w-6 h-6 mb-2" />
                            <span className="text-sm">{t('frontend.workspaceDashboard.git.noChangesDetected')}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}, (prev, next) => {
    return (
        prev.commit.hash === next.commit.hash &&
        prev.isSelected === next.isSelected &&
        prev.loadingDiff === next.loadingDiff &&
        prev.commitDiff === next.commitDiff
    );
});

export const GitCommitHistory: React.FC<CommitHistoryProps> = ({
    gitData,
    selectedCommit,
    loadingDiff,
    commitDiff,
    hasMoreCommits,
    isLoadingMore,
    handleCommitSelect,
    handleLoadMoreCommits,
    fetchGitData,
    t,
}) => {
    const commits = gitData.recentCommits;

    return (
        <div className="flex flex-col h-full w-full">
            {/* Minimal Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-muted/10 shrink-0">
                <div className="flex items-center gap-2">
                    <IconHistory className="w-4 h-4 text-muted-foreground/70" />
                    <span className="text-xs font-medium text-muted-foreground">
                        {commits.length} {t('frontend.workspaceDashboard.git.commits')}
                    </span>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { void fetchGitData(); }}
                    disabled={gitData.loading}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                    <IconRefresh className={cn("w-3.5 h-3.5", gitData.loading && "animate-spin")} />
                </Button>
            </div>

            {/* Virtualized Commits */}
            <div className="flex-1 min-h-0 bg-background">
                {commits.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center opacity-30">
                        <IconHistory className="w-12 h-12 mb-4" />
                        <span className="text-sm">{t('frontend.workspaceDashboard.git.noActivityDetected')}</span>
                    </div>
                ) : (
                    <Virtuoso
                        style={{ height: '100%' }}
                        totalCount={commits.length}
                        data={commits}
                        itemContent={(idx, commit) => (
                            <HistoryRow
                                commit={commit}
                                isSelected={selectedCommit?.hash === commit.hash}
                                onSelect={(c) => { void handleCommitSelect(c); }}
                                loadingDiff={loadingDiff}
                                commitDiff={commitDiff}
                                t={t}
                            />
                        )}
                        components={{
                            Footer: () => (
                                <div className="p-4 flex flex-col items-center">
                                    {hasMoreCommits ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => { void handleLoadMoreCommits(); }}
                                            disabled={isLoadingMore}
                                            className="text-xs text-muted-foreground hover:bg-muted"
                                        >
                                            {isLoadingMore ? (
                                                <IconLoader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                                            ) : (
                                                <IconArrowDownCircle className="w-3.5 h-3.5 mr-2" />
                                            )}
                                            {t('frontend.workspaceDashboard.git.loadOlderCommits')}
                                        </Button>
                                    ) : (
                                        <div className="py-6 flex items-center gap-4 text-muted-foreground/20">
                                            <div className="h-px w-8 bg-current" />
                                            <span className="text-[10px] font-medium uppercase tracking-widest">{t('frontend.workspaceDashboard.git.endOfHistory')}</span>
                                            <div className="h-px w-8 bg-current" />
                                        </div>
                                    )}
                                </div>
                            )
                        }}
                    />
                )}
            </div>
        </div>
    );
};

