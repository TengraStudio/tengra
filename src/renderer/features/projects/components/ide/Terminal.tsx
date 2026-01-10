import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { useTranslation } from '@/i18n'
import 'xterm/css/xterm.css'

interface TerminalComponentProps {
    cwd?: string
    projectId?: string  // For persistent command history
}

// Terminal history persistence keys
const HISTORY_KEY_PREFIX = 'orbit_terminal_history_'
const MAX_HISTORY_SIZE = 500

// Get history storage key for a project
const getHistoryKey = (projectId?: string) => {
    return `${HISTORY_KEY_PREFIX}${projectId || 'global'}`
}

// Load command history from localStorage
const loadHistory = (projectId?: string): string[] => {
    try {
        const stored = localStorage.getItem(getHistoryKey(projectId))
        if (stored) {
            return JSON.parse(stored)
        }
    } catch (error) {
        console.warn('Failed to load terminal history:', error)
    }
    return []
}

// Save command history to localStorage
const saveHistory = (history: string[], projectId?: string) => {
    try {
        // Keep only the last MAX_HISTORY_SIZE commands
        const trimmed = history.slice(-MAX_HISTORY_SIZE)
        localStorage.setItem(getHistoryKey(projectId), JSON.stringify(trimmed))
    } catch (error) {
        console.warn('Failed to save terminal history:', error)
    }
}

export const TerminalComponent = ({ cwd, projectId }: TerminalComponentProps) => {
    const { t } = useTranslation()
    const terminalRef = useRef<HTMLDivElement>(null)
    const pidRef = useRef<string | null>(null)

    // Command history state
    const historyRef = useRef<string[]>(loadHistory(projectId))
    const historyIndexRef = useRef<number>(-1)
    const currentInputRef = useRef<string>('')

    // Add command to history
    const addToHistory = useCallback((command: string) => {
        if (command.trim()) {
            // Avoid duplicate consecutive entries
            if (historyRef.current.length === 0 || historyRef.current[historyRef.current.length - 1] !== command) {
                historyRef.current.push(command)
                saveHistory(historyRef.current, projectId)
            }
        }
        // Reset history navigation
        historyIndexRef.current = -1
        currentInputRef.current = ''
    }, [projectId])

    useEffect(() => {
        if (!terminalRef.current) return

        const term = new Terminal({
            theme: {
                background: '#1e1e1e',
                foreground: '#cccccc',
                cursor: '#ffffff'
            },
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 14,
            cursorBlink: true,
            convertEol: true
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.open(terminalRef.current)

        try {
            if (terminalRef.current && (terminalRef.current as any).offsetParent) {
                fitAddon.fit()
            }
        } catch {
            console.warn('ide/Terminal: Initial fit failed')
        }

        // Track current line input for history navigation
        let lineBuffer = ''

        // Initialize backend process
        const initTerminal = async () => {
            try {
                const terminalId = `term-${Date.now()}`
                const result = await window.electron.terminal.create({
                    id: terminalId,
                    cwd: cwd || process.cwd?.() || '.',
                    cols: term.cols,
                    rows: term.rows
                })

                if (!result.success) {
                    throw new Error(result.error || t('projectDashboard.terminalFailedSession'))
                }
                pidRef.current = terminalId

                // Setup listeners
                const cleanupData = window.electron.terminal.onData(({ id, data }) => {
                    if (pidRef.current && id === pidRef.current) {
                        term.write(data)
                    }
                })

                const cleanupExit = window.electron.terminal.onExit(({ id, code }) => {
                    if (pidRef.current && id === pidRef.current) {
                        term.write(`\r\n\x1b[33m${t('projectDashboard.terminalExited')} ${code}\x1b[0m\r\n`)
                    }
                })

                // Use a ref to store cleanups to call in useEffect cleanup
                const cleanups = { data: cleanupData, exit: cleanupExit };
                (term as any)._cleanups = cleanups;

                // Enhanced data handler with history support
                term.onData(data => {
                    if (!pidRef.current) return

                    // Handle special key sequences for history navigation
                    if (data === '\x1b[A') {
                        // Up arrow - go back in history
                        if (historyRef.current.length > 0) {
                            if (historyIndexRef.current === -1) {
                                // Save current input
                                currentInputRef.current = lineBuffer
                                historyIndexRef.current = historyRef.current.length - 1
                            } else if (historyIndexRef.current > 0) {
                                historyIndexRef.current--
                            }

                            // Clear current line and show history item
                            const historyItem = historyRef.current[historyIndexRef.current]
                            window.electron.terminal.write(pidRef.current, '\x1b[2K\r')
                            window.electron.terminal.write(pidRef.current, historyItem)
                            lineBuffer = historyItem
                        }
                        return
                    }

                    if (data === '\x1b[B') {
                        // Down arrow - go forward in history
                        if (historyIndexRef.current !== -1) {
                            if (historyIndexRef.current < historyRef.current.length - 1) {
                                historyIndexRef.current++
                                const historyItem = historyRef.current[historyIndexRef.current]
                                window.electron.terminal.write(pidRef.current, '\x1b[2K\r')
                                window.electron.terminal.write(pidRef.current, historyItem)
                                lineBuffer = historyItem
                            } else {
                                // Restore original input
                                historyIndexRef.current = -1
                                window.electron.terminal.write(pidRef.current, '\x1b[2K\r')
                                window.electron.terminal.write(pidRef.current, currentInputRef.current)
                                lineBuffer = currentInputRef.current
                            }
                        }
                        return
                    }

                    // Track line input for Enter key
                    if (data === '\r' || data === '\n') {
                        // Command submitted - add to history
                        if (lineBuffer.trim()) {
                            addToHistory(lineBuffer)
                        }
                        lineBuffer = ''
                        historyIndexRef.current = -1
                    } else if (data === '\x7f' || data === '\b') {
                        // Backspace
                        lineBuffer = lineBuffer.slice(0, -1)
                    } else if (data.charCodeAt(0) >= 32 || data.length > 1) {
                        // Regular character input (or paste)
                        lineBuffer += data
                    }

                    // Send to terminal
                    window.electron.terminal.write(pidRef.current, data)
                })

                term.onResize(({ cols, rows }) => {
                    if (pidRef.current) {
                        window.electron.terminal.resize(pidRef.current, cols, rows)
                    }
                })

            } catch (error) {
                term.write(`\r\n\x1b[31m${t('projectDashboard.terminalFailedStart')}\x1b[0m\r\n`)
                console.error(error)
            }
        }

        initTerminal()

        const handleResize = () => {
            try {
                if (terminalRef.current && (terminalRef.current as any).offsetParent) {
                    fitAddon.fit()
                }
            } catch {
                // Ignore fit errors on resize
            }
        }
        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            if (pidRef.current) {
                window.electron.terminal.kill(pidRef.current)
            }

            // Call individual cleanups
            const cleanups = (term as any)._cleanups
            if (cleanups) {
                if (typeof cleanups.data === 'function') cleanups.data()
                if (typeof cleanups.exit === 'function') cleanups.exit()
            }

            term.dispose()
        }
    }, [cwd, addToHistory, t])

    return (
        <div
            ref={terminalRef}
            className="w-full h-full bg-[#1e1e1e] rounded-lg overflow-hidden border border-white/10"
            style={{ minHeight: '300px' }}
        />
    )
}

