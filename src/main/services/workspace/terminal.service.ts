/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { AuthService } from '@main/services/security/auth.service';
import { getDataFilePath, getDataSubPath } from '@main/services/system/app-layout-paths.util';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SettingsService } from '@main/services/system/settings.service';
import { AlacrittyBackend } from '@main/services/terminal/backends/alacritty.backend';
import { pathExists } from '@main/services/terminal/backends/backend-discovery.util';
import { DockerBackend } from '@main/services/terminal/backends/docker.backend';
import { GhosttyBackend } from '@main/services/terminal/backends/ghostty.backend';
import { KittyBackend } from '@main/services/terminal/backends/kitty.backend';
import { ProxyTerminalBackend } from '@main/services/terminal/backends/proxy-terminal.backend';
import {
    ITerminalBackend,
    ITerminalProcess,
} from '@main/services/terminal/backends/terminal-backend.interface';
import { WarpBackend } from '@main/services/terminal/backends/warp.backend';
import { WindowsTerminalBackend } from '@main/services/terminal/backends/windows-terminal.backend';
import { BatchedEventEmitter } from '@shared/utils/batched-event-emitter.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

const MAX_COMMAND_HISTORY_SIZE = 2000;
const MAX_COMMAND_LENGTH = 2000;
const MAX_SEARCH_HISTORY_SIZE = 500;
const MAX_SEARCH_QUERY_LENGTH = 512;

// OPT-007 Terminal Lifecycle Constants
const MAX_SESSIONS = 15;
const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const LOG_TRIM_SIZE_BYTES = 2 * 1024 * 1024; // Trim to 2MB
const SESSION_INACTIVITY_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const TERMINAL_DISCOVERY_CACHE_TTL_MS = 5 * 60 * 1000;

export interface TerminalShellInfo {
    id: string;
    name: string;
    path: string;
}

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

export interface TerminalDiscoverySnapshot {
    terminalAvailable: boolean;
    shells: TerminalShellInfo[];
    backends: TerminalBackendInfo[];
    refreshedAt: number;
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
    metadata?: Record<string, RuntimeValue>;
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
    metadata?: Record<string, RuntimeValue>;
}

interface TerminalSessionTemplate {
    id: string;
    name: string;
    shell: string;
    cwd: string;
    cols: number;
    rows: number;
    backendId: string;
    workspaceId?: string;
    metadata?: Record<string, RuntimeValue>;
    createdAt: number;
    updatedAt: number;
}

interface ExportedTerminalSessionPayload {
    version: 1;
    kind: 'terminal-session';
    exportedAt: number;
    snapshot: TerminalSnapshot;
    scrollback?: string;
}

export interface TerminalScrollbackSearchResult {
    lineNumber: number;
    line: string;
}

export interface TerminalScrollbackSearchOptions {
    regex?: boolean;
    caseSensitive?: boolean;
    limit?: number;
}

export interface TerminalScrollbackExportResult {
    success: boolean;
    path?: string;
    content?: string;
    error?: string;
}

export interface TerminalSessionAnalytics {
    sessionId: string;
    bytes: number;
    lineCount: number;
    commandCount: number;
    updatedAt: number;
}

export interface TerminalScrollbackMarker {
    id: string;
    sessionId: string;
    label: string;
    lineNumber: number;
    createdAt: number;
}

export interface TerminalScrollbackFilterOptions {
    query?: string;
    fromLine?: number;
    toLine?: number;
    caseSensitive?: boolean;
}

export interface TerminalSearchAnalytics {
    totalSearches: number;
    regexSearches: number;
    plainSearches: number;
    lastSearchAt: number;
}

interface TerminalSearchStatePayload {
    analytics: TerminalSearchAnalytics;
    history: string[];
}

interface ImportTerminalSessionResult {
    success: boolean;
    sessionId?: string;
    error?: string;
}

export class TerminalService extends BaseService {
    private sessions: Map<string, TerminalSession> = new Map();
    private backends: Map<string, ITerminalBackend> = new Map();
    private readonly eventBus: EventBusService;
    private readonly settingsService: SettingsService;
    private persistencePath: string;
    private historyPath: string;
    private markersPath: string;
    private templatesPath: string;
    private searchStatePath: string;
    private snapshots: Map<string, TerminalSnapshot> = new Map();
    private templates: Map<string, TerminalSessionTemplate> = new Map();
    private commandHistory: TerminalCommandHistoryEntry[] = [];
    private lineBuffers: Map<string, string> = new Map();
    private dataEmitters: Map<string, BatchedEventEmitter<string>> = new Map();
    private scrollbackMarkers: TerminalScrollbackMarker[] = [];
    private searchHistory: string[] = [];
    private searchAnalytics: TerminalSearchAnalytics = {
        totalSearches: 0,
        regexSearches: 0,
        plainSearches: 0,
        lastSearchAt: 0,
    };
    private discoverySnapshot: TerminalDiscoverySnapshot | null = null;
    private cleanupTimer: NodeJS.Timeout | null = null;
    private powerStateUnsubscribe: (() => void) | null = null;

