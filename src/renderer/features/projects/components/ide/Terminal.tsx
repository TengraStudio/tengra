import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

interface TerminalComponentProps {
    cwd?: string
}

export const TerminalComponent = ({ cwd }: TerminalComponentProps) => {
    const terminalRef = useRef<HTMLDivElement>(null)
    const pidRef = useRef<string | null>(null)

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
        fitAddon.fit()

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
                    throw new Error(result.error || 'Failed to create terminal session')
                }
                pidRef.current = terminalId

                // Setup listeners
                window.electron.terminal.onData(({ id, data }) => {
                    if (pidRef.current && id === pidRef.current) {
                        term.write(data)
                    }
                })

                window.electron.terminal.onExit(({ id, code }) => {
                    if (pidRef.current && id === pidRef.current) {
                        term.write(`\r\n\x1b[33mTerminal exited with code ${code}\x1b[0m\r\n`)
                    }
                })

                term.onData(data => {
                    if (pidRef.current) {
                        window.electron.terminal.write(pidRef.current, data)
                    }
                })

                term.onResize(({ cols, rows }) => {
                    if (pidRef.current) {
                        window.electron.terminal.resize(pidRef.current, cols, rows)
                    }
                })

            } catch (error) {
                term.write('\r\n\x1b[31mFailed to start terminal.\x1b[0m\r\n')
                console.error(error)
            }
        }

        initTerminal()

        const handleResize = () => fitAddon.fit()
        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            if (pidRef.current) {
                window.electron.terminal.kill(pidRef.current)
            }
            term.dispose()
            window.electron.terminal.removeAllListeners()
        }
    }, [cwd])

    return (
        <div
            ref={terminalRef}
            className="w-full h-full bg-[#1e1e1e] rounded-lg overflow-hidden border border-white/10"
            style={{ minHeight: '300px' }}
        />
    )
}
