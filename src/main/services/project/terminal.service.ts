import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { AlacrittyBackend } from '@main/services/terminal/backends/alacritty.backend';
import { GhosttyBackend } from '@main/services/terminal/backends/ghostty.backend';
import { KittyBackend } from '@main/services/terminal/backends/kitty.backend';
import { NodePtyBackend } from '@main/services/terminal/backends/node-pty.backend';
import {
    ITerminalBackend,
    ITerminalProcess,
} from '@main/services/terminal/backends/terminal-backend.interface';
import { WarpBackend } from '@main/services/terminal/backends/warp.backend';
import { WindowsTerminalBackend } from '@main/services/terminal/backends/windows-terminal.backend';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { app } from 'electron';

const MAX_COMMAND_HISTORY_SIZE = 2000;
const MAX_COMMAND_LENGTH = 2000;

export interface TerminalCommandHistoryEntry {
    command: string;
    shell?: string;
    cwd?: string;
    timestamp: number;
    sessionId: string;
}

export interface TerminalBackendInfo {
    id: string;
    name: string;
    available: boolean;
}

interface TerminalSession {
    id: string;
    process: ITerminalProcess | null; // Null if restored but not yet spawned (zombie state) or finished
    shell: string;
    cwd: string;
    cols: number;
    rows: number;
    logStream?: fs.WriteStream;
    title?: string;
    lastActive: number;
    backendId: string;
    workspaceId?: string;
    metadata?: Record<string, unknown>;
}

interface TerminalSnapshot {
    id: string;
    shell: string;
    cwd: string;
    title?: string;
    cols: number;
    rows: number;
    timestamp: number;
    backendId: string;
    workspaceId?: string;
    metadata?: Record<string, unknown>;
}

export class TerminalService extends BaseService {
    private sessions: Map<string, TerminalSession> = new Map();
    private backends: Map<string, ITerminalBackend> = new Map();
    private persistencePath: string;
    private historyPath: string;
    private snapshots: Map<string, TerminalSnapshot> = new Map();
    private commandHistory: TerminalCommandHistoryEntry[] = [];
    private lineBuffers: Map<string, string> = new Map();

    constructor() {
        super('TerminalService');

        // Register default backends
        const nodePtyBackend = new NodePtyBackend();
        this.backends.set(nodePtyBackend.id, nodePtyBackend);

        const ghosttyBackend = new GhosttyBackend();
        this.backends.set(ghosttyBackend.id, ghosttyBackend);

        const alacrittyBackend = new AlacrittyBackend();
        this.backends.set(alacrittyBackend.id, alacrittyBackend);

        const warpBackend = new WarpBackend();
        this.backends.set(warpBackend.id, warpBackend);

        const kittyBackend = new KittyBackend();
        this.backends.set(kittyBackend.id, kittyBackend);

        const windowsTerminalBackend = new WindowsTerminalBackend();
        this.backends.set(windowsTerminalBackend.id, windowsTerminalBackend);

        // Setup persistence path
        try {
            const userDataPath = app.getPath('userData');
            this.persistencePath = path.join(userDataPath, 'terminal-sessions.json');
            this.historyPath = path.join(userDataPath, 'terminal-command-history.json');

            // Create logs directory
            const logsPath = path.join(userDataPath, 'terminal-logs');
            if (!fs.existsSync(logsPath)) {
                fs.mkdirSync(logsPath, { recursive: true });
            }
        } catch (e) {
            appLogger.error('TerminalService', 'Failed to determine userData path', e as Error);
            this.persistencePath = '';
            this.historyPath = '';
        }
    }

    /**
     * Register a new terminal backend
     */
    addBackend(backend: ITerminalBackend): void {
        this.logInfo(`Registering terminal backend: ${backend.id}`);
        this.backends.set(backend.id, backend);
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing TerminalService...');
        await this.loadSnapshots();
        await this.loadCommandHistory();
    }

