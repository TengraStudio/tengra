import { AlertCircle, CheckSquare, ChevronDown, ChevronRight, FileText, Plus, RefreshCw, Square } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { AnimatePresence, motion } from '@/lib/framer-motion-compat'
import { cn } from '@/lib/utils'

interface ProjectTodoTabProps {
    projectRoot: string
    t: (key: string) => string
}

interface TodoItem {
    id: string
    text: string
    completed: boolean
    line: number
    filePath: string
    relativePath: string
}

interface TodoFile {
    path: string
    relativePath: string
    items: TodoItem[]
}

const IGNORED_FOLDERS = ['node_modules', '.git', 'dist', 'build', 'out', '.next', '.idea', '.vscode', 'coverage', '.orbit', 'vendor']
const TODO_FILENAMES = ['todo.md', 'todo.txt', 'todo', 'tasks.md', 'tasks.txt', 'roadmap.md']

export const ProjectTodoTab: React.FC<ProjectTodoTabProps> = ({ projectRoot, t }) => {
    const [todoFiles, setTodoFiles] = useState<TodoFile[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isAdding, setIsAdding] = useState(false)
    const [newTaskText, setNewTaskText] = useState('')
    const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({})

    const scanDirectory = useCallback(async (dirPath: string): Promise<string[]> => {
        const foundFiles: string[] = []
        try {
            const entries = await window.electron.files.listDirectory(dirPath)
            const entryList = Array.isArray(entries) ? entries : []

            for (const entry of entryList) {
                if (IGNORED_FOLDERS.includes(entry.name)) { continue }
                if (entry.name.startsWith('.')) { continue }

                const fullPath = `${dirPath}/${entry.name}`

                if (entry.isDirectory) {
                    const subFiles = await scanDirectory(fullPath)
                    foundFiles.push(...subFiles)
                } else if (TODO_FILENAMES.includes(entry.name.toLowerCase())) {
                    foundFiles.push(fullPath)
                }
            }
        } catch (e) {
            console.warn(`Failed to scan ${dirPath}`, e)
        }
        return foundFiles
    }, [])

    const parseTodoFile = useCallback(async (filePath: string): Promise<TodoFile | null> => {
        try {
            const content = await window.electron.files.readFile(filePath)
            const lines = content.split('\n')
            const items: TodoItem[] = []
            const relativePath = filePath.replace(projectRoot, '').replace(/^[\\/]/, '')

            lines.forEach((line, index) => {
                const trimmed = line.trim()
                const match = trimmed.match(/^[-*+]\s*\[([ xX-])\]\s*(.*)/)
                if (match) {
                    const status = match[1].toLowerCase()
                    items.push({
                        id: `${filePath}-${index}`,
                        text: match[2].trim() || '',
                        completed: status === 'x',
                        line: index + 1,
                        filePath,
                        relativePath
                    })
                } else if (trimmed.startsWith('TODO:') || trimmed.startsWith('FIXME:')) {
                    items.push({
                        id: `${filePath}-${index}`,
                        text: trimmed.replace(/^(TODO|FIXME):?\s*/, '').trim(),
                        completed: false,
                        line: index + 1,
                        filePath,
                        relativePath
                    })
                }
            })

            return { path: filePath, relativePath, items }
        } catch (e) {
            console.error(`Failed to parse ${filePath}`, e)
            return null
        }
    }, [projectRoot])

    const fetchTodos = useCallback(async () => {
        if (!projectRoot) { return }
        setLoading(true)
        setError(null)
        try {
            const files = await scanDirectory(projectRoot)
            const results = await Promise.all(files.map(parseTodoFile))
            const validFiles = results.filter((f): f is TodoFile => f !== null && f.items.length > 0)

            setTodoFiles(validFiles)

            // Auto expand all by default
            const expanded: Record<string, boolean> = {}
            validFiles.forEach(f => expanded[f.path] = true)
            setExpandedFiles(expanded)

        } catch (err) {
            console.error('Failed to fetch todos:', err)
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setLoading(false)
        }
    }, [projectRoot, scanDirectory, parseTodoFile])

    const handleToggle = async (item: TodoItem) => {
        try {
            const content = await window.electron.files.readFile(item.filePath)
            const lines = content.split('\n')

            // Verify line content matches to avoid drift issues
            const targetLine = lines[item.line - 1]
            if (!targetLine || (!targetLine.includes('- [ ]') && !targetLine.includes('- [x]'))) {
                throw new Error('File content changed, please refresh')
            }

            const newLine = item.completed
                ? targetLine.replace('- [x]', '- [ ]')
                : targetLine.replace('- [ ]', '- [x]')

            lines[item.line - 1] = newLine
            await window.electron.files.writeFile(item.filePath, lines.join('\n'))

            // Optimistic update
            setTodoFiles(prev => prev.map(f => {
                if (f.path !== item.filePath) { return f }
                return {
                    ...f,
                    items: f.items.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i)
                }
            }))
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
            void fetchTodos() // Revert/Refresh on error
        }
    }

    const handleAddTask = async () => {
        if (!newTaskText.trim()) { return }

        try {
            // Default to root TODO.md
            const targetPath = `${projectRoot}/TODO.md`
            let content = ''

            // Check if file exists
            if (await window.electron.files.exists(targetPath)) {
                content = await window.electron.files.readFile(targetPath)
                if (content && !content.endsWith('\n')) { content += '\n' }
            } else {
                content = '# Project Tasks\n\n'
            }

            const newTaskLine = `- [ ] ${newTaskText}`
            const newContent = content + newTaskLine + '\n'

            await window.electron.files.writeFile(targetPath, newContent)
            setNewTaskText('')
            setIsAdding(false)
            await fetchTodos()

        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        }
    }

    useEffect(() => {
        void fetchTodos()
    }, [fetchTodos])

    const totalStats = useMemo(() => {
        let total = 0
        let completed = 0
        todoFiles.forEach(f => {
            total += f.items.length
            f.items.forEach(i => { if (i.completed) { completed++ } })
        })
        return { total, completed, pending: total - completed }
    }, [todoFiles])

    if (loading && todoFiles.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                {t('projectDashboard.loadingTasks') || 'Scanning for tasks...'}
            </div>
        )
    }

    return (
        <div className="h-full overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-background/50 backdrop-blur-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <CheckSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white">{t('projectDashboard.projectTasks')}</h2>
                        <div className="text-xs text-muted-foreground flex gap-2">
                            <span className="text-emerald-400">{totalStats.completed} {t('common.done')}</span>
                            <span className="text-white/20">•</span>
                            <span className="text-white/60">{totalStats.pending} {t('projectDashboard.pending')}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className={cn(
                            "p-2 rounded-lg transition-colors",
                            isAdding ? "bg-primary text-primary-foreground" : "hover:bg-white/10 text-muted-foreground hover:text-white"
                        )}
                        title={t('common.add') || 'Add Task'}
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => void fetchTodos()}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-white"
                        title={t('common.refresh') || 'Refresh'}
                    >
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}

                {/* Add Task Input */}
                <AnimatePresence>
                    {isAdding && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="bg-card border border-primary/30 rounded-xl p-3 mb-4 shadow-lg shadow-primary/5">
                                <div className="flex gap-2">
                                    <input
                                        autoFocus
                                        value={newTaskText}
                                        onChange={e => setNewTaskText(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { void handleAddTask() } }}
                                        placeholder={t('projects.todoPlaceholder')}
                                        className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-muted-foreground/50"
                                    />
                                    <button
                                        onClick={() => void handleAddTask()}
                                        disabled={!newTaskText.trim()}
                                        className="px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-md disabled:opacity-50"
                                    >
                                        Add
                                    </button>
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-2 pl-1">
                                    {t('projects.willActOn')} <span className="font-mono text-primary/70">/TODO.md</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {todoFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-60">
                        <CheckSquare className="w-12 h-12 mb-4 opacity-20" />
                        <p>{t('projectDashboard.noTasks')}</p>
                        <p className="text-xs mt-1">{t('projectDashboard.createTodo')}</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {todoFiles.map(file => {
                            const isExpanded = expandedFiles[file.path]
                            const pendingCount = file.items.filter(i => !i.completed).length

                            return (
                                <div key={file.path} className="space-y-2">
                                    <button
                                        onClick={() => setExpandedFiles(p => ({ ...p, [file.path]: !p[file.path] }))}
                                        className="w-full flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground hover:text-white transition-colors group select-none"
                                    >
                                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                        <FileText className="w-3 h-3" />
                                        <span className="truncate">{file.relativePath}</span>
                                        <div className="h-px bg-white/5 flex-1 group-hover:bg-white/10 transition-colors" />
                                        <span className={cn("px-1.5 py-0.5 rounded text-[10px]", pendingCount > 0 ? "bg-primary/10 text-primary" : "bg-white/5 text-muted-foreground")}>
                                            {pendingCount} {t('projectDashboard.pending')}
                                        </span>
                                    </button>

                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="grid gap-2 pl-2"
                                            >
                                                {file.items.map(todo => (
                                                    <div
                                                        key={todo.id}
                                                        className={cn(
                                                            "group flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden",
                                                            todo.completed
                                                                ? "bg-card/30 border-white/5 hover:bg-card/50 opacity-60 hover:opacity-100"
                                                                : "bg-card border-white/10 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                                                        )}
                                                        onClick={() => void handleToggle(todo)}
                                                    >
                                                        {todo.completed ? (
                                                            <CheckSquare className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                                        ) : (
                                                            <Square className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                                                        )}

                                                        <div className="flex-1 min-w-0">
                                                            <p className={cn(
                                                                "text-sm leading-relaxed break-words transition-colors",
                                                                todo.completed ? "text-muted-foreground line-through decoration-white/20" : "text-gray-200"
                                                            )}>
                                                                {todo.text}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1.5">
                                                                <span className="text-[10px] font-mono text-muted-foreground/40 text-primary/40">
                                                                    Line {todo.line}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
