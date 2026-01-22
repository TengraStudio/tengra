import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { appLogger } from '@main/logging/logger'
import { safeJsonParse } from '@shared/utils/sanitize.util'
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
    // eslint-disable-next-line
    pty = require('node-pty') as IPtyModule
} catch {
    appLogger.warn('TerminalService', 'node-pty not available, terminal features disabled')
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
            appLogger.warn('TerminalService', 'node-pty not loaded - terminal features unavailable')
        }

        // Setup persistence path
        try {
            const userDataPath = app.getPath('userData')
            this.persistencePath = path.join(userDataPath, 'terminal-sessions.json')
            void this.loadSnapshots()
        } catch (e) {
            appLogger.error('TerminalService', 'Failed to determine userData path', e as Error)
            this.persistencePath = ''
        }

        // Auto-save on quit
        app.on('before-quit', () => {
            void this.saveSnapshots()
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
        return process.platform === 'win32' ? this.getWindowsShells() : this.getUnixShells()
    }

    private getWindowsShells(): { id: string; name: string; path: string }[] {
        const shells: { id: string; name: string; path: string }[] = []
        const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'

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

        // Check for PowerShell 7
        const pwshPaths = [
            path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe'),
            path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'PowerShell', '7', 'pwsh.exe')
        ]
        for (const pwshPath of pwshPaths) {
            if (fs.existsSync(pwshPath)) {
                shells.unshift({ id: 'pwsh', name: 'PowerShell 7', path: pwshPath })
                break
            }
        }

        // Git Bash detection
        const gitBashPath = path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git', 'bin', 'bash.exe')
        if (fs.existsSync(gitBashPath)) {
            shells.push({ id: 'gitbash', name: 'Git Bash', path: gitBashPath })
        }

        return shells
    }

    private getUnixShells(): { id: string; name: string; path: string }[] {
        const shells: { id: string; name: string; path: string }[] = []
        const commonPaths = [
            { id: 'bash', name: 'Bash', path: '/bin/bash' },
            { id: 'zsh', name: 'Zsh', path: '/bin/zsh' },
            { id: 'sh', name: 'Sh', path: '/bin/sh' },
            { id: 'fish', name: 'Fish', path: '/usr/bin/fish' }
        ]
        for (const s of commonPaths) {
            if (fs.existsSync(s.path)) { shells.push(s) }
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
            appLogger.info('TerminalService', `Replacing existing session: ${options.id}`)
            this.kill(options.id)
        }

        const snapshot = this.snapshots.get(options.id)
        const isRestoring = !!snapshot

        const { shell, args: shellArgs } = this.getShellConfig(options, snapshot)
        const cwd = this.getCwdConfig(options, snapshot)

        const session = this.initSessionObject(options, snapshot, isRestoring)
        const finalCols = Math.max(1, session.cols)
        const finalRows = Math.max(1, session.rows)

        try {
            const env = this.createSessionEnv()

            appLogger.info('TerminalService', `Spawning PTY: shell=${shell}, cwd=${cwd}, dims=${finalCols}x${finalRows}`)

            const ptyProcess = pty.spawn(shell, shellArgs, {
                name: 'xterm-256color',
                cols: finalCols,
                rows: finalRows,
                cwd,
                env
            })

            session.ptyProcess = ptyProcess
            session.shell = shell
            session.cwd = cwd
            this.sessions.set(options.id, session)

            if (session.buffer) {
                options.onData(session.buffer)
            }

            this.setupSessionListeners(options, ptyProcess)
            return true
        } catch (error) {
            console.error('[TerminalService] Failed to create session:', error)
            return false
        }
    }

    private getShellConfig(options: { shell?: string }, snapshot?: TerminalSnapshot): { shell: string; args: string[] } {
        const availableShells = this.getAvailableShells()
        const selectedShell = availableShells.find(s => s.id === options.shell)
        const shell = selectedShell ? selectedShell.path : (options.shell ?? snapshot?.shell ?? this.getDefaultShell())

        const args: string[] = []
        if (process.platform === 'win32') {
            if (shell.toLowerCase().includes('powershell.exe') || shell.toLowerCase().includes('pwsh.exe')) {
                args.push('-NoLogo', '-ExecutionPolicy', 'Bypass')
            }
        } else {
            args.push('-l')
        }
        return { shell, args }
    }

    private getCwdConfig(options: { cwd?: string }, snapshot?: TerminalSnapshot): string {
        let cwd = options.cwd ?? snapshot?.cwd ?? os.homedir()
        if (!fs.existsSync(cwd)) {
            cwd = os.homedir()
        }
        return cwd
    }

    private initSessionObject(options: { id: string; cols?: number; rows?: number }, snapshot: TerminalSnapshot | undefined, isRestoring: boolean): TerminalSession {
        return {
            id: options.id,
            ptyProcess: null, // assigned after spawn
            shell: '', // assigned after spawn
            cwd: '', // assigned after spawn
            cols: options.cols ?? snapshot?.cols ?? 80,
            rows: options.rows ?? snapshot?.rows ?? 24,
            buffer: (isRestoring && snapshot) ? snapshot.buffer + '\r\n[Session Restored]\r\n' : '',
            lastActive: Date.now()
        }
    }

    private setupSessionListeners(options: { id: string; onData: (data: string) => void; onExit: (code: number) => void }, ptyProcess: IPty): void {
        ptyProcess.onData((data: string) => {
            const s = this.sessions.get(options.id)
            if (s) {
                s.buffer += data
                if (s.buffer.length > BUFFER_TRUNCATE_THRESHOLD) {
                    s.buffer = s.buffer.substring(s.buffer.length - MAX_BUFFER_SIZE)
                }
                s.lastActive = Date.now()
            }
            options.onData(data)
        })

        ptyProcess.onExit(({ exitCode }) => {
            appLogger.info('TerminalService', `Session ${options.id} exited with code ${exitCode}`)
            this.sessions.delete(options.id)
            this.snapshots.delete(options.id)
            options.onExit(exitCode)
            void this.saveSnapshots()
        })
    }

    /**
     * Write data to terminal session
     */
    write(sessionId: string, data: string): boolean {
        const session = this.sessions.get(sessionId)
        if (!session?.ptyProcess) { return false }

        try {
            session.ptyProcess.write(data)
            return true
        } catch (e) {
            appLogger.error('TerminalService', 'Write failed', e as Error)
            return false
        }
    }

    /**
     * Resize terminal session
     */
    resize(sessionId: string, cols: number, rows: number): boolean {
        const session = this.sessions.get(sessionId)
        if (!session?.ptyProcess) { return false }

        try {
            session.ptyProcess.resize(cols, rows)
            session.cols = cols
            session.rows = rows
            return true
        } catch (e) {
            appLogger.error('TerminalService', 'Resize failed', e as Error)
            return false
        }
    }

    /**
     * Kill terminal session
     */
    kill(sessionId: string): boolean {
        const session = this.sessions.get(sessionId)
        if (!session?.ptyProcess) { return false }

        try {
            session.ptyProcess.kill()
            this.sessions.delete(sessionId)
            this.snapshots.delete(sessionId)
            return true
        } catch (e) {
            appLogger.error('TerminalService', 'Kill failed', e as Error)
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
        return (this.sessions.get(sessionId)?.buffer ?? (this.snapshots.get(sessionId)?.buffer ?? ''))
    }

    /**
     * Load snapshots from disk
     */
    private async loadSnapshots() {
        try {
            try {
                await fs.promises.access(this.persistencePath)
            } catch {
                if (!fs.existsSync(this.persistencePath)) {
                    return // File doesn't exist
                }
            }

            const data = await fs.promises.readFile(this.persistencePath, 'utf-8')
            const rawSnapshots = safeJsonParse<TerminalSnapshot[]>(data, [])

            // Filter out old snapshots (> 7 days)
            const now = Date.now()
            const validSnapshots = rawSnapshots.filter(s => (now - s.timestamp) < 7 * 24 * 60 * 60 * 1000)

            validSnapshots.forEach(s => this.snapshots.set(s.id, s))
            appLogger.info('TerminalService', `Loaded ${validSnapshots.length} sessions from snapshot`)
        } catch (e) {
            appLogger.error('TerminalService', 'Failed to load snapshots', e as Error)
        }
    }

    /**
     * Save active sessions to disk
     */
    private async saveSnapshots() {
        if (!this.persistencePath) { return }

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

            await fs.promises.writeFile(this.persistencePath, JSON.stringify(snapshots, null, 2))
            appLogger.info('TerminalService', `Saved ${snapshots.length} sessions to ${this.persistencePath}`)
        } catch (e) {
            appLogger.error('TerminalService', 'Failed to save snapshots', e as Error)
        }
    }

    private createSessionEnv(): Record<string, string | undefined> {
        const env = { ...process.env } as Record<string, string | undefined>
        if (process.platform === 'win32') {
            env.SYSTEMROOT = env.SYSTEMROOT ?? 'C:\\Windows'
            env.SystemRoot = env.SystemRoot ?? 'C:\\Windows'
            env.WINDIR = env.WINDIR ?? env.SYSTEMROOT
            env.PYTHONIOENCODING = 'utf-8'
            env.ConEmuANSI = 'ON'
        } else {
            env.TERM = 'xterm-256color'
            env.COLORTERM = 'truecolor'
        }
        return env
    }

    /**
     * Cleanup all sessions
     */
    dispose(): void {
        void this.saveSnapshots() // Last save
        for (const [, session] of this.sessions) {
            try {
                session.ptyProcess?.kill()
            } catch { /* Already dead */ }
        }
        this.sessions.clear()
    }
}
