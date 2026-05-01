/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    terminalCreateResponseSchema,
    terminalKillResponseSchema,
    terminalResizeResponseSchema,
    terminalWriteResponseSchema
} from '@shared/schemas/terminal.schema';
import type { TerminalIpcContract } from '@shared/terminal-ipc';
import { toTerminalSessionId,toWorkspaceId, WorkspaceId } from '@shared/types/ids';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useCallback, useEffect, useRef } from 'react';

import { invokeTypedIpc } from '@/lib/ipc-client';
import { getTerminalTheme } from '@/lib/terminal-theme';
import { useSettingsStore } from '@/store/settings.store';
import { appLogger } from '@/utils/renderer-logger';

import { loadHistory, saveHistory } from '../utils/terminal-history';

const initializedTerminals = new Set<string>();
const initializingTerminals = new Set<string>();

interface TerminalCleanups {
    data?: () => void;
    exit?: () => void;
}

interface TerminalConfig {
    theme: ReturnType<typeof getTerminalTheme>;
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    letterSpacing: number;
    cursorBlink: boolean;
    cursorStyle: 'bar' | 'block' | 'underline';
    convertEol: boolean;
    scrollback: number;
    fontWeight: '400' | '600';
    fontWeightBold: '400' | '600';
}

const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
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
};

/**
 * Get terminal configuration merged with user settings
 */
function getTerminalConfig(settings: { terminal?: Partial<TerminalConfig> } | null): TerminalConfig {
    return {
        ...DEFAULT_TERMINAL_CONFIG,
        ...(settings?.terminal ?? {}),
        theme: getTerminalTheme(), // Always use current theme
    };
}

const KEY_CODES: Record<string, string> = {
    ARROW_UP: '\x1b[A',
    ARROW_DOWN: '\x1b[B',
    ENTER: '\r',
    NEWLINE: '\n',
    DELETE: '\x7f',
    BACKSPACE: '\b',
    CLEAR_LINE: '\x1b[2K\r'
};

interface LineBufferContext {
    lineBuffer: string;
    historyRef: React.MutableRefObject<string[]>;
    historyIndexRef: React.MutableRefObject<number>;
    currentInputRef: React.MutableRefObject<string>;
    pidRef: React.MutableRefObject<string | null>;
    addToHistory: (command: string) => void;
}

const handleArrowUp = (context: LineBufferContext): string => {
    const { lineBuffer, historyRef, historyIndexRef, currentInputRef, pidRef } = context;

    if (historyRef.current.length === 0) {
        return lineBuffer;
    }

    if (historyIndexRef.current === -1) {
        currentInputRef.current = lineBuffer;
        historyIndexRef.current = historyRef.current.length - 1;
    } else if (historyIndexRef.current > 0) {
        historyIndexRef.current--;
    }

    const historyItem = historyRef.current[historyIndexRef.current] ?? '';
    if (pidRef.current) {
        void invokeTypedIpc<TerminalIpcContract, 'terminal:write'>('terminal:write', [pidRef.current, KEY_CODES.CLEAR_LINE], { responseSchema: terminalWriteResponseSchema });
        void invokeTypedIpc<TerminalIpcContract, 'terminal:write'>('terminal:write', [pidRef.current, historyItem], { responseSchema: terminalWriteResponseSchema });
    }
    return historyItem;
};

const handleArrowDown = (context: LineBufferContext): string => {
    const { historyRef, historyIndexRef, currentInputRef, pidRef } = context;

    if (historyIndexRef.current === -1) {
        return '';
    }

    if (historyIndexRef.current < historyRef.current.length - 1) {
        historyIndexRef.current++;
        const historyItem = historyRef.current[historyIndexRef.current] ?? '';
        if (pidRef.current) {
            void invokeTypedIpc<TerminalIpcContract, 'terminal:write'>('terminal:write', [pidRef.current, KEY_CODES.CLEAR_LINE], { responseSchema: terminalWriteResponseSchema });
            void invokeTypedIpc<TerminalIpcContract, 'terminal:write'>('terminal:write', [pidRef.current, historyItem], { responseSchema: terminalWriteResponseSchema });
        }
        return historyItem;
    } else {
        historyIndexRef.current = -1;
        if (pidRef.current) {
            void invokeTypedIpc<TerminalIpcContract, 'terminal:write'>('terminal:write', [pidRef.current, KEY_CODES.CLEAR_LINE], { responseSchema: terminalWriteResponseSchema });
            void invokeTypedIpc<TerminalIpcContract, 'terminal:write'>('terminal:write', [pidRef.current, currentInputRef.current], { responseSchema: terminalWriteResponseSchema });
        }
        return currentInputRef.current;
    }
};

const handleCharInput = (data: string, lineBuffer: string): string => {
    if (data === KEY_CODES.DELETE || data === KEY_CODES.BACKSPACE) {
        return lineBuffer.slice(0, -1);
    }
    if (data.charCodeAt(0) >= 32 || data.length > 1) {
        return lineBuffer + data;
    }
    return lineBuffer;
};