    /**
     * Check if terminal service is available
     */
    async isAvailable(): Promise<boolean> {
        // At least one backend must be available
        for (const backend of this.backends.values()) {
            if (await backend.isAvailable()) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get available shells for the current platform
     */
    getAvailableShells(): { id: string; name: string; path: string }[] {
        return process.platform === 'win32' ? this.getWindowsShells() : this.getUnixShells();
    }

    /**
     * Get information about all registered terminal backends.
     * @returns A list of terminal backends with their availability status.
     */
    async getAvailableBackends(): Promise<TerminalBackendInfo[]> {
        const backendNames: Record<string, string> = {
            'node-pty': 'Integrated Terminal',
            ghostty: 'Ghostty',
            alacritty: 'Alacritty',
            warp: 'Warp',
            kitty: 'Kitty',
            'windows-terminal': 'Windows Terminal',
        };

        const backends = Array.from(this.backends.values());
        const info = await Promise.all(
            backends.map(async backend => ({
                id: backend.id,
                name: backendNames[backend.id] ?? backend.id,
                available: await backend.isAvailable(),
            }))
        );

        return info;
    }

    private getWindowsShells(): { id: string; name: string; path: string }[] {
        const shells: { id: string; name: string; path: string }[] = [];
        const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';

        shells.push({
            id: 'powershell',
            name: 'PowerShell',
            path: path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
        });
        shells.push({
            id: 'cmd',
            name: 'Command Prompt',
            path: path.join(systemRoot, 'System32', 'cmd.exe'),
        });

        const pwshPaths = [
            path.join(
                process.env.ProgramFiles ?? 'C:\\Program Files',
                'PowerShell',
                '7',
                'pwsh.exe'
            ),
            path.join(
                process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
                'PowerShell',
                '7',
                'pwsh.exe'
            ),
        ];
        for (const pwshPath of pwshPaths) {
            if (fs.existsSync(pwshPath)) {
                shells.unshift({ id: 'pwsh', name: 'PowerShell 7', path: pwshPath });
                break;
            }
        }

        const gitBashPath = path.join(
            process.env.ProgramFiles ?? 'C:\\Program Files',
            'Git',
            'bin',
            'bash.exe'
        );
        if (fs.existsSync(gitBashPath)) {
            shells.push({ id: 'gitbash', name: 'Git Bash', path: gitBashPath });
        }

        return shells;
    }

    private getUnixShells(): { id: string; name: string; path: string }[] {
        const shells: { id: string; name: string; path: string }[] = [];
        const commonPaths = [
            { id: 'bash', name: 'Bash', path: '/bin/bash' },
            { id: 'zsh', name: 'Zsh', path: '/bin/zsh' },
            { id: 'sh', name: 'Sh', path: '/bin/sh' },
            { id: 'fish', name: 'Fish', path: '/usr/bin/fish' },
        ];
        for (const s of commonPaths) {
            if (fs.existsSync(s.path)) {
                shells.push(s);
            }
        }
        return shells;
    }

    private getDefaultShell(): string {
        const shells = this.getAvailableShells();
        return shells.length > 0
            ? shells[0].path
            : process.platform === 'win32'
              ? 'powershell.exe'
              : '/bin/bash';
    }

    /**
     * Create a new terminal session
     */
    async createSession(options: {
        id: string;
        shell?: string;
        cwd?: string;
        cols?: number;
        rows?: number;
        backendId?: string;
        workspaceId?: string;
        onData: (data: string) => void;
        onExit: (code: number) => void;
        metadata?: Record<string, unknown>;
    }): Promise<boolean> {
        let backendId = options.backendId ?? 'node-pty';
        let backend = this.backends.get(backendId);

        if (!backend || !(await backend.isAvailable())) {
            this.logInfo(`Backend ${backendId} is not available, trying fallback backend`);
            backend = undefined;
            for (const [candidateId, candidateBackend] of this.backends.entries()) {
                if (await candidateBackend.isAvailable()) {
                    backendId = candidateId;
                    backend = candidateBackend;
                    break;
                }
            }
        }

        if (!backend) {
            this.logError('No terminal backend is available');
            return false;
        }

        if (this.sessions.has(options.id)) {
            this.logInfo(`Replacing existing session: ${options.id}`);
            this.kill(options.id);
        }

        const snapshot = this.snapshots.get(options.id);
        const isRestoring = !!snapshot;

        const { shell, args } = this.getShellConfig(options, snapshot);
        const cwd = this.getCwdConfig(options, snapshot);
        const cols = options.cols ?? snapshot?.cols ?? 80;
        const rows = options.rows ?? snapshot?.rows ?? 24;

        // Create log stream
        const logPath = this.getLogPath(options.id);
        const logStream = fs.createWriteStream(logPath, { flags: 'a' });

        try {
            const process = await backend.create({
                id: options.id,
                shell,
                args,
                cwd,
                cols,
                rows,
                env: this.createSessionEnv(),
                metadata: options.metadata,
                onData: data => {
                    const session = this.sessions.get(options.id);
                    if (session?.logStream) {
                        session.logStream.write(data);
                        session.lastActive = Date.now();
                    }
                    this.captureCommandInput(options.id, data);
                    options.onData(data);
                },
                onExit: code => {
                    this.logInfo(`Session ${options.id} exited with code ${code}`);

                    const session = this.sessions.get(options.id);
                    // Close log stream
                    if (session?.logStream) {
                        try {
                            session.logStream.end();
                        } catch (e) {
                            appLogger.error(
                                'TerminalService',
                                'Failed to close log stream on exit',
                                e as Error
                            );
                        }
                    }

                    this.sessions.delete(options.id);
                    this.snapshots.delete(options.id);
                    this.lineBuffers.delete(options.id);

                    options.onExit(code);
                    void this.saveSnapshots();
                },
            });

            const session: TerminalSession = {
                id: options.id,
                process,
                shell,
                cwd,
                cols,
                rows,
                logStream,
                lastActive: Date.now(),
                backendId,
                workspaceId: options.workspaceId ?? snapshot?.workspaceId,
                metadata: options.metadata ?? snapshot?.metadata,
            };

            this.sessions.set(options.id, session);

            if (isRestoring || snapshot) {
                // Read tail of log file
                try {
                    const tail = await this.readLogTail(options.id);
                    if (tail) {
                        // Small delay to ensure xterm is ready or just sending it directly
                        options.onData(tail + '\r\n\x1b[90m[Session Restored]\x1b[0m\r\n');
                    }
                } catch (e) {
                    appLogger.error('TerminalService', 'Failed to restore session log', e as Error);
                }
            }

            return true;
        } catch (error) {
            this.logError(`Failed to create session: ${error}`);
            return false;
        }
    }

    private getShellConfig(
        options: { shell?: string },
        snapshot?: TerminalSnapshot
    ): { shell: string; args: string[] } {
        const availableShells = this.getAvailableShells();
        const selectedShell = availableShells.find(s => s.id === options.shell);
        const shell = selectedShell
            ? selectedShell.path
            : (options.shell ?? snapshot?.shell ?? this.getDefaultShell());

        const args: string[] = [];
        if (process.platform === 'win32') {
            if (
                shell.toLowerCase().includes('powershell.exe') ||
                shell.toLowerCase().includes('pwsh.exe')
            ) {
                args.push('-NoLogo', '-ExecutionPolicy', 'Bypass');
            }
        } else {
            args.push('-l');
        }
        return { shell, args };
    }

    private getCwdConfig(options: { cwd?: string }, snapshot?: TerminalSnapshot): string {
        let cwd = options.cwd ?? snapshot?.cwd ?? os.homedir();
        if (!fs.existsSync(cwd)) {
            cwd = os.homedir();
        }
        return cwd;
    }

    /**
     * Write data to terminal session
     */
    write(sessionId: string, data: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session?.process) {
            return false;
        }

        try {
            // No need to capture input here as it's echoed back in onData
            // But we keep it in case we want to capture keystrokes specifically (e.g. for history before echo)
            // However, captureCommandInput was called on buffer write before.
            // Let's keep consistency:
            // Actually, captureCommandInput parses the *output* stream (which includes echo) to find commands.
            // So we don't need to call it here on input.
            session.process.write(data);
            return true;
        } catch (e) {
            appLogger.error('TerminalService', 'Write failed', e as Error);
            return false;
        }
    }

    /**
     * Resize terminal session
     */
    resize(sessionId: string, cols: number, rows: number): boolean {
        const session = this.sessions.get(sessionId);
        if (!session?.process) {
            return false;
        }

        try {
            session.process.resize(cols, rows);
            session.cols = cols;
            session.rows = rows;
            return true;
        } catch (e) {
            appLogger.error('TerminalService', 'Resize failed', e as Error);
            return false;
        }
    }

    /**
     * Kill terminal session
     */
    kill(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session?.process) {
            return false;
        }

        try {
            session.process.kill();
            if (session.logStream) {
                try {
                    session.logStream.end();
                } catch {
                    /* ignore */
                }
            }
            this.sessions.delete(sessionId);
            this.snapshots.delete(sessionId);
            this.lineBuffers.delete(sessionId);
            return true;
        } catch (e) {
            appLogger.error('TerminalService', 'Kill failed', e as Error);
            return false;
        }
    }

