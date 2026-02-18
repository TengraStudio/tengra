import { Download, FileText, RefreshCw, Search, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface LogEntry {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    source: string;
    message: string;
}

interface ProjectLogsTabProps {
    projectPath: string;
    language: Language;
}

export const ProjectLogsTab: React.FC<ProjectLogsTabProps> = ({ projectPath, language }) => {
    const { t } = useTranslation(language);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [filter, setFilter] = useState('');
    const [levelFilter, setLevelFilter] = useState<'all' | LogEntry['level']>('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [autoScroll, setAutoScroll] = useState(true);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Listen for terminal output as logs
    useEffect(() => {
        const handleTerminalData = (_event: unknown, data: { sessionId: string; data: string }) => {
            const lines = data.data.split('\n').filter(line => line.trim());
            const newEntries: LogEntry[] = lines.map(line => {
                let level: LogEntry['level'] = 'info';
                if (line.toLowerCase().includes('error')) {
                    level = 'error';
                } else if (line.toLowerCase().includes('warn')) {
                    level = 'warn';
                } else if (line.toLowerCase().includes('debug')) {
                    level = 'debug';
                }

                return {
                    timestamp: new Date().toISOString(),
                    level,
                    source: data.sessionId || 'terminal',
                    message: line,
                };
            });
            setLogs(prev => [...prev.slice(-500), ...newEntries]); // Keep last 500 lines
        };

        const listener = handleTerminalData as Parameters<typeof window.electron.ipcRenderer.on>[1];
        window.electron.ipcRenderer.on('terminal:data', listener);

        return () => {
            window.electron.ipcRenderer.off('terminal:data', listener);
        };
    }, [projectPath]);

    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    const { filteredLogs, levelStats } = React.useMemo(() => {
        const nextFilteredLogs: LogEntry[] = [];
        const stats = {
            total: 0,
            error: 0,
            warn: 0,
            info: 0,
            debug: 0,
        };
        const normalizedFilter = filter.toLowerCase();

        for (const log of logs) {
            const matchesText = log.message.toLowerCase().includes(normalizedFilter);
            const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
            const matchesSource = sourceFilter === 'all' || log.source === sourceFilter;
            if (!matchesText || !matchesLevel || !matchesSource) {
                continue;
            }

            nextFilteredLogs.push(log);
            stats.total += 1;
            switch (log.level) {
                case 'error':
                    stats.error += 1;
                    break;
                case 'warn':
                    stats.warn += 1;
                    break;
                case 'debug':
                    stats.debug += 1;
                    break;
                default:
                    stats.info += 1;
                    break;
            }
        }

        return {
            filteredLogs: nextFilteredLogs,
            levelStats: stats,
        };
    }, [filter, levelFilter, logs, sourceFilter]);

    const availableSources = React.useMemo(
        () => Array.from(new Set(logs.map(log => log.source))).sort(),
        [logs]
    );

    const exportLogs = useCallback(() => {
        const content = filteredLogs
            .map(
                entry =>
                    `[${new Date(entry.timestamp).toISOString()}] [${entry.level.toUpperCase()}] ${entry.message}`
            )
            .join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `project-logs-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }, [filteredLogs]);

    const highlightMatch = (text: string) => {
        if (!filter.trim()) {
            return text;
        }
        const escaped = filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escaped})`, 'gi');
        const parts = text.split(regex);
        const normalizedFilter = filter.toLowerCase();
        return parts.map((part, idx) =>
            part.toLowerCase() === normalizedFilter ? (
                <mark key={`${part}-${idx}`} className="bg-warning/25 text-foreground px-0.5 rounded-sm">
                    {part}
                </mark>
            ) : (
                <React.Fragment key={`${part}-${idx}`}>{part}</React.Fragment>
            )
        );
    };

    const getLevelColor = (level: LogEntry['level']) => {
        switch (level) {
            case 'error':
                return 'text-destructive';
            case 'warn':
                return 'text-warning';
            case 'debug':
                return 'text-muted-foreground';
            default:
                return 'text-muted-foreground';
        }
    };

    const getLevelBg = (level: LogEntry['level']) => {
        switch (level) {
            case 'error':
                return 'bg-destructive/10 border-destructive/20';
            case 'warn':
                return 'bg-warning/10 border-warning/20';
            case 'debug':
                return 'bg-muted/10 border-border/20';
            default:
                return 'bg-muted/10 border-border/10';
        }
    };

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
                            onChange={e => setFilter(e.target.value)}
                            placeholder={t('projectDashboard.logsFilter')}
                            className="pl-10 pr-4 py-2 bg-muted/30 border border-border/50 rounded-lg text-sm outline-none focus:border-primary/50 w-64"
                        />
                    </div>
                    <select
                        value={levelFilter}
                        onChange={e => setLevelFilter(e.target.value as 'all' | LogEntry['level'])}
                        className="px-3 py-2 bg-muted/30 border border-border/50 rounded-lg text-sm outline-none focus:border-primary/50"
                    >
                        <option value="all">{t('logging.allLevels')}</option>
                        <option value="info">{t('logging.info')}</option>
                        <option value="warn">{t('logging.warn')}</option>
                        <option value="error">{t('logging.error')}</option>
                        <option value="debug">{t('logging.debug')}</option>
                    </select>
                    <select
                        value={sourceFilter}
                        onChange={e => setSourceFilter(e.target.value)}
                        className="px-3 py-2 bg-muted/30 border border-border/50 rounded-lg text-sm outline-none focus:border-primary/50"
                    >
                        <option value="all">All sources</option>
                        {availableSources.map(source => (
                            <option key={source} value={source}>
                                {source}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className={cn(
                            'p-2 rounded-lg border transition-colors',
                            autoScroll
                                ? 'bg-primary/10 border-primary/20 text-primary'
                                : 'bg-muted/30 border-border/50 text-muted-foreground'
                        )}
                        title={t('logging.autoScroll')}
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={exportLogs}
                        className="flex items-center gap-2 px-4 py-2 bg-muted/30 hover:bg-muted/50 border border-border/50 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        {t('logging.export')}
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
            <div className="flex-1 min-h-0 bg-background rounded-2xl border border-border/50 overflow-hidden flex flex-col font-mono text-xs">
                <div className="px-4 py-2 border-b border-border/40 flex items-center gap-2 text-xxs text-muted-foreground">
                    <span>Total: {levelStats.total}</span>
                    <span>Info: {levelStats.info}</span>
                    <span>Warn: {levelStats.warn}</span>
                    <span>Error: {levelStats.error}</span>
                    <span>Debug: {levelStats.debug}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-border/50">
                    {filteredLogs.length > 0 ? (
                        <>
                            {filteredLogs.map((log, idx) => (
                                <div
                                    key={idx}
                                    className={cn(
                                        'p-2 rounded-lg border transition-all',
                                        getLevelBg(log.level)
                                    )}
                                >
                                    <span className="text-neutral mr-2">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                    <span className="text-muted-foreground/70 mr-2">[{log.source}]</span>
                                    <span
                                        className={cn(
                                            'uppercase font-bold mr-2',
                                            getLevelColor(log.level)
                                        )}
                                    >
                                        [{log.level}]
                                    </span>
                                    <span className={getLevelColor(log.level)}>{highlightMatch(log.message)}</span>
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
    );
};
