import { useState, useEffect } from 'react'
import { FileCode, Activity, Terminal as TerminalIcon, X, Play, RefreshCw } from 'lucide-react'
import { TerminalComponent } from './ide/Terminal'
import { FileExplorer } from './ide/FileExplorer'
import { CodeEditor } from './ide/CodeEditor'
import { AgentCouncil } from '@/features/chat/components/AgentCouncil'

interface OpenFile {
    path: string
    name: string
    content: string
    isDirty: boolean
}

export const ProjectDashboard = () => {
    const [stats, setStats] = useState<any>(null)
    const [analysis, setAnalysis] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'overview' | 'terminal' | 'files' | 'tasks' | 'search' | 'council'>('overview')
    const [projectRoot, setProjectRoot] = useState<string>('')
    const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
    const [activeFile, setActiveFile] = useState<string | null>(null)

    const analyzeProject = async () => {
        setLoading(true)
        try {
            const settings = await (window.electron as any).getSettings()
            let rootPath = settings?.general?.lastProjectRoot

            if (!rootPath) {
                const auth = await (window.electron as any).checkAuthStatus()
                if (auth?.files && auth.files.length > 0) {
                    const workspace = auth.files[0]
                    rootPath = workspace.uri.replace('file:///', '')
                    // fallback used
                }
            }

            if (rootPath) {
                if (rootPath.match(/^\/[a-zA-Z]:/)) rootPath = rootPath.substring(1)

                setProjectRoot(rootPath)
                const data = await (window.electron as any).project.analyze(rootPath)
                setAnalysis(data)
                setStats(data.stats)

                // mock git/npm status
                // const status = await (window.electron as any).git?.getStatus?.(rootPath) || []
                // setGitStatus(status)

                // Load Scripts
                // The 'scripts' variable was unused, and setNpmScripts was commented out.
                // The scanScripts call is no longer needed here if its result isn't used.
                try {
                    // await window.electron.process.scanScripts(rootPath) // If we still want to run this for side effects, keep it. Otherwise, remove.
                } catch (e) { console.warn('Scripts scan failed', e) }
            }
        } catch (error) {
            console.error('Project analysis failed:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        analyzeProject()
    }, [])

    const handleFileSelect = async (path: string) => {
        // specific fix for windows paths if needed, usually we just use what explorer gives
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
                Analyzing Project...
            </div>
        )
    }

    if (!analysis) {
        return (
            <div className="p-8 text-center text-muted-foreground">No active project.</div>
        )
    }

    const { type, dependencies } = analysis
    const activeFileObj = openFiles.find(f => f.path === activeFile)

    return (
        <div className="h-full flex flex-col bg-background text-foreground">
            {/* Tab Navigation */}
            <div className="flex items-center gap-1 p-2 border-b border-white/10 bg-black/20 backdrop-blur-md">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${activeTab === 'overview' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'}`}
                >
                    <Activity className="w-3.5 h-3.5" /> Overview
                </button>
                <button
                    onClick={() => setActiveTab('terminal')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${activeTab === 'terminal' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'}`}
                >
                    <TerminalIcon className="w-3.5 h-3.5" /> Terminal
                </button>
                <button
                    onClick={() => setActiveTab('files')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${activeTab === 'files' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'}`}
                >
                    <FileCode className="w-3.5 h-3.5" /> Files
                </button>
                <button
                    onClick={() => setActiveTab('tasks')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${activeTab === 'tasks' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'}`}
                >
                    <Play className="w-3.5 h-3.5" /> Tasks
                </button>
                <button
                    onClick={() => setActiveTab('search')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${activeTab === 'search' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'}`}
                >
                    <RefreshCw className="w-3.5 h-3.5" /> Search
                </button>
                <button
                    onClick={() => setActiveTab('council')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${activeTab === 'council' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'}`}
                >
                    <Activity className="w-3.5 h-3.5" /> Council
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-2">
                {activeTab === 'overview' && (
                    <div className="space-y-6 overflow-y-auto pr-2">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-card p-4 rounded-xl border border-border">
                                <div className="text-xs font-bold uppercase text-muted-foreground mb-1">Files</div>
                                <div className="text-2xl font-black text-white">{stats?.fileCount || 0}</div>
                            </div>
                            <div className="bg-card p-4 rounded-xl border border-border">
                                <div className="text-xs font-bold uppercase text-muted-foreground mb-1">LOC</div>
                                <div className="text-2xl font-black text-white">~{stats?.loc || 0}</div>
                            </div>
                            <div className="bg-card p-4 rounded-xl border border-border">
                                <div className="text-xs font-bold uppercase text-muted-foreground mb-1">Modules</div>
                                <div className="text-2xl font-black text-white">{Object.keys(dependencies || {}).length}</div>
                            </div>
                            <div className="bg-card p-4 rounded-xl border border-border">
                                <div className="text-xs font-bold uppercase text-muted-foreground mb-1">Type</div>
                                <div className="text-2xl font-black text-primary capitalize">{type}</div>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pr-2">
                        <div className="text-muted-foreground p-4">Tasks not available</div>
                    </div>
                )}

                {activeTab === 'search' && (
                    <div className="h-full flex flex-col space-y-4">
                        <div className="flex gap-2 bg-card p-4 rounded-xl border border-border">
                            <input
                                type="text"
                                placeholder="Search in project..."
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
                            <SearchResults projectRoot={projectRoot} onSelect={handleFileSelect} />
                        </div>
                    </div>
                )}

                {activeTab === 'council' && (
                    <div className="h-full">
                        <AgentCouncil />
                    </div>
                )}

                {activeTab === 'files' && (
                    <div className="h-full flex gap-4">
                        {/* Sidebar */}
                        <div className="w-64 flex-shrink-0 bg-card rounded-xl border border-white/10 flex flex-col">
                            <div className="p-3 border-b border-white/10 text-xs font-bold uppercase text-muted-foreground">
                                Explorer
                            </div>
                            <div className="flex-1 overflow-hidden p-1">
                                <FileExplorer rootPath={projectRoot} onFileSelect={handleFileSelect} />
                            </div>
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 bg-card rounded-xl border border-white/10 flex flex-col overflow-hidden">
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
                                    <p>Select a file to edit</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

const SearchResults = ({ projectRoot, onSelect }: { projectRoot: string, onSelect: (path: string) => void }) => {
    const [results, setResults] = useState<any[]>([])

    useEffect(() => {
        const handler = (e: any) => setResults(e.detail)
        window.addEventListener('search-results', handler)
        return () => window.removeEventListener('search-results', handler)
    }, [])

    if (results.length === 0) return <div className="text-center text-muted-foreground mt-10">No results to display</div>

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
