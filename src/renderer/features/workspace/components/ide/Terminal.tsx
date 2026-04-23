/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { cn } from '@renderer/lib/utils';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@/i18n';
import { getTerminalTheme } from '@/lib/terminal-theme';
import { performanceMonitor } from '@/utils/performance';
import { appLogger } from '@/utils/renderer-logger';


interface TerminalComponentProps {
    cwd?: string | undefined;
    workspaceId?: string | undefined; // For persistent command history
}

interface TerminalCleanups {
    data: () => void;
    exit: () => void;
}

interface TerminalStateRefs {
    terminalInstanceRef: React.MutableRefObject<Terminal | null>;
    pidRef: React.MutableRefObject<string | null>;
    historyRef: React.MutableRefObject<string[]>;
    historyIndexRef: React.MutableRefObject<number>;
    currentInputRef: React.MutableRefObject<string>;
    lineBuffer: string;
}

// Terminal history persistence keys
const HISTORY_KEY_PREFIX = 'Tengra_terminal_history_';
const MAX_HISTORY_SIZE = 500;

// Get history storage key for a workspace
const getHistoryKey = (workspaceId?: string) => {
    return `${HISTORY_KEY_PREFIX}${workspaceId ?? 'global'}`;
};

// Load command history from localStorage
const loadHistory = (workspaceId?: string): string[] => {
    try {
        const stored = localStorage.getItem(getHistoryKey(workspaceId));
        if (stored) {
            return safeJsonParse<string[]>(stored, []);
        }
    } catch (error) {
        appLogger.warn('TerminalComponent', 'Failed to load terminal history', error as Error);
    }
    return [];
};

// Save command history to localStorage
const saveHistory = (history: string[], workspaceId?: string) => {
    try {
        // Keep only the last MAX_HISTORY_SIZE commands
        const trimmed = history.slice(-MAX_HISTORY_SIZE);
        localStorage.setItem(getHistoryKey(workspaceId), JSON.stringify(trimmed));
    } catch (error) {
        appLogger.warn('TerminalComponent', 'Failed to save terminal history', error as Error);
    }
};

// Global registry to track initialized terminals (prevents duplicate spawns)
const initializedTerminals = new Set<string>();
const initializingTerminals = new Set<string>();

// Helper to attach cleanups to terminal instance
const attachCleanups = (term: Terminal, cleanups: TerminalCleanups) => {
    const terminalWithCleanups = term as Terminal & { _cleanups?: TerminalCleanups };
    terminalWithCleanups._cleanups = cleanups;
};

// Helper to get cleanups from terminal instance
const getCleanups = (term: Terminal): TerminalCleanups | undefined => {
    const terminalWithCleanups = term as Terminal & { _cleanups?: TerminalCleanups };
    return terminalWithCleanups._cleanups;
};

// Initialize terminal instance with xterm configuration
const createTerminalInstance = (): Terminal => {
    return new Terminal({
        theme: getTerminalTheme(),
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        lineHeight: 1.4,
        letterSpacing: 0.2,
        cursorBlink: true,
        cursorStyle: 'block',
        convertEol: true,
        scrollback: 10000,
        fontWeight: '400',
        fontWeightBold: '600'
    });
};

// Initialize FitAddon and fit terminal to container
const initializeFitAddon = (term: Terminal, containerRef: React.RefObject<HTMLDivElement>) => {
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    if (containerRef.current) {
        term.open(containerRef.current);
        try {
            if ((containerRef.current as HTMLElement).offsetParent) {
                fitAddon.fit();
            }
        } catch {
            appLogger.warn('TerminalComponent', 'Initial fit failed');
        }
    }

    return fitAddon;
};

