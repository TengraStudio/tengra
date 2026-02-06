import { safeJsonParse } from '@shared/utils/sanitize.util';
import { useCallback, useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

import { useTranslation } from '@/i18n';
import { getTerminalTheme } from '@/lib/terminal-theme';
import { appLogger } from '@/utils/renderer-logger';

import 'xterm/css/xterm.css';

interface TerminalComponentProps {
    cwd?: string | undefined
    projectId?: string | undefined  // For persistent command history
}

interface TerminalCleanups {
    data: () => void
    exit: () => void
}

interface TerminalStateRefs {
    terminalInstanceRef: React.MutableRefObject<Terminal | null>
    pidRef: React.MutableRefObject<string | null>
    historyRef: React.MutableRefObject<string[]>
    historyIndexRef: React.MutableRefObject<number>
    currentInputRef: React.MutableRefObject<string>
    lineBuffer: string
}

// Terminal history persistence keys
const HISTORY_KEY_PREFIX = 'Tandem_terminal_history_';
const MAX_HISTORY_SIZE = 500;

// Get history storage key for a project
const getHistoryKey = (projectId?: string) => {
    return `${HISTORY_KEY_PREFIX}${projectId ?? 'global'}`;
};

// Load command history from localStorage
const loadHistory = (projectId?: string): string[] => {
    try {
        const stored = localStorage.getItem(getHistoryKey(projectId));
        if (stored) {
            return safeJsonParse<string[]>(stored, []);
        }
    } catch (error) {
        console.warn('Failed to load terminal history:', error);
    }
    return [];
};

// Save command history to localStorage
const saveHistory = (history: string[], projectId?: string) => {
    try {
        // Keep only the last MAX_HISTORY_SIZE commands
        const trimmed = history.slice(-MAX_HISTORY_SIZE);
        localStorage.setItem(getHistoryKey(projectId), JSON.stringify(trimmed));
    } catch (error) {
        console.warn('Failed to save terminal history:', error);
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
        fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", "SF Mono", Monaco, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace',
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
            console.warn('ide/Terminal: Initial fit failed');
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
    projectId: string | undefined,
    cwd: string | undefined,
    addToHistory: (command: string) => void,
    t: (key: string) => string
) => {
    const pidRef = useRef<string | null>(null);
    const isInitializedRef = useRef(false);
    const terminalInstanceRef = useRef<Terminal | null>(null);
    const terminalIdRef = useRef<string | null>(null);

    // Command history state
    const historyRef = useRef<string[]>(loadHistory(projectId));
    const historyIndexRef = useRef<number>(-1);
    const currentInputRef = useRef<string>('');

    useEffect(() => {
        if (isInitializedRef.current || !terminalRef.current) { return; }

        isInitializedRef.current = true;
        const terminalId = `term-${projectId ?? 'global'}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        terminalIdRef.current = terminalId;

        const term = createTerminalInstance();
        terminalInstanceRef.current = term;
        const fitAddon = initializeFitAddon(term, terminalRef);

        const initTerminal = async () => {
            const finalTerminalId = terminalIdRef.current;
            if (!finalTerminalId || initializingTerminals.has(finalTerminalId) || initializedTerminals.has(finalTerminalId)) { return; }

            initializingTerminals.add(finalTerminalId);
            try {
                const result = await window.electron.terminal.create({
                    id: finalTerminalId,
                    cwd: cwd ?? '.',
                    cols: term.cols,
                    rows: term.rows
                });

                if (!result.success) {
                    const errorMessage = result.error ?? t('projectDashboard.terminalFailedSession');
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
                        term.write(`\r\n\x1b[33m${t('projectDashboard.terminalExited')} ${code}\x1b[0m\r\n`);
                    }
                });

                attachCleanups(term, { data: cleanupData, exit: cleanupExit });
                setupTerminalDataHandler(term, { historyRef, historyIndexRef, currentInputRef }, pidRef, addToHistory);

                term.onResize(({ cols, rows }) => {
                    if (pidRef.current) { window.electron.terminal.resize(pidRef.current, cols, rows).catch(() => { }); }
                });
            } catch (error) {
                term.write(`\r\n\x1b[31m${t('projectDashboard.terminalFailedStart')}\x1b[0m\r\n`);
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
    }, [projectId, cwd, terminalRef, addToHistory, t]);

    return { historyRef, historyIndexRef, currentInputRef };
};

export const TerminalComponent = ({ cwd, projectId }: TerminalComponentProps) => {
    const { t } = useTranslation();
    const terminalRef = useRef<HTMLDivElement>(null);

    // Command history logic
    const historyRef = useRef<string[]>(loadHistory(projectId));
    const historyIndexRef = useRef<number>(-1);
    const currentInputRef = useRef<string>('');

    const addToHistory = useCallback((command: string) => {
        if (command.trim()) {
            if (historyRef.current.length === 0 || historyRef.current[historyRef.current.length - 1] !== command) {
                historyRef.current.push(command);
                saveHistory(historyRef.current, projectId);
            }
        }
        historyIndexRef.current = -1;
        currentInputRef.current = '';
    }, [projectId]);

    useTerminalInstance(terminalRef, projectId, cwd, addToHistory, t);

    return (
        <div className="w-full h-full relative group" style={{ minHeight: '300px' }}>
            {/* Modern terminal container with gradient border effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10 rounded-xl blur-xl opacity-30" />
            <div
                ref={terminalRef}
                className="relative w-full h-full bg-card rounded-xl overflow-hidden border border-border/50 shadow-2xl backdrop-blur-sm"
                style={{
                    boxShadow: 'inset 0 1px 0 0 hsl(var(--border) / 0.1), 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
                }}
            />
            {/* Subtle top gradient overlay */}
            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-muted/30 to-transparent pointer-events-none rounded-t-xl" />
        </div>
    );
};


