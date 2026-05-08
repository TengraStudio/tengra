/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertCircle, IconArrowDown, IconArrowUp, IconCheck, IconChecks, IconChevronDown, IconChevronLeft, IconChevronRight, IconExternalLink, IconGitBranch, IconGitCommit, IconGitMerge, IconGitPullRequest, IconLoader2, IconMessageCircle, IconRefresh, IconTag, IconUserCheck, IconX } from '@tabler/icons-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownContent } from '@/features/chat/components/message/MarkdownContent';
import { useGitData } from '@/features/workspace/hooks/useGitData';
import { cn } from '@/lib/utils';
import type { Workspace } from '@/types';

import {
    GitAdvancedPanel,
    GitBranchSelect,
    GitChangeStats,
    GitCommitHistory,
    GitCommitSection,
    GitRemotes,
    GitStatusHeader
} from '../components/git';
import { GitFile } from '../components/git/types';

interface WorkspaceGitTabProps {
    workspace: Workspace;
    t: (key: string) => string;
    activeTab: string;
}

export const WorkspaceGitTab: React.FC<WorkspaceGitTabProps> = ({ workspace, t, activeTab }) => {
    const {
        gitData,
        remotes,
        trackingInfo,
        diffStats,
        commitMessage,
        setCommitMessage,
        isCommitting,
        isPulling,
        lastActionError,
        fetchGitData,
        handleStageFile,
        handleUnstageFile,
        handleStageAll,
        handleUnstageAll,
        handleCommit,
        handlePull,
        selectedCommit,
        commitDiff,
        loadingDiff,
        handleCommitSelect,
        selectedFile,
        fileDiff,
        handleGitFileSelect,
        isLoadingMore,
        hasMoreCommits,
        handleLoadMoreCommits,
        branches,
        isCheckingOut,
        handleCheckout,
        pullRequests,
        issues,
        fetchPullRequests,
        fetchIssues,
        sectionStates,
        selectedPrNumber,
        prDetails,
        isUpdatingPr,
        handleSelectPr,
        handleUpdatePrState,
        handleMergePr,
        handleApprovePr
    } = useGitData(workspace);

    const [view, setView] = useState<'changes' | 'history' | 'pull_requests' | 'issues'>('changes');

    useEffect(() => {
        const handler = (e: Event) => {
            const customEvent = e as CustomEvent<{ path?: string }>;
            const targetPath = typeof customEvent.detail?.path === 'string' ? customEvent.detail.path : '';
            if (!targetPath || activeTab !== 'git') {
                return;
            }
            setView('changes');
            void fetchGitData().finally(() => {
                const normalized = targetPath.replace(/\\/g, '/');
                const workspaceRoot = (workspace.path ?? '').replace(/\\/g, '/').replace(/\/+$/g, '');
                const relative = workspaceRoot && normalized.toLowerCase().startsWith(workspaceRoot.toLowerCase() + '/')
                    ? normalized.slice(workspaceRoot.length + 1)
                    : normalized;
                void handleGitFileSelect({ path: relative, staged: false, status: '' });
            });
        };
        window.addEventListener('tengra:workspace-git-open-diff', handler);
        return () => window.removeEventListener('tengra:workspace-git-open-diff', handler);
    }, [activeTab, fetchGitData, handleGitFileSelect, workspace.path]);

    useEffect(() => {
        if (activeTab === 'git' && workspace.path) {
            void fetchGitData();
        }
    }, [activeTab, workspace.path, fetchGitData]);

    useEffect(() => {
        if (view === 'pull_requests' && pullRequests.length === 0) {
            void fetchPullRequests();
        } else if (view === 'issues' && issues.length === 0) {
            void fetchIssues();
        }
    }, [view, fetchPullRequests, fetchIssues, pullRequests.length, issues.length]);

    // Handle toggle for file selection
    const onFileSelect = useCallback((file: GitFile | null) => {
        if (!file) {
            handleGitFileSelect(null);
            return;
        }
        if (selectedFile?.path === file.path && selectedFile.staged === file.staged) {
            handleGitFileSelect(null);
        } else {
            handleGitFileSelect(file);
        }
    }, [selectedFile, handleGitFileSelect]);

    if (!gitData.isRepository) {
        return (
            <div className="flex flex-1 items-center justify-center p-12">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mx-auto mb-6">
                        <IconGitBranch className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <h3 className="text-lg font-medium">{t('frontend.workspaceDashboard.notAGitRepo')}</h3>
                    <Button variant="outline" className="rounded-lg px-8">
                        Initialize Repository
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-background select-none">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between px-6 h-14 border-b border-border/40 shrink-0">
                <div className="flex items-center gap-4">
                    <GitBranchSelect
                        branch={gitData.branch}
                        branches={branches}
                        isCheckingOut={isCheckingOut}
                        handleCheckout={handleCheckout}
                    />

                    <div className="h-4 w-px bg-border/40 mx-1" />

                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 px-3 text-sm font-semibold rounded-md",
                                view === 'changes' ? "bg-muted text-foreground" : "text-muted-foreground"
                            )}
                            onClick={() => setView('changes')}
                        >
                            Changes
                            {gitData.changedFiles.length > 0 && (
                                <Badge variant="secondary" className="ml-2 h-4 px-1 bg-primary/10 text-primary border-none min-w-1-25rem flex justify-center">
                                    {gitData.changedFiles.length}
                                </Badge>
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 px-3 text-sm font-semibold rounded-md",
                                view === 'history' ? "bg-muted text-foreground" : "text-muted-foreground"
                            )}
                            onClick={() => setView('history')}
                        >
                            History
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 px-3 text-sm font-semibold rounded-md",
                                view === 'pull_requests' ? "bg-muted text-foreground" : "text-muted-foreground"
                            )}
                            onClick={() => setView('pull_requests')}
                        >
                            {t('frontend.workspaceDashboard.pullRequests')}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 px-3 text-sm font-semibold rounded-md",
                                view === 'issues' ? "bg-muted text-foreground" : "text-muted-foreground"
                            )}
                            onClick={() => setView('issues')}
                        >
                            {t('frontend.workspaceDashboard.issues')}
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {trackingInfo && (
                        <div className="flex items-center gap-3 px-3 typo-overline font-medium text-muted-foreground border-r border-border/40 mr-2 h-6">
                            <span className="flex items-center gap-1"><IconArrowUp className="w-3 h-3 text-emerald-500/60" /> {trackingInfo.ahead}</span>
                            <span className="flex items-center gap-1"><IconArrowDown className="w-3 h-3 text-indigo-500/60" /> {trackingInfo.behind}</span>
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 hover:bg-muted text-muted-foreground"
                        onClick={() => fetchGitData()}
                    >
                        <IconRefresh className={cn("w-3.5 h-3.5", gitData.loading && "animate-spin")} />
                    </Button>
                    <Button
                        size="sm"
                        className="h-8 px-4 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-md"
                        onClick={() => handlePull()}
                        disabled={isPulling}
                    >
                        {isPulling ? <IconRefresh className="w-3.5 h-3.5 animate-spin mr-2" /> : "Sync Changes"}
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    <ScrollArea className="flex-1">
                        <div className="p-6 pb-20 max-w-5xl">
                            {lastActionError && (
                                <div className="mb-6 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                                        <span>{lastActionError}</span>
                                    </div>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 px-3 hover:bg-destructive/10 text-destructive font-bold uppercase tracking-wider text-[10px] rounded-md"
                                        onClick={() => fetchGitData()} // Re-fetch clears error in hook
                                    >
                                        Dismiss
                                    </Button>
                                </div>
                            )}

                            {view === 'changes' && (
                                <div className="space-y-10">
                                    {/* Commit Section moved to TOP */}
                                    {gitData.changedFiles.length > 0 && (
                                        <GitCommitSection
                                            commitMessage={commitMessage}
                                            setCommitMessage={setCommitMessage}
                                            isCommitting={isCommitting}
                                            handleCommit={handleCommit}
                                            workspacePath={workspace.path}
                                            t={t}
                                        />
                                    )}

                                    <GitChangeStats
                                        diffStats={diffStats || { staged: { added: 0, deleted: 0, files: 0 }, unstaged: { added: 0, deleted: 0, files: 0 }, total: { added: 0, deleted: 0, files: 0 } }}
                                        gitData={gitData}
                                        handleStageFile={handleStageFile}
                                        handleUnstageFile={handleUnstageFile}
                                        handleStageAll={handleStageAll}
                                        handleUnstageAll={handleUnstageAll}
                                        getStatusIcon={() => null}
                                        handleGitFileSelect={onFileSelect}
                                        selectedFile={selectedFile}
                                        fileDiff={fileDiff}
                                        loadingDiff={loadingDiff}
                                        t={t}
                                    />
                                </div>
                            )}

                            {view === 'history' && (
                                <GitCommitHistory
                                    gitData={gitData}
                                    selectedCommit={selectedCommit}
                                    loadingDiff={loadingDiff}
                                    commitDiff={commitDiff}
                                    isLoadingMore={isLoadingMore}
                                    hasMoreCommits={hasMoreCommits}
                                    handleCommitSelect={handleCommitSelect}
                                    handleLoadMoreCommits={handleLoadMoreCommits}
                                    fetchGitData={fetchGitData}
                                    t={t}
                                />
                            )}

                            {view === 'pull_requests' && (
                                <div className="space-y-4">
                                    {sectionStates.pullRequests.loading ? (
                                        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                                            <IconRefresh className="w-8 h-8 text-muted-foreground/40 animate-spin mb-4" />
                                            <p className="text-sm text-muted-foreground">Fetching pull requests...</p>
                                        </div>
                                    ) : sectionStates.pullRequests.error ? (
                                        <div className="p-8 text-center bg-destructive/5 rounded-xl border border-destructive/10">
                                            <IconAlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
                                            <p className="text-sm font-medium text-destructive mb-1">Failed to load Pull Requests</p>
                                            <p className="text-xs text-muted-foreground mb-4">{sectionStates.pullRequests.error}</p>
                                            <Button variant="outline" size="sm" onClick={() => fetchPullRequests()}>Retry</Button>
                                        </div>
                                    ) : pullRequests.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                            <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center">
                                                <IconGitPullRequest className="w-8 h-8 text-muted-foreground/40" />
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="text-lg font-medium">{t('frontend.workspaceDashboard.noPullRequests')}</h3>
                                                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                                    {t('frontend.workspaceDashboard.pullRequestIntegrationHint')}
                                                </p>
                                            </div>
                                        </div>
                                    ) : selectedPrNumber && prDetails ? (
                                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            {/* PR Header / Back Button */}
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-4">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-9 w-9 rounded-xl bg-muted/5 hover:bg-muted/10 border border-border/10"
                                                        onClick={() => handleSelectPr(null)}
                                                    >
                                                        <IconChevronLeft className="w-5 h-5" />
                                                    </Button>
                                                    <div className="space-y-0.5">
                                                        <h3 className="text-xl font-bold tracking-tight">{prDetails.pr.title} <span className="text-muted-foreground/40 font-normal ml-1">#{prDetails.pr.number}</span></h3>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <Badge className={cn(
                                                                "h-5 px-2 text-[10px] font-bold uppercase tracking-wider",
                                                                prDetails.pr.merged ? "bg-purple-500/10 text-purple-500 border-purple-500/20" :
                                                                prDetails.pr.state === 'open' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                                                                "bg-destructive/10 text-destructive border-destructive/20"
                                                            )}>
                                                                {prDetails.pr.merged ? 'merged' : prDetails.pr.state}
                                                            </Badge>
                                                            {prDetails.pr.draft && (
                                                                <Badge variant="outline" className="h-5 px-2 text-[10px] font-bold uppercase tracking-wider border-muted-foreground/30 text-muted-foreground/60">
                                                                    draft
                                                                </Badge>
                                                            )}
                                                            <span>•</span>
                                                            <div className="flex items-center gap-1.5 font-medium text-foreground/70">
                                                                <img src={prDetails.pr.user.avatar_url} className="w-4 h-4 rounded-full" />
                                                                {prDetails.pr.user.login}
                                                            </div>
                                                            <span>•</span>
                                                            <span>{new Date(prDetails.pr.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                        {prDetails.pr.labels.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-2">
                                                                {prDetails.pr.labels.map((label: any) => (
                                                                    <span 
                                                                        key={label.id} 
                                                                        className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight"
                                                                        style={{ backgroundColor: `#${label.color}20`, color: `#${label.color}`, border: `1px solid #${label.color}40` }}
                                                                    >
                                                                        {label.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {prDetails.pr.state === 'open' && !prDetails.pr.merged && (
                                                        <>
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                className="h-8 gap-2 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10"
                                                                onClick={() => handleApprovePr(prDetails.pr.number)}
                                                                disabled={isUpdatingPr}
                                                            >
                                                                <IconChecks className="w-4 h-4" />
                                                                Approve
                                                            </Button>
                                                            <Button 
                                                                variant="default" 
                                                                size="sm" 
                                                                className="h-8 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                                                                onClick={() => handleMergePr(prDetails.pr.number)}
                                                                disabled={isUpdatingPr || prDetails.pr.mergeable === false}
                                                            >
                                                                {isUpdatingPr ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconGitMerge className="w-4 h-4" />}
                                                                Merge
                                                            </Button>
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                className="h-8 gap-2 text-destructive hover:bg-destructive/10 border-destructive/20"
                                                                onClick={() => handleUpdatePrState(prDetails.pr.number, 'closed')}
                                                                disabled={isUpdatingPr}
                                                            >
                                                                <IconX className="w-4 h-4" />
                                                                Close
                                                            </Button>
                                                        </>
                                                    )}
                                                    {prDetails.pr.state === 'closed' && !prDetails.pr.merged && (
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            className="h-8 gap-2 text-emerald-500 hover:bg-emerald-500/10 border-emerald-500/20"
                                                            onClick={() => handleUpdatePrState(prDetails.pr.number, 'open')}
                                                            disabled={isUpdatingPr}
                                                        >
                                                            <IconRefresh className="w-4 h-4" />
                                                            Reopen
                                                        </Button>
                                                    )}
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg"
                                                        onClick={() => window.open(prDetails.pr.html_url, '_blank')}
                                                    >
                                                        <IconExternalLink className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* PR Body / Description */}
                                            {prDetails.pr.body && (
                                                <div className="p-6 rounded-2xl bg-muted/5 border border-border/40 space-y-4">
                                                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                                        <IconMessageCircle className="w-3.5 h-3.5" />
                                                        Description
                                                    </div>
                                                    <div className="text-sm text-foreground/80 leading-relaxed">
                                                        <MarkdownContent content={prDetails.pr.body} t={t as any} />
                                                    </div>
                                                </div>
                                            )}

                                            {/* PR Stats / Info */}
                                            <div className="grid grid-cols-4 gap-4">
                                                <div className="p-4 rounded-xl bg-muted/5 border border-border/20 flex flex-col gap-1">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Base</span>
                                                    <div className="flex items-center gap-1.5 text-xs font-semibold truncate">
                                                        <IconGitBranch className="w-3.5 h-3.5 text-primary/60" />
                                                        {prDetails.pr.base.ref}
                                                    </div>
                                                </div>
                                                <div className="p-4 rounded-xl bg-muted/5 border border-border/20 flex flex-col gap-1">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Head</span>
                                                    <div className="flex items-center gap-1.5 text-xs font-semibold truncate">
                                                        <IconGitBranch className="w-3.5 h-3.5 text-indigo-500/60" />
                                                        {prDetails.pr.head.ref}
                                                    </div>
                                                </div>
                                                <div className="p-4 rounded-xl bg-muted/5 border border-border/20 flex flex-col gap-1">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Changes</span>
                                                    <div className="flex items-center gap-2 text-xs font-semibold">
                                                        <span className="text-emerald-500">+{prDetails.pr.additions}</span>
                                                        <span className="text-destructive">-{prDetails.pr.deletions}</span>
                                                    </div>
                                                </div>
                                                <div className="p-4 rounded-xl bg-muted/5 border border-border/20 flex flex-col gap-1">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Checks</span>
                                                    <div className="flex items-center gap-2 text-xs font-semibold">
                                                        {prDetails.checks.length > 0 ? (
                                                            <>
                                                                {prDetails.checks.every((c: any) => c.conclusion === 'success') ? (
                                                                    <span className="flex items-center gap-1 text-emerald-500"><IconCheck className="w-3.5 h-3.5" /> All pass</span>
                                                                ) : prDetails.checks.some((c: any) => c.conclusion === 'failure') ? (
                                                                    <span className="flex items-center gap-1 text-destructive"><IconX className="w-3.5 h-3.5" /> Failing</span>
                                                                ) : (
                                                                    <span className="flex items-center gap-1 text-amber-500"><IconLoader2 className="w-3.5 h-3.5 animate-spin" /> Pending</span>
                                                                )}
                                                            </>
                                                        ) : <span className="text-muted-foreground/40 italic">No checks</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Reviewers Section */}
                                            {prDetails.reviews.length > 0 && (
                                                <div className="space-y-4">
                                                    <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/40">Reviewers</h4>
                                                    <div className="flex flex-wrap gap-3">
                                                        {Array.from(new Map(prDetails.reviews.map((r: any) => [r.user.login, r])).values()).map((review: any) => (
                                                            <div key={review.id} className="flex items-center gap-2 p-2 px-3 rounded-full bg-muted/5 border border-border/20">
                                                                <img src={review.user.avatar_url} className="w-4 h-4 rounded-full" />
                                                                <span className="text-xs font-medium">{review.user.login}</span>
                                                                <Badge className={cn(
                                                                    "h-4 px-1.5 text-[8px] font-bold uppercase tracking-tighter",
                                                                    review.state === 'APPROVED' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                                    review.state === 'CHANGES_REQUESTED' ? "bg-destructive/10 text-destructive border-destructive/20" :
                                                                    "bg-muted text-muted-foreground border-transparent"
                                                                )}>
                                                                    {review.state.replace('_', ' ')}
                                                                </Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Files Changed */}
                                            <div className="space-y-4">
                                                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/40">Files Changed ({prDetails.files.length})</h4>
                                                <div className="grid gap-2">
                                                    {prDetails.files.map((file: any) => (
                                                        <FileDiffItem key={file.sha} file={file} t={t} />
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Comments Section */}
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/40">Activity</h4>
                                                    <Badge variant="outline" className="h-5 px-1.5 opacity-50">{prDetails.comments.length} comments</Badge>
                                                </div>
                                                <div className="space-y-4">
                                                    {prDetails.comments.map((comment: any) => (
                                                        <div key={comment.id} className="flex gap-4 group">
                                                            <img src={comment.user.avatar_url} className="w-8 h-8 rounded-full shrink-0 border border-border/20" />
                                                            <div className="flex-1 space-y-1.5">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-bold">{comment.user.login}</span>
                                                                    <span className="text-[10px] text-muted-foreground/50">{new Date(comment.created_at).toLocaleString()}</span>
                                                                </div>
                                                                <div className="text-sm text-foreground/80 bg-muted/5 p-4 rounded-2xl rounded-tl-none border border-border/20">
                                                                    <MarkdownContent content={comment.body} t={t as any} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {prDetails.comments.length === 0 && (
                                                        <div className="py-12 text-center border-2 border-dashed border-border/20 rounded-2xl">
                                                            <IconMessageCircle className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                                                            <p className="text-xs text-muted-foreground/40 font-medium">No activity yet</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {pullRequests.map((pr: any) => (
                                                <div 
                                                    key={pr.id} 
                                                    className="group p-4 rounded-xl border border-border/50 bg-muted/5 hover:bg-muted/10 transition-all flex items-start justify-between gap-4 cursor-pointer"
                                                    onClick={() => handleSelectPr(pr.number)}
                                                >
                                                    <div className="flex items-start gap-4">
                                                        <div className="mt-1">
                                                            <IconGitPullRequest className={cn("w-5 h-5", pr.state === 'open' ? "text-emerald-500" : "text-purple-500")} />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{pr.title}</span>
                                                                <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase font-bold tracking-wider bg-background/50 border-border/50">
                                                                    #{pr.number}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                <div className="flex items-center gap-1.5">
                                                                    <img src={pr.user.avatar_url} className="w-4 h-4 rounded-full" alt={pr.user.login} />
                                                                    <span className="font-medium text-foreground/80">{pr.user.login}</span>
                                                                </div>
                                                                <span>•</span>
                                                                <span>{new Date(pr.created_at).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            window.open(pr.html_url, '_blank');
                                                        }}
                                                    >
                                                        <IconExternalLink className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {view === 'issues' && (
                                <div className="space-y-4">
                                    {sectionStates.issues.loading ? (
                                        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                                            <IconRefresh className="w-8 h-8 text-muted-foreground/40 animate-spin mb-4" />
                                            <p className="text-sm text-muted-foreground">Fetching issues...</p>
                                        </div>
                                    ) : sectionStates.issues.error ? (
                                        <div className="p-8 text-center bg-destructive/5 rounded-xl border border-destructive/10">
                                            <IconAlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
                                            <p className="text-sm font-medium text-destructive mb-1">Failed to load Issues</p>
                                            <p className="text-xs text-muted-foreground mb-4">{sectionStates.issues.error}</p>
                                            <Button variant="outline" size="sm" onClick={() => fetchIssues()}>Retry</Button>
                                        </div>
                                    ) : issues.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                            <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center">
                                                <IconAlertCircle className="w-8 h-8 text-muted-foreground/40" />
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="text-lg font-medium">{t('frontend.workspaceDashboard.noIssuesFound')}</h3>
                                                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                                    {t('frontend.workspaceDashboard.issueTrackingIntegrationHint')}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {issues.map((issue: any) => (
                                                <div key={issue.id} className="group p-4 rounded-xl border border-border/50 bg-muted/5 hover:bg-muted/10 transition-all flex items-start justify-between gap-4">
                                                    <div className="flex items-start gap-4">
                                                        <div className="mt-1">
                                                            <IconAlertCircle className={cn("w-5 h-5", issue.state === 'open' ? "text-emerald-500" : "text-muted-foreground")} />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{issue.title}</span>
                                                                <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase font-bold tracking-wider bg-background/50 border-border/50">
                                                                    #{issue.number}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                <div className="flex items-center gap-1.5">
                                                                    <img src={issue.user.avatar_url} className="w-4 h-4 rounded-full" alt={issue.user.login} />
                                                                    <span className="font-medium text-foreground/80">{issue.user.login}</span>
                                                                </div>
                                                                <span>•</span>
                                                                <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary rounded-lg"
                                                        onClick={() => window.open(issue.html_url, '_blank')}
                                                    >
                                                        <IconExternalLink className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                <div className="w-80 border-l border-border/40 bg-muted/5 p-6 space-y-10 overflow-y-auto hidden lg:block">
                    {gitData && (
                        <GitStatusHeader
                            gitData={gitData}
                            diffStats={diffStats || { staged: { added: 0, deleted: 0, files: 0 }, unstaged: { added: 0, deleted: 0, files: 0 }, total: { added: 0, deleted: 0, files: 0 } }}
                            t={t}
                        />
                    )}
                    <GitRemotes remotes={remotes} t={t} />
                    <GitAdvancedPanel workspacePath={workspace.path} />
                </div>
            </div>
        </div>
    );
};

const FileDiffItem: React.FC<{ file: any; t: any }> = ({ file, t }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="rounded-xl border border-border/20 bg-muted/5 overflow-hidden">
            <div 
                className="p-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/10 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                        "transition-transform duration-200",
                        isExpanded ? "rotate-90" : ""
                    )}>
                        <IconChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                    </div>
                    <div className={cn(
                        "w-1.5 h-1.5 rounded-full flex-shrink-0",
                        file.status === 'added' ? "bg-emerald-500" :
                        file.status === 'removed' ? "bg-destructive" :
                        "bg-amber-500"
                    )} />
                    <span className="text-xs font-medium truncate text-foreground/80">{file.filename}</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold">
                        <span className="text-emerald-500">+{file.additions}</span>
                        <span className="text-destructive">-{file.deletions}</span>
                    </div>
                    {file.status !== 'renamed' && (
                        <div className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter bg-muted/20 border border-border/20 text-muted-foreground/60">
                            {file.status}
                        </div>
                    )}
                </div>
            </div>
            {isExpanded && file.patch && (
                <div className="border-t border-border/20 bg-background/40">
                    <div className="p-4 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre">
                        {file.patch.split('\n').map((line: string, i: number) => {
                            const isAdded = line.startsWith('+') && !line.startsWith('+++');
                            const isRemoved = line.startsWith('-') && !line.startsWith('---');
                            const isHeader = line.startsWith('@@');
                            
                            return (
                                <div 
                                    key={i} 
                                    className={cn(
                                        "px-2 -mx-2",
                                        isAdded ? "bg-emerald-500/10 text-emerald-500" :
                                        isRemoved ? "bg-destructive/10 text-destructive" :
                                        isHeader ? "bg-primary/5 text-primary/70 font-bold" :
                                        "text-foreground/60"
                                    )}
                                >
                                    {line}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {isExpanded && !file.patch && (
                <div className="p-4 border-t border-border/20 text-xs text-muted-foreground/40 italic text-center">
                    No preview available for this file type
                </div>
            )}
        </div>
    );
};

