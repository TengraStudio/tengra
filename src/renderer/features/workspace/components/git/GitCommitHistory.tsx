/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertCircle, IconArrowDownCircle, IconCalendar, IconChevronDown, IconChevronRight, IconHistory, IconListTree, IconLoader2, IconRefresh, IconUser } from '@tabler/icons-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
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

const HistoryRow = ({
    commit,
    isSelected,
    onSelect,
    loadingDiff,
    commitDiff,
    isLast,
    t
}: {
    commit: GitCommitInfo;
    isSelected: boolean;
    onSelect: (commit: GitCommitInfo | null) => void;
    loadingDiff: boolean;
    commitDiff: string | null;
    isLast: boolean;
    t: (key: string) => string;
}) => {
    const date = new Date(commit.date);

    return (
        <div className="relative group">
            {/* Timeline Vertical Line */}
            {!isLast && (
                <div className="absolute left-38px top-36px bottom-0 w-px bg-border/20 z-0 group-last:hidden" />
            )}

            <div className="flex flex-col relative z-10">
                <div
                    onClick={() => onSelect(commit)}
                    className={cn(
                        "flex items-start gap-4 py-4 px-5 cursor-pointer transition-all duration-200",
                        isSelected
                            ? "bg-primary/[0.03] border-l-2 border-primary"
                            : "hover:bg-muted/30 border-l-2 border-transparent"
                    )}
                >
                    {/* Avatar / Icon with Timeline Point */}
                    <div className="relative mt-0.5">
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center typo-overline font-bold shadow-sm border transition-all",
                            isSelected
                                ? "bg-primary/20 text-primary border-primary/30"
                                : "bg-muted text-muted-foreground/60 border-border/40 group-hover:bg-muted/80"
                        )}>
                            {commit.author[0].toUpperCase()}
                        </div>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-4">
                            <span className={cn(
                                "typo-overline font-bold leading-tight truncate ",
                                isSelected ? "text-primary" : "text-foreground/90"
                            )}>
                                {commit.message}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="outline" className="h-5 px-1.5 border-border/10 bg-muted/40 text-muted-foreground/40 rounded-md font-mono typo-overline hover:bg-muted/60 transition-colors">
                                    {commit.hash.substring(0, 7).toUpperCase()}
                                </Badge>
                                {isSelected ? <IconChevronDown className="w-3.5 h-3.5 text-primary/60" /> : <IconChevronRight className="w-3.5 h-3.5 text-muted-foreground/10 group-hover:text-muted-foreground/30" />}
                            </div>
                        </div>

                        <div className="flex items-center gap-4 typo-overline text-muted-foreground/40 font-bold uppercase leading-none">
                            <div className="flex items-center gap-1.5">
                                <IconUser className="w-2.5 h-2.5" />
                                <span>{commit.author}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <IconCalendar className="w-2.5 h-2.5" />
                                <span>{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {isSelected && (
                    <div className="mx-5 mb-8 mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        {loadingDiff ? (
                            <div className="flex flex-col items-center justify-center py-16 bg-muted/5 rounded-2xl border border-dashed border-border/10">
                                <IconLoader2 className="w-6 h-6 animate-spin text-primary/40 mb-3" />
                                <span className="typo-overline font-bold uppercase text-muted-foreground/30">Streaming Git Delta...</span>
                            </div>
                        ) : commitDiff ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-1 text-muted-foreground/30">
                                    <IconListTree className="w-3.5 h-3.5" />
                                    <span className="typo-overline font-bold uppercase ">Detailed Changeset</span>
                                </div>
                                <GitCommitDiffView
                                    selectedCommit={commit}
                                    loadingDiff={loadingDiff}
                                    commitDiff={commitDiff}
                                    t={t}
                                />
                            </div>
                        ) : (
                            <div className="py-12 flex flex-col items-center justify-center bg-muted/5 rounded-2xl text-center border border-dashed border-border/10">
                                <IconAlertCircle className="w-6 h-6 text-amber-500/30 mb-3" />
                                <span className="typo-overline font-bold text-muted-foreground/40 uppercase ">No Modifications Found</span>
                                <p className="typo-overline text-muted-foreground/20 max-w-240 mt-2 leading-relaxed">
                                    This commit contains no file-level changes. It could be a merge commit or metadata-only update.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

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
    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-10">
            {/* Header Section */}
            <div className="flex items-end justify-between px-2">
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-primary">
                        <IconHistory className="w-4 h-4" />
                        <h2 className="text-sm font-bold uppercase ">Repository Timeline</h2>
                    </div>
                    <div className="flex items-center gap-2.5 typo-overline font-bold uppercase text-muted-foreground/30">
                        <span>Index: {gitData.recentCommits.length} Records</span>
                        <div className="w-1 h-1 rounded-full bg-border/20" />
                        <span>Live Sync Enabled</span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchGitData}
                        disabled={gitData.loading}
                        className="h-9 px-4 typo-overline font-bold uppercase bg-background/50 border-border/10 hover:border-primary/20 hover:text-primary transition-all shadow-sm"
                    >
                        <IconRefresh className={cn("w-3.5 h-3.5 mr-2.5", gitData.loading && "animate-spin")} />
                        Re-Index
                    </Button>
                </div>
            </div>

            {/* Commits Container */}
            <div className="border border-border/40 rounded-3xl bg-card shadow-2xl shadow-black/20 overflow-hidden min-h-500 flex flex-col">
                {gitData.recentCommits.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-40 grayscale opacity-20">
                        <div className="p-6 rounded-full bg-muted mb-6">
                            <IconHistory className="w-10 h-10" />
                        </div>
                        <span className="typo-overline font-bold uppercase">No Activity Detected</span>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {gitData.recentCommits.map((commit: GitCommitInfo, idx) => (
                            <HistoryRow
                                key={commit.hash + idx}
                                commit={commit}
                                isSelected={selectedCommit?.hash === commit.hash}
                                onSelect={handleCommitSelect}
                                loadingDiff={loadingDiff}
                                commitDiff={commitDiff}
                                isLast={idx === gitData.recentCommits.length - 1 && !hasMoreCommits}
                                t={t}
                            />
                        ))}

                        {/* Pagination Section */}
                        <div className="p-6 flex flex-col items-center border-t border-border/10 bg-muted/5">
                            {hasMoreCommits ? (
                                <Button
                                    variant="ghost"
                                    onClick={handleLoadMoreCommits}
                                    disabled={isLoadingMore}
                                    className="group h-10 px-6 typo-overline font-bold uppercase text-muted-foreground/40 hover:text-primary hover:bg-primary/5 transition-all w-full md:w-auto"
                                >
                                    {isLoadingMore ? (
                                        <IconLoader2 className="w-4 h-4 animate-spin mr-3" />
                                    ) : (
                                        <IconArrowDownCircle className="w-4 h-4 mr-3 group-hover:translate-y-0.5 transition-transform" />
                                    )}
                                    Fetch Previous Commits
                                </Button>
                            ) : (
                                <div className="py-4 flex items-center gap-4 text-muted-foreground/20">
                                    <div className="h-px w-12 bg-current" />
                                    <span className="typo-overline font-bold uppercase ">End of History</span>
                                    <div className="h-px w-12 bg-current" />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

