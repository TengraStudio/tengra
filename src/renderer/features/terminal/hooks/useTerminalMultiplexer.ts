import { useCallback, useState } from 'react';

import { appLogger } from '@/utils/renderer-logger';

import type { MultiplexerMode, MultiplexerSession } from '../utils/terminal-panel-types';
import { parseScreenSessions, parseTmuxSessions, quoteCommandValue } from '../utils/terminal-panel-utils';

/**
 * Props for useTerminalMultiplexer hook
 */
interface UseTerminalMultiplexerProps {
    /** Workspace path for command execution */
    workspacePath?: string;
    /** Currently active tab ID ref */
    activeTabIdRef: React.MutableRefObject<string | null>;
    /** Function to write command to active terminal */
    writeCommandToActiveTerminal: (command: string) => Promise<void>;
}

/**
 * Hook for terminal multiplexer (tmux/screen) integration
 * 
 * @param props - Hook configuration
 * @returns Multiplexer state and control functions
 */
export function useTerminalMultiplexer({
    workspacePath,
    activeTabIdRef: _activeTabIdRef,
    writeCommandToActiveTerminal,
}: UseTerminalMultiplexerProps) {
    const [multiplexerMode, setMultiplexerMode] = useState<MultiplexerMode>('tmux');
    const [multiplexerSessionName, setMultiplexerSessionName] = useState('main');
    const [isMultiplexerLoading, setIsMultiplexerLoading] = useState(false);
    const [multiplexerSessions, setMultiplexerSessions] = useState<MultiplexerSession[]>([]);
    const [multiplexerError, setMultiplexerError] = useState<string | null>(null);

    /**
     * Refresh multiplexer sessions list
     * 
     * @param mode - Multiplexer mode to use
     */
    const refreshMultiplexerSessions = useCallback(
        async (mode: MultiplexerMode = multiplexerMode) => {
            try {
                setIsMultiplexerLoading(true);
                setMultiplexerError(null);
                setMultiplexerSessions([]);

                if (mode === 'tmux') {
                    const result = await window.electron.runCommand(
                        'tmux',
                        ['list-sessions', '-F', '#S|#{session_windows}|#{session_attached}'],
                        workspacePath
                    );
                    if (result.code !== 0) {
                        const stderr = (result.stderr || '').toLowerCase();
                        if (
                            stderr.includes('failed to connect') ||
                            stderr.includes('no server running')
                        ) {
                            setMultiplexerSessions([]);
                            return;
                        }
                        setMultiplexerError(result.stderr || 'Failed to list tmux sessions');
                        return;
                    }
                    setMultiplexerSessions(parseTmuxSessions(result.stdout));
                    return;
                }

                const result = await window.electron.runCommand('screen', ['-ls'], workspacePath);
                if (result.code !== 0) {
                    const stderr = (result.stderr || '').toLowerCase();
                    if (stderr.includes('no sockets found')) {
                        setMultiplexerSessions([]);
                        return;
                    }
                    setMultiplexerError(result.stderr || 'Failed to list screen sessions');
                    return;
                }
                setMultiplexerSessions(parseScreenSessions(result.stdout));
            } catch (error) {
                appLogger.error(
                    'TerminalPanel',
                    'Failed to query multiplexer sessions',
                    error as Error
                );
                setMultiplexerError(
                    error instanceof Error ? error.message : 'Multiplexer query failed'
                );
            } finally {
                setIsMultiplexerLoading(false);
            }
        },
        [multiplexerMode, workspacePath]
    );

    /**
     * Attach to an existing multiplexer session
     * 
     * @param session - Session to attach to
     */
    const attachMultiplexerSession = useCallback(
        async (session: MultiplexerSession) => {
            const command =
                multiplexerMode === 'tmux'
                    ? `tmux attach -t ${quoteCommandValue(session.id)}`
                    : `screen -r ${quoteCommandValue(session.id)}`;
            await writeCommandToActiveTerminal(command);
        },
        [multiplexerMode, writeCommandToActiveTerminal]
    );

    /**
     * Create a new multiplexer session
     */
    const createMultiplexerSession = useCallback(async () => {
        const safeName = multiplexerSessionName.trim() || 'main';
        const command =
            multiplexerMode === 'tmux'
                ? `tmux new -As ${quoteCommandValue(safeName)}`
                : `screen -S ${quoteCommandValue(safeName)}`;
        await writeCommandToActiveTerminal(command);
    }, [multiplexerMode, multiplexerSessionName, writeCommandToActiveTerminal]);

    return {
        multiplexerMode,
        setMultiplexerMode,
        multiplexerSessionName,
        setMultiplexerSessionName,
        isMultiplexerLoading,
        multiplexerSessions,
        multiplexerError,
        refreshMultiplexerSessions,
        attachMultiplexerSession,
        createMultiplexerSession,
    };
}
