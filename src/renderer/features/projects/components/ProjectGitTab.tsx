import {
    ArrowDown,
    ArrowUp,
    Check,
    Download,
    GitBranch,
    GitCommit,
    Globe,
    Minus,
    Plus,
    RefreshCw,
    Upload,
    FileCode
} from 'lucide-react'
import React, { useEffect } from 'react'

import { ContributionGrid } from '@renderer/features/projects/components/ContributionGrid'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useGitData } from '@renderer/features/projects/hooks/useGitData'
import { Project } from '@shared/types/project'

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
        handleCommitSelect
    } = useGitData(project)

    useEffect(() => {
        if (activeTab === 'git' && project.path) {
            void fetchGitData()
        }
    }, [activeTab, project.path, fetchGitData])

    const getStatusIcon = (status: string) => {
        if (status.startsWith('A')) { return <Plus className="w-3.5 h-3.5 text-emerald-400" /> }
        if (status.startsWith('D')) { return <Minus className="w-3.5 h-3.5 text-red-400" /> }
        if (status.startsWith('M')) { return <FileCode className="w-3.5 h-3.5 text-amber-400" /> }
        if (status.startsWith('R')) { return <FileCode className="w-3.5 h-3.5 text-blue-400" /> }
        return <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
    }

    return (
        <div className="h-full flex flex-col gap-6 overflow-y-auto px-6 py-6">
            {!gitData.isRepository ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-2">
                        <div className="text-muted-foreground text-sm">{t('projectDashboard.notAGitRepo')}</div>
                    </div>
                </div>
            ) : gitData.loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center space-y-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto" />
                        <div className="text-muted-foreground text-sm">{t('projectDashboard.loadingGit')}</div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Git Status Header */}
                    <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-foreground flex items-center gap-3">
                                <div className={cn("w-3 h-3 rounded-full", gitData.isClean ? "bg-emerald-500" : "bg-amber-500")} />
                                {t('projectDashboard.gitRepository')}
                            </h2>
                            <button
                                onClick={() => { void fetchGitData() }}
                                className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                                title={t('common.refresh')}
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                            <div className="bg-muted/30 rounded-xl p-4">
                                <div className="text-xs text-muted-foreground mb-2">{t('projectDashboard.branch')}</div>
                                {branches.length > 0 ? (
                                    <Select value={gitData.branch ?? ''} onValueChange={(value) => { void handleCheckout(value) }} disabled={isCheckingOut}>
                                        <SelectTrigger className="h-8 text-sm">
                                            <SelectValue>
                                                <div className="flex items-center gap-2">
                                                    <GitBranch className="w-3.5 h-3.5" />
                                                    {gitData.branch ?? 'N/A'}
                                                </div>
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {branches.map((branch) => (
                                                <SelectItem key={branch} value={branch}>
                                                    {branch === gitData.branch && <Check className="w-3.5 h-3.5 inline mr-2" />}
                                                    {branch}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="text-sm font-semibold text-foreground">{gitData.branch ?? 'N/A'}</div>
                                )}
                            </div>
                            <div className="bg-muted/30 rounded-xl p-4">
                                <div className="text-xs text-muted-foreground mb-1">{t('projectDashboard.status')}</div>
                                <div className={cn("text-sm font-semibold", gitData.isClean ? "text-emerald-400" : "text-amber-400")}>
                                    {gitData.isClean ? t('projectDashboard.clean') : t('projectDashboard.dirty')}
                                </div>
                            </div>
                            <div className="bg-muted/30 rounded-xl p-4">
                                <div className="text-xs text-muted-foreground mb-1">{t('projectDashboard.lastCommit')}</div>
                                <div className="text-sm font-semibold text-foreground">
                                    {gitData.lastCommit?.relativeTime ?? 'N/A'}
                                </div>
                            </div>
                            <div className="bg-muted/30 rounded-xl p-4">
                                <div className="text-xs text-muted-foreground mb-1">{t('projectDashboard.tracking')}</div>
                                <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    {trackingInfo?.tracking ? (
                                        <>
                                            {trackingInfo.ahead > 0 && (
                                                <span className="text-amber-400 flex items-center gap-1">
                                                    <ArrowUp className="w-3 h-3" /> {trackingInfo.ahead}
                                                </span>
                                            )}
                                            {trackingInfo.behind > 0 && (
                                                <span className="text-blue-400 flex items-center gap-1">
                                                    <ArrowDown className="w-3 h-3" /> {trackingInfo.behind}
                                                </span>
                                            )}
                                            {trackingInfo.ahead === 0 && trackingInfo.behind === 0 && (
                                                <span className="text-emerald-400">{t('projectDashboard.upToDate')}</span>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-muted-foreground">{t('projectDashboard.noRemote')}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => { void handlePull() }}
                                disabled={isPulling || remotes.length === 0}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                                    "bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30",
                                    "disabled:opacity-50 disabled:cursor-not-allowed"
                                )}
                            >
                                {isPulling ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Download className="w-3.5 h-3.5" />
                                )}
                                {t('projectDashboard.pull')}
                            </button>
                            <button
                                onClick={() => { void handlePush() }}
                                disabled={isPushing || remotes.length === 0 || (trackingInfo?.ahead ?? 0) === 0}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                                    "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30",
                                    "disabled:opacity-50 disabled:cursor-not-allowed"
                                )}
                            >
                                {isPushing ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Upload className="w-3.5 h-3.5" />
                                )}
                                {t('projectDashboard.push')}
                            </button>
                        </div>

                        {/* Commit Section */}
                        {gitData.stagedFiles.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-border/50">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={commitMessage}
                                        onChange={(e) => setCommitMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey && commitMessage.trim()) {
                                                e.preventDefault()
                                                void handleCommit()
                                            }
                                        }}
                                        placeholder={t('projectDashboard.commitMessage')}
                                        className="flex-1 bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                                    />
                                    <button
                                        onClick={() => { void handleCommit() }}
                                        disabled={!commitMessage.trim() || isCommitting}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                                            "bg-primary border border-primary/30 text-primary-foreground hover:bg-primary/90",
                                            "disabled:opacity-50 disabled:cursor-not-allowed"
                                        )}
                                    >
                                        {isCommitting ? (
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <GitCommit className="w-4 h-4" />
                                        )}
                                        Commit
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Remotes */}
                    {remotes.length > 0 && (
                        <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-6">
                            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                                <Globe className="w-4 h-4" />
                                Remotes
                            </h3>
                            <div className="space-y-2">
                                {remotes.map((remote) => (
                                    <div key={remote.name} className="bg-muted/30 rounded-xl p-3 flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-semibold text-foreground">{remote.name}</div>
                                            <div className="text-xs text-muted-foreground">{remote.url}</div>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            {remote.fetch && <span>fetch</span>}
                                            {remote.push && <span>push</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Commits */}
                    <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-foreground">{t('projectDashboard.recentCommits')}</h3>
                            <div className="flex items-center gap-2">
                                {selectedCommit && (
                                    <button
                                        onClick={() => { void handleCommitSelect(null as any) }}
                                        className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/50 transition-colors"
                                    >
                                        Clear Selection
                                    </button>
                                )}
                                <button
                                    onClick={() => { void fetchGitData() }}
                                    className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                                    title={t('common.refresh')}
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Contribution Chart */}
                        {Object.keys(commitStats).length > 0 && !selectedCommit && (
                            <div className="mb-6">
                                <ContributionGrid commitCounts={commitStats} />
                            </div>
                        )}

                        {gitData.recentCommits.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                {t('projectDashboard.noCommits')}
                            </div>
                        ) : (
                            <div className={cn("grid gap-4", selectedCommit ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
                                {gitData.recentCommits.map((commit, i) => (
                                    <button
                                        key={commit.hash ?? i}
                                        onClick={() => { void handleCommitSelect(commit) }}
                                        className={cn(
                                            "flex flex-col gap-3 p-5 rounded-2xl transition-all text-left group",
                                            selectedCommit?.hash === commit.hash
                                                ? "bg-primary/20 border-2 border-primary shadow-lg shadow-primary/10"
                                                : "bg-muted/30 border border-border/50 hover:bg-muted/50 hover:border-primary/30"
                                        )}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                                                {commit.author[0].toUpperCase()}
                                            </div>
                                            <div className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded group-hover:text-primary transition-colors">
                                                {commit.hash.substring(0, 7)}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-foreground font-bold line-clamp-2 leading-tight mb-1">
                                                {commit.message}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                <span className="font-semibold text-primary/70">{commit.author}</span>
                                                <span className="mx-1.5">/</span>
                                                {new Date(commit.date).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Commit Diff View */}
                        {selectedCommit && (
                            <div className="mt-6 border-t border-border/50 pt-6 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <GitCommit className="w-4 h-4 text-primary" />
                                        <h4 className="text-sm font-bold text-foreground">
                                            Changes in Commit <span className="font-mono text-primary">{selectedCommit.hash.substring(0, 7)}</span>
                                        </h4>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                                        Unified Diff
                                    </div>
                                </div>
                                <div className="bg-neutral-950 rounded-xl border border-border/50 overflow-hidden">
                                    {loadingDiff ? (
                                        <div className="h-64 flex items-center justify-center text-muted-foreground">
                                            <RefreshCw className="w-6 h-6 animate-spin mr-3" />
                                            <span>Analyzing commit changes...</span>
                                        </div>
                                    ) : commitDiff ? (
                                        <div className="max-h-[500px] overflow-auto p-4 font-mono text-xs leading-relaxed">
                                            {commitDiff.split('\n').map((line, idx) => {
                                                const isAddition = line.startsWith('+') && !line.startsWith('+++')
                                                const isDeletion = line.startsWith('-') && !line.startsWith('---')
                                                const isHeader = line.startsWith('diff --git') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')

                                                return (
                                                    <div
                                                        key={idx}
                                                        className={cn(
                                                            "whitespace-pre",
                                                            isAddition && "text-emerald-400 bg-emerald-500/5",
                                                            isDeletion && "text-red-400 bg-red-500/5",
                                                            isHeader && "text-blue-400 font-bold opacity-80 mt-2 first:mt-0"
                                                        )}
                                                    >
                                                        {line || ' '}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="h-40 flex items-center justify-center text-muted-foreground text-sm italic">
                                            No diff data available for this commit.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Changes Statistics & Files */}
                    {diffStats && (diffStats.total.added > 0 || diffStats.total.deleted > 0 || diffStats.total.files > 0 || gitData.changedFiles.length > 0) && (
                        <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-6 flex flex-col gap-6">
                            <h3 className="text-sm font-bold text-foreground">Changes Statistics</h3>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-muted/30 rounded-xl p-4">
                                    <div className="text-xs text-muted-foreground mb-1">Files Changed</div>
                                    <div className="text-2xl font-bold text-foreground">{diffStats.total.files}</div>
                                </div>
                                <div className="bg-muted/30 rounded-xl p-4">
                                    <div className="text-xs text-muted-foreground mb-1">Lines Added</div>
                                    <div className="text-2xl font-bold text-emerald-400">+{diffStats.total.added}</div>
                                </div>
                                <div className="bg-muted/30 rounded-xl p-4">
                                    <div className="text-xs text-muted-foreground mb-1">Lines Deleted</div>
                                    <div className="text-2xl font-bold text-red-400">-{diffStats.total.deleted}</div>
                                </div>
                            </div>

                            {/* Changed Files List */}
                            {gitData.changedFiles.length > 0 && (
                                <div className="flex flex-col gap-4">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('projectDashboard.changedFiles')}</h4>

                                    {/* Staged Files */}
                                    {gitData.stagedFiles.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="text-xs font-semibold text-emerald-400 px-2">{t('projectDashboard.stagedFiles')}</div>
                                            <div className="space-y-1">
                                                {gitData.stagedFiles.map((file, i) => (
                                                    <div
                                                        key={`staged-${file.path}-${i}`}
                                                        className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-xs"
                                                    >
                                                        {getStatusIcon(file.status)}
                                                        <span className="flex-1 truncate text-foreground">{file.path}</span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                void handleUnstageFile(file.path)
                                                            }}
                                                            className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-amber-400"
                                                            title={t('projectDashboard.unstage')}
                                                        >
                                                            <Minus className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Unstaged Files */}
                                    {gitData.unstagedFiles.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="text-xs font-semibold text-amber-400 px-2">{t('projectDashboard.unstagedFiles')}</div>
                                            <div className="space-y-1">
                                                {gitData.unstagedFiles.map((file, i) => (
                                                    <div
                                                        key={`unstaged-${file.path}-${i}`}
                                                        className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-xs"
                                                    >
                                                        {getStatusIcon(file.status)}
                                                        <span className="flex-1 truncate text-foreground">{file.path}</span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                void handleStageFile(file.path)
                                                            }}
                                                            className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-emerald-400"
                                                            title={t('projectDashboard.stage')}
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
                    )}
                </>
            )}
        </div>
    )
}
