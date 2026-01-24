import { FileText, RefreshCw, Search, Trash2 } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Language, useTranslation } from '@/i18n'
import { cn } from '@/lib/utils'

interface LogEntry {
    timestamp: string
    level: 'info' | 'warn' | 'error' | 'debug'
    message: string
}

interface ProjectLogsTabProps {
    projectPath: string
    language: Language
}

export const ProjectLogsTab: React.FC<ProjectLogsTabProps> = ({ projectPath, language }) => {
    const { t } = useTranslation(language)
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [filter, setFilter] = useState('')
    const [autoScroll, setAutoScroll] = useState(true)
    const logsEndRef = useRef<HTMLDivElement>(null)

    // Listen for terminal output as logs
    useEffect(() => {
        const handleTerminalData = (_event: unknown, data: { sessionId: string; data: string }) => {
            const lines = data.data.split('\n').filter(line => line.trim())
            const newEntries: LogEntry[] = lines.map(line => {
                let level: LogEntry['level'] = 'info'
                if (line.toLowerCase().includes('error')) { level = 'error' }
                else if (line.toLowerCase().includes('warn')) { level = 'warn' }
                else if (line.toLowerCase().includes('debug')) { level = 'debug' }

                return {
                    timestamp: new Date().toISOString(),
                    level,
                    message: line
                }
            })
            setLogs(prev => [...prev.slice(-500), ...newEntries]) // Keep last 500 lines
        }

        const listener = handleTerminalData as Parameters<typeof window.electron.ipcRenderer.on>[1]
        window.electron.ipcRenderer.on('terminal:data', listener)

        return () => {
            window.electron.ipcRenderer.off('terminal:data', listener)
        }
    }, [projectPath])

    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs, autoScroll])

    const clearLogs = useCallback(() => {
        setLogs([])
    }, [])

    const filteredLogs = logs.filter(log =>
        log.message.toLowerCase().includes(filter.toLowerCase())
    )

    const getLevelColor = (level: LogEntry['level']) => {
        switch (level) {
            case 'error': return 'text-red-400'
            case 'warn': return 'text-amber-400'
            case 'debug': return 'text-zinc-500'
            default: return 'text-zinc-300'
        }
    }

    const getLevelBg = (level: LogEntry['level']) => {
        switch (level) {
            case 'error': return 'bg-red-500/10 border-red-500/20'
            case 'warn': return 'bg-amber-500/10 border-amber-500/20'
            case 'debug': return 'bg-zinc-500/10 border-zinc-500/20'
            default: return 'bg-muted/10 border-border/10'
        }
    }

    return (
        <div className="flex-1 flex flex-col gap-6 p-4 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
                        <FileText className="w-8 h-8 text-primary" />
                        {t('projectDashboard.logs')}
                    </h2>
                    <p className="text-muted-foreground text-sm max-w-xl">
                        {t('projectDashboard.logsDescription')}
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder={t('projectDashboard.logsFilter')}
                            className="pl-10 pr-4 py-2 bg-muted/30 border border-border/50 rounded-lg text-sm outline-none focus:border-primary/50 w-64"
                        />
                    </div>
                    <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className={cn(
                            "p-2 rounded-lg border transition-colors",
                            autoScroll ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted/30 border-border/50 text-muted-foreground"
                        )}
                        title="Auto-scroll"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={clearLogs}
                        className="flex items-center gap-2 px-4 py-2 bg-muted/30 hover:bg-muted/50 border border-border/50 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        {t('projectDashboard.logsClear')}
                    </button>
                </div>
            </div>

            {/* Logs Container */}
            <div className="flex-1 min-h-0 bg-black/60 backdrop-blur-md rounded-2xl border border-border/50 overflow-hidden flex flex-col font-mono text-xs">
                <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-border/50">
                    {filteredLogs.length > 0 ? (
                        <>
                            {filteredLogs.map((log, idx) => (
                                <div
                                    key={idx}
                                    className={cn(
                                        "p-2 rounded-lg border transition-all",
                                        getLevelBg(log.level)
                                    )}
                                >
                                    <span className="text-zinc-600 mr-2">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                    <span className={cn("uppercase font-bold mr-2", getLevelColor(log.level))}>
                                        [{log.level}]
                                    </span>
                                    <span className={getLevelColor(log.level)}>
                                        {log.message}
                                    </span>
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-4 text-muted-foreground">
                            <FileText className="w-16 h-16 opacity-20" />
                            <p>{t('projectDashboard.logsEmpty')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