    /**
     * Get all active session IDs
     */
    getActiveSessions(): string[] {
        return Array.from(this.sessions.keys());
    }

    /**
     * Get recent command history
     */
    getRecentHistory(limit: number = 50): TerminalCommandHistoryEntry[] {
        return this.commandHistory.slice(0, limit);
    }

    /**
     * Get session buffer content
     */
    async getSessionBuffer(sessionId: string): Promise<string> {
        return this.readLogTail(sessionId);
    }

    getCommandHistory(query = '', limit = 100): TerminalCommandHistoryEntry[] {
        const normalizedQuery = query.trim().toLowerCase();
        const cappedLimit = Math.max(1, Math.min(limit, 500));
        const list = normalizedQuery
            ? this.commandHistory.filter(entry =>
                  entry.command.toLowerCase().includes(normalizedQuery)
              )
            : this.commandHistory;

        return list.slice(0, cappedLimit);
    }

    async clearCommandHistory(): Promise<boolean> {
        this.commandHistory = [];
        this.lineBuffers.clear();
        return this.saveCommandHistory();
    }

    /**
     * Load snapshots from disk
     */
    private async loadSnapshots() {
        if (!this.persistencePath) {
            return;
        }
        try {
            if (!fs.existsSync(this.persistencePath)) {
                return;
            }

            const data = await fs.promises.readFile(this.persistencePath, 'utf-8');
            const rawSnapshots = safeJsonParse<TerminalSnapshot[]>(data, []);

            // Filter out old snapshots (> 7 days)
            const now = Date.now();
            const validSnapshots = rawSnapshots.filter(
                s => now - s.timestamp < 7 * 24 * 60 * 60 * 1000
            );

            validSnapshots.forEach(s => this.snapshots.set(s.id, s));
            appLogger.info(
                'TerminalService',
                `Loaded ${validSnapshots.length} sessions from snapshot`
            );
        } catch (e) {
            appLogger.error('TerminalService', 'Failed to load snapshots', e as Error);
        }
    }