    constructor(
        eventBus?: EventBusService, 
        settingsService?: SettingsService,
        authService?: AuthService
    ) {
        super('TerminalService');
        this.eventBus = eventBus ?? new EventBusService();
        this.settingsService = settingsService ?? new SettingsService();
        
        // Register default backends
        if (authService) {
            const proxyTerminalBackend = new ProxyTerminalBackend(authService);
            this.backends.set(proxyTerminalBackend.id, proxyTerminalBackend);
            
            // Docker backend also needs auth for proxy communication
            const dockerBackend = new DockerBackend(authService);
            this.backends.set(dockerBackend.id, dockerBackend);
        }

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
            this.persistencePath = getDataFilePath('terminal', 'sessions.json');
            this.historyPath = getDataFilePath('terminal', 'command-history.json');
            this.markersPath = getDataFilePath('terminal', 'scrollback-markers.json');
            this.templatesPath = getDataFilePath('terminal', 'session-templates.json');
            this.searchStatePath = getDataFilePath('terminal', 'search-state.json');

            // Create logs directory
            const logsPath = getDataSubPath('terminal', 'logs');
            if (!fs.existsSync(logsPath)) {
                fs.mkdirSync(logsPath, { recursive: true });
            }
        } catch (e) {
            appLogger.error('TerminalService', 'Failed to determine userData path', e as Error);
            this.persistencePath = '';
            this.historyPath = '';
            this.markersPath = '';
            this.templatesPath = '';
            this.searchStatePath = '';
        }
    }

    /**
     * Register a new terminal backend
     */
    addBackend(backend: ITerminalBackend): void {
        this.logInfo(`Registering terminal backend: ${backend.id}`);
        this.backends.set(backend.id, backend);
        this.discoverySnapshot = null;
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing TerminalService...');
        await this.loadSnapshots();
        await this.loadCommandHistory();
        await this.loadScrollbackMarkers();
        await this.loadSessionTemplates();
        await this.loadSearchState();
        const currentSettings = this.settingsService.getSettings();
        this.handlePowerStateChange(currentSettings.window?.lowPowerMode ?? false);

        // Subscribe to power state changes for adaptive throttling
        this.powerStateUnsubscribe?.();
        this.powerStateUnsubscribe = this.eventBus.on('power:state-changed', (payload) => {
            this.handlePowerStateChange(payload.isLowPowerMode);
        });

        // Start periodic cleanup
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.cleanupTimer = setInterval(() => {
            void this.performPeriodicCleanup();
        }, CLEANUP_INTERVAL_MS);
    }

    private handlePowerStateChange(isLowPowerMode: boolean) {
        this.logInfo(`Throttling terminal updates (Low Power Mode: ${isLowPowerMode})`);

        // Update all active emitters with new frequency
        const maxWaitMs = isLowPowerMode ? 150 : 30; // 6Hz vs 33Hz
        for (const emitter of this.dataEmitters.values()) {
            emitter.updateOptions({ maxWaitMs });
        }
    }

    private async performPeriodicCleanup() {
        this.logInfo('Performing periodic terminal cleanup...');
        this.enforceSessionLimits();
        await this.trimAllLogs();
        this.pruneInactiveSessions();
    }

    private enforceSessionLimits() {
        if (this.sessions.size <= MAX_SESSIONS) {
            return;
        }

        // Kill oldest sessions first
        const sortedSessions = Array.from(this.sessions.values())
            .sort((a, b) => a.lastActive - b.lastActive);

        const toKill = sortedSessions.slice(0, this.sessions.size - MAX_SESSIONS);
        for (const session of toKill) {
            this.logInfo(`Killing session ${session.id} due to session limit`);
            this.kill(session.id);
        }
    }

    private pruneInactiveSessions() {
        const now = Date.now();
        for (const session of this.sessions.values()) {
            if (now - session.lastActive > SESSION_INACTIVITY_TIMEOUT_MS) {
                this.logInfo(`Pruning inactive session ${session.id}`);
                this.kill(session.id);
            }
        }
    }

    private async trimAllLogs() {
        for (const sessionId of this.sessions.keys()) {
            await this.trimLogFile(sessionId);
        }
    }

    private async trimLogFile(sessionId: string) {
        const logPath = this.getLogPath(sessionId);
        try {
            const stats = await fs.promises.stat(logPath);
            if (stats.size > MAX_LOG_SIZE_BYTES) {
                this.logInfo(`Trimming log file for ${sessionId} (${stats.size} bytes)`);
                const content = await this.readLogTail(sessionId, LOG_TRIM_SIZE_BYTES);
                await fs.promises.writeFile(logPath, content, 'utf-8');
            }
        } catch {
            // Silently ignore if file doesn't exist
        }
    }

    /**
     * Check if terminal service is available
     */
    async isAvailable(): Promise<boolean> {
        const snapshot = await this.getDiscoverySnapshot();
        return snapshot.terminalAvailable;
    }

    /**
     * Get available shells for the current platform
     */
    async getAvailableShells(): Promise<TerminalShellInfo[]> {
        const snapshot = await this.getDiscoverySnapshot();
        return snapshot.shells;
    }

    /**
     * Get information about all registered terminal backends.
     * @returns A list of terminal backends with their availability status.
     */
    async getAvailableBackends(): Promise<TerminalBackendInfo[]> {
        const snapshot = await this.getDiscoverySnapshot();
        return snapshot.backends;
    }

    async getDiscoverySnapshot(options?: { refresh?: boolean }): Promise<TerminalDiscoverySnapshot> {
        const refresh = options?.refresh === true;
        if (
            !refresh &&
            this.discoverySnapshot &&
            Date.now() - this.discoverySnapshot.refreshedAt < TERMINAL_DISCOVERY_CACHE_TTL_MS
        ) {
            return this.discoverySnapshot;
        }

        const [shells, backends] = await Promise.all([
            this.detectAvailableShells(),
            this.detectAvailableBackends(),
        ]);
        const snapshot: TerminalDiscoverySnapshot = {
            terminalAvailable: backends.some(backend => backend.available),
            shells,
            backends,
            refreshedAt: Date.now(),
        };
        this.discoverySnapshot = snapshot;
        return snapshot;
    }

    private async detectAvailableBackends(): Promise<TerminalBackendInfo[]> {
        const backendNames: Record<string, string> = {
            'proxy-terminal': 'Integrated Terminal',
            ghostty: 'Ghostty',
            alacritty: 'Alacritty',
            warp: 'Warp',
            kitty: 'Kitty',
            'windows-terminal': 'Windows Terminal',
        };

        const backends = Array.from(this.backends.values());
        return Promise.all(
            backends.map(async backend => ({
                id: backend.id,
                name: backendNames[backend.id] ?? backend.id,
                available: await backend.isAvailable(),
            }))
        );
    }

    async getRuntimeHealth(): Promise<{
        terminalAvailable: boolean;
        totalBackends: number;
        availableBackends: number;
        backends: TerminalBackendInfo[];
    }> {
        const snapshot = await this.getDiscoverySnapshot();
        const backends = snapshot.backends;
        const availableBackends = backends.filter(backend => backend.available).length;
        return {
            terminalAvailable: snapshot.terminalAvailable,
            totalBackends: backends.length,
            availableBackends,
            backends,
        };
    }

    private async detectAvailableShells(): Promise<TerminalShellInfo[]> {
        return process.platform === 'win32'
            ? this.getWindowsShells()
            : this.getUnixShells();
    }

    private async getWindowsShells(): Promise<TerminalShellInfo[]> {
        const shells: TerminalShellInfo[] = [];
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
            if (await pathExists(pwshPath)) {
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
        if (await pathExists(gitBashPath)) {
            shells.push({ id: 'gitbash', name: 'Git Bash', path: gitBashPath });
        }

        return shells;
    }

    private async getUnixShells(): Promise<TerminalShellInfo[]> {
        const shells: TerminalShellInfo[] = [];
        const commonPaths = [
            { id: 'bash', name: 'Bash', path: '/bin/bash' },
            { id: 'zsh', name: 'Zsh', path: '/bin/zsh' },
            { id: 'sh', name: 'Sh', path: '/bin/sh' },
            { id: 'fish', name: 'Fish', path: '/usr/bin/fish' },
        ];
        for (const s of commonPaths) {
            if (await pathExists(s.path)) {
                shells.push(s);
            }
        }
        return shells;
    }

    private async getDefaultShell(): Promise<string> {
        const shells = await this.detectAvailableShells();
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
        title?: string;
        onData: (data: string) => void;
        onExit: (code: number) => void;
        metadata?: Record<string, RuntimeValue>;
    }): Promise<boolean> {
        const discoverySnapshot = await this.getDiscoverySnapshot();
        const availableBackendIds = new Set(
            discoverySnapshot.backends
                .filter(backend => backend.available)
                .map(backend => backend.id)
        );
        let backendId = options.backendId ?? 'proxy-terminal';
        let backend = this.backends.get(backendId);

        if (!backend || !availableBackendIds.has(backendId)) {
            this.logInfo(`Backend ${backendId} is not available, trying fallback backend`);
            backend = undefined;
            for (const backendInfo of discoverySnapshot.backends) {
                if (!backendInfo.available) {
                    continue;
                }
                backendId = backendInfo.id;
                backend = this.backends.get(backendId);
                if (backend) {
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

        const { shell, args } = await this.getShellConfig(options, snapshot);
        const cwd = await this.getCwdConfig(options, snapshot);
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
                    
                    // Use batched emitter for UI updates
                    const emitter = this.dataEmitters.get(options.id);
                    if (emitter) {
                        emitter.emitBatched(data);
                    } else {
                        options.onData(data);
                    }
                },
                onExit: code => {
                    this.logInfo(`Session ${options.id} exited with code ${code}`);

                    const emitter = this.dataEmitters.get(options.id);
                    if (emitter) {
                        emitter.flush();
                        emitter.dispose();
                        this.dataEmitters.delete(options.id);
                    }

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
                title: options.title ?? snapshot?.title,
                lastActive: Date.now(),
                backendId,
                workspaceId: options.workspaceId ?? snapshot?.workspaceId,
                metadata: options.metadata ?? snapshot?.metadata,
            };

            this.sessions.set(options.id, session);

            // Initialize batched emitter for the new session
            const dataEmitter = new BatchedEventEmitter<string>({
                maxWaitMs: 30, // 33Hz max update frequency
                maxBatchSize: 100, // Or 100 chunks
                merger: (batch) => batch.join('')
            });
            dataEmitter.on('batch', (mergedData: string) => {
                options.onData(mergedData);
            });
            this.dataEmitters.set(options.id, dataEmitter);

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

    private async getShellConfig(
        options: { shell?: string },
        snapshot?: TerminalSnapshot
    ): Promise<{ shell: string; args: string[] }> {
        const availableShells = await this.getAvailableShells();
        const selectedShell = availableShells.find(s => s.id === options.shell);
        const shell = selectedShell
            ? selectedShell.path
            : (options.shell ?? snapshot?.shell ?? await this.getDefaultShell());

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

    private async getCwdConfig(
        options: { cwd?: string },
        snapshot?: TerminalSnapshot
    ): Promise<string> {
        let cwd = options.cwd ?? snapshot?.cwd ?? os.homedir();
        if (!(await pathExists(cwd))) {
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
                } catch (error) {
                    appLogger.warn('TerminalService', `Failed to close log stream for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            const emitter = this.dataEmitters.get(sessionId);
            if (emitter) {
                emitter.dispose();
                this.dataEmitters.delete(sessionId);
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

    getSessionSnapshots(): TerminalSnapshot[] {
        return Array.from(this.snapshots.values()).sort((a, b) => b.timestamp - a.timestamp);
    }

    async exportSession(
        sessionId: string,
        options: { includeScrollback?: boolean } = {}
    ): Promise<string | null> {
        const snapshot = this.resolveSnapshot(sessionId);
        if (!snapshot) {
            return null;
        }
        const payload: ExportedTerminalSessionPayload = {
            version: 1,
            kind: 'terminal-session',
            exportedAt: Date.now(),
            snapshot,
        };

        if (options.includeScrollback) {
            payload.scrollback = await this.readLogAll(sessionId);
        }

        return JSON.stringify(payload, null, 2);
    }

    async importSession(
        payloadRaw: string,
        options: { overwrite?: boolean; sessionId?: string } = {}
    ): Promise<ImportTerminalSessionResult> {
        const parsed = safeJsonParse<ExportedTerminalSessionPayload | null>(payloadRaw, null);
        if (parsed?.kind !== 'terminal-session' || parsed.version !== 1 || !parsed.snapshot) {
            return { success: false, error: 'Invalid terminal session export payload' };
        }

        const snapshot = parsed.snapshot;
        const targetSessionId = (options.sessionId ?? snapshot.id).trim();
        if (!targetSessionId) {
            return { success: false, error: 'Session id is required' };
        }

        if (!options.overwrite && (this.snapshots.has(targetSessionId) || this.sessions.has(targetSessionId))) {
            return { success: false, error: `Session ${targetSessionId} already exists` };
        }

        this.snapshots.set(targetSessionId, {
            ...snapshot,
            id: targetSessionId,
            timestamp: Date.now(),
        });
        await this.saveSnapshots();

        if (typeof parsed.scrollback === 'string' && parsed.scrollback.length > 0) {
            try {
                await fs.promises.writeFile(this.getLogPath(targetSessionId), parsed.scrollback, 'utf-8');
            } catch (error) {
                appLogger.error('TerminalService', 'Failed to write imported scrollback', error as Error);
            }
        }

        return { success: true, sessionId: targetSessionId };
    }

    async generateSessionShareCode(
        sessionId: string,
        options: { includeScrollback?: boolean } = {}
    ): Promise<string | null> {
        const payload = await this.exportSession(sessionId, options);
        if (!payload) {
            return null;
        }
        return `termshare:${Buffer.from(payload, 'utf-8').toString('base64url')}`;
    }

    async importSessionShareCode(
        shareCode: string,
        options: { overwrite?: boolean; sessionId?: string } = {}
    ): Promise<ImportTerminalSessionResult> {
        if (typeof shareCode !== 'string' || !shareCode.startsWith('termshare:')) {
            return { success: false, error: 'Invalid session share code' };
        }

        const encoded = shareCode.slice('termshare:'.length).trim();
        if (!encoded) {
            return { success: false, error: 'Invalid session share code' };
        }

        try {
            const payload = Buffer.from(encoded, 'base64url').toString('utf-8');
            return this.importSession(payload, options);
        } catch {
            return { success: false, error: 'Invalid session share code encoding' };
        }
    }

    getSessionTemplates(): TerminalSessionTemplate[] {
        return Array.from(this.templates.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    async createSessionTemplate(
        sessionId: string,
        options: { templateId?: string; name?: string } = {}
    ): Promise<TerminalSessionTemplate | null> {
        const snapshot = this.resolveSnapshot(sessionId);
        if (!snapshot) {
            return null;
        }

        const templateId = (options.templateId ?? `tpl-${sessionId}`).trim();
        if (!templateId) {
            return null;
        }

        const previous = this.templates.get(templateId);
        const now = Date.now();
        const template: TerminalSessionTemplate = {
            id: templateId,
            name: (options.name ?? previous?.name ?? snapshot.title ?? `Template ${templateId}`)
                .trim()
                .slice(0, 120),
            shell: snapshot.shell,
            cwd: snapshot.cwd,
            cols: snapshot.cols,
            rows: snapshot.rows,
            backendId: snapshot.backendId,
            workspaceId: snapshot.workspaceId,
            metadata: snapshot.metadata,
            createdAt: previous?.createdAt ?? now,
            updatedAt: now,
        };

        this.templates.set(templateId, template);
        await this.saveSessionTemplates();
        return template;
    }

    async deleteSessionTemplate(templateId: string): Promise<boolean> {
        const existed = this.templates.delete(templateId);
        if (!existed) {
            return false;
        }
        await this.saveSessionTemplates();
        return true;
    }

    async restoreSessionTemplate(
        templateId: string,
        options: {
            sessionId?: string;
            title?: string;
            onData: (data: string) => void;
            onExit: (code: number) => void;
        }
    ): Promise<string | null> {
        const template = this.templates.get(templateId);
        if (!template) {
            return null;
        }

        const sessionId =
            options.sessionId && options.sessionId.trim().length > 0
                ? options.sessionId.trim()
                : `term-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        const created = await this.createSession({
            id: sessionId,
            shell: template.shell,
            cwd: template.cwd,
            cols: template.cols,
            rows: template.rows,
            backendId: template.backendId,
            workspaceId: template.workspaceId,
            metadata: template.metadata,
            title: options.title ?? template.name,
            onData: options.onData,
            onExit: options.onExit,
        });
        return created ? sessionId : null;
    }

    async restoreSnapshotSession(options: {
        snapshotId: string;
        onData: (data: string) => void;
        onExit: (code: number) => void;
    }): Promise<boolean> {
        const snapshot = this.snapshots.get(options.snapshotId);
        if (!snapshot) {
            return false;
        }

        return this.createSession({
            id: snapshot.id,
            shell: snapshot.shell,
            cwd: snapshot.cwd,
            cols: snapshot.cols,
            rows: snapshot.rows,
            backendId: snapshot.backendId,
            workspaceId: snapshot.workspaceId,
            title: snapshot.title,
            metadata: snapshot.metadata,
            onData: options.onData,
            onExit: options.onExit,
        });
    }

    async restoreAllSnapshots(options: {
        onData: (sessionId: string, data: string) => void;
        onExit: (sessionId: string, code: number) => void;
    }): Promise<{ restored: number; failed: number; sessionIds: string[] }> {
        const snapshots = this.getSessionSnapshots();
        let restored = 0;
        let failed = 0;
        const sessionIds: string[] = [];

        for (const snapshot of snapshots) {
            if (this.sessions.has(snapshot.id)) {
                continue;
            }
            const ok = await this.createSession({
                id: snapshot.id,
                shell: snapshot.shell,
                cwd: snapshot.cwd,
                cols: snapshot.cols,
                rows: snapshot.rows,
                backendId: snapshot.backendId,
                workspaceId: snapshot.workspaceId,
                title: snapshot.title,
                metadata: snapshot.metadata,
                onData: data => options.onData(snapshot.id, data),
                onExit: code => options.onExit(snapshot.id, code),
            });
            if (ok) {
                restored += 1;
                sessionIds.push(snapshot.id);
            } else {
                failed += 1;
            }
        }

        return { restored, failed, sessionIds };
    }

    async setSessionTitle(sessionId: string, title: string): Promise<boolean> {
        const normalized = title.trim().slice(0, 120);
        if (!normalized) {
            return false;
        }

        const session = this.sessions.get(sessionId);
        if (session) {
            session.title = normalized;
        }

        const snapshot = this.snapshots.get(sessionId);
        if (snapshot) {
            snapshot.title = normalized;
            this.snapshots.set(sessionId, snapshot);
        }

        if (!session && !snapshot) {
            return false;
        }

        await this.saveSnapshots();
        return true;
    }

    async searchSessionScrollback(
        sessionId: string,
        query: string,
        options: TerminalScrollbackSearchOptions = {}
    ): Promise<TerminalScrollbackSearchResult[]> {
        const normalized = query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
        if (!normalized) {
            return [];
        }
        this.recordSearchQuery(normalized);
        this.searchAnalytics.totalSearches += 1;
        if (options.regex) {
            this.searchAnalytics.regexSearches += 1;
        } else {
            this.searchAnalytics.plainSearches += 1;
        }
        this.searchAnalytics.lastSearchAt = Date.now();

        const content = await this.readLogAll(sessionId);
        if (!content) {
            return [];
        }

        const limit = Math.max(1, Math.min(options.limit ?? 100, 1000));
        const lines = content.split(/\r?\n/);
        const results: TerminalScrollbackSearchResult[] = [];

        if (options.regex) {
            const flags = options.caseSensitive ? 'g' : 'gi';
            let regex: RegExp;
            try {
                regex = new RegExp(normalized, flags);
            } catch {
                return [];
            }

            for (let i = 0; i < lines.length && results.length < limit; i += 1) {
                const line = lines[i] ?? '';
                if (!line) {
                    continue;
                }
                regex.lastIndex = 0;
                if (regex.test(line)) {
                    results.push({ lineNumber: i + 1, line });
                }
            }
            return results;
        }

        const needle = options.caseSensitive ? normalized : normalized.toLowerCase();
        for (let i = 0; i < lines.length && results.length < limit; i += 1) {
            const line = lines[i] ?? '';
            if (!line) {
                continue;
            }
            const hay = options.caseSensitive ? line : line.toLowerCase();
            if (hay.includes(needle)) {
                results.push({ lineNumber: i + 1, line });
            }
        }
        return results;
    }

    getSearchSuggestions(query = '', limit = 10): string[] {
        const normalizedQuery = query.trim().toLowerCase();
        const max = Math.max(1, Math.min(limit, 100));
        const suggestions: string[] = [];
        const seen = new Set<string>();

        const add = (value: string) => {
            const cleaned = value.trim();
            if (!cleaned) {
                return;
            }
            const key = cleaned.toLowerCase();
            if (seen.has(key)) {
                return;
            }
            if (normalizedQuery && !key.includes(normalizedQuery)) {
                return;
            }
            seen.add(key);
            suggestions.push(cleaned);
        };

        this.searchHistory.forEach(add);
        this.commandHistory.forEach(entry => add(entry.command));

        return suggestions.slice(0, max);
    }

    async exportSearchResults(
        sessionId: string,
        query: string,
        options: TerminalScrollbackSearchOptions = {},
        exportPath?: string,
        format: 'json' | 'txt' = 'json'
    ): Promise<TerminalScrollbackExportResult> {
        const results = await this.searchSessionScrollback(sessionId, query, options);
        const payload =
            format === 'txt'
                ? results.map(item => `${item.lineNumber}: ${item.line}`).join('\n')
                : JSON.stringify(
                      {
                          sessionId,
                          query,
                          options,
                          count: results.length,
                          exportedAt: Date.now(),
                          results,
                      },
                      null,
                      2
                  );

        if (!exportPath) {
            return { success: true, content: payload };
        }
        try {
            await fs.promises.writeFile(exportPath, payload, 'utf-8');
            return { success: true, path: exportPath };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    async exportSessionScrollback(
        sessionId: string,
        exportPath?: string
    ): Promise<TerminalScrollbackExportResult> {
        try {
            const content = await this.readLogAll(sessionId);
            if (!content) {
                return { success: false, error: 'No scrollback content found' };
            }

            if (!exportPath) {
                return { success: true, content };
            }

            await fs.promises.writeFile(exportPath, content, 'utf-8');
            return { success: true, path: exportPath };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    async getSessionAnalytics(sessionId: string): Promise<TerminalSessionAnalytics> {
        const content = await this.readLogAll(sessionId);
        const bytes = Buffer.byteLength(content, 'utf-8');
        const lineCount = content ? content.split(/\r?\n/).length : 0;
        const commandCount = this.commandHistory.filter(item => item.sessionId === sessionId).length;
        let updatedAt = 0;
        try {
            const stats = await fs.promises.stat(this.getLogPath(sessionId));
            updatedAt = stats.mtimeMs;
        } catch {
            updatedAt = 0;
        }
        return { sessionId, bytes, lineCount, commandCount, updatedAt };
    }

    getSearchAnalytics(): TerminalSearchAnalytics {
        return { ...this.searchAnalytics };
    }

    async addScrollbackMarker(
        sessionId: string,
        label: string,
        lineNumber?: number
    ): Promise<TerminalScrollbackMarker | null> {
        const normalizedLabel = label.trim().slice(0, 120);
        if (!normalizedLabel) {
            return null;
        }
        const content = await this.readLogAll(sessionId);
        const lineCount = content ? content.split(/\r?\n/).length : 0;
        const safeLineNumber = Math.max(1, Math.min(lineNumber ?? lineCount, Math.max(lineCount, 1)));
        const marker: TerminalScrollbackMarker = {
            id: `${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            sessionId,
            label: normalizedLabel,
            lineNumber: safeLineNumber,
            createdAt: Date.now(),
        };
        this.scrollbackMarkers.unshift(marker);
        await this.saveScrollbackMarkers();
        return marker;
    }

    listScrollbackMarkers(sessionId?: string): TerminalScrollbackMarker[] {
        const list = sessionId
            ? this.scrollbackMarkers.filter(item => item.sessionId === sessionId)
            : this.scrollbackMarkers;
        return [...list].sort((a, b) => b.createdAt - a.createdAt);
    }

    async deleteScrollbackMarker(markerId: string): Promise<boolean> {
        const prevLength = this.scrollbackMarkers.length;
        this.scrollbackMarkers = this.scrollbackMarkers.filter(item => item.id !== markerId);
        if (this.scrollbackMarkers.length === prevLength) {
            return false;
        }
        await this.saveScrollbackMarkers();
        return true;
    }

    async filterSessionScrollback(
        sessionId: string,
        options: TerminalScrollbackFilterOptions = {}
    ): Promise<string[]> {
        const content = await this.readLogAll(sessionId);
        if (!content) {
            return [];
        }
        const lines = content.split(/\r?\n/);
        const fromLine = Math.max(1, options.fromLine ?? 1);
        const toLine = Math.max(fromLine, options.toLine ?? lines.length);
        const query = options.query?.trim() ?? '';
        const caseSensitive = options.caseSensitive === true;
        const needle = caseSensitive ? query : query.toLowerCase();

        return lines
            .map((line, index) => ({ line, lineNumber: index + 1 }))
            .filter(item => item.lineNumber >= fromLine && item.lineNumber <= toLine)
            .filter(item => {
                if (!query) {
                    return true;
                }
                const hay = caseSensitive ? item.line : item.line.toLowerCase();
                return hay.includes(needle);
            })
            .map(item => item.line);
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
        this.powerStateUnsubscribe?.();
        this.powerStateUnsubscribe = null;
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        await this.saveSnapshots(); // Last save
        await this.saveCommandHistory();
        await this.saveScrollbackMarkers();
        await this.saveSessionTemplates();
        await this.saveSearchState();
        for (const [, session] of this.sessions) {
            try {
                session.process?.kill();
                session.logStream?.end();
            } catch (error) {
                appLogger.warn('TerminalService', `Session cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        this.sessions.clear();
        this.lineBuffers.clear();
        this.discoverySnapshot = null;
    }

    private getLogPath(sessionId: string): string {
        return getDataFilePath('terminal', 'logs', `${sessionId}.log`);
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

    private async readLogAll(sessionId: string): Promise<string> {
        const logPath = this.getLogPath(sessionId);
        try {
            if (!fs.existsSync(logPath)) {
                return '';
            }
            return await fs.promises.readFile(logPath, 'utf-8');
        } catch (error) {
            appLogger.error(
                'TerminalService',
                `Failed to read full log for ${sessionId}`,
                error as Error
            );
            return '';
        }
    }

    private async loadScrollbackMarkers(): Promise<void> {
        if (!this.markersPath) {
            return;
        }
        try {
            if (!fs.existsSync(this.markersPath)) {
                return;
            }
            const raw = await fs.promises.readFile(this.markersPath, 'utf-8');
            const parsed = safeJsonParse<TerminalScrollbackMarker[]>(raw, []);
            this.scrollbackMarkers = parsed
                .filter(item => typeof item?.id === 'string' && typeof item?.sessionId === 'string')
                .map(item => ({
                    id: item.id,
                    sessionId: item.sessionId,
                    label: typeof item.label === 'string' ? item.label : 'Marker',
                    lineNumber: Number(item.lineNumber) || 1,
                    createdAt: Number(item.createdAt) || Date.now(),
                }));
        } catch (error) {
            appLogger.error('TerminalService', 'Failed to load scrollback markers', error as Error);
        }
    }

    private async saveScrollbackMarkers(): Promise<boolean> {
        if (!this.markersPath) {
            return false;
        }
        try {
            await fs.promises.writeFile(
                this.markersPath,
                JSON.stringify(this.scrollbackMarkers.slice(0, 5000), null, 2),
                'utf-8'
            );
            return true;
        } catch (error) {
            appLogger.error('TerminalService', 'Failed to save scrollback markers', error as Error);
            return false;
        }
    }

    private resolveSnapshot(sessionId: string): TerminalSnapshot | null {
        const session = this.sessions.get(sessionId);
        if (session) {
            return {
                id: session.id,
                shell: session.shell,
                cwd: session.cwd,
                title: session.title,
                cols: session.cols,
                rows: session.rows,
                timestamp: Date.now(),
                backendId: session.backendId,
                workspaceId: session.workspaceId,
                metadata: session.metadata,
            };
        }
        const snapshot = this.snapshots.get(sessionId);
        return snapshot ? { ...snapshot } : null;
    }

    private recordSearchQuery(query: string): void {
        const normalized = query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
        if (!normalized) {
            return;
        }
        this.searchHistory = this.searchHistory.filter(
            item => item.toLowerCase() !== normalized.toLowerCase()
        );
        this.searchHistory.unshift(normalized);
        if (this.searchHistory.length > MAX_SEARCH_HISTORY_SIZE) {
            this.searchHistory = this.searchHistory.slice(0, MAX_SEARCH_HISTORY_SIZE);
        }
        void this.saveSearchState();
    }

    private async loadSessionTemplates(): Promise<void> {
        if (!this.templatesPath) {
            return;
        }
        try {
            if (!fs.existsSync(this.templatesPath)) {
                return;
            }
            const raw = await fs.promises.readFile(this.templatesPath, 'utf-8');
            const parsed = safeJsonParse<TerminalSessionTemplate[]>(raw, []);
            this.templates.clear();
            parsed
                .filter(item => typeof item?.id === 'string' && item.id.trim().length > 0)
                .forEach(item => {
                    this.templates.set(item.id, {
                        ...item,
                        name: typeof item.name === 'string' ? item.name : item.id,
                        createdAt: Number(item.createdAt) || Date.now(),
                        updatedAt: Number(item.updatedAt) || Date.now(),
                    });
                });
        } catch (error) {
            appLogger.error('TerminalService', 'Failed to load terminal session templates', error as Error);
        }
    }

    private async saveSessionTemplates(): Promise<boolean> {
        if (!this.templatesPath) {
            return false;
        }
        try {
            await fs.promises.writeFile(
                this.templatesPath,
                JSON.stringify(Array.from(this.templates.values()), null, 2),
                'utf-8'
            );
            return true;
        } catch (error) {
            appLogger.error('TerminalService', 'Failed to save terminal session templates', error as Error);
            return false;
        }
    }

    private async loadSearchState(): Promise<void> {
        if (!this.searchStatePath) {
            return;
        }
        try {
            if (!fs.existsSync(this.searchStatePath)) {
                return;
            }
            const raw = await fs.promises.readFile(this.searchStatePath, 'utf-8');
            const parsed = safeJsonParse<TerminalSearchStatePayload | null>(raw, null);
            if (!parsed) {
                return;
            }
            const history = Array.isArray(parsed.history)
                ? parsed.history
                      .filter(item => typeof item === 'string' && item.trim().length > 0)
                      .slice(0, MAX_SEARCH_HISTORY_SIZE)
                : [];
            this.searchHistory = history;
            if (parsed.analytics) {
                this.searchAnalytics = {
                    totalSearches: Number(parsed.analytics.totalSearches) || 0,
                    regexSearches: Number(parsed.analytics.regexSearches) || 0,
                    plainSearches: Number(parsed.analytics.plainSearches) || 0,
                    lastSearchAt: Number(parsed.analytics.lastSearchAt) || 0,
                };
            }
        } catch (error) {
            appLogger.error('TerminalService', 'Failed to load terminal search state', error as Error);
        }
    }

    private async saveSearchState(): Promise<boolean> {
        if (!this.searchStatePath) {
            return false;
        }
        try {
            const payload: TerminalSearchStatePayload = {
                analytics: this.searchAnalytics,
                history: this.searchHistory.slice(0, MAX_SEARCH_HISTORY_SIZE),
            };
            await fs.promises.writeFile(this.searchStatePath, JSON.stringify(payload, null, 2), 'utf-8');
            return true;
        } catch (error) {
            appLogger.error('TerminalService', 'Failed to save terminal search state', error as Error);
            return false;
        }
    }

}
