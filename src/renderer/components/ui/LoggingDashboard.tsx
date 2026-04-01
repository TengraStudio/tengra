import type { IpcRendererEvent } from 'electron';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/i18n';

interface LogEntry {
    id: string;
    timestamp: Date;
    level: 'debug' | 'info' | 'warn' | 'error';
    source: string;
    message: string;
}
interface LoggingDashboardProps {
    isOpen: boolean;
    onClose: () => void;
}

const levelColors = {
    debug: 'text-muted-foreground',
    info: 'text-primary',
    warn: 'text-warning',
    error: 'text-destructive',
};
const levelBadgeColors = {
    debug: 'bg-muted/20 text-muted-foreground',
    info: 'bg-primary/20 text-primary',
    warn: 'bg-warning/20 text-warning',
    error: 'bg-destructive/20 text-destructive',
};

const LogTableHeader: React.FC<{ t: (key: string) => string }> = ({ t }) => (
    <div className="sticky top-0 z-10 bg-muted text-muted-foreground flex font-semibold text-xs">
        <div className="px-3 py-2 w-32 shrink-0">{t('logging.time')}</div>
        <div className="px-3 py-2 w-20 shrink-0">{t('logging.level')}</div>
        <div className="px-3 py-2 w-32 shrink-0">{t('logging.source')}</div>
        <div className="px-3 py-2 flex-1">{t('logging.message')}</div>
    </div>
);

