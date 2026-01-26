import { safeJsonParse } from '@shared/utils/sanitize.util';
import { useCallback, useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

import { useTranslation } from '@/i18n';

import 'xterm/css/xterm.css';

interface TerminalComponentProps {
    cwd?: string | undefined
    projectId?: string | undefined  // For persistent command history
}

// Terminal history persistence keys
const HISTORY_KEY_PREFIX = 'orbit_terminal_history_';
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

export const TerminalComponent = ({ cwd, projectId }: TerminalComponentProps) => {
    const { t } = useTranslation();
    const terminalRef = useRef<HTMLDivElement>(null);
    const pidRef = useRef<string | null>(null);
    const isInitializedRef = useRef(false);
    const terminalInstanceRef = useRef<Terminal | null>(null);
    const terminalIdRef = useRef<string | null>(null);

    // Command history state
    const historyRef = useRef<string[]>(loadHistory(projectId));
    const historyIndexRef = useRef<number>(-1);
    const currentInputRef = useRef<string>('');

    // Add command to history
    const addToHistory = useCallback((command: string) => {
        if (command.trim()) {
            // Avoid duplicate consecutive entries
            if (historyRef.current.length === 0 || historyRef.current[historyRef.current.length - 1] !== command) {
                historyRef.current.push(command);
                saveHistory(historyRef.current, projectId);
            }
        }
        // Reset history navigation
        historyIndexRef.current = -1;
        currentInputRef.current = '';
    }, [projectId]);

    useEffect(() => {
        // Prevent multiple initializations
        if (isInitializedRef.current) {
            console.warn('[TerminalComponent] Already initialized, skipping');
            return;
        }

        if (!terminalRef.current) {
            console.warn('[TerminalComponent] No container ref, skipping');
            return;
        }

        console.warn('[TerminalComponent] Initializing terminal');
        isInitializedRef.current = true;

        // Generate a unique terminal ID for this mount
        const terminalId = `term-${projectId ?? 'global'}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        terminalIdRef.current = terminalId;

        // Check if already initializing (shouldn't happen, but safety check)
        if (initializingTerminals.has(terminalId) || initializedTerminals.has(terminalId)) {
            console.warn(`[TerminalComponent] Terminal ${terminalId} already exists, generating new ID`);
            terminalIdRef.current = `term-${projectId ?? 'global'}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        }

        const term = new Terminal({
            theme: {
                background: '#0a0a0f',
                foreground: '#e4e4e7',
                cursor: '#60a5fa',
                cursorAccent: '#0a0a0f',
                selectionBackground: 'rgba(96, 165, 250, 0.2)',
                selectionForeground: '#ffffff',
                black: '#1a1a1f',
                red: '#f87171',
                green: '#34d399',
                yellow: '#fbbf24',
                blue: '#60a5fa',
                magenta: '#f472b6',
                cyan: '#22d3ee',
                white: '#fafafa',
                brightBlack: '#3f3f46',
                brightRed: '#fca5a5',
                brightGreen: '#6ee7b7',
                brightYellow: '#fcd34d',
                brightBlue: '#93c5fd',
                brightMagenta: '#f9a8d4',
                brightCyan: '#67e8f9',
                brightWhite: '#ffffff'
            },
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

        terminalInstanceRef.current = term;

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);

        try {
            if (terminalRef.current && (terminalRef.current as HTMLElement).offsetParent) {
                fitAddon.fit();
            }
        } catch {
            console.warn('ide/Terminal: Initial fit failed');
        }

        // Track current line input for history navigation
        let lineBuffer = '';

        // Initialize backend process
        const initTerminal = async () => {
            const finalTerminalId = terminalIdRef.current; // Final check before creating
            if (!finalTerminalId || initializingTerminals.has(finalTerminalId) || initializedTerminals.has(finalTerminalId)) {
                console.warn(`[TerminalComponent] Terminal ${finalTerminalId} already exists or is null, skipping`);
                return;
            }

            initializingTerminals.add(finalTerminalId);

            try {
                const result = await window.electron.terminal.create({
                    id: finalTerminalId,
                    cwd: cwd ?? process.cwd?.() ?? '.',
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

                // Setup listeners
                const cleanupData = window.electron.terminal.onData(({ id, data }) => {
                    try {
                        if (pidRef.current && id === pidRef.current && term) {
                            term.write(data);
                        }
                    } catch (error) {
                        console.error('[TerminalComponent] Error writing data:', error);
                    }
                });

                const cleanupExit = window.electron.terminal.onExit(({ id, code }) => {
                    try {
                        if (pidRef.current && id === pidRef.current && term) {
                            term.write(`\r\n\x1b[33m${t('projectDashboard.terminalExited')} ${code}\x1b[0m\r\n`);
                        }
                    } catch (error) {
                        console.error('[TerminalComponent] Error handling exit:', error);
                    }
                });

                // Use a ref to store cleanups to call in useEffect cleanup
                const cleanups = { data: cleanupData, exit: cleanupExit };
                (term as unknown as { _cleanups: typeof cleanups })._cleanups = cleanups;

                // Enhanced data handler with history support
                term.onData(data => {
                    if (!pidRef.current) { return; }

                    // Handle special key sequences for history navigation
                    if (data === '\x1b[A') {
                        // Up arrow - go back in history
                        if (historyRef.current.length > 0) {
                            if (historyIndexRef.current === -1) {
                                // Save current input
                                currentInputRef.current = lineBuffer;
                                historyIndexRef.current = historyRef.current.length - 1;
                            } else if (historyIndexRef.current > 0) {
                                historyIndexRef.current--;
                            }

                            // Clear current line and show history item
                            const historyItem = historyRef.current[historyIndexRef.current] ?? '';
                            if (pidRef.current) {
                                void window.electron.terminal.write(pidRef.current, '\x1b[2K\r');
                                void window.electron.terminal.write(pidRef.current, historyItem);
                            }
                            lineBuffer = historyItem;
                        }
                        return;
                    }

                    if (data === '\x1b[B') {
                        // Down arrow - go forward in history
                        if (historyIndexRef.current !== -1) {
                            if (historyIndexRef.current < historyRef.current.length - 1) {
                                historyIndexRef.current++;
                                const historyItem = historyRef.current[historyIndexRef.current] ?? '';
                                if (pidRef.current) {
                                    void window.electron.terminal.write(pidRef.current, '\x1b[2K\r');
                                    void window.electron.terminal.write(pidRef.current, historyItem);
                                }
                                lineBuffer = historyItem;
                            } else {
                                // Restore original input
                                historyIndexRef.current = -1;
                                void window.electron.terminal.write(pidRef.current, '\x1b[2K\r');
                                void window.electron.terminal.write(pidRef.current, currentInputRef.current);
                                lineBuffer = currentInputRef.current;
                            }
                        }
                        return;
                    }

                    // Track line input for Enter key
                    if (data === '\r' || data === '\n') {
                        // Command submitted - add to history
                        if (lineBuffer.trim()) {
                            addToHistory(lineBuffer);
                        }
                        lineBuffer = '';
                        historyIndexRef.current = -1;
                    } else if (data === '\x7f' || data === '\b') {
                        // Backspace
                        lineBuffer = lineBuffer.slice(0, -1);
                    } else if (data.charCodeAt(0) >= 32 || data.length > 1) {
                        // Regular character input (or paste)
                        lineBuffer += data;
                    }

                    // Send to terminal
                    if (pidRef.current) {
                        window.electron.terminal.write(pidRef.current, data).catch(err => {
                            console.error('[TerminalComponent] Write failed:', err);
                        });
                    }
                });

                term.onResize(({ cols, rows }) => {
                    if (pidRef.current) {
                        window.electron.terminal.resize(pidRef.current, cols, rows).catch(err => {
                            console.error('[TerminalComponent] Resize failed:', err);
                        });
                    }
                });

            } catch (error) {
                term.write(`\r\n\x1b[31m${t('projectDashboard.terminalFailedStart')}\x1b[0m\r\n`);
                console.error(error);
            }
        };

        void initTerminal();

        const handleResize = () => {
            try {
                if (terminalRef.current && (terminalRef.current as HTMLElement).offsetParent) {
                    fitAddon.fit();
                }
            } catch {
                // Ignore fit errors on resize
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            isInitializedRef.current = false;
            window.removeEventListener('resize', handleResize);

            const terminalId = pidRef.current ?? terminalIdRef.current;
            if (terminalId) {
                // Remove from registry
                initializedTerminals.delete(terminalId);
                initializingTerminals.delete(terminalId);

                // Kill the terminal session
                window.electron.terminal.kill(terminalId).catch(err => {
                    console.error('[TerminalComponent] Failed to kill terminal on cleanup:', err);
                });
            }

            // Call individual cleanups
            const cleanups = (term as unknown as { _cleanups?: { data: () => void, exit: () => void } })._cleanups;
            if (cleanups) {
                if (typeof cleanups.data === 'function') { cleanups.data(); }
                if (typeof cleanups.exit === 'function') { cleanups.exit(); }
            }

            try {
                term.dispose();
            } catch (err) {
                console.error('[TerminalComponent] Error disposing terminal:', err);
            }
            terminalInstanceRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Remove dependencies to prevent re-initialization on prop changes

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

