import { useGitData } from '@renderer/features/workspace/hooks/useGitData';
import { AlertTriangle, CheckCircle2, FileCode, Minus, Plus, RefreshCw } from 'lucide-react';
import React, { useEffect } from 'react';

import type { Workspace } from '@/types';

import {
    GitAdvancedPanel,
    GitChangeStats,
    GitCommitHistory,
    GitCommitSection,
    GitQuickActions,
    GitRemotes,
    GitStatusHeader
} from '../components/git';

interface WorkspaceGitTabProps {
    workspace: Workspace
    t: (key: string) => string
    activeTab: string
}

export const WorkspaceGitTab: React.FC<WorkspaceGitTabProps> = ({ workspace, t, activeTab }) => {
    const {
        gitData,
        branches,
        remotes,
        trackingInfo,
        diffStats,
        commitStats,
        commitMessage,
        setCommitMessage,
        isCommitting,
        isPushing,
        isPulling,
        isCheckingOut,
        lastActionError,
        fetchGitData,
        handleStageFile,
        handleUnstageFile,
        handleCheckout,
        handleCommit,
        handlePush,
        handlePull,
        selectedCommit,
        commitDiff,
        loadingDiff,
        sectionStates,
        handleCommitSelect
    } = useGitData(workspace);

    useEffect(() => {
        if (activeTab === 'git' && workspace.path) {
            void fetchGitData();
        }
    }, [activeTab, workspace.path, fetchGitData]);

    const getStatusIcon = (status: string) => {
        if (status.startsWith('A')) { return <Plus className="w-3.5 h-3.5 text-success" />; }
        if (status.startsWith('D')) { return <Minus className="w-3.5 h-3.5 text-destructive" />; }
        if (status.startsWith('M')) { return <FileCode className="w-3.5 h-3.5 text-warning" />; }
        if (status.startsWith('R')) { return <FileCode className="w-3.5 h-3.5 text-primary" />; }
        return <FileCode className="w-3.5 h-3.5 text-muted-foreground" />;
    };

    const sectionDescriptors: Array<{ key: keyof typeof sectionStates; label: string }> = [
        { key: 'status', label: t('workspaceDashboard.gitSectionStatus') },
        { key: 'actions', label: t('workspaceDashboard.gitSectionActions') },
        { key: 'remotes', label: t('workspaceDashboard.gitSectionRemotes') },
        { key: 'commits', label: t('workspaceDashboard.gitSectionCommits') },
        { key: 'changes', label: t('workspaceDashboard.gitSectionChanges') },
    ];

    return (
        <div className="h-full flex flex-col gap-6 overflow-y-auto px-6 py-6">
            {!gitData.isRepository ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-2">
                        <div className="text-muted-foreground text-sm">{t('workspaceDashboard.notAGitRepo')}</div>
                    </div>
                </div>
            ) : (
                <>
                    {lastActionError && lastActionError.toLowerCase().includes('lock') && (
                        <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                            {lastActionError}
                        </div>
                    )}
                    {gitData.loading && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 border border-border/50 rounded-xl px-3 py-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                            {t('workspaceDashboard.loadingGit')}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        {sectionDescriptors.map(section => {
                            const state = sectionStates[section.key];
                            return (
                                <div key={section.key} className="bg-card/60 border border-border/50 rounded-xl px-3 py-2 space-y-1">
                                    <div className="tw-text-11 text-muted-foreground">{section.label}</div>
                                    <div className="flex items-center gap-1.5 text-xs font-medium">
                                        {state.loading ? (
                                            <>
                                                <RefreshCw className="w-3 h-3 animate-spin text-warning" />
                                                <span className="text-warning">{t('workspaceDashboard.gitSectionLoading')}</span>
                                            </>
                                        ) : state.error ? (
                                            <>
                                                <AlertTriangle className="w-3 h-3 text-destructive" />
                                                <span className="text-destructive">{t('workspaceDashboard.gitSectionError')}</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-3 h-3 text-success" />
                                                <span className="text-success">{t('workspaceDashboard.gitSectionReady')}</span>
                                            </>
                                        )}
                                    </div>
                                    {state.error && (
                                        <div className="tw-text-10 text-muted-foreground truncate" title={state.error}>
                                            {state.error}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <GitStatusHeader
                        gitData={gitData}
                        branches={branches}
                        trackingInfo={trackingInfo}
                        isCheckingOut={isCheckingOut}
                        handleCheckout={handleCheckout}
                        fetchGitData={fetchGitData}
                        t={t}
                    />

                    <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-6">
                        <GitQuickActions
                            isPulling={isPulling}
                            isPushing={isPushing}
                            remotes={remotes}
                            trackingInfo={trackingInfo}
                            handlePull={handlePull}
                            handlePush={handlePush}
                            t={t}
                        />

                        {gitData.stagedFiles.length > 0 && (
                            <GitCommitSection
                                commitMessage={commitMessage}
                                setCommitMessage={setCommitMessage}
                                isCommitting={isCommitting}
                                handleCommit={handleCommit}
                                t={t}
                            />
                        )}
                    </div>

                    <GitRemotes remotes={remotes} t={t} />

                    <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-6">
                        <GitCommitHistory
                            gitData={gitData}
                            selectedCommit={selectedCommit}
                            commitStats={commitStats}
                            loadingDiff={loadingDiff}
                            commitDiff={commitDiff}
                            handleCommitSelect={handleCommitSelect}
                            fetchGitData={fetchGitData}
                            t={t}
                        />
                    </div>

                    {diffStats && (diffStats.total.added > 0 || diffStats.total.deleted > 0 || diffStats.total.files > 0 || gitData.changedFiles.length > 0) && (
                        <GitChangeStats
                            diffStats={diffStats}
                            gitData={gitData}
                            handleStageFile={handleStageFile}
                            handleUnstageFile={handleUnstageFile}
                            getStatusIcon={getStatusIcon}
                            t={t}
                        />
                    )}

                    <GitAdvancedPanel workspacePath={workspace.path} />
                </>
            )}
        </div>
    );
};
