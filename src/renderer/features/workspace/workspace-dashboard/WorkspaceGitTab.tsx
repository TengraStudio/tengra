/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertCircle, IconArrowDown, IconArrowUp, IconGitBranch, IconGitPullRequest, IconRefresh } from '@tabler/icons-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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

import { GitIssuesView } from './git/GitIssuesView';
import { GitPRDetailsView, GitPRListView } from './git/GitPRView';

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
    }, [view, fetchPullRequests, fetchIssues, pullRequests, issues]);

    const onFileSelect = useCallback((file: GitFile | null) => {
        if (!file) {
            void handleGitFileSelect(null);
            return;
        }
        if (selectedFile?.path === file.path && selectedFile.staged === file.staged) {
            void handleGitFileSelect(null);
        } else {
            void handleGitFileSelect(file);
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
                            >
                            {t('frontend.workspaceDashboard.git.changes')}
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
                            {t('frontend.workspaceDashboard.git.history')}
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
                        onClick={() => { void fetchGitData(); }}
                    >
                        <IconRefresh className={cn("w-3.5 h-3.5", gitData.loading && "animate-spin")} />
                    </Button>
                    <Button
                        size="sm"
                        className="h-8 px-4 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-md"
                        onClick={() => { void handlePull(); }}
                        disabled={isPulling}
                    >
                        {isPulling ? <IconRefresh className="w-3.5 h-3.5 animate-spin mr-2" /> : t('frontend.workspaceDashboard.git.syncChanges')}
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
                                        onClick={() => { void fetchGitData(); }} // Re-fetch clears error in hook
                                    >
                                        {t('common.dismiss')}
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
                                            <p className="text-sm text-muted-foreground">{t('frontend.workspaceDashboard.git.fetchingPullRequests')}</p>
                                        </div>
                                    ) : sectionStates.pullRequests.error ? (
                                        <div className="p-8 text-center bg-destructive/5 rounded-xl border border-destructive/10">
                                            <IconAlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
                                            <p className="text-sm font-medium text-destructive mb-1">{t('frontend.workspaceDashboard.git.failedLoadPullRequests')}</p>
                                            <p className="text-xs text-muted-foreground mb-4">{sectionStates.pullRequests.error}</p>
                                            <Button variant="outline" size="sm" onClick={() => { void fetchPullRequests(); }}>{t('common.retry')}</Button>
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
                                        <GitPRDetailsView
                                            prDetails={prDetails}
                                            isUpdatingPr={isUpdatingPr}
                                            handleSelectPr={(pr) => { void handleSelectPr(pr); }}
                                            handleUpdatePrState={(num, state) => { void handleUpdatePrState(num, state); }}
                                            handleMergePr={(num) => { void handleMergePr(num); }}
                                            handleApprovePr={(num) => { void handleApprovePr(num); }}
                                            t={t}
                                        />
                                    ) : (
                                        <GitPRListView
                                            pullRequests={pullRequests}
                                            handleSelectPr={(pr) => { void handleSelectPr(pr); }}
                                        />
                                    )}
                                </div>
                            )}

                            {view === 'issues' && (
                                <div className="space-y-4">
                                    {sectionStates.issues.loading ? (
                                        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                                            <IconRefresh className="w-8 h-8 text-muted-foreground/40 animate-spin mb-4" />
                                            <p className="text-sm text-muted-foreground">{t('frontend.workspaceDashboard.git.fetchingIssues')}</p>
                                        </div>
                                    ) : sectionStates.issues.error ? (
                                        <div className="p-8 text-center bg-destructive/5 rounded-xl border border-destructive/10">
                                            <IconAlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
                                            <p className="text-sm font-medium text-destructive mb-1">{t('frontend.workspaceDashboard.git.failedLoadIssues')}</p>
                                            <p className="text-xs text-muted-foreground mb-4">{sectionStates.issues.error}</p>
                                            <Button variant="outline" size="sm" onClick={() => { void fetchIssues(); }}>{t('common.retry')}</Button>
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
                                        <GitIssuesView issues={issues} />
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