const LogRow: React.FC<{ log: LogEntry }> = React.memo(({ log }) => (
    <div
        className={`flex border-b border-muted hover:bg-muted/50 ${log.level === 'error' ? 'bg-destructive/10' : ''}`}
    >
        <div className="px-3 py-1.5 text-muted-foreground whitespace-nowrap w-32 shrink-0">
            {new Date(log.timestamp).toLocaleTimeString()}
        </div>
        <div className="px-3 py-1.5 w-20 shrink-0">
            <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${levelBadgeColors[log.level]}`}
            >
                {log.level.toUpperCase()}
            </span>
        </div>
        <div
            className="px-3 py-1.5 text-muted-foreground truncate w-32 shrink-0"
            title={log.source}
        >
            {log.source}
        </div>
        <div className={`px-3 py-1.5 ${levelColors[log.level]} break-all flex-1`}>
            {log.message}
        </div>
    </div>
));
LogRow.displayName = 'LogRow';

export const LoggingDashboard: React.FC<LoggingDashboardProps> = React.memo(
    ({ isOpen, onClose }) => {
        const { language } = useAuth();
        const { t } = useTranslation(language);
        const [logs, setLogs] = useState<LogEntry[]>([]);
        const [filter, setFilter] = useState('');
        const [levelFilter, setLevelFilter] = useState('all');
        const [autoScroll, setAutoScroll] = useState(true);
        const [isPaused, setIsPaused] = useState(false);
        const virtuosoRef = React.useRef<VirtuosoHandle>(null);
        const logBufferRef = React.useRef<LogEntry[]>([]);
        const rafIdRef = React.useRef<number>(0);

        useEffect(() => {
            if (!isOpen) {
                return;
            }
            const flushBuffer = () => {
                const batch = logBufferRef.current;
                if (batch.length === 0) {return;}
                logBufferRef.current = [];
                setLogs(prev => [...prev, ...batch].slice(-500));
            };
            const appendLogs = (incoming: LogEntry[]) => {
                if (isPaused) {return;}
                for (const log of incoming) {
                    logBufferRef.current.push({
                        ...log,
                        id: `${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
                    });
                }
                if (!rafIdRef.current) {
                    rafIdRef.current = requestAnimationFrame(() => {
                        rafIdRef.current = 0;
                        flushBuffer();
                    });
                }
            };
            const singleHandler = (_: IpcRendererEvent, log: LogEntry) => appendLogs([log]);
            const batchHandler = (_: IpcRendererEvent, logsBatch: LogEntry[]) => {
                appendLogs(Array.isArray(logsBatch) ? logsBatch : []);
            };

            window.electron.ipcRenderer.on('log:entry', singleHandler);
            window.electron.ipcRenderer.on('log:entry-batch', batchHandler);
            return () => {
                window.electron.ipcRenderer.off('log:entry', singleHandler);
                window.electron.ipcRenderer.off('log:entry-batch', batchHandler);
                if (rafIdRef.current) {cancelAnimationFrame(rafIdRef.current);}
                logBufferRef.current = [];
            };
        }, [isOpen, isPaused]);

        const filteredLogs = useMemo(
            () =>
                logs.filter(log => {
                    const matchesText =
                        !filter ||
                        log.message.toLowerCase().includes(filter.toLowerCase()) ||
                        log.source.toLowerCase().includes(filter.toLowerCase());
                    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
                    return matchesText && matchesLevel;
                }),
            [logs, filter, levelFilter]
        );

        const exportLogs = useCallback(() => {
            const content = filteredLogs
                .map(
                    l =>
                        `[${new Date(l.timestamp).toISOString()}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`
                )
                .join('\n');
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Tengra-logs-${new Date().toISOString().slice(0, 10)}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        }, [filteredLogs]);

        if (!isOpen) {
            return null;
        }

        return (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="logging-dashboard-title"
            >
                <div className="w-full max-w-6xl h-full bg-muted rounded-xl border border-border flex flex-col overflow-hidden shadow-2xl">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
                        <div className="flex items-center gap-4">
                            <h2
                                id="logging-dashboard-title"
                                className="text-lg font-semibold text-foreground flex items-center gap-2"
                            >
                                <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                </svg>
                                {t('logging.title')}
                            </h2>
                            <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded">
                                {filteredLogs.length} {t('logging.entries')}
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-accent rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                            aria-label={t('shortcuts.close')}
                        >
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30">
                        <input
                            type="text"
                            placeholder={t('logging.filterPlaceholder')}
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            className="flex-1 max-w-xs px-3 py-1.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none"
                        />
                        <select
                            value={levelFilter}
                            onChange={e => setLevelFilter(e.target.value)}
                            className="px-3 py-1.5 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none"
                        >
                            <option value="all">{t('logging.allLevels')}</option>
                            {['debug', 'info', 'warn', 'error'].map(lvl => (
                                <option key={lvl} value={lvl}>
                                    {t(`logging.${lvl}`)}
                                </option>
                            ))}
                        </select>
                        <div className="flex items-center gap-2 ml-auto">
                            <button
                                onClick={() => setIsPaused(!isPaused)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isPaused ? 'bg-success text-success-foreground' : 'bg-accent text-muted-foreground hover:bg-muted'}`}
                            >
                                {isPaused ? `▶ ${t('logging.resume')}` : `⏸ ${t('logging.pause')}`}
                            </button>
                            <button
                                onClick={() => setAutoScroll(!autoScroll)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${autoScroll ? 'bg-info text-info-foreground' : 'bg-accent text-muted-foreground hover:bg-muted'}`}
                            >
                                {t('logging.autoScroll')}{' '}
                                {autoScroll ? t('logging.on') : t('logging.off')}
                            </button>
                            <button
                                onClick={exportLogs}
                                className="px-3 py-1.5 bg-accent text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                            >
                                {t('logging.export')}
                            </button>
                            <button
                                onClick={() => setLogs([])}
                                className="px-3 py-1.5 bg-destructive/20 text-destructive rounded-lg text-sm font-medium hover:bg-destructive/30 transition-colors"
                            >
                                {t('logging.clear')}
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden font-mono text-xs flex flex-col">
                        {filteredLogs.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                <div className="text-center">
                                    <svg
                                        className="w-12 h-12 mx-auto mb-3 opacity-30"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                        />
                                    </svg>
                                    <p>{t('logging.noLogs')}</p>
                                    <p className="text-xs mt-1">{t('logging.noLogsDesc')}</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <LogTableHeader t={t} />
                                <div className="flex-1">
                                    <Virtuoso
                                        ref={virtuosoRef}
                                        data={filteredLogs}
                                        totalCount={filteredLogs.length}
                                        followOutput={autoScroll ? 'smooth' : false}
                                        defaultItemHeight={28}
                                        itemContent={(_index, log) => (
                                            <LogRow log={log} />
                                        )}
                                        className="custom-scrollbar"
                                        style={{ height: '100%' }}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <div className="px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground flex justify-between">
                        <span>
                            {t('logging.lastUpdated')}: {new Date().toLocaleTimeString()}
                        </span>
                        <span>
                            {t('logging.showing')} {filteredLogs.length} {t('logging.of')}{' '}
                            {logs.length} {t('logging.logs')}
                        </span>
                    </div>
                </div>
            </div>
        );
    }
);

LoggingDashboard.displayName = 'LoggingDashboard';
export default LoggingDashboard;

