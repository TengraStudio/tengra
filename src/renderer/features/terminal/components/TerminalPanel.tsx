/**
 * Terminal Panel Component
 * VSCode-style terminal panel with bottom slide-up behavior
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@/i18n';

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { TerminalSession, TerminalPanelState } from '@shared/types/terminal-v2';
import { X, Plus } from 'lucide-react';

import './TerminalPanel.css';

const TERMINAL_MIN_HEIGHT = 100;
const TERMINAL_DEFAULT_HEIGHT = 300;
const TERMINAL_MAX_HEIGHT = 800;

export const TerminalPanel: React.FC = () => {
    const { t } = useTranslation();
    const [panelState, setPanelState] = useState<TerminalPanelState>({
        isOpen: false,
        height: TERMINAL_DEFAULT_HEIGHT,
        activeSessionId: null,
        sessions: [],
        splitMode: 'single'
    });

    const [isResizing, setIsResizing] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const terminalRefs = useRef<Map<string, { terminal: Terminal; fitAddon: FitAddon }>>(new Map());

    const toggleTerminal = useCallback(() => {
        setPanelState(prev => ({
            ...prev,
            isOpen: !prev.isOpen
        }));
    }, []);

    const createNewTerminal = useCallback(async () => {
        try {
            const sessionId = await window.electron.invoke('terminal:create', {
                cols: 80,
                rows: 24
            }) as string;

            const newSession: TerminalSession = {
                id: sessionId,
                title: `${t('terminal.title')} ${panelState.sessions.length + 1}`,
                cwd: '',
                shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
                backendType: 'xterm',
                status: 'running',
                createdAt: Date.now(),
                lastActive: Date.now()
            };

            setPanelState(prev => ({
                ...prev,
                isOpen: true,
                activeSessionId: sessionId,
                sessions: [...prev.sessions, newSession]
            }));
        } catch (error) {
            console.error('Failed to create terminal:', error);
        }
    }, [t, panelState.sessions.length]);


    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === '`') {
                e.preventDefault();
                toggleTerminal();
            } else if (e.ctrlKey && e.shiftKey && e.key === '~') {
                e.preventDefault();
                void createNewTerminal();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleTerminal, createNewTerminal]);


    const closeTerminal = async (sessionId: string) => {
        try {
            await window.electron.invoke('terminal:close', sessionId);

            setPanelState(prev => {
                const newSessions = prev.sessions.filter(s => s.id !== sessionId);
                const newActiveId = prev.activeSessionId === sessionId
                    ? (newSessions.length > 0 ? newSessions[0].id : null)
                    : prev.activeSessionId;

                return {
                    ...prev,
                    sessions: newSessions,
                    activeSessionId: newActiveId,
                    isOpen: newSessions.length > 0 ? prev.isOpen : false
                };
            });

            const terminalInstance = terminalRefs.current.get(sessionId);
            if (terminalInstance) {
                terminalInstance.terminal.dispose();
                terminalRefs.current.delete(sessionId);
            }
        } catch (error) {
            console.error('Failed to close terminal:', error);
        }
    };

    const switchTerminal = (sessionId: string) => {
        setPanelState(prev => ({
            ...prev,
            activeSessionId: sessionId
        }));
    };

    const initializeTerminal = (sessionId: string, container: HTMLDivElement) => {
        if (terminalRefs.current.has(sessionId)) {
            return;
        }

        const terminal = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Consolas, "Courier New", monospace',
            theme: {
                background: '#1e1e1e',
                foreground: '#cccccc'
            }
        });

        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(container);
        fitAddon.fit();

        terminalRefs.current.set(sessionId, { terminal, fitAddon });

        terminal.onData((data: string) => {
            void window.electron.invoke('terminal:write', sessionId, data);
        });
    };

    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    };

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const newHeight = window.innerHeight - e.clientY;
            const clampedHeight = Math.max(TERMINAL_MIN_HEIGHT, Math.min(TERMINAL_MAX_HEIGHT, newHeight));
            setPanelState(prev => ({ ...prev, height: clampedHeight }));
        };

        const handleMouseUp = () => setIsResizing(false);

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    if (!panelState.isOpen) return null;

    return (
        <div ref={panelRef} className="terminal-panel" style={{ height: `${panelState.height}px` }}>
            <div className="terminal-resize-handle" onMouseDown={handleResizeStart} />

            <div className="terminal-header">
                <div className="terminal-tabs">
                    {panelState.sessions.map(session => (
                        <div
                            key={session.id}
                            className={`terminal-tab ${session.id === panelState.activeSessionId ? 'active' : ''}`}
                            onClick={() => switchTerminal(session.id)}
                        >
                            <span>{session.title}</span>
                            <button onClick={(e) => { e.stopPropagation(); void closeTerminal(session.id); }}>
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="terminal-actions">
                    <button onClick={() => void createNewTerminal()} title={t('terminal.new')}>
                        <Plus size={18} />
                    </button>
                    <button onClick={toggleTerminal} title={t('terminal.hide')}>
                        <X size={18} />
                    </button>
                </div>
            </div>

            <div className="terminal-container">
                {panelState.sessions.map(session => (
                    <div
                        key={session.id}
                        className={session.id === panelState.activeSessionId ? 'terminal-view active' : 'terminal-view'}
                        ref={(el) => el && session.id === panelState.activeSessionId && initializeTerminal(session.id, el)}
                    />
                ))}
            </div>
        </div>
    );
};
