import { ContributionGrid } from '@renderer/features/projects/components/ContributionGrid'
import { CodeEditor } from '@renderer/features/projects/components/ide/CodeEditor'
import { FileExplorer } from '@renderer/features/projects/components/ide/FileExplorer'
import { FolderInspector } from '@renderer/features/projects/components/ide/FolderInspector'
import { TerminalComponent } from '@renderer/features/projects/components/ide/Terminal'
import { ProjectTodoTab } from '@renderer/features/projects/components/ProjectTodoTab'
import { ArrowDown, ArrowUp, Camera, Check, Download, FileCode, GitBranch, GitCommit, Globe, Minus, Pencil, Plus, RefreshCw, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { DiffViewer } from '@/components/ui/DiffViewer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AgentCouncil } from '@/features/chat/components/AgentCouncil'
import { cn } from '@/lib/utils'
import { Project, ProjectAnalysis, ProjectStats } from '@/types'
import { getLanguageFromExtension } from '@/utils/language-map'

interface OpenFile {
    path: string
    name: string
    content: string
    isDirty: boolean
}

import { Language, useTranslation } from '@/i18n'

interface ProjectDashboardProps {
    project: Project
    onUpdate?: (updates: Partial<Project>) => Promise<void>
    onOpenLogoGenerator?: () => void
    language?: Language
    // External tab control
    activeTab?: 'overview' | 'terminal' | 'files' | 'tasks' | 'search' | 'council' | 'git'
    onTabChange?: (tab: 'overview' | 'terminal' | 'files' | 'tasks' | 'search' | 'council' | 'git') => void
    onDelete?: () => void
}

export const ProjectDashboard = ({
    project,
    onUpdate,
    onOpenLogoGenerator,
    language = 'en',
    activeTab: externalTab,
    onTabChange,
    onDelete
}: ProjectDashboardProps) => {
    const { t } = useTranslation(language)
    const [stats, setStats] = useState<ProjectStats | null>(null)
    const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null)
    const [loading, setLoading] = useState(false)
    const [internalTab, setInternalTab] = useState<'overview' | 'terminal' | 'files' | 'tasks' | 'search' | 'council' | 'git'>('overview')
    // Use external tab if provided, otherwise use internal
    const activeTab = externalTab ?? internalTab
    const setActiveTab = onTabChange ?? setInternalTab
    const [projectRoot, setProjectRoot] = useState<string>(project.path)
    const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
    const [activeFile, setActiveFile] = useState<string | null>(null)
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null)

    // Inline Editing State
    const [isEditingName, setIsEditingName] = useState(false)
    const [isEditingDesc, setIsEditingDesc] = useState(false)
    const [editName, setEditName] = useState(project.title)
    const [editDesc, setEditDesc] = useState(project.description || '')

    // Git State
    const [gitData, setGitData] = useState<{
        branch: string | null
        isClean: boolean | null
        lastCommit: { hash: string; message: string; author: string; relativeTime: string } | null
        recentCommits: Array<{ hash: string; message: string; author: string; date: string }>
        isRepository: boolean
        loading: boolean
        changedFiles: Array<{ status: string; path: string; staged: boolean }>
        stagedFiles: Array<{ status: string; path: string; staged: boolean }>
        unstagedFiles: Array<{ status: string; path: string; staged: boolean }>
    }>({
        branch: null,
        isClean: null,
        lastCommit: null,
        recentCommits: [],
        isRepository: false,
        loading: false,
        changedFiles: [],
        stagedFiles: [],
        unstagedFiles: []
    })
    const [selectedFile, setSelectedFile] = useState<{ path: string; staged: boolean } | null>(null)
    const [fileDiff, setFileDiff] = useState<{ original: string; modified: string } | null>(null)
    const [loadingDiff, setLoadingDiff] = useState(false)

    // Additional Git State
    const [branches, setBranches] = useState<string[]>([])
    const [remotes, setRemotes] = useState<Array<{ name: string; url: string; fetch: boolean; push: boolean }>>([])
    const [trackingInfo, setTrackingInfo] = useState<{ tracking: string | null; ahead: number; behind: number } | null>(null)
    const [diffStats, setDiffStats] = useState<{ staged: { added: number; deleted: number; files: number }; unstaged: { added: number; deleted: number; files: number }; total: { added: number; deleted: number; files: number } } | null>(null)
    const [commitStats, setCommitStats] = useState<Record<string, number>>({})
    const [commitMessage, setCommitMessage] = useState('')
    const [isCommitting, setIsCommitting] = useState(false)
    const [isPushing, setIsPushing] = useState(false)
    const [isPulling, setIsPulling] = useState(false)
    const [isCheckingOut, setIsCheckingOut] = useState(false)

    const fetchGitData = useCallback(async () => {
        if (!project.path) { return }

        setGitData(prev => ({ ...prev, loading: true }))
        try {
            // Check if it's a git repository
            const repoCheck = await window.electron.git.isRepository(project.path)
            if (!repoCheck.isRepository) {
                setGitData({
                    branch: null,
                    isClean: null,
                    lastCommit: null,
                    recentCommits: [],
                    isRepository: false,
                    loading: false,
                    changedFiles: [],
                    stagedFiles: [],
                    unstagedFiles: []
                })
                return
            }

            // Fetch all git data in parallel
            const [branchResult, statusResult, lastCommitResult, recentCommitsResult, detailedStatus, branchesResult, remotesResult, trackingResult, diffStatsResult, commitStatsResult] = await Promise.all([
                window.electron.git.getBranch(project.path),
                window.electron.git.getStatus(project.path),
                window.electron.git.getLastCommit(project.path),
                window.electron.git.getRecentCommits(project.path, 10),
                window.electron.git.getDetailedStatus(project.path),
                window.electron.git.getBranches(project.path),
                window.electron.git.getRemotes(project.path),
                window.electron.git.getTrackingInfo(project.path),
                window.electron.git.getDiffStats(project.path),
                window.electron.git.getCommitStats(project.path, 365)
            ])

            setGitData({
                branch: branchResult.success ? branchResult.branch ?? null : null,
                isClean: statusResult.success ? (statusResult.isClean ?? null) : null,
                lastCommit: lastCommitResult.success && lastCommitResult.hash
                    ? {
                        hash: lastCommitResult.hash,
                        message: lastCommitResult.message || '',
                        author: lastCommitResult.author || '',
                        relativeTime: lastCommitResult.relativeTime || ''
                    }
                    : null,
                recentCommits: recentCommitsResult.success ? (recentCommitsResult.commits ?? []) : [],
                isRepository: true,
                loading: false,
                changedFiles: detailedStatus.success ? (detailedStatus.allFiles ?? []) : [],
                stagedFiles: detailedStatus.success ? (detailedStatus.stagedFiles ?? []) : [],
                unstagedFiles: detailedStatus.success ? (detailedStatus.unstagedFiles ?? []) : []
            })

            setBranches(branchesResult.success ? (branchesResult.branches ?? []) : [])
            setRemotes(remotesResult.success ? (remotesResult.remotes ?? []) : [])
            setTrackingInfo(trackingResult.success ? { tracking: trackingResult.tracking ?? null, ahead: trackingResult.ahead ?? 0, behind: trackingResult.behind ?? 0 } : null)
            setDiffStats(diffStatsResult.success ? {
                staged: diffStatsResult.staged ?? { added: 0, deleted: 0, files: 0 },
                unstaged: diffStatsResult.unstaged ?? { added: 0, deleted: 0, files: 0 },
                total: diffStatsResult.total ?? { added: 0, deleted: 0, files: 0 }
            } : null)
            setCommitStats(commitStatsResult.success ? (commitStatsResult.commitCounts ?? {}) : {})
        } catch (error) {
            console.error('Failed to fetch git data:', error)
            setGitData(prev => ({ ...prev, loading: false }))
        }
    }, [project.path])

    // Fetch git data when git tab is active
    useEffect(() => {
        if (activeTab === 'git' && project.path) {
            void fetchGitData()
        }
    }, [activeTab, project.path, fetchGitData])

    const loadFileDiff = useCallback(async (filePath: string, staged: boolean) => {
        if (!project.path) { return }

        setLoadingDiff(true)
        try {
            const result = await window.electron.git.getFileDiff(project.path, filePath, staged)
            if (result.success) {
                setFileDiff({
                    original: result.original,
                    modified: result.modified
                })
            }
        } catch (error) {
            console.error('Failed to load file diff:', error)
        } finally {
            setLoadingDiff(false)
        }
    }, [project.path])

    const handleGitFileSelect = useCallback(async (file: { status: string; path: string; staged: boolean }) => {
        setSelectedFile(file)
        await loadFileDiff(file.path, file.staged)
    }, [loadFileDiff])

    const handleStageFile = useCallback(async (filePath: string) => {
        if (!project.path) { return }

        try {
            const result = await window.electron.git.stageFile(project.path, filePath)
            if (result.success) {
                await fetchGitData()
                // Update selected file if it's the same
                if (selectedFile?.path === filePath) {
                    setSelectedFile({ ...selectedFile, staged: true })
                    await loadFileDiff(filePath, true)
                }
            }
        } catch (error) {
            console.error('Failed to stage file:', error)
        }
    }, [project.path, fetchGitData, selectedFile, loadFileDiff])

    const handleUnstageFile = useCallback(async (filePath: string) => {
        if (!project.path) { return }

        try {
            const result = await window.electron.git.unstageFile(project.path, filePath)
            if (result.success) {
                await fetchGitData()
                // Update selected file if it's the same
                if (selectedFile?.path === filePath) {
                    setSelectedFile({ ...selectedFile, staged: false })
                    await loadFileDiff(filePath, false)
                }
            }
        } catch (error) {
            console.error('Failed to unstage file:', error)
        }
    }, [project.path, fetchGitData, selectedFile, loadFileDiff])

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

    const handleCheckout = useCallback(async (branch: string) => {
        if (!project.path) { return }

        setIsCheckingOut(true)
        try {
            const result = await window.electron.git.checkout(project.path, branch)
            if (result.success) {
                await fetchGitData()
            } else {
                console.error('Failed to checkout branch:', result.error)
            }
        } catch (error) {
            console.error('Failed to checkout branch:', error)
        } finally {
            setIsCheckingOut(false)
        }
    }, [project.path, fetchGitData])

    const handleCommit = useCallback(async () => {
        if (!project.path || !commitMessage.trim()) { return }

        setIsCommitting(true)
        try {
            const result = await window.electron.git.commit(project.path, commitMessage.trim())
            if (result.success) {
                setCommitMessage('')
                await fetchGitData()
            } else {
                console.error('Failed to commit:', result.error)
            }
        } catch (error) {
            console.error('Failed to commit:', error)
        } finally {
            setIsCommitting(false)
        }
    }, [project.path, commitMessage, fetchGitData])

    const handlePush = useCallback(async () => {
        if (!project.path) { return }

        setIsPushing(true)
        try {
            const result = await window.electron.git.push(project.path, 'origin')
            if (result.success) {
                await fetchGitData()
            } else {
                console.error('Failed to push:', result.error)
            }
        } catch (error) {
            console.error('Failed to push:', error)
        } finally {
            setIsPushing(false)
        }
    }, [project.path, fetchGitData])

    const handlePull = useCallback(async () => {
        if (!project.path) { return }

        setIsPulling(true)
        try {
            const result = await window.electron.git.pull(project.path)
            if (result.success) {
                await fetchGitData()
            } else {
                console.error('Failed to pull:', result.error)
            }
        } catch (error) {
            console.error('Failed to pull:', error)
        } finally {
            setIsPulling(false)
        }
    }, [project.path, fetchGitData])

    const analyzeProject = useCallback(async () => {
        setLoading(true)
        try {
            const rootPath = project.path
            console.warn('[ProjectDashboard] Requesting analysis for path:', rootPath)
            if (rootPath) {
                setProjectRoot(rootPath)
                window.electron.log.info(`[ProjectDashboard] Calling analyze for ${rootPath}`)
                const data = await window.electron.project.analyze(rootPath, project.id)
                window.electron.log.info('[ProjectDashboard] Analysis results received', data as ProjectAnalysis)
                setAnalysis(data)
                setStats(data.stats)
            }
        } catch (error) {
            console.error('Project analysis failed:', error)
        } finally {
            setLoading(false)
        }
    }, [project.path, project.id])

    const handleSaveName = async () => {
        if (editName.trim() && editName !== project.title) {
            await onUpdate?.({ title: editName })
        }
        setIsEditingName(false)
    }

    const handleSaveDesc = async () => {
        if (editDesc !== project.description) {
            await onUpdate?.({ description: editDesc })
        }
        setIsEditingDesc(false)
    }

    useEffect(() => {
        void analyzeProject()
    }, [project.path, project.id, analyzeProject])

    const handleFileSelect = async (path: string) => {
        if (openFiles.find(f => f.path === path)) {
            setActiveFile(path)
            setActiveTab('files')
            return
        }

        try {
            const content = await window.electron.files.readFile(path)
            const name = path.split(/[\\/]/).pop() || 'file'
            setOpenFiles([...openFiles, { path, name, content, isDirty: false }])
            setActiveFile(path)
            setActiveTab('files')
        } catch (error) {
            console.error('Failed to open file', error)
        }
    }

    const closeFile = (e: React.MouseEvent, path: string) => {
        e.stopPropagation()
        const newFiles = openFiles.filter(f => f.path !== path)
        setOpenFiles(newFiles)
        if (activeFile === path) {
            setActiveFile(newFiles.length > 0 ? newFiles[newFiles.length - 1].path : null)
        }
    }

    if (loading && !analysis) {
        return (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                {t('projectDashboard.analyzing')}
            </div>
        )
    }

    if (!analysis) {
        return (
            <div className="p-8 text-center text-muted-foreground">{t('projectDashboard.noProject')}</div>
        )
    }

    const { type, dependencies } = analysis
    const activeFileObj = openFiles.find(f => f.path === activeFile)

    return (
        <div className="h-full flex flex-col bg-background text-foreground">
            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-2">
                {activeTab === 'overview' && (
                    <div className="space-y-8 overflow-y-auto pr-2 pb-12 animate-in fade-in duration-500">
                        {/* Project Header & Identity */}
                        <div className="flex flex-col md:flex-row gap-8 items-start bg-card/20 p-6 rounded-3xl border border-white/5 backdrop-blur-sm">
                            {/* Logo Area */}
                            <div className="relative group shrink-0">
                                <div className="w-32 h-32 rounded-2xl bg-black/40 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden transition-all group-hover:border-primary/50 shadow-inner">
                                    {project.logo ? (
                                        <img src={`safe-file://${project.logo}`} alt="Logo" className="w-full h-full object-cover" />
                                    ) : (
                                        <Sparkles className="w-10 h-10 text-muted-foreground/20" />
                                    )}

                                    <button
                                        onClick={onOpenLogoGenerator}
                                        className="absolute inset-0 bg-primary/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 text-white"
                                    >
                                        <Camera className="w-6 h-6" />
                                        <span className="text-[10px] font-bold uppercase tracking-tighter">{t('projects.changeLogo') || 'Change Logo'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Name & Description Area */}
                            <div className="flex-1 space-y-4 w-full">
                                <div className="space-y-1 group">
                                    {isEditingName ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                autoFocus
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') { void handleSaveName() }
                                                    if (e.key === 'Escape') { setIsEditingName(false) }
                                                }}
                                                onBlur={handleSaveName}
                                                className="text-3xl font-black bg-black/40 border border-primary/50 rounded-lg px-2 py-1 outline-none w-full tracking-tight"
                                            />
                                            <button onClick={handleSaveName} className="p-2 bg-primary text-primary-foreground rounded-lg">
                                                <Check className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <h1
                                            onClick={() => setIsEditingName(true)}
                                            className="text-4xl font-black tracking-tighter text-white cursor-pointer hover:text-primary transition-colors flex items-center gap-3"
                                        >
                                            {project.title}
                                            <Pencil className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                                        </h1>
                                    )}
                                </div>

                                <div className="group">
                                    {isEditingDesc ? (
                                        <div className="space-y-2">
                                            <textarea
                                                autoFocus
                                                value={editDesc}
                                                onChange={e => setEditDesc(e.target.value)}
                                                onBlur={handleSaveDesc}
                                                className="w-full bg-black/40 border border-primary/30 rounded-xl p-3 text-sm text-gray-300 outline-none min-h-[80px] resize-none"
                                                placeholder={(t('projects.description') || 'Description') + '...'}
                                            />
                                        </div>
                                    ) : (
                                        <p
                                            onClick={() => setIsEditingDesc(true)}
                                            className="text-sm text-muted-foreground leading-relaxed cursor-pointer hover:text-foreground transition-colors max-w-2xl flex items-start gap-2"
                                        >
                                            {project.description || (t('projects.noDescription') || 'No description provided')}
                                            <Pencil className="w-3 h-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-4 pt-2">
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{type}</span>
                                    </div>
                                    <div className="text-[10px] font-medium text-muted-foreground font-mono bg-white/5 px-2 py-1 rounded border border-white/5">
                                        {projectRoot}
                                    </div>
                                    <button
                                        onClick={analyzeProject}
                                        disabled={loading}
                                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 text-xs"
                                        title={t('common.refresh')}
                                    >
                                        <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                                        {loading ? t('common.loading') : t('common.refresh')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="bg-card p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1 tracking-wider">{t('projectDashboard.fileCount')}</div>
                                <div className="text-2xl font-black text-white">{stats?.fileCount ?? 0}</div>
                            </div>
                            <div className="bg-card p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1 tracking-wider">{t('projectDashboard.loc')}</div>
                                <div className="text-2xl font-black text-white">~{stats?.loc ?? 0}</div>
                            </div>
                            <div className="bg-card p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1 tracking-wider">{t('projectDashboard.totalSize') || 'Total Size'}</div>
                                <div className="text-2xl font-black text-white">{stats ? formatBytes(stats.totalSize) : '0 B'}</div>
                            </div>
                            <div className="bg-card p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1 tracking-wider">{t('projectDashboard.modules')}</div>
                                <div className="text-2xl font-black text-white">{analysis?.monorepo?.packages?.length ?? Object.keys(dependencies ?? {}).length}</div>
                            </div>
                            <div className="bg-card p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1 tracking-wider">{t('projectDashboard.type')}</div>
                                <div className="text-2xl font-black text-primary capitalize">{type}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Technology Stack */}
                            <div className="bg-card/40 rounded-2xl border border-white/5 p-5 space-y-4">
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    {t('projectDashboard.techStack')}
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {(analysis?.frameworks ?? []).map((fw: string) => (
                                        <span key={fw} className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-xs text-blue-300 font-medium">
                                            {fw}
                                        </span>
                                    ))}
                                    {(analysis?.frameworks?.length ?? 0) === 0 && <span className="text-xs text-muted-foreground italic">{t('projectDashboard.noFrameworks')}</span>}
                                </div>
                            </div>

                            {/* Language Distribution */}
                            <div className="bg-card/40 rounded-2xl border border-white/5 p-5 space-y-4">
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    {t('projectDashboard.langDist')}
                                </h3>
                                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                                    {Object.entries(analysis?.languages ?? {})
                                        .sort(([, a], [, b]) => (b as number) - (a as number))
                                        .slice(0, 15)
                                        .map(([lang, count]) => {
                                            const percentage = stats ? Math.round(((count as number) / stats.fileCount) * 100) : 0
                                            return (
                                                <div key={lang} className="space-y-1">
                                                    <div className="flex justify-between text-[10px] uppercase font-bold tracking-tight">
                                                        <span className="text-gray-300">{lang}</span>
                                                        <span className="text-muted-foreground">{percentage}%</span>
                                                    </div>
                                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-emerald-500/50 rounded-full"
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                </div>
                            </div>
                        </div>

                        {/* TODO List Section */}
                        {(analysis?.todos?.length ?? 0) > 0 && (
                            <div className="bg-card/40 rounded-2xl border border-white/5 p-5 space-y-4">
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                                    {t('projectDashboard.todoList') || 'Upcoming Tasks'}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {analysis?.todos.map((todo: string, i: number) => (
                                        <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                                            <div className="w-4 h-4 rounded border border-white/20 mt-0.5 flex-shrink-0" />
                                            <span className="text-xs text-zinc-300 line-clamp-2">{todo}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Danger Zone */}
                        <div className="mt-12 pt-8 border-t border-red-500/20">
                            <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                                <Trash2 className="w-5 h-5" />
                                {t('projects.dangerZone') || 'Danger Zone'}
                            </h3>
                            <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-6 flex items-center justify-between">
                                <div>
                                    <h4 className="text-white font-medium mb-1">{t('projects.deleteProject') || 'Delete Project'}</h4>
                                    <p className="text-sm text-muted-foreground">{t('projects.deleteWarning') || 'This action cannot be undone.'}</p>
                                </div>
                                <button
                                    onClick={onDelete}
                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-colors text-sm font-medium"
                                >
                                    {t('common.delete') || 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'terminal' && (
                    <div className="h-full bg-black rounded-xl border border-white/10 overflow-hidden p-1">
                        <TerminalComponent cwd={projectRoot} />
                    </div>
                )}

                {activeTab === 'tasks' && (
                    <div className="h-full overflow-hidden">
                        <ProjectTodoTab projectRoot={projectRoot} t={t} />
                    </div>
                )}

                {activeTab === 'search' && (
                    <div className="h-full flex flex-col space-y-4">
                        <div className="flex gap-2 bg-card p-4 rounded-xl border border-border">
                            <input
                                type="text"
                                placeholder={t('projectDashboard.searchInProject')}
                                className="flex-1 bg-black/20 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                        const query = e.currentTarget.value
                                        if (query.trim().length > 1) {
                                            setLoading(true)
                                            try {
                                                const results = await window.electron.code.searchFiles(projectRoot, query)
                                                const event = new CustomEvent('search-results', { detail: results });
                                                window.dispatchEvent(event);
                                            } finally { setLoading(false) }
                                        }
                                    }
                                }}
                            />
                        </div>
                        <div className="flex-1 bg-card rounded-xl border border-border overflow-hidden flex flex-col p-2">
                            <SearchResults projectRoot={projectRoot} onSelect={handleFileSelect} t={t} />
                        </div>
                    </div>
                )}

                {activeTab === 'council' && (
                    <div className="h-full">
                        <AgentCouncil language={language} />
                    </div>
                )}

                {activeTab === 'git' && (
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
                                            onClick={fetchGitData}
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
                                                <Select value={gitData.branch || ''} onValueChange={handleCheckout} disabled={isCheckingOut}>
                                                    <SelectTrigger className="h-8 text-sm">
                                                        <SelectValue>
                                                            <div className="flex items-center gap-2">
                                                                <GitBranch className="w-3.5 h-3.5" />
                                                                {gitData.branch || 'N/A'}
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
                                                <div className="text-sm font-semibold text-white">{gitData.branch || 'N/A'}</div>
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
                                                {gitData.lastCommit?.relativeTime || 'N/A'}
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
                                            onClick={handlePull}
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
                                            onClick={handlePush}
                                            disabled={isPushing || remotes.length === 0 || trackingInfo?.ahead === 0}
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
                                                    onClick={handleCommit}
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
                                            onClick={fetchGitData}
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
                                                <div key={commit.hash || i} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                                        {commit.author?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm text-white font-medium truncate">
                                                            {commit.message || 'No message'}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                            {commit.author} • {commit.hash?.substring(0, 7)} • {new Date(commit.date).toLocaleDateString()}
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
                                                    onClick={fetchGitData}
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
                                                                onClick={() => handleGitFileSelect(file)}
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
                                                                onClick={() => handleGitFileSelect(file)}
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
                                                            {getStatusIcon(selectedFile.path.split('/').pop() || '')}
                                                            <div>
                                                                <div className="text-sm font-semibold text-white">{selectedFile.path}</div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {getStatusLabel(gitData.changedFiles.find(f => f.path === selectedFile.path)?.status || '')}
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
                        )}
                    </div>
                )}

                {activeTab === 'files' && (
                    <div className="h-full flex gap-4 transition-all duration-300">
                        {/* Sidebar */}
                        <div className="w-64 flex-shrink-0 bg-card rounded-xl border border-white/10 flex flex-col">
                            <div className="p-3 border-b border-white/10 text-xs font-bold uppercase text-muted-foreground flex justify-between items-center">
                                {t('projectDashboard.explorer')}
                            </div>
                            <div className="flex-1 overflow-hidden p-1">
                                <FileExplorer rootPath={projectRoot} onFileSelect={handleFileSelect} onFolderSelect={(path) => setSelectedFolder(path)} />
                            </div>
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 bg-card rounded-xl border border-white/10 flex flex-col overflow-hidden min-w-0">
                            {openFiles.length > 0 ? (
                                <>
                                    <div className="flex items-center overflow-x-auto border-b border-white/10 bg-black/20 scrollbar-none">
                                        {openFiles.map(file => (
                                            <div
                                                key={file.path}
                                                onClick={() => setActiveFile(file.path)}
                                                className={`
                                                    group flex items-center gap-2 px-3 py-2 text-xs border-r border-white/5 cursor-pointer min-w-[120px] max-w-[200px]
                                                    ${activeFile === file.path ? 'bg-card text-primary font-medium border-t-2 border-t-primary' : 'text-muted-foreground hover:bg-white/5'}
                                                `}
                                            >
                                                <FileCode size={12} className={activeFile === file.path ? 'text-primary' : 'opacity-50'} />
                                                <span className="truncate flex-1">{file.name}</span>
                                                <button
                                                    onClick={(e) => closeFile(e, file.path)}
                                                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex-1 relative">
                                        {activeFileObj && (
                                            <CodeEditor
                                                content={activeFileObj.content}
                                                language={activeFileObj.name.split('.').pop() || 'typescript'}
                                                onChange={(newContent) => {
                                                    const newFiles = openFiles.map(f => f.path === activeFileObj.path ? { ...f, content: newContent, isDirty: true } : f)
                                                    setOpenFiles(newFiles)
                                                }}
                                            />
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                                    <CodeCodeIcon className="w-16 h-16 mb-4 opacity-10" />
                                    <p>{t('projectDashboard.selectFile')}</p>
                                </div>
                            )}
                        </div>

                        {/* Folder Inspector */}
                        <div className={cn(
                            "w-80 flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden border-l border-white/10",
                            selectedFolder ? "opacity-100 mr-0" : "opacity-0 w-0 border-0 pointer-events-none"
                        )}>
                            <FolderInspector folderPath={selectedFolder} rootPath={projectRoot} />
                        </div>
                    </div>
                )}
            </div>
        </div >
    )
}

const formatBytes = (bytes: number) => {
    if (bytes === 0) { return '0 B' }
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const SearchResults = ({ projectRoot, onSelect, t }: { projectRoot: string, onSelect: (path: string) => void, t: (key: string) => string }) => {
    const [results, setResults] = useState<{ file: string; line: number; text: string }[]>([])

    useEffect(() => {
        const handler = (e: Event) => {
            const customEvent = e as CustomEvent
            setResults(customEvent.detail)
        }
        window.addEventListener('search-results', handler)
        return () => window.removeEventListener('search-results', handler)
    }, [])

    if (results.length === 0) { return <div className="text-center text-muted-foreground mt-10">{t('projectDashboard.noResults')}</div> }

    return (
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 space-y-2">
            {results.map((res, i) => (
                <div key={i} onClick={() => onSelect(res.file)} className="p-2 hover:bg-white/5 rounded cursor-pointer group">
                    <div className="flex items-center gap-2 text-xs text-blue-400 mb-0.5">
                        <span className="font-mono">{res.file.replace(projectRoot, '')}:{res.line}</span>
                    </div>
                    <div className="text-sm text-gray-300 font-mono line-clamp-1 opacity-80 group-hover:opacity-100">
                        {res.text.trim()}
                    </div>
                </div>
            ))}
        </div>
    )
}

const CodeCodeIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
)
