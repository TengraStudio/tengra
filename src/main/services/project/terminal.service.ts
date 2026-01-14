/**
 * Terminal Service - PTY-based terminal integration for CMD/PowerShell
 * Uses node-pty for native shell support
 */
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { app } from 'electron'

// Type definitions for node-pty
interface IPty {
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    kill: () => void;
    onData: (callback: (data: string) => void) => void;
    onExit: (callback: (exitInfo: { exitCode: number }) => void) => void;
}

interface IPtyModule {
    spawn: (
        shell: string,
        args: string[],
        options: { name: string; cols: number; rows: number; cwd: string; env: Record<string, string | undefined> }
    ) => IPty;
}

// Dynamic import for node-pty (native module)
let pty: IPtyModule | null = null
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pty = require('node-pty') as IPtyModule
} catch {
    console.warn('[TerminalService] node-pty not available, terminal features disabled')
}

const MAX_BUFFER_SIZE = 1024 * 1024 // 1MB buffer per session
const BUFFER_TRUNCATE_THRESHOLD = 1.2 * 1024 * 1024 // Only truncate when we hit 1.2MB

interface TerminalSession {
    id: string
    ptyProcess: IPty | null // Null if restored but not yet spawned (zombie state) or finished
    shell: string
    cwd: string
    cols: number
    rows: number
    buffer: string
    title?: string
    lastActive: number
}

interface TerminalSnapshot {
    id: string
    shell: string
    cwd: string
    buffer: string
    title?: string
    cols: number
    rows: number
    timestamp: number
}

export class TerminalService {
    private sessions: Map<string, TerminalSession> = new Map()
    private persistencePath: string
    private snapshots: Map<string, TerminalSnapshot> = new Map()

    constructor() {
        if (!pty) {
            console.warn('[TerminalService] node-pty not loaded - terminal features unavailable')
        }

        // Setup persistence path
        try {
            const userDataPath = app.getPath('userData')
            this.persistencePath = path.join(userDataPath, 'terminal-sessions.json')
            this.loadSnapshots()
        } catch (e) {
            console.error('[TerminalService] Failed to determine userData path:', e)
            this.persistencePath = ''
        }

        // Auto-save on quit
        app.on('before-quit', () => {
            this.saveSnapshots()
        })
    }

    /**
     * Check if terminal service is available
     */
    isAvailable(): boolean {
        return !!pty
    }

    /**
     * Get available shells for the current platform
     */
    getAvailableShells(): { id: string; name: string; path: string }[] {
        const shells: { id: string; name: string; path: string }[] = []

        if (process.platform === 'win32') {
            const systemRoot = process.env.SystemRoot || 'C:\\Windows'
            // Windows shells - use absolute paths for stability
            shells.push({
                id: 'powershell',
                name: 'PowerShell',
                path: path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
            })
            shells.push({
                id: 'cmd',
                name: 'Command Prompt',
                path: path.join(systemRoot, 'System32', 'cmd.exe')
            })

            // Check for PowerShell 7 (pwsh)
            const pwshPaths = [
                path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe'),
                path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'PowerShell', '7', 'pwsh.exe')
            ]
            for (const pwshPath of pwshPaths) {
                if (fs.existsSync(pwshPath)) {
                    shells.unshift({
                        id: 'pwsh',
                        name: 'PowerShell 7',
                        path: pwshPath
                    })
                    break
                }
            }

            // Git Bash detection
            const gitBashPath = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe')
            if (fs.existsSync(gitBashPath)) {
                shells.push({
                    id: 'gitbash',
                    name: 'Git Bash',
                    path: gitBashPath
                })
            }
        } else {
            // Unix-like shells
            const commonPaths = [
                { id: 'bash', name: 'Bash', path: '/bin/bash' },
                { id: 'zsh', name: 'Zsh', path: '/bin/zsh' },
                { id: 'sh', name: 'Sh', path: '/bin/sh' },
                { id: 'fish', name: 'Fish', path: '/usr/bin/fish' }
            ]
            for (const s of commonPaths) {
                if (fs.existsSync(s.path)) shells.push(s)
            }
        }

