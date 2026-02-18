import { useGitData } from '@renderer/features/projects/hooks/useGitData';
import { Project } from '@shared/types/project';
import { AlertTriangle, CheckCircle2, FileCode, Minus, Plus, RefreshCw } from 'lucide-react';
import React, { useEffect } from 'react';

import { GitAdvancedPanel } from './git/GitAdvancedPanel';
import { GitChangeStats } from './git/GitChangeStats';
import { GitCommitHistory } from './git/GitCommitHistory';
import { GitCommitSection } from './git/GitCommitSection';
import { GitQuickActions } from './git/GitQuickActions';
import { GitRemotes } from './git/GitRemotes';
import { GitStatusHeader } from './git/GitStatusHeader';

interface ProjectGitTabProps {
    project: Project
    t: (key: string) => string
    activeTab: string
}

export const ProjectGitTab: React.FC<ProjectGitTabProps> = ({ project, t, activeTab }) => {
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
    } = useGitData(project);

    useEffect(() => {
        if (activeTab === 'git' && project.path) {
            void fetchGitData();
        }
    }, [activeTab, project.path, fetchGitData]);

    const getStatusIcon = (status: string) => {
        if (status.startsWith('A')) { return <Plus className="w-3.5 h-3.5 text-success" />; }
        if (status.startsWith('D')) { return <Minus className="w-3.5 h-3.5 text-destructive" />; }
        if (status.startsWith('M')) { return <FileCode className="w-3.5 h-3.5 text-warning" />; }
        if (status.startsWith('R')) { return <FileCode className="w-3.5 h-3.5 text-primary" />; }
        return <FileCode className="w-3.5 h-3.5 text-muted-foreground" />;
    };

    const sectionDescriptors: Array<{ key: keyof typeof sectionStates; label: string }> = [
        { key: 'status', label: t('projectDashboard.gitSectionStatus') },
        { key: 'actions', label: t('projectDashboard.gitSectionActions') },
        { key: 'remotes', label: t('projectDashboard.gitSectionRemotes') },
        { key: 'commits', label: t('projectDashboard.gitSectionCommits') },
        { key: 'changes', label: t('projectDashboard.gitSectionChanges') },
    ];

    return (
        <div className="h-full flex flex-col gap-6 overflow-y-auto px-6 py-6">
            {!gitData.isRepository ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-2">
                        <div className="text-muted-foreground text-sm">{t('projectDashboard.notAGitRepo')}</div>
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
                            {t('projectDashboard.loadingGit')}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        {sectionDescriptors.map(section => {
                            const state = sectionStates[section.key];
                            return (
                                <div key={section.key} className="bg-card/60 border border-border/50 rounded-xl px-3 py-2 space-y-1">
                                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{section.label}</div>
                                    <div className="flex items-center gap-1.5 text-xs font-medium">
                                        {state.loading ? (
                                            <>
                                                <RefreshCw className="w-3 h-3 animate-spin text-warning" />
                                                <span className="text-warning">{t('projectDashboard.gitSectionLoading')}</span>
                                            </>
                                        ) : state.error ? (
                                            <>
                                                <AlertTriangle className="w-3 h-3 text-destructive" />
                                                <span className="text-destructive">{t('projectDashboard.gitSectionError')}</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-3 h-3 text-success" />
                                                <span className="text-success">{t('projectDashboard.gitSectionReady')}</span>
                                            </>
                                        )}
                                    </div>
                                    {state.error && (
                                        <div className="text-[10px] text-muted-foreground truncate" title={state.error}>
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

                    <GitAdvancedPanel projectPath={project.path} />
                </>
            )}
        </div>
    );
};
