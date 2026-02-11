import { appLogger } from '@main/logging/logger';
import { DockerService } from '@main/services/project/docker.service';
import { TerminalService } from '@main/services/project/terminal.service';
import {
    ExplainCommandOptions,
    ExplainErrorOptions,
    FixErrorOptions,
    SuggestionOptions,
    TerminalSmartService,
} from '@main/services/project/terminal-smart.service';
import {
    TerminalProfile,
    TerminalProfileService,
} from '@main/services/terminal/terminal-profile.service';
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

const MAX_COLS = 500;
const MAX_ROWS = 200;
const MAX_WRITE_SIZE = 1024 * 1024; // 1MB
const MAX_SESSION_ID_LENGTH = 128;
const SESSION_ID_PATTERN = /^[\w.:-]+$/;
const MAX_HISTORY_QUERY_LENGTH = 256;

interface TerminalCreateOptions {
    id?: string;
    shell?: string;
    cwd?: string;
    cols?: number;
    rows?: number;
    backendId?: string;
    workspaceId?: string;
    metadata?: Record<string, unknown>;
}

function assertValidDimensions(cols?: number, rows?: number): void {
    if (cols !== undefined && (!Number.isInteger(cols) || cols < 1 || cols > MAX_COLS)) {
        throw new Error(`cols must be an integer between 1 and ${MAX_COLS}`);
    }
    if (rows !== undefined && (!Number.isInteger(rows) || rows < 1 || rows > MAX_ROWS)) {
        throw new Error(`rows must be an integer between 1 and ${MAX_ROWS}`);
    }
}

function assertValidSessionId(value: unknown): string {
    if (typeof value !== 'string') {
        throw new Error('sessionId must be a string');
    }

    const sessionId = value.trim();
    if (!sessionId) {
        throw new Error('sessionId cannot be empty');
    }
    if (sessionId.length > MAX_SESSION_ID_LENGTH) {
        throw new Error(`sessionId must be at most ${MAX_SESSION_ID_LENGTH} characters`);
    }
    if (!SESSION_ID_PATTERN.test(sessionId)) {
        throw new Error('sessionId contains invalid characters');
    }

    return sessionId;
}

function parseCreateOptions(value: unknown): TerminalCreateOptions {
    if (!value || typeof value !== 'object') {
        return {};
    }

    const raw = value as Record<string, unknown>;
    const options: TerminalCreateOptions = {};

    if (raw.id !== undefined) {
        options.id = assertValidSessionId(raw.id);
    }

    if (typeof raw.shell === 'string') {
        const shell = raw.shell.trim();
        if (shell) {
            options.shell = shell;
        }
    }

    if (typeof raw.cwd === 'string') {
        const cwd = raw.cwd.trim();
        if (cwd) {
            options.cwd = cwd;
        }
    }

    if (raw.cols !== undefined) {
        options.cols = Number(raw.cols);
    }
    if (raw.rows !== undefined) {
        options.rows = Number(raw.rows);
    }

    if (typeof raw.backendId === 'string') {
        const backendId = raw.backendId.trim();
        if (backendId) {
            options.backendId = backendId;
        }
    }
    if (typeof raw.workspaceId === 'string') {
        options.workspaceId = raw.workspaceId;
    }
    if (raw.metadata !== undefined && typeof raw.metadata === 'object' && raw.metadata !== null) {
        options.metadata = raw.metadata as Record<string, unknown>;
    }

    assertValidDimensions(options.cols, options.rows);
    return options;
}

function parseHistoryQuery(value: unknown): string {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim().slice(0, MAX_HISTORY_QUERY_LENGTH);
}

function parseHistoryLimit(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isInteger(numeric)) {
        return 100;
    }
    return Math.max(1, Math.min(numeric, 500));
}

