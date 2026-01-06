/**
 * Terminal Service - PTY-based terminal integration for CMD/PowerShell
 * Uses node-pty for native shell support
 */
import * as os from 'os'
import * as path from 'path'

// Dynamic import for node-pty (native module)
let pty: any = null
try {
    pty = require('node-pty')
} catch (e) {
    console.warn('[TerminalService] node-pty not available, terminal features disabled')
}

interface TerminalSession {
    id: string
    ptyProcess: any
    shell: string
    cwd: string
    cols: number
    rows: number
}

export class TerminalService {
    private sessions: Map<string, TerminalSession> = new Map()

    constructor() {
        if (!pty) {
            console.warn('[TerminalService] node-pty not loaded - terminal features unavailable')
        }
    }

    /**

     * Get the default shell for the current platform
     */
    private getDefaultShell(): string {
        if (process.platform === 'win32') {
            // Prefer PowerShell if available, fallback to cmd
            return process.env.COMSPEC || 'powershell.exe'
        }
        return process.env.SHELL || '/bin/bash'
    }

    /**
     * Create a new terminal session
     */
    createSession(options: {
        id: string
        shell?: string
        cwd?: string
        cols?: number
        rows?: number
        onData?: (data: string) => void
        onExit?: (code: number) => void
    }): boolean {
        if (!pty) {
            console.error('[TerminalService] Cannot create session - node-pty not available')
            return false
        }

        if (this.sessions.has(options.id)) {
            console.warn(`[TerminalService] Session ${options.id} already exists`)
            return false
        }

        const shell = options.shell || this.getDefaultShell()
        const cwd = options.cwd || os.homedir()
        const cols = options.cols || 80
        const rows = options.rows || 24

        try {
            // Determine shell args based on platform
            let shellArgs: string[] = []
            if (process.platform === 'win32') {
                if (shell.toLowerCase().includes('powershell')) {
                    shellArgs = ['-NoLogo']
                }
            }

            const ptyProcess = pty.spawn(shell, shellArgs, {
                name: 'xterm-256color',
                cols,
                rows,
                cwd,
                env: {
                    ...process.env,
                    TERM: 'xterm-256color',
                    COLORTERM: 'truecolor'
                } as any
            })

            // Set up event handlers
            if (options.onData) {
                ptyProcess.onData(options.onData)
            }

            if (options.onExit) {
                ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
                    options.onExit!(exitCode)
                    this.sessions.delete(options.id)
                })
            }

            this.sessions.set(options.id, {
                id: options.id,
                ptyProcess,
                shell,
                cwd,
                cols,
                rows
            })

            return true
        } catch (e) {
            console.error('[TerminalService] Failed to create session:', e)
            return false
        }
    }

    /**
     * Write data to terminal session
     */
    write(sessionId: string, data: string): boolean {
        const session = this.sessions.get(sessionId)
        if (!session) return false

        try {
            session.ptyProcess.write(data)
            return true
        } catch (e) {
            console.error('[TerminalService] Write failed:', e)
            return false
        }
    }

    /**
     * Resize terminal session
     */
    resize(sessionId: string, cols: number, rows: number): boolean {
        const session = this.sessions.get(sessionId)
        if (!session) return false

        try {
            session.ptyProcess.resize(cols, rows)
            session.cols = cols
            session.rows = rows
            return true
        } catch (e) {
            console.error('[TerminalService] Resize failed:', e)
            return false
        }
    }

    /**
     * Kill terminal session
     */
    kill(sessionId: string): boolean {
        const session = this.sessions.get(sessionId)
        if (!session) return false

        try {
            session.ptyProcess.kill()
            this.sessions.delete(sessionId)
            return true
        } catch (e) {
            console.error('[TerminalService] Kill failed:', e)
            return false
        }
    }

    /**
     * Get all active session IDs
     */
    getActiveSessions(): string[] {
        return Array.from(this.sessions.keys())
    }

    /**
     * Check if PTY is available
     */
    isAvailable(): boolean {
        return pty !== null
    }

    /**
     * Get available shells on the system
     */
    getAvailableShells(): { id: string; name: string; path: string }[] {
        const shells: { id: string; name: string; path: string }[] = []

        if (process.platform === 'win32') {
            // Windows shells
            shells.push({
                id: 'powershell',
                name: 'PowerShell',
                path: 'powershell.exe'
            })
            shells.push({
                id: 'cmd',
                name: 'Command Prompt',
                path: 'cmd.exe'
            })
            // Check for PowerShell Core (pwsh)
            try {
                const pwshPath = path.join(process.env.ProgramFiles || '', 'PowerShell', '7', 'pwsh.exe')
                shells.unshift({
                    id: 'pwsh',
                    name: 'PowerShell 7',
                    path: pwshPath
                })
            } catch { }
        } else {
            // Unix-like shells
            shells.push(
                { id: 'bash', name: 'Bash', path: '/bin/bash' },
                { id: 'zsh', name: 'Zsh', path: '/bin/zsh' },
                { id: 'fish', name: 'Fish', path: '/usr/bin/fish' },
                { id: 'sh', name: 'Shell', path: '/bin/sh' }
            )
        }

        return shells
    }

    /**
     * Cleanup all sessions
     */
    dispose(): void {
        for (const [_id, session] of this.sessions) {
            try {
                session.ptyProcess.kill()
            } catch { }
        }
        this.sessions.clear()
    }
}