    /**
     * Save active sessions to disk
     */
    private async saveSnapshots() {
        if (!this.persistencePath) {
            return;
        }

        try {
            const snapshots: TerminalSnapshot[] = [];

            this.sessions.forEach(session => {
                snapshots.push({
                    id: session.id,
                    shell: session.shell,
                    cwd: session.cwd,
                    cols: session.cols,
                    rows: session.rows,
                    // No buffer storage in JSON anymore
                    title: session.title,
                    timestamp: Date.now(),
                    backendId: session.backendId,
                    workspaceId: session.workspaceId,
                    metadata: session.metadata,
                });
            });

            await fs.promises.writeFile(this.persistencePath, JSON.stringify(snapshots, null, 2));
            appLogger.info(
                'TerminalService',
                `Saved ${snapshots.length} sessions to ${this.persistencePath}`
            );
        } catch (e) {
            appLogger.error('TerminalService', 'Failed to save snapshots', e as Error);
        }
    }

    private createSessionEnv(): Record<string, string | undefined> {
        const env = { ...process.env } as Record<string, string | undefined>;
        if (process.platform === 'win32') {
            env.SYSTEMROOT = env.SYSTEMROOT ?? 'C:\\Windows';
            env.SystemRoot = env.SystemRoot ?? 'C:\\Windows';
            env.WINDIR = env.WINDIR ?? env.SYSTEMROOT;
            env.PYTHONIOENCODING = 'utf-8';
            env.ConEmuANSI = 'ON';
        } else {
            env.TERM = 'xterm-256color';
            env.COLORTERM = 'truecolor';
        }
        return env;
    }

    private captureCommandInput(sessionId: string, data: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        let lineBuffer = this.lineBuffers.get(sessionId) ?? '';
        let i = 0;
        while (i < data.length) {
            const char = data[i] ?? '';
            if (char === '\x1b') {
                i = this.skipEscapeSequence(data, i);
                continue;
            }

            if (char === '\r' || char === '\n') {
                this.commitCommandFromBuffer(sessionId, session, lineBuffer);
                lineBuffer = '';
                i += 1;
                continue;
            }

            if (char === '\b' || char === '\x7f') {
                lineBuffer = lineBuffer.slice(0, -1);
                i += 1;
                continue;
            }

            if (char.charCodeAt(0) >= 32) {
                if (lineBuffer.length < MAX_COMMAND_LENGTH) {
                    lineBuffer += char;
                }
            }

            i += 1;
        }

        this.lineBuffers.set(sessionId, lineBuffer);
    }