        return shells
    }

    /**
     * Get the default shell for the current platform
     */
    private getDefaultShell(): string {
        const shells = this.getAvailableShells()
        return shells.length > 0 ? shells[0].path : (process.platform === 'win32' ? 'powershell.exe' : '/bin/bash')
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
        onData: (data: string) => void
        onExit: (code: number) => void
    }): boolean {
        if (!pty) {
            console.error('[TerminalService] Cannot create session - node-pty not available')
            return false
        }

        // Cleanup existing session with same ID if it exists (force restart)
        if (this.sessions.has(options.id)) {
            console.log(`[TerminalService] Replacing existing session: ${options.id}`)
            this.kill(options.id)
        }

        // Check for snapshot restoration
        const snapshot = this.snapshots.get(options.id)
        const isRestoring = !!snapshot

        const availableShells = this.getAvailableShells()
        const selectedShell = availableShells.find(s => s.id === options.shell)

        // Priority: Options > Snapshot > Default
        const shell = selectedShell ? selectedShell.path : (options.shell || snapshot?.shell || this.getDefaultShell())

        // Priority: Options > Snapshot > Home
        let cwd = options.cwd || snapshot?.cwd || os.homedir()

        // Verify CWD exists, fallback to home if deleted
        if (!fs.existsSync(cwd)) {
            cwd = os.homedir()
        }

        const cols = options.cols || snapshot?.cols || 80
        const rows = options.rows || snapshot?.rows || 24

        try {
            // Determine shell args
            const shellArgs: string[] = []
            if (process.platform === 'win32') {
                if (shell.toLowerCase().includes('powershell.exe') || shell.toLowerCase().includes('pwsh.exe')) {
                    shellArgs.push('-NoLogo')
                    shellArgs.push('-ExecutionPolicy', 'Bypass')
                }
            } else {
                // Linux/Mac: Login shell for proper path loading
                shellArgs.push('-l')
            }

            // Sanitize dimensions
            const finalCols = Math.max(1, cols)
            const finalRows = Math.max(1, rows)

            // Enhanced Environment
            const env = { ...process.env } as Record<string, string | undefined>
            if (process.platform === 'win32') {
                env.SYSTEMROOT = env.SYSTEMROOT || 'C:\\Windows'
                env.SystemRoot = env.SystemRoot || 'C:\\Windows'
                env.WINDIR = env.WINDIR || env.SYSTEMROOT
                // Force UTF-8 for PowerShell
                env.PYTHONIOENCODING = 'utf-8'
                env.ConEmuANSI = 'ON'
            } else {
                env.TERM = 'xterm-256color'
                env.COLORTERM = 'truecolor'
            }

            console.log(`[TerminalService] Spawning PTY: shell=${shell}, cwd=${cwd}, dims=${finalCols}x${finalRows}`)

            const ptyProcess = pty.spawn(shell, shellArgs, {
                name: 'xterm-256color',
                cols: finalCols,
                rows: finalRows,
                cwd,
                env
            })

            const session: TerminalSession = {
                id: options.id,
                ptyProcess,
                shell,
                cwd,
                cols,
                rows,
                buffer: isRestoring && snapshot ? snapshot.buffer + '\r\n[Session Restored]\r\n' : '',
                lastActive: Date.now()
            }

            this.sessions.set(options.id, session)

            // If restoring, send the buffer immediately to the frontend
            if (session.buffer) {
                options.onData(session.buffer)
            }

            // Data listener
            ptyProcess.onData((data: string) => {
                const s = this.sessions.get(options.id)
                if (s) {
                    s.buffer += data
                    // Lazy truncation: only slice if significantly larger than MAX
                    if (s.buffer.length > BUFFER_TRUNCATE_THRESHOLD) {
                        s.buffer = s.buffer.substring(s.buffer.length - MAX_BUFFER_SIZE)
                    }
                    s.lastActive = Date.now()
                }
                options.onData(data)
            })

            ptyProcess.onExit(({ exitCode }) => {
                console.log(`[TerminalService] Session ${options.id} exited with code ${exitCode}`)
                this.sessions.delete(options.id)
                this.snapshots.delete(options.id) // Remove snapshot on clean exit
                options.onExit(exitCode)
                this.saveSnapshots() // Sync state
            })

            return true
        } catch (error) {
            console.error('[TerminalService] Failed to create session:', error)
            return false
        }
    }

    /**
     * Write data to terminal session
     */
    write(sessionId: string, data: string): boolean {
        const session = this.sessions.get(sessionId)
        if (!session || !session.ptyProcess) return false

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
        if (!session || !session.ptyProcess) return false

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
        if (!session || !session.ptyProcess) return false

        try {
            session.ptyProcess.kill()
            this.sessions.delete(sessionId)
            this.snapshots.delete(sessionId)
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
     * Get session buffer content
     */
    getSessionBuffer(sessionId: string): string {
        return this.sessions.get(sessionId)?.buffer || this.snapshots.get(sessionId)?.buffer || ''
    }

    /**
     * Load snapshots from disk
     */
    private loadSnapshots() {
        try {
            if (fs.existsSync(this.persistencePath)) {
                const data = fs.readFileSync(this.persistencePath, 'utf-8')
                const rawSnapshots = JSON.parse(data) as TerminalSnapshot[]

                // Filter out old snapshots (> 7 days)
                const now = Date.now()
                const validSnapshots = rawSnapshots.filter(s => (now - s.timestamp) < 7 * 24 * 60 * 60 * 1000)

                validSnapshots.forEach(s => this.snapshots.set(s.id, s))
                console.log(`[TerminalService] Loaded ${validSnapshots.length} sessions from snapshot`)
            }
        } catch (e) {
            console.error('[TerminalService] Failed to load snapshots:', e)
        }
    }

    /**
     * Save active sessions to disk
     */
    private saveSnapshots() {
        if (!this.persistencePath) return

        try {
            const snapshots: TerminalSnapshot[] = []

            this.sessions.forEach(session => {
                snapshots.push({
                    id: session.id,
                    shell: session.shell,
                    cwd: session.cwd,
                    cols: session.cols,
                    rows: session.rows,
                    buffer: session.buffer,
                    title: session.title,
                    timestamp: Date.now()
                })
            })

            fs.writeFileSync(this.persistencePath, JSON.stringify(snapshots, null, 2))
            console.log(`[TerminalService] Saved ${snapshots.length} sessions to ${this.persistencePath}`)
        } catch (e) {
            console.error('[TerminalService] Failed to save snapshots:', e)
        }
    }

    /**
     * Cleanup all sessions
     */
    dispose(): void {
        this.saveSnapshots() // Last save
        for (const [, session] of this.sessions) {
            try {
                session.ptyProcess?.kill()
            } catch { /* Already dead */ }
        }
        this.sessions.clear()
    }
}