export function useTerminal(cwd?: string, workspaceId?: string, t?: (key: string) => string) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const pidRef = useRef<string | null>(null);
    const isInitializedRef = useRef(false);
    const terminalIdRef = useRef<string | null>(null);
    const historyRef = useRef<string[]>(loadHistory(workspaceId));
    const historyIndexRef = useRef<number>(-1);
    const currentInputRef = useRef<string>('');
    const cleanupsRef = useRef<TerminalCleanups>({});
    const termRef = useRef<Terminal | null>(null);

    // Get settings from store for terminal configuration
    const settings = useSettingsStore(snapshot => snapshot.settings);

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

    useEffect(() => {
        if (isInitializedRef.current || !terminalRef.current) { return; }

        isInitializedRef.current = true;
        const normalizedWorkspaceId: WorkspaceId = toWorkspaceId(workspaceId ?? 'global');
        const terminalId = toTerminalSessionId(`term-${normalizedWorkspaceId}-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`);
        terminalIdRef.current = terminalId;

        const terminalConfig = getTerminalConfig(settings);
        const term = new Terminal(terminalConfig);
        termRef.current = term;

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);

        try {
            if ((terminalRef.current as HTMLElement).offsetParent) {
                fitAddon.fit();
            }
        } catch {
            // Silently catch initial fit failure
        }

        let lineBuffer = '';

        const initTerminal = async (): Promise<void> => {
            const finalTerminalId = terminalIdRef.current;
            if (!finalTerminalId || initializingTerminals.has(finalTerminalId) || initializedTerminals.has(finalTerminalId)) { return; }

            initializingTerminals.add(finalTerminalId);

            try {
                const sessionId = await invokeTypedIpc<TerminalIpcContract, 'terminal:create'>('terminal:create', [{
                    id: finalTerminalId,
                    cwd: cwd ?? (typeof process !== 'undefined' ? process.cwd() : ''),
                    cols: term.cols,
                    rows: term.rows
                }], { responseSchema: terminalCreateResponseSchema });

                if (!sessionId) {
                    const errorMessage = t ? t('frontend.workspaceDashboard.terminalFailedSession') : 'Failed to start session';
                    term.write(`\r\n\x1b[31m[ERROR] ${errorMessage}\x1b[0m\r\n`);
                    initializingTerminals.delete(finalTerminalId);
                    return;
                }

                pidRef.current = finalTerminalId;
                initializedTerminals.add(finalTerminalId);
                initializingTerminals.delete(finalTerminalId);

                const cleanupData = window.electron.terminal.onData(({ id, data }) => {
                    if (pidRef.current && id === pidRef.current) {
                        term.write(data);
                    }
                });

                const cleanupExit = window.electron.terminal.onExit(({ id, code }) => {
                    if (pidRef.current && id === pidRef.current) {
                        term.write(`\r\n\x1b[33mTerminal exited with code ${code}\x1b[0m\r\n`);
                    }
                });

                cleanupsRef.current = { data: cleanupData, exit: cleanupExit };

                term.onData((data: string) => {
                    if (!pidRef.current) { return; }

                    if (data === KEY_CODES.ARROW_UP) {
                        lineBuffer = handleArrowUp({ lineBuffer, historyRef, historyIndexRef, currentInputRef, pidRef, addToHistory });
                        return;
                    }

                    if (data === KEY_CODES.ARROW_DOWN) {
                        lineBuffer = handleArrowDown({ lineBuffer, historyRef, historyIndexRef, currentInputRef, pidRef, addToHistory });
                        return;
                    }

                    if (data === KEY_CODES.ENTER || data === KEY_CODES.NEWLINE) {
                        if (lineBuffer.trim()) { addToHistory(lineBuffer); }
                        lineBuffer = '';
                        historyIndexRef.current = -1;
                    } else {
                        lineBuffer = handleCharInput(data, lineBuffer);
                    }

                    if (pidRef.current) {
                        invokeTypedIpc<TerminalIpcContract, 'terminal:write'>('terminal:write', [pidRef.current, data], { responseSchema: terminalWriteResponseSchema }).catch(error => {
                            appLogger.warn('WorkspaceUseTerminal', 'Failed to write terminal input', error as Error);
                        });
                    }
                });

                term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
                    if (pidRef.current) {
                        invokeTypedIpc<TerminalIpcContract, 'terminal:resize'>('terminal:resize', [pidRef.current, cols, rows], { responseSchema: terminalResizeResponseSchema }).catch(error => {
                            appLogger.warn('WorkspaceUseTerminal', 'Failed to resize terminal', error as Error);
                        });
                    }
                });

            } catch (error) {
                appLogger.error('WorkspaceUseTerminal', 'Failed to initialize terminal', error as Error);
                term.write(`\r\n\x1b[31mFailed to start terminal\x1b[0m\r\n`);
            }
        };

        void initTerminal();

        const handleResize = (): void => {
            if (terminalRef.current?.offsetParent) {
                fitAddon.fit();
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
                invokeTypedIpc<TerminalIpcContract, 'terminal:kill'>('terminal:kill', [terminalId], { responseSchema: terminalKillResponseSchema }).catch(error => {
                    appLogger.warn('WorkspaceUseTerminal', 'Failed to kill terminal during cleanup', error as Error);
                });
            }
            if (cleanupsRef.current.data) { cleanupsRef.current.data(); }
            if (cleanupsRef.current.exit) { cleanupsRef.current.exit(); }
            term.dispose();
        };
    }, [cwd, workspaceId, t, addToHistory, settings]);

    // Update terminal options when settings change
    useEffect(() => {
        const term = termRef.current;
        if (!term) { return; }

        const terminalConfig = getTerminalConfig(settings);
        term.options.fontSize = terminalConfig.fontSize;
        term.options.fontFamily = terminalConfig.fontFamily;
        term.options.lineHeight = terminalConfig.lineHeight;
        term.options.letterSpacing = terminalConfig.letterSpacing;
        term.options.cursorStyle = terminalConfig.cursorStyle;
        term.options.cursorBlink = terminalConfig.cursorBlink;
        term.options.scrollback = terminalConfig.scrollback;
    }, [settings]);

    return { terminalRef };
}