// Handle up arrow key (navigate history backward)
const handleHistoryUp = (
    stateRefs: Pick<TerminalStateRefs, 'historyRef' | 'historyIndexRef' | 'currentInputRef'>,
    pidRef: React.MutableRefObject<string | null>,
    currentLineBuffer: string
): string => {
    const { historyRef, historyIndexRef, currentInputRef } = stateRefs;

    if (historyRef.current.length > 0) {
        if (historyIndexRef.current === -1) {
            currentInputRef.current = currentLineBuffer;
            historyIndexRef.current = historyRef.current.length - 1;
        } else if (historyIndexRef.current > 0) {
            historyIndexRef.current--;
        }

        const historyItem = historyRef.current[historyIndexRef.current] ?? '';
        if (pidRef.current) {
            void window.electron.terminal.write(pidRef.current, '\x1b[2K\r');
            void window.electron.terminal.write(pidRef.current, historyItem);
        }
        return historyItem;
    }

    return currentLineBuffer;
};

// Handle down arrow key (navigate history forward)
const handleHistoryDown = (
    stateRefs: Pick<TerminalStateRefs, 'historyRef' | 'historyIndexRef' | 'currentInputRef'>,
    pidRef: React.MutableRefObject<string | null>,
    currentLineBuffer: string
): string => {
    const { historyRef, historyIndexRef, currentInputRef } = stateRefs;

    if (historyIndexRef.current !== -1) {
        if (historyIndexRef.current < historyRef.current.length - 1) {
            historyIndexRef.current++;
            const historyItem = historyRef.current[historyIndexRef.current] ?? '';
            if (pidRef.current) {
                void window.electron.terminal.write(pidRef.current, '\x1b[2K\r');
                void window.electron.terminal.write(pidRef.current, historyItem);
            }
            return historyItem;
        } else {
            historyIndexRef.current = -1;
            if (pidRef.current) {
                void window.electron.terminal.write(pidRef.current, '\x1b[2K\r');
                void window.electron.terminal.write(pidRef.current, currentInputRef.current);
            }
            return currentInputRef.current;
        }
    }

    return currentLineBuffer;
};

// Update line buffer based on input character
const updateLineBuffer = (lineBuffer: string, data: string): string => {
    if (data === '\r' || data === '\n') {
        return '';
    } else if (data === '\x7f' || data === '\b') {
        return lineBuffer.slice(0, -1);
    } else if (data.charCodeAt(0) >= 32 || data.length > 1) {
        return lineBuffer + data;
    }

    return lineBuffer;
};

// Setup terminal data handler with history support
const setupTerminalDataHandler = (
    term: Terminal,
    stateRefs: Pick<TerminalStateRefs, 'historyRef' | 'historyIndexRef' | 'currentInputRef'>,
    pidRef: React.MutableRefObject<string | null>,
    addToHistory: (command: string) => void
) => {
    let lineBuffer = '';

    term.onData(data => {
        if (!pidRef.current) { return; }

        // Handle up arrow
        if (data === '\x1b[A') {
            lineBuffer = handleHistoryUp(
                stateRefs,
                pidRef,
                lineBuffer
            );
            return;
        }

        // Handle down arrow
        if (data === '\x1b[B') {
            lineBuffer = handleHistoryDown(
                stateRefs,
                pidRef,
                lineBuffer
            );
            return;
        }

        // Track Enter key for history
        if (data === '\r' || data === '\n') {
            if (lineBuffer.trim()) {
                addToHistory(lineBuffer);
            }
            stateRefs.historyIndexRef.current = -1;
        }

        // Update line buffer
        lineBuffer = updateLineBuffer(lineBuffer, data);

        // Send to terminal
        if (pidRef.current) {
            window.electron.terminal.write(pidRef.current, data).catch(err => {
                appLogger.error('TerminalComponent', 'Write failed', err as Error);
            });
        }
    });
};

