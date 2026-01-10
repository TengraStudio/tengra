import { useState, useEffect, useCallback } from 'react'
import { FileCode, X, Pencil, Camera, Sparkles, Check, RefreshCw } from 'lucide-react'
import { TerminalComponent } from './ide/Terminal'
import { FileExplorer } from './ide/FileExplorer'
import { CodeEditor } from './ide/CodeEditor'
import { FolderInspector } from './ide/FolderInspector'
import { AgentCouncil } from '@/features/chat/components/AgentCouncil'
import { ProjectTodoTab } from './ProjectTodoTab'
import { Project, ProjectAnalysis, ProjectStats } from '@/types'
import { cn } from '@/lib/utils'

interface OpenFile {
    path: string
    name: string
    content: string
    isDirty: boolean
}

import { useTranslation, Language } from '@/i18n'

interface ProjectDashboardProps {
    project: Project
    onUpdate?: (updates: Partial<Project>) => Promise<void>
    onOpenLogoGenerator?: () => void
    language?: Language
    // External tab control
    activeTab?: 'overview' | 'terminal' | 'files' | 'tasks' | 'search' | 'council' | 'git'
    onTabChange?: (tab: 'overview' | 'terminal' | 'files' | 'tasks' | 'search' | 'council' | 'git') => void
}

export const ProjectDashboard = ({
    project,
    onUpdate,
    onOpenLogoGenerator,
    language = 'en',
    activeTab: externalTab,
    onTabChange
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

    const analyzeProject = useCallback(async () => {
        setLoading(true)
        try {
            const rootPath = project.path
            if (rootPath) {
                setProjectRoot(rootPath)
                const data = await window.electron.project.analyze(rootPath, project.id)
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
        analyzeProject()
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
                                                    if (e.key === 'Enter') handleSaveName()
                                                    if (e.key === 'Escape') setIsEditingName(false)
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
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-card p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1 tracking-wider">{t('projectDashboard.fileCount')}</div>
                                <div className="text-2xl font-black text-white">{stats?.fileCount || 0}</div>
                            </div>
                            <div className="bg-card p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1 tracking-wider">{t('projectDashboard.loc')}</div>
                                <div className="text-2xl font-black text-white">~{stats?.loc || 0}</div>
                            </div>
                            <div className="bg-card p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1 tracking-wider">{t('projectDashboard.modules')}</div>
                                <div className="text-2xl font-black text-white">{Object.keys(dependencies || {}).length}</div>
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
                                    {(analysis.frameworks || []).map((fw: string) => (
                                        <span key={fw} className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-xs text-blue-300 font-medium">
                                            {fw}
                                        </span>
                                    ))}
                                    {(analysis.frameworks?.length ?? 0) === 0 && <span className="text-xs text-muted-foreground italic">{t('projectDashboard.noFrameworks')}</span>}
                                </div>
                            </div>

                            {/* Language Distribution */}
                            <div className="bg-card/40 rounded-2xl border border-white/5 p-5 space-y-4">
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    {t('projectDashboard.langDist')}
                                </h3>
                                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                                    {Object.entries(analysis.languages || {})
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
                        <AgentCouncil />
                    </div>
                )}

                {activeTab === 'git' && (
                    <div className="h-full flex flex-col gap-6 overflow-y-auto px-6 py-6">
                        {/* Git Status Header */}
                        <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                            <h2 className="text-lg font-bold text-white flex items-center gap-3 mb-4">
                                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                Git Repository
                            </h2>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-white/5 rounded-xl p-4">
                                    <div className="text-xs text-muted-foreground mb-1">{t('projectDashboard.branch')}</div>
                                    <div className="text-sm font-semibold text-white">main</div>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4">
                                    <div className="text-xs text-muted-foreground mb-1">{t('projectDashboard.status')}</div>
                                    <div className="text-sm font-semibold text-emerald-400">Clean</div>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4">
                                    <div className="text-xs text-muted-foreground mb-1">{t('projectDashboard.lastCommit')}</div>
                                    <div className="text-sm font-semibold text-white">2 hours ago</div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Commits */}
                        <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                            <h3 className="text-sm font-bold text-white mb-4">{t('projectDashboard.recentCommits')}</h3>
                            <div className="space-y-3">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                            {String.fromCharCode(65 + (i % 26))}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-white font-medium truncate">
                                                {['fix: resolve login issue', 'feat: add new dashboard', 'chore: update deps', 'docs: update readme', 'refactor: clean code'][i - 1]}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                {i} day{i > 1 ? 's' : ''} ago • abc{i}def
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
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
        </div>
    )
}

const SearchResults = ({ projectRoot, onSelect, t }: { projectRoot: string, onSelect: (path: string) => void, t: any }) => {
    const [results, setResults] = useState<any[]>([])

    useEffect(() => {
        const handler = (e: any) => setResults(e.detail)
        window.addEventListener('search-results', handler)
        return () => window.removeEventListener('search-results', handler)
    }, [])

    if (results.length === 0) return <div className="text-center text-muted-foreground mt-10">{t('projectDashboard.noResults')}</div>

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
