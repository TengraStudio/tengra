import React, { useEffect, useState } from 'react'
import { CheckSquare, Square, RefreshCw, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'

interface ProjectTodoTabProps {
    projectRoot: string
    t: any
}

interface TodoItem {
    id: string
    text: string
    completed: boolean
    line: number
}

export const ProjectTodoTab: React.FC<ProjectTodoTabProps> = ({ projectRoot, t }) => {
    const [todos, setTodos] = useState<TodoItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchTodos = async () => {
        if (!projectRoot) return
        setLoading(true)
        setError(null)
        try {
            // Check if TODO.md exists
            let targetPath = `${projectRoot}/TODO.md`
            let exists = await window.electron.files.exists(targetPath)

            if (!exists) {
                targetPath = `${projectRoot}/todo.md`
                exists = await window.electron.files.exists(targetPath)
            }

            if (!exists) {
                targetPath = `${projectRoot}/docs/TODO.md`
                exists = await window.electron.files.exists(targetPath)
            }

            if (!exists) {
                setTodos([])
                return
            }

            const content = await window.electron.files.readFile(targetPath)
            parseTodos(content)
        } catch (err: any) {
            console.error('Failed to fetch TODO.md:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const parseTodos = (content: string) => {
        const lines = content.split('\n')
        const items: TodoItem[] = []

        lines.forEach((line, index) => {
            const trimmed = line.trim()
            if (trimmed.startsWith('- [ ]')) {
                items.push({
                    id: `todo-${index}`,
                    text: trimmed.replace('- [ ]', '').trim(),
                    completed: false,
                    line: index + 1
                })
            } else if (trimmed.startsWith('- [x]')) {
                items.push({
                    id: `todo-${index}`,
                    text: trimmed.replace('- [x]', '').trim(),
                    completed: true,
                    line: index + 1
                })
            }
        })
        setTodos(items)
    }

    useEffect(() => {
        fetchTodos()
    }, [projectRoot])

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                {t('projectDashboard.loadingTasks')}
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-400 bg-red-500/5 rounded-xl border border-red-500/10 m-4">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                {t('projectDashboard.failedLoad')}
            </div>
        )
    }

    if (todos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-60">
                <CheckSquare className="w-12 h-12 mb-4 opacity-20" />
                <p>{t('projectDashboard.noTasks')}</p>
                <p className="text-xs mt-1">{t('projectDashboard.createTodo')}</p>
            </div>
        )
    }

    const pending = todos.filter(t => !t.completed)
    const completed = todos.filter(t => t.completed)

    return (
        <div className="h-full overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-primary" />
                    {t('projectDashboard.projectTasks')}
                    <span className="text-xs font-normal text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                        {pending.length} {t('projectDashboard.pending')}
                    </span>
                </h2>
                <button
                    onClick={fetchTodos}
                    className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-muted-foreground hover:text-white"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Pending Tasks */}
                {pending.map((todo, i) => (
                    <motion.div
                        key={todo.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-card border border-white/5 rounded-xl p-4 hover:border-primary/30 transition-colors group relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-1 h-full bg-orange-500/50" />
                        <div className="flex items-start gap-3">
                            <Square className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-200 leading-relaxed break-words">{todo.text}</p>
                                <p className="text-[10px] text-muted-foreground mt-2 font-mono opacity-50">Line {todo.line}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}

                {/* Completed Tasks */}
                {completed.map((todo, i) => (
                    <motion.div
                        key={todo.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: (pending.length + i) * 0.05 }}
                        className="bg-card/50 border border-white/5 rounded-xl p-4 opacity-60 hover:opacity-100 transition-all"
                    >
                        <div className="flex items-start gap-3">
                            <CheckSquare className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-muted-foreground line-through decoration-white/20">{todo.text}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}