function buildSessionId(): string {
    return `term-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function broadcastTerminalEvent(
    getWindow: () => BrowserWindow | null,
    channel: string,
    payload: unknown
) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows.forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send(channel, payload);
            }
        });
        return;
    }

    const fallbackWindow = getWindow();
    if (fallbackWindow && !fallbackWindow.isDestroyed()) {
        fallbackWindow.webContents.send(channel, payload);
    }
}

/**
 * Registers all terminal IPC channels with runtime validation and safe fallbacks.
 */
export function registerTerminalIpc(
    getWindow: () => BrowserWindow | null,
    terminalService: TerminalService,
    profileService: TerminalProfileService,
    smartService: TerminalSmartService,
    dockerService: DockerService
) {
    ipcMain.setMaxListeners(60);
    appLogger.info('terminal', '[IPC] Terminal service registered');

    // Profile Management
    ipcMain.handle(
        'terminal:getProfiles',
        createSafeIpcHandler(
            'terminal:getProfiles',
            async () => {
                return profileService.getProfiles();
            },
            []
        )
    );

    ipcMain.handle(
        'terminal:saveProfile',
        createIpcHandler('terminal:saveProfile', async (_event, profile: TerminalProfile) => {
            return profileService.saveProfile(profile);
        })
    );

    ipcMain.handle(
        'terminal:deleteProfile',
        createIpcHandler('terminal:deleteProfile', async (_event, id: string) => {
            return profileService.deleteProfile(id);
        })
    );

    // Check availability
    ipcMain.handle(
        'terminal:isAvailable',
        createIpcHandler('terminal:isAvailable', async () => {
            return terminalService.isAvailable();
        })
    );

    // Get available shells
    ipcMain.handle(
        'terminal:getShells',
        createSafeIpcHandler(
            'terminal:getShells',
            async () => {
                return terminalService.getAvailableShells();
            },
            []
        )
    );

    // Get available terminal backends
    ipcMain.handle(
        'terminal:getBackends',
        createSafeIpcHandler(
            'terminal:getBackends',
            async () => {
                return terminalService.getAvailableBackends();
            },
            []
        )
    );

    // Create session
    ipcMain.handle(
        'terminal:create',
        createIpcHandler(
            'terminal:create',
            async (_event: IpcMainInvokeEvent, optionsRaw: unknown) => {
                const options = parseCreateOptions(optionsRaw);
                const sessionId = options.id ?? buildSessionId();

                appLogger.info('ipc', `terminal:create called for session ${sessionId}`);

                const success = await terminalService.createSession({
                    ...options,
                    id: sessionId,
                    onData: (data: string) => {
                        broadcastTerminalEvent(getWindow, 'terminal:data', { id: sessionId, data });
                        broadcastTerminalEvent(getWindow, `terminal:data:${sessionId}`, data);
                    },
                    onExit: (code: number) => {
                        broadcastTerminalEvent(getWindow, 'terminal:exit', { id: sessionId, code });
                    },
                });
                return success ? sessionId : null;
            }
        )
    );

    // Close session
    ipcMain.handle(
        'terminal:close',
        createSafeIpcHandler(
            'terminal:close',
            async (_event: IpcMainInvokeEvent, sessionIdRaw: unknown) => {
                const sessionId = assertValidSessionId(sessionIdRaw);
                return terminalService.kill(sessionId);
            },
            false
        )
    );

    // Write to session
    ipcMain.handle(
        'terminal:write',
        createSafeIpcHandler(
            'terminal:write',
            async (_event: IpcMainInvokeEvent, sessionIdRaw: unknown, data: string) => {
                const sessionId = assertValidSessionId(sessionIdRaw);
                if (typeof data !== 'string') {
                    throw new Error('data must be a string');
                }
                if (data.length > MAX_WRITE_SIZE) {
                    throw new Error('data exceeds maximum size of 1MB');
                }

                return withRateLimit('terminal', async () =>
                    terminalService.write(sessionId, data)
                );
            },
            false
        )
    );

    // Resize session
    ipcMain.handle(
        'terminal:resize',
        createSafeIpcHandler(
            'terminal:resize',
            async (
                _event: IpcMainInvokeEvent,
                sessionIdRaw: unknown,
                cols: number,
                rows: number
            ) => {
                const sessionId = assertValidSessionId(sessionIdRaw);
                assertValidDimensions(cols, rows);
                return terminalService.resize(sessionId, cols, rows);
            },
            false
        )
    );

    // Kill session
    ipcMain.handle(
        'terminal:kill',
        createSafeIpcHandler(
            'terminal:kill',
            async (_event: IpcMainInvokeEvent, sessionIdRaw: unknown) => {
                const sessionId = assertValidSessionId(sessionIdRaw);
                return terminalService.kill(sessionId);
            },
            false
        )
    );

    // Get active sessions
    ipcMain.handle(
        'terminal:getSessions',
        createSafeIpcHandler(
            'terminal:getSessions',
            async () => {
                return terminalService.getActiveSessions();
            },
            []
        )
    );

    // Read session buffer
    ipcMain.handle(
        'terminal:readBuffer',
        createSafeIpcHandler(
            'terminal:readBuffer',
            async (_event: IpcMainInvokeEvent, sessionIdRaw: unknown) => {
                const sessionId = assertValidSessionId(sessionIdRaw);
                return terminalService.getSessionBuffer(sessionId);
            },
            ''
        )
    );

    // Command history
    ipcMain.handle(
        'terminal:getCommandHistory',
        createSafeIpcHandler(
            'terminal:getCommandHistory',
            async (_event: IpcMainInvokeEvent, queryRaw: unknown, limitRaw: unknown) => {
                const query = parseHistoryQuery(queryRaw);
                const limit = parseHistoryLimit(limitRaw);
                return terminalService.getCommandHistory(query, limit);
            },
            []
        )
    );

    ipcMain.handle(
        'terminal:clearCommandHistory',
        createSafeIpcHandler(
            'terminal:clearCommandHistory',
            async () => {
                return terminalService.clearCommandHistory();
            },
            false
        )
    );

    // Smart Suggestions
    ipcMain.handle(
        'terminal:getSuggestions',
        createSafeIpcHandler(
            'terminal:getSuggestions',
            async (_event: IpcMainInvokeEvent, options: SuggestionOptions) => {
                return smartService.getSuggestions(options);
            },
            []
        )
    );

    // AI Command Explanation
    ipcMain.handle(
        'terminal:explainCommand',
        createSafeIpcHandler(
            'terminal:explainCommand',
            async (_event: IpcMainInvokeEvent, options: ExplainCommandOptions) => {
                return withRateLimit('terminal', async () => smartService.explainCommand(options));
            },
            { explanation: 'Service unavailable', breakdown: [] }
        )
    );

    // AI Error Explanation
    ipcMain.handle(
        'terminal:explainError',
        createSafeIpcHandler(
            'terminal:explainError',
            async (_event: IpcMainInvokeEvent, options: ExplainErrorOptions) => {
                return withRateLimit('terminal', async () => smartService.explainError(options));
            },
            { summary: 'Service unavailable', cause: 'Unknown', solution: 'Please try again later' }
        )
    );

    // AI Error Fix Suggestion
    ipcMain.handle(
        'terminal:fixError',
        createSafeIpcHandler(
            'terminal:fixError',
            async (_event: IpcMainInvokeEvent, options: FixErrorOptions) => {
                return withRateLimit('terminal', async () => smartService.fixError(options));
            },
            { suggestedCommand: '', explanation: 'Service unavailable', confidence: 'low' as const }
        )
    );

    ipcMain.handle(
        'terminal:getDockerContainers',
        createSafeIpcHandler(
            'terminal:getDockerContainers',
            async () => {
                return dockerService.listContainers();
            },
            { success: false, containers: [] }
        )
    );
}
