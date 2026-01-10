import React, { useState, useEffect, useRef } from 'react'
import type { IpcRendererEvent } from 'electron'

interface LogEntry {
    id: string
    timestamp: Date
    level: 'debug' | 'info' | 'warn' | 'error'
    source: string
    message: string
}

interface LoggingDashboardProps {
    isOpen: boolean
    onClose: () => void
}

const levelColors = {
    debug: 'text-gray-400',
    info: 'text-blue-400',
    warn: 'text-yellow-400',
    error: 'text-red-400'
}

const levelBadgeColors = {
    debug: 'bg-gray-500/20 text-gray-400',
    info: 'bg-blue-500/20 text-blue-400',
    warn: 'bg-yellow-500/20 text-yellow-400',
    error: 'bg-red-500/20 text-red-400'
}

export const LoggingDashboard: React.FC<LoggingDashboardProps> = ({ isOpen, onClose }) => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [filter, setFilter] = useState<string>('')
    const [levelFilter, setLevelFilter] = useState<string>('all')
    const [autoScroll, setAutoScroll] = useState(true)
    const [isPaused, setIsPaused] = useState(false)
    const logsEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!isOpen) return

        // Subscribe to logs from main process
        const handler = (_event: IpcRendererEvent, log: LogEntry) => {
            if (!isPaused) {
                setLogs(prev => [...prev.slice(-500), { ...log, id: `${Date.now()}-${Math.random()}` }])
            }
        }

        window.electron?.ipcRenderer.on('log:entry', handler)

        return () => {
            window.electron?.ipcRenderer.off('log:entry', handler)
        }
    }, [isOpen, isPaused])

    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs, autoScroll])

    const filteredLogs = logs.filter(log => {
        const matchesText = !filter ||
            log.message.toLowerCase().includes(filter.toLowerCase()) ||
            log.source.toLowerCase().includes(filter.toLowerCase())
        const matchesLevel = levelFilter === 'all' || log.level === levelFilter
        return matchesText && matchesLevel
    })

    const clearLogs = () => setLogs([])

    const exportLogs = () => {
        const content = filteredLogs.map(log =>
            `[${new Date(log.timestamp).toISOString()}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`
        ).join('\n')

        const blob = new Blob([content], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `orbit-logs-${new Date().toISOString().slice(0, 10)}.txt`
        a.click()
        URL.revokeObjectURL(url)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-[90vw] max-w-6xl h-[80vh] bg-gray-900 rounded-xl border border-gray-700 flex flex-col overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/50">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Logging Dashboard
                        </h2>
                        <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                            {filteredLogs.length} entries
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-700 bg-gray-800/30">
                    <input
                        type="text"
                        placeholder="Filter logs..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="flex-1 max-w-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <select
                        value={levelFilter}
                        onChange={(e) => setLevelFilter(e.target.value)}
                        className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                        <option value="all">All Levels</option>
                        <option value="debug">Debug</option>
                        <option value="info">Info</option>
                        <option value="warn">Warning</option>
                        <option value="error">Error</option>
                    </select>
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={() => setIsPaused(!isPaused)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isPaused ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                        >
                            {isPaused ? '▶ Resume' : '⏸ Pause'}
                        </button>
                        <button
                            onClick={() => setAutoScroll(!autoScroll)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${autoScroll ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                        >
                            Auto-scroll {autoScroll ? 'ON' : 'OFF'}
                        </button>
                        <button
                            onClick={exportLogs}
                            className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
                        >
                            Export
                        </button>
                        <button
                            onClick={clearLogs}
                            className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-600/30 transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {/* Log Entries */}
                <div className="flex-1 overflow-y-auto font-mono text-xs">
                    {filteredLogs.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            <div className="text-center">
                                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p>No logs to display</p>
                                <p className="text-xs mt-1">Logs will appear here as they are generated</p>
                            </div>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="sticky top-0 bg-gray-800 text-gray-400">
                                <tr>
                                    <th className="text-left px-3 py-2 w-32">Time</th>
                                    <th className="text-left px-3 py-2 w-20">Level</th>
                                    <th className="text-left px-3 py-2 w-32">Source</th>
                                    <th className="text-left px-3 py-2">Message</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.map((log) => (
                                    <tr
                                        key={log.id}
                                        className={`border-b border-gray-800 hover:bg-gray-800/50 ${log.level === 'error' ? 'bg-red-900/10' : ''}`}
                                    >
                                        <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${levelBadgeColors[log.level]}`}>
                                                {log.level.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-3 py-1.5 text-gray-400 truncate max-w-[120px]" title={log.source}>
                                            {log.source}
                                        </td>
                                        <td className={`px-3 py-1.5 ${levelColors[log.level]} break-all`}>
                                            {log.message}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    <div ref={logsEndRef} />
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-gray-700 bg-gray-800/30 text-xs text-gray-500 flex justify-between">
                    <span>Last updated: {new Date().toLocaleTimeString()}</span>
                    <span>Showing {filteredLogs.length} of {logs.length} logs</span>
                </div>
            </div>
        </div>
    )
}

export default LoggingDashboard