const useTerminalInstance = (
    terminalRef: React.RefObject<HTMLDivElement>,
    workspaceId: string | undefined,
    cwd: string | undefined,
    addToHistory: (command: string) => void,
    t: (key: string) => string
) => {
    const pidRef = useRef<string | null>(null);
    const isInitializedRef = useRef(false);
    const terminalInstanceRef = useRef<Terminal | null>(null);
    const terminalIdRef = useRef<string | null>(null);

    // Command history state
    const historyRef = useRef<string[]>(loadHistory(workspaceId));
    const historyIndexRef = useRef<number>(-1);
    const currentInputRef = useRef<string>('');

    useEffect(() => {
        if (isInitializedRef.current || !terminalRef.current) { return; }

        isInitializedRef.current = true;
        const terminalId = `term-${workspaceId ?? 'global'}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        terminalIdRef.current = terminalId;

        const term = createTerminalInstance();
        terminalInstanceRef.current = term;
        const fitAddon = initializeFitAddon(term, terminalRef);

        const initTerminal = async () => {
            const finalTerminalId = terminalIdRef.current;
            if (!finalTerminalId || initializingTerminals.has(finalTerminalId) || initializedTerminals.has(finalTerminalId)) { return; }

            initializingTerminals.add(finalTerminalId);
            try {
                const sessionId = await window.electron.terminal.create({
                    id: finalTerminalId,
                    cwd: cwd ?? '.',
                    cols: term.cols,
                    rows: term.rows
                });

                if (!sessionId) {
                    const errorMessage = t('workspaceDashboard.terminalFailedSession');
                    term.write(`\r\n\x1b[31m[ERROR] ${errorMessage}\x1b[0m\r\n`);
                    initializingTerminals.delete(finalTerminalId);
                    throw new Error(errorMessage);
                }

                pidRef.current = finalTerminalId;
                initializedTerminals.add(finalTerminalId);
                initializingTerminals.delete(finalTerminalId);

                const cleanupData = window.electron.terminal.onData(({ id, data }) => {
                    if (pidRef.current && id === pidRef.current) { term.write(data); }
                });

                const cleanupExit = window.electron.terminal.onExit(({ id, code }) => {
                    if (pidRef.current && id === pidRef.current) {
                        term.write(`\r\n\x1b[33m${t('workspaceDashboard.terminalExited')} ${code}\x1b[0m\r\n`);
                    }
                });

                attachCleanups(term, { data: cleanupData, exit: cleanupExit });
                setupTerminalDataHandler(term, { historyRef, historyIndexRef, currentInputRef }, pidRef, addToHistory);
                performanceMonitor.mark('workspace:terminal:ready');

                term.onResize(({ cols, rows }) => {
                    if (pidRef.current) {
                        window.electron.terminal.resize(pidRef.current, cols, rows).catch(error => {
                            appLogger.warn('TerminalComponent', 'Failed to resize terminal', error as Error);
                        });
                    }
                });
            } catch (error) {
                term.write(`\r\n\x1b[31m${t('workspaceDashboard.terminalFailedStart')}\x1b[0m\r\n`);
                appLogger.error('TerminalComponent', 'Failed to start terminal', error as Error);
            }
        };

        void initTerminal();

        const handleResize = () => {
            try { if (terminalRef.current && (terminalRef.current as HTMLElement).offsetParent) { fitAddon.fit(); } } catch {
                // Ignore fit errors on resize
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            isInitializedRef.current = false;
            window.removeEventListener('resize', handleResize);
            const terminalId = pidRef.current ?? terminalIdRef.current;
            if (terminalId) {
                initializedTerminals.delete(terminalId);
                initializingTerminals.delete(terminalId);
                window.electron.terminal.kill(terminalId).catch(err => {
                    appLogger.error('TerminalComponent', 'Failed to kill terminal on cleanup', err as Error);
                });
            }
            const cleanups = getCleanups(term);
            if (cleanups) {
                if (typeof cleanups.data === 'function') { cleanups.data(); }
                if (typeof cleanups.exit === 'function') { cleanups.exit(); }
            }
            try { term.dispose(); } catch (err) {
                appLogger.error('TerminalComponent', 'Error disposing terminal', err as Error);
            }
            terminalInstanceRef.current = null;
        };
    }, [workspaceId, cwd, terminalRef, addToHistory, t]);

    return { historyRef, historyIndexRef, currentInputRef };
};

export const TerminalComponent = ({ cwd, workspaceId }: TerminalComponentProps) => {
    const { t } = useTranslation();
    const terminalRef = useRef<HTMLDivElement>(null);
    const [terminalRuntimeHealth, setTerminalRuntimeHealth] = useState<{
        terminalAvailable: boolean;
        availableBackends: number;
        totalBackends: number;
    } | null>(null);
    const [sshConnectionCount, setSshConnectionCount] = useState(0);
    const [dockerAvailable, setDockerAvailable] = useState<boolean | null>(null);

    // Command history logic
    const historyRef = useRef<string[]>(loadHistory(workspaceId));
    const historyIndexRef = useRef<number>(-1);
    const currentInputRef = useRef<string>('');

    const addToHistory = useCallback((command: string) => {
        if (command.trim()) {
            if (historyRef.current.length === 0 || historyRef.current[historyRef.current.length - 1] !== command) {
                historyRef.current.push(command);
                saveHistory(historyRef.current, workspaceId);
            }
        }
        historyIndexRef.current = -1;
        currentInputRef.current = '';
    }, [workspaceId]);

    useTerminalInstance(terminalRef, workspaceId, cwd, addToHistory, t);

    useEffect(() => {
        let cancelled = false;
        const fetchRuntimeStatus = async () => {
            try {
                const [runtimeHealth, sshConnections, dockerContainers] = await Promise.all([
                    window.electron.terminal.getRuntimeHealth(),
                    window.electron.ssh.getConnections(),
                    window.electron.terminal.getDockerContainers(),
                ]);
                if (cancelled) {
                    return;
                }
                setTerminalRuntimeHealth({
                    terminalAvailable: runtimeHealth.terminalAvailable,
                    availableBackends: runtimeHealth.availableBackends,
                    totalBackends: runtimeHealth.totalBackends,
                });
                setSshConnectionCount(Array.isArray(sshConnections) ? sshConnections.length : 0);
                const hasDockerData = Array.isArray(dockerContainers)
                    || (
                        typeof dockerContainers === 'object'
                        && dockerContainers !== null
                        && 'success' in dockerContainers
                    );
                setDockerAvailable(hasDockerData);
            } catch {
                if (!cancelled) {
                    setDockerAvailable(false);
                }
            }
        };

        void fetchRuntimeStatus();
        const timer = window.setInterval(() => {
            void fetchRuntimeStatus();
        }, 15000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, []);

    return (
        <div className="w-full h-full relative group flex flex-col gap-2 min-h-300">
            <div className="flex flex-wrap items-center gap-2 typo-overline">
                <span className={cn(
                    'inline-flex items-center rounded-full px-2 py-1 border',
                    terminalRuntimeHealth?.terminalAvailable ? 'border-success/50 text-success' : 'border-destructive/50 text-destructive'
                )}>
                    {t('workspace.terminalStatusTerm')} {terminalRuntimeHealth?.availableBackends ?? 0}/{terminalRuntimeHealth?.totalBackends ?? 0}
                </span>
                <span className={cn(
                    'inline-flex items-center rounded-full px-2 py-1 border',
                    sshConnectionCount > 0 ? 'border-success/50 text-success' : 'border-muted-foreground/40 text-muted-foreground'
                )}>
                    {t('workspace.terminalStatusSsh')} {sshConnectionCount}
                </span>
                <span className={cn(
                    'inline-flex items-center rounded-full px-2 py-1 border',
                    dockerAvailable ? 'border-success/50 text-success' : 'border-muted-foreground/40 text-muted-foreground'
                )}>
                    {t('workspace.terminalStatusDocker')} {dockerAvailable ? t('workspace.terminalStatusReady') : t('workspace.terminalStatusUnavailable')}
                </span>
            </div>
            <div className="relative flex-1">
                {/* Modern terminal container with gradient border effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10 rounded-xl blur-xl opacity-30" />
                <div
                    ref={terminalRef}
                    className="relative w-full h-full bg-card rounded-xl overflow-hidden border border-border/50 shadow-2xl backdrop-blur-sm"
                    style={{
                        boxShadow: 'var(--terminal-surface-shadow)'
                    }}
                />
                {/* Subtle top gradient overlay */}
                <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-muted/30 to-transparent pointer-events-none rounded-t-xl" />
            </div>
        </div>
    );
};