    private skipEscapeSequence(data: string, startIndex: number): number {
        let i = startIndex + 1;
        if ((data[i] ?? '') === '[') {
            i += 1;
            while (i < data.length) {
                const seqChar = data[i] ?? '';
                i += 1;
                if (
                    (seqChar >= 'A' && seqChar <= 'Z') ||
                    (seqChar >= 'a' && seqChar <= 'z') ||
                    seqChar === '~'
                ) {
                    break;
                }
            }
        }
        return i;
    }

    private commitCommandFromBuffer(
        sessionId: string,
        session: TerminalSession,
        lineBuffer: string
    ): void {
        const command = lineBuffer.trim();
        if (!command) {
            return;
        }

        const previous = this.commandHistory[0];
        if (
            previous?.command === command &&
            previous.cwd === session.cwd &&
            previous.shell === session.shell
        ) {
            return;
        }

        this.commandHistory.unshift({
            command,
            shell: session.shell,
            cwd: session.cwd,
            timestamp: Date.now(),
            sessionId,
        });

        if (this.commandHistory.length > MAX_COMMAND_HISTORY_SIZE) {
            this.commandHistory = this.commandHistory.slice(0, MAX_COMMAND_HISTORY_SIZE);
        }

        void this.saveCommandHistory();
    }

    private async loadCommandHistory(): Promise<void> {
        if (!this.historyPath) {
            return;
        }

        try {
            if (!fs.existsSync(this.historyPath)) {
                return;
            }

            const raw = await fs.promises.readFile(this.historyPath, 'utf-8');
            const parsed = safeJsonParse<TerminalCommandHistoryEntry[]>(raw, []);
            const sanitized = parsed
                .filter(
                    entry => typeof entry?.command === 'string' && entry.command.trim().length > 0
                )
                .map(entry => ({
                    command: entry.command.trim().slice(0, MAX_COMMAND_LENGTH),
                    shell: typeof entry.shell === 'string' ? entry.shell : undefined,
                    cwd: typeof entry.cwd === 'string' ? entry.cwd : undefined,
                    timestamp: Number(entry.timestamp) || Date.now(),
                    sessionId:
                        typeof entry.sessionId === 'string' && entry.sessionId.trim()
                            ? entry.sessionId
                            : 'unknown',
                }))
                .slice(0, MAX_COMMAND_HISTORY_SIZE);

            this.commandHistory = sanitized;
            appLogger.info(
                'TerminalService',
                `Loaded ${sanitized.length} terminal commands from history`
            );
        } catch (error) {
            appLogger.error(
                'TerminalService',
                'Failed to load terminal command history',
                error as Error
            );
        }
    }

    private async saveCommandHistory(): Promise<boolean> {
        if (!this.historyPath) {
            return false;
        }

        try {
            await fs.promises.writeFile(
                this.historyPath,
                JSON.stringify(this.commandHistory.slice(0, MAX_COMMAND_HISTORY_SIZE), null, 2)
            );
            return true;
        } catch (error) {
            appLogger.error(
                'TerminalService',
                'Failed to save terminal command history',
                error as Error
            );
            return false;
        }
    }

    /**
     * Cleanup all sessions
     */
    async cleanup(): Promise<void> {
        this.logInfo('Cleaning up TerminalService...');
        await this.saveSnapshots(); // Last save
        await this.saveCommandHistory();
        for (const [, session] of this.sessions) {
            try {
                session.process?.kill();
                session.logStream?.end();
            } catch {
                /* Already dead */
            }
        }
        this.sessions.clear();
        this.lineBuffers.clear();
    }

    private getLogPath(sessionId: string): string {
        const userDataPath = app.getPath('userData');
        return path.join(userDataPath, 'terminal-logs', `${sessionId}.log`);
    }

    private async readLogTail(sessionId: string, bytes = 100 * 1024): Promise<string> {
        const logPath = this.getLogPath(sessionId);
        try {
            if (!fs.existsSync(logPath)) {
                return '';
            }
            const stats = await fs.promises.stat(logPath);
            const size = stats.size;
            const start = Math.max(0, size - bytes);
            const length = size - start;

            if (length <= 0) {
                return '';
            }

            const handle = await fs.promises.open(logPath, 'r');
            const buffer = Buffer.alloc(length);
            await handle.read(buffer, 0, length, start);
            await handle.close();

            return buffer.toString('utf-8');
        } catch (e) {
            appLogger.error(
                'TerminalService',
                `Failed to read log tail for ${sessionId}`,
                e as Error
            );
            return '';
        }
    }
}
