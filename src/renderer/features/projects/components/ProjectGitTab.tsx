import {
    ArrowDown,
    ArrowUp,
    Check,
    Download,
    FileCode,
    GitBranch,
    GitCommit,
    Globe,
    Minus,
    Plus,
    RefreshCw,
    Upload
} from 'lucide-react'
import React, { useEffect } from 'react'

import { ContributionGrid } from '@renderer/features/projects/components/ContributionGrid'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DiffViewer } from '@/components/ui/DiffViewer'
import { cn } from '@/lib/utils'
import { getLanguageFromExtension } from '@/utils/language-map'
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
        selectedFile,
        fileDiff,
        loadingDiff,
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
        handleGitFileSelect,
        handleStageFile,
        handleUnstageFile,
        handleCheckout,
        handleCommit,
        handlePush,
        handlePull
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

    const getStatusLabel = (status: string) => {
        if (status.startsWith('A')) { return t('projectDashboard.added') }
        if (status.startsWith('D')) { return t('projectDashboard.deleted') }
        if (status.startsWith('M')) { return t('projectDashboard.modified') }
        if (status.startsWith('R')) { return t('projectDashboard.renamed') }
        return status
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
                    <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-white flex items-center gap-3">
                                <div className={cn("w-3 h-3 rounded-full", gitData.isClean ? "bg-emerald-500" : "bg-amber-500")} />
                                {t('projectDashboard.gitRepository')}
                            </h2>
                            <button
                                onClick={() => { void fetchGitData() }}
                                className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                                title={t('common.refresh')}
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                            <div className="bg-white/5 rounded-xl p-4">
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
                                    <div className="text-sm font-semibold text-white">{gitData.branch ?? 'N/A'}</div>
                                )}
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                                <div className="text-xs text-muted-foreground mb-1">{t('projectDashboard.status')}</div>
                                <div className={cn("text-sm font-semibold", gitData.isClean ? "text-emerald-400" : "text-amber-400")}>
                                    {gitData.isClean ? t('projectDashboard.clean') : t('projectDashboard.dirty')}
                                </div>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                                <div className="text-xs text-muted-foreground mb-1">{t('projectDashboard.lastCommit')}</div>
                                <div className="text-sm font-semibold text-white">
                                    {gitData.lastCommit?.relativeTime ?? 'N/A'}
                                </div>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                                <div className="text-xs text-muted-foreground mb-1">{t('projectDashboard.tracking')}</div>
                                <div className="text-sm font-semibold text-white flex items-center gap-2">
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
                            <div className="mt-4 pt-4 border-t border-white/10">
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
                                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
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

                    {/* Statistics */}
                    {diffStats && (diffStats.total.added > 0 || diffStats.total.deleted > 0 || diffStats.total.files > 0) && (
                        <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                            <h3 className="text-sm font-bold text-white mb-4">Changes Statistics</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-white/5 rounded-xl p-4">
                                    <div className="text-xs text-muted-foreground mb-1">Files Changed</div>
                                    <div className="text-2xl font-bold text-white">{diffStats.total.files}</div>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4">
                                    <div className="text-xs text-muted-foreground mb-1">Lines Added</div>
                                    <div className="text-2xl font-bold text-emerald-400">+{diffStats.total.added}</div>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4">
                                    <div className="text-xs text-muted-foreground mb-1">Lines Deleted</div>
                                    <div className="text-2xl font-bold text-red-400">-{diffStats.total.deleted}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Remotes */}
                    {remotes.length > 0 && (
                        <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                <Globe className="w-4 h-4" />
                                Remotes
                            </h3>
                            <div className="space-y-2">
                                {remotes.map((remote) => (
                                    <div key={remote.name} className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-semibold text-white">{remote.name}</div>
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
                    <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-white">{t('projectDashboard.recentCommits')}</h3>
                            <button
                                onClick={() => { void fetchGitData() }}
                                className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                                title={t('common.refresh')}
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Contribution Chart */}
                        {Object.keys(commitStats).length > 0 && (
                            <div className="mb-6">
                                <ContributionGrid commitCounts={commitStats} />
                            </div>
                        )}

                        {gitData.recentCommits.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                {t('projectDashboard.noCommits')}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {gitData.recentCommits.map((commit, i) => (
                                    <div key={commit.hash ?? i} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                            {commit.author[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-white font-medium truncate">
                                                {commit.message}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                {commit.author} • {commit.hash.substring(0, 7)} • {new Date(commit.date).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Changed Files Section */}
                    {gitData.changedFiles.length > 0 && (
                        <div className="grid grid-cols-[300px_1fr] gap-4 min-h-0 flex-1">
                            {/* File List */}
                            <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-white/10 p-4 flex flex-col overflow-hidden">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-white">{t('projectDashboard.changedFiles')}</h3>
                                    <button
                                        onClick={() => { void fetchGitData() }}
                                        className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                                        title={t('common.refresh')}
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Staged Files */}
                                {gitData.stagedFiles.length > 0 && (
                                    <div className="mb-4">
                                        <div className="text-xs font-semibold text-emerald-400 mb-2 px-2">{t('projectDashboard.stagedFiles')}</div>
                                        <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                                            {gitData.stagedFiles.map((file, i) => (
                                                <div
                                                    key={`staged-${file.path}-${i}`}
                                                    onClick={() => { void handleGitFileSelect(file) }}
                                                    className={cn(
                                                        "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors text-xs",
                                                        selectedFile?.path === file.path && selectedFile?.staged
                                                            ? "bg-primary/20 border border-primary/30"
                                                            : "bg-white/5 hover:bg-white/10 border border-transparent"
                                                    )}
                                                >
                                                    {getStatusIcon(file.status)}
                                                    <span className="flex-1 truncate text-white">{file.path}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            void handleUnstageFile(file.path)
                                                        }}
                                                        className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-amber-400"
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
                                    <div className="flex-1 min-h-0 flex flex-col">
                                        <div className="text-xs font-semibold text-amber-400 mb-2 px-2">{t('projectDashboard.unstagedFiles')}</div>
                                        <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
                                            {gitData.unstagedFiles.map((file, i) => (
                                                <div
                                                    key={`unstaged-${file.path}-${i}`}
                                                    onClick={() => { void handleGitFileSelect(file) }}
                                                    className={cn(
                                                        "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors text-xs",
                                                        selectedFile?.path === file.path && !selectedFile?.staged
                                                            ? "bg-primary/20 border border-primary/30"
                                                            : "bg-white/5 hover:bg-white/10 border border-transparent"
                                                    )}
                                                >
                                                    {getStatusIcon(file.status)}
                                                    <span className="flex-1 truncate text-white">{file.path}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            void handleStageFile(file.path)
                                                        }}
                                                        className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-emerald-400"
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

                            {/* Diff Viewer */}
                            <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden flex flex-col">
                                {selectedFile ? (
                                    <>
                                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {getStatusIcon(selectedFile.path.split('/').pop() ?? '')}
                                                <div>
                                                    <div className="text-sm font-semibold text-white">{selectedFile.path}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {getStatusLabel(gitData.changedFiles.find(f => f.path === selectedFile.path)?.status ?? '')}
                                                        {selectedFile.staged && ' • Staged'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-1 min-h-0">
                                            {loadingDiff ? (
                                                <div className="flex items-center justify-center h-full">
                                                    <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                                                </div>
                                            ) : fileDiff ? (
                                                <DiffViewer
                                                    original={fileDiff.original}
                                                    modified={fileDiff.modified}
                                                    language={getLanguageFromExtension(selectedFile.path)}
                                                    className="h-full"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                                    {t('projectDashboard.noDiffAvailable')}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                        {t('projectDashboard.selectFileToViewDiff')}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )
            }
        </div >
    )
}
