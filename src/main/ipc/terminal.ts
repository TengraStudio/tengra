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
    title?: string;
    metadata?: Record<string, unknown>;
}

interface TerminalSearchOptions {
    regex?: boolean;
    caseSensitive?: boolean;
    limit?: number;
}

interface TerminalScrollbackFilterPayload {
    query?: string;
    fromLine?: number;
    toLine?: number;
    caseSensitive?: boolean;
}

interface TerminalImportSessionOptions {
    overwrite?: boolean;
    sessionId?: string;
}

interface TerminalTemplateSavePayload {
    sessionId?: string;
    templateId?: string;
    name?: string;
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
    if (typeof raw.title === 'string') {
        const title = raw.title.trim();
        if (title) {
            options.title = title.slice(0, 120);
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

function parseSearchOptions(value: unknown): TerminalSearchOptions {
    if (!value || typeof value !== 'object') {
        return {};
    }
    const raw = value as Record<string, unknown>;
    const limitRaw = Number(raw.limit);
    return {
        regex: raw.regex === true,
        caseSensitive: raw.caseSensitive === true,
        limit: Number.isInteger(limitRaw) ? Math.max(1, Math.min(limitRaw, 1000)) : undefined,
    };
}

function parseScrollbackFilterPayload(value: unknown): TerminalScrollbackFilterPayload {
    if (!value || typeof value !== 'object') {
        return {};
    }
    const raw = value as Record<string, unknown>;
    return {
        query: typeof raw.query === 'string' ? raw.query : undefined,
        fromLine: Number.isInteger(Number(raw.fromLine)) ? Number(raw.fromLine) : undefined,
        toLine: Number.isInteger(Number(raw.toLine)) ? Number(raw.toLine) : undefined,
        caseSensitive: raw.caseSensitive === true,
    };
}

function parseImportSessionOptions(value: unknown): TerminalImportSessionOptions {
    if (!value || typeof value !== 'object') {
        return {};
    }
    const raw = value as Record<string, unknown>;
    return {
        overwrite: raw.overwrite === true,
        sessionId: typeof raw.sessionId === 'string' ? raw.sessionId.trim() : undefined,
    };
}

function parseTemplateSavePayload(value: unknown): TerminalTemplateSavePayload {
    if (!value || typeof value !== 'object') {
        return {};
    }
    const raw = value as Record<string, unknown>;
    return {
        sessionId: typeof raw.sessionId === 'string' ? raw.sessionId.trim() : undefined,
        templateId: typeof raw.templateId === 'string' ? raw.templateId.trim() : undefined,
        name: typeof raw.name === 'string' ? raw.name.trim() : undefined,
    };
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

    ipcMain.handle(
        'terminal:validateProfile',
        createSafeIpcHandler(
            'terminal:validateProfile',
            async (_event, profile: TerminalProfile) => {
                return profileService.validateProfile(profile);
            },
            { valid: false, errors: ['validation failed'] }
        )
    );

    ipcMain.handle(
        'terminal:getProfileTemplates',
        createSafeIpcHandler(
            'terminal:getProfileTemplates',
            async () => {
                return profileService.getProfileTemplates();
            },
            []
        )
    );

    ipcMain.handle(
        'terminal:exportProfiles',
        createSafeIpcHandler(
            'terminal:exportProfiles',
            async () => {
                return profileService.exportProfiles();
            },
            ''
        )
    );

    ipcMain.handle(
        'terminal:exportProfileShareCode',
        createSafeIpcHandler(
            'terminal:exportProfileShareCode',
            async (_event, profileIdRaw: unknown) => {
                if (typeof profileIdRaw !== 'string' || profileIdRaw.trim().length === 0) {
                    throw new Error('profileId is required');
                }
                return profileService.exportProfileShareCode(profileIdRaw.trim());
            },
            null
        )
    );

    ipcMain.handle(
        'terminal:importProfileShareCode',
        createSafeIpcHandler(
            'terminal:importProfileShareCode',
            async (_event, shareCodeRaw: unknown, optionsRaw?: unknown) => {
                const shareCode = typeof shareCodeRaw === 'string' ? shareCodeRaw : '';
                const options =
                    optionsRaw && typeof optionsRaw === 'object'
                        ? { overwrite: (optionsRaw as Record<string, unknown>).overwrite === true }
                        : undefined;
                return profileService.importProfileShareCode(shareCode, options);
            },
            { success: false, imported: false, error: 'import failed' }
        )
    );

    ipcMain.handle(
        'terminal:importProfiles',
        createSafeIpcHandler(
            'terminal:importProfiles',
            async (_event, payload: string, options?: { overwrite?: boolean }) => {
                return profileService.importProfiles(payload, options);
            },
            { success: false, imported: 0, skipped: 0, errors: ['import failed'] }
        )
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

    ipcMain.handle(
        'terminal:getSnapshotSessions',
        createSafeIpcHandler(
            'terminal:getSnapshotSessions',
            async () => {
                return terminalService.getSessionSnapshots();
            },
            []
        )
    );

    ipcMain.handle(
        'terminal:exportSession',
        createSafeIpcHandler(
            'terminal:exportSession',
            async (_event: IpcMainInvokeEvent, sessionIdRaw: unknown, optionsRaw?: unknown) => {
                const sessionId = assertValidSessionId(sessionIdRaw);
                const includeScrollback =
                    optionsRaw && typeof optionsRaw === 'object'
                        ? (optionsRaw as Record<string, unknown>).includeScrollback === true
                        : false;
                return terminalService.exportSession(sessionId, { includeScrollback });
            },
            null
        )
    );

    ipcMain.handle(
        'terminal:importSession',
        createSafeIpcHandler(
            'terminal:importSession',
            async (_event: IpcMainInvokeEvent, payloadRaw: unknown, optionsRaw?: unknown) => {
                const payload = typeof payloadRaw === 'string' ? payloadRaw : '';
                const options = parseImportSessionOptions(optionsRaw);
                return terminalService.importSession(payload, options);
            },
            { success: false, error: 'import failed' }
        )
    );

    ipcMain.handle(
        'terminal:createSessionShareCode',
        createSafeIpcHandler(
            'terminal:createSessionShareCode',
            async (_event: IpcMainInvokeEvent, sessionIdRaw: unknown, optionsRaw?: unknown) => {
                const sessionId = assertValidSessionId(sessionIdRaw);
                const includeScrollback =
                    optionsRaw && typeof optionsRaw === 'object'
                        ? (optionsRaw as Record<string, unknown>).includeScrollback === true
                        : false;
                return terminalService.generateSessionShareCode(sessionId, { includeScrollback });
            },
            null
        )
    );

    ipcMain.handle(
        'terminal:importSessionShareCode',
        createSafeIpcHandler(
            'terminal:importSessionShareCode',
            async (_event: IpcMainInvokeEvent, shareCodeRaw: unknown, optionsRaw?: unknown) => {
                const shareCode = typeof shareCodeRaw === 'string' ? shareCodeRaw : '';
                const options = parseImportSessionOptions(optionsRaw);
                return terminalService.importSessionShareCode(shareCode, options);
            },
            { success: false, error: 'import failed' }
        )
    );

    ipcMain.handle(
        'terminal:getSessionTemplates',
        createSafeIpcHandler(
            'terminal:getSessionTemplates',
            async () => {
                return terminalService.getSessionTemplates();
            },
            []
        )
    );

    ipcMain.handle(
        'terminal:saveSessionTemplate',
        createSafeIpcHandler(
            'terminal:saveSessionTemplate',
            async (_event: IpcMainInvokeEvent, payloadRaw: unknown) => {
                const payload = parseTemplateSavePayload(payloadRaw);
                if (!payload.sessionId) {
                    throw new Error('sessionId is required');
                }
                return terminalService.createSessionTemplate(payload.sessionId, {
                    templateId: payload.templateId,
                    name: payload.name,
                });
            },
            null
        )
    );

    ipcMain.handle(
        'terminal:deleteSessionTemplate',
        createSafeIpcHandler(
            'terminal:deleteSessionTemplate',
            async (_event: IpcMainInvokeEvent, templateIdRaw: unknown) => {
                if (typeof templateIdRaw !== 'string' || templateIdRaw.trim().length === 0) {
                    throw new Error('templateId is required');
                }
                return terminalService.deleteSessionTemplate(templateIdRaw.trim());
            },
            false
        )
    );

    ipcMain.handle(
        'terminal:createFromSessionTemplate',
        createSafeIpcHandler(
            'terminal:createFromSessionTemplate',
            async (
                _event: IpcMainInvokeEvent,
                templateIdRaw: unknown,
                optionsRaw?: unknown
            ) => {
                if (typeof templateIdRaw !== 'string' || templateIdRaw.trim().length === 0) {
                    throw new Error('templateId is required');
                }
                const options =
                    optionsRaw && typeof optionsRaw === 'object'
                        ? (optionsRaw as Record<string, unknown>)
                        : {};
                const requestedSessionIdRaw =
                    typeof options.sessionId === 'string' ? options.sessionId.trim() : undefined;
                const requestedSessionId =
                    requestedSessionIdRaw && requestedSessionIdRaw.length > 0
                        ? requestedSessionIdRaw
                        : buildSessionId();
                const title = typeof options.title === 'string' ? options.title.trim() : undefined;
                let activeSessionId = requestedSessionId;
                const createdSessionId = await terminalService.restoreSessionTemplate(templateIdRaw.trim(), {
                    sessionId: requestedSessionId,
                    title,
                    onData: (data: string) => {
                        const id = activeSessionId;
                        if (id.trim().length > 0) {
                            broadcastTerminalEvent(getWindow, 'terminal:data', { id, data });
                            broadcastTerminalEvent(getWindow, `terminal:data:${id}`, data);
                        }
                    },
                    onExit: (code: number) => {
                        const id = activeSessionId;
                        if (id.trim().length > 0) {
                            broadcastTerminalEvent(getWindow, 'terminal:exit', { id, code });
                        }
                    },
                });
                activeSessionId = createdSessionId ?? activeSessionId;
                return createdSessionId;
            },
            null
        )
    );

    ipcMain.handle(
        'terminal:restoreAllSnapshots',
        createSafeIpcHandler(
            'terminal:restoreAllSnapshots',
            async () => {
                return terminalService.restoreAllSnapshots({
                    onData: (sessionId: string, data: string) => {
                        broadcastTerminalEvent(getWindow, 'terminal:data', { id: sessionId, data });
                        broadcastTerminalEvent(getWindow, `terminal:data:${sessionId}`, data);
                    },
                    onExit: (sessionId: string, code: number) => {
                        broadcastTerminalEvent(getWindow, 'terminal:exit', { id: sessionId, code });
                    },
                });
            },
            { restored: 0, failed: 0, sessionIds: [] }
        )
    );

    ipcMain.handle(
        'terminal:restoreSnapshotSession',
        createSafeIpcHandler(
            'terminal:restoreSnapshotSession',
            async (_event: IpcMainInvokeEvent, snapshotIdRaw: unknown) => {
                const snapshotId = assertValidSessionId(snapshotIdRaw);
                return terminalService.restoreSnapshotSession({
                    snapshotId,
                    onData: (data: string) => {
                        broadcastTerminalEvent(getWindow, 'terminal:data', { id: snapshotId, data });
                        broadcastTerminalEvent(getWindow, `terminal:data:${snapshotId}`, data);
                    },
                    onExit: (code: number) => {
                        broadcastTerminalEvent(getWindow, 'terminal:exit', { id: snapshotId, code });
                    },
                });
            },
            false
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

    ipcMain.handle(
        'terminal:setSessionTitle',
        createSafeIpcHandler(
            'terminal:setSessionTitle',
            async (_event: IpcMainInvokeEvent, sessionIdRaw: unknown, titleRaw: unknown) => {
                const sessionId = assertValidSessionId(sessionIdRaw);
                const title = typeof titleRaw === 'string' ? titleRaw : '';
                return terminalService.setSessionTitle(sessionId, title);
            },
            false
        )
    );

    ipcMain.handle(
        'terminal:searchScrollback',
        createSafeIpcHandler(
            'terminal:searchScrollback',
            async (
                _event: IpcMainInvokeEvent,
                sessionIdRaw: unknown,
                queryRaw: unknown,
                optionsRaw: unknown
            ) => {
                const sessionId = assertValidSessionId(sessionIdRaw);
                const query = typeof queryRaw === 'string' ? queryRaw : '';
                const options = parseSearchOptions(optionsRaw);
                return terminalService.searchSessionScrollback(sessionId, query, options);
            },
            []
        )
    );

    ipcMain.handle(
        'terminal:exportScrollback',
        createSafeIpcHandler(
            'terminal:exportScrollback',
            async (
                _event: IpcMainInvokeEvent,
                sessionIdRaw: unknown,
                exportPathRaw?: unknown
            ) => {
                const sessionId = assertValidSessionId(sessionIdRaw);
                const exportPath = typeof exportPathRaw === 'string' ? exportPathRaw : undefined;
                return terminalService.exportSessionScrollback(sessionId, exportPath);
            },
            { success: false, error: 'export failed' }
        )
    );

    ipcMain.handle(
        'terminal:getSessionAnalytics',
        createSafeIpcHandler(
            'terminal:getSessionAnalytics',
            async (_event: IpcMainInvokeEvent, sessionIdRaw: unknown) => {
                const sessionId = assertValidSessionId(sessionIdRaw);
                return terminalService.getSessionAnalytics(sessionId);
            },
            { sessionId: '', bytes: 0, lineCount: 0, commandCount: 0, updatedAt: 0 }
        )
    );

    ipcMain.handle(
        'terminal:getSearchAnalytics',
        createSafeIpcHandler(
            'terminal:getSearchAnalytics',
            async () => {
                return terminalService.getSearchAnalytics();
            },
            { totalSearches: 0, regexSearches: 0, plainSearches: 0, lastSearchAt: 0 }
        )
    );

    ipcMain.handle(
        'terminal:getSearchSuggestions',
        createSafeIpcHandler(
            'terminal:getSearchSuggestions',
            async (_event: IpcMainInvokeEvent, queryRaw?: unknown, limitRaw?: unknown) => {
                const query = typeof queryRaw === 'string' ? queryRaw : '';
                const limit = Number.isInteger(Number(limitRaw)) ? Number(limitRaw) : 10;
                return terminalService.getSearchSuggestions(query, limit);
            },
            []
        )
    );

    ipcMain.handle(
        'terminal:exportSearchResults',
        createSafeIpcHandler(
            'terminal:exportSearchResults',
            async (
                _event: IpcMainInvokeEvent,
                sessionIdRaw: unknown,
                queryRaw: unknown,
                optionsRaw?: unknown,
                exportPathRaw?: unknown,
                formatRaw?: unknown
            ) => {
                const sessionId = assertValidSessionId(sessionIdRaw);
                const query = typeof queryRaw === 'string' ? queryRaw : '';
                const options = parseSearchOptions(optionsRaw);
                const exportPath = typeof exportPathRaw === 'string' ? exportPathRaw : undefined;
                const format = formatRaw === 'txt' ? 'txt' : 'json';
                return terminalService.exportSearchResults(
                    sessionId,
                    query,
                    options,
                    exportPath,
                    format
                );
            },
            { success: false, error: 'export failed' }
        )
    );

    ipcMain.handle(
        'terminal:addScrollbackMarker',
        createSafeIpcHandler(
            'terminal:addScrollbackMarker',
            async (_event: IpcMainInvokeEvent, sessionIdRaw: unknown, labelRaw: unknown, lineNumberRaw?: unknown) => {
                const sessionId = assertValidSessionId(sessionIdRaw);
                const label = typeof labelRaw === 'string' ? labelRaw : '';
                const lineNumber = Number.isInteger(Number(lineNumberRaw)) ? Number(lineNumberRaw) : undefined;
                return terminalService.addScrollbackMarker(sessionId, label, lineNumber);
            },
            null
        )
    );

    ipcMain.handle(
        'terminal:listScrollbackMarkers',
        createSafeIpcHandler(
            'terminal:listScrollbackMarkers',
            async (_event: IpcMainInvokeEvent, sessionIdRaw?: unknown) => {
                const sessionId =
                    typeof sessionIdRaw === 'string' && sessionIdRaw.trim().length > 0
                        ? assertValidSessionId(sessionIdRaw)
                        : undefined;
                return terminalService.listScrollbackMarkers(sessionId);
            },
            []
        )
    );

    ipcMain.handle(
        'terminal:deleteScrollbackMarker',
        createSafeIpcHandler(
            'terminal:deleteScrollbackMarker',
            async (_event: IpcMainInvokeEvent, markerIdRaw: unknown) => {
                if (typeof markerIdRaw !== 'string' || markerIdRaw.trim().length === 0) {
                    throw new Error('markerId is required');
                }
                return terminalService.deleteScrollbackMarker(markerIdRaw.trim());
            },
            false
        )
    );

    ipcMain.handle(
        'terminal:filterScrollback',
        createSafeIpcHandler(
            'terminal:filterScrollback',
            async (_event: IpcMainInvokeEvent, sessionIdRaw: unknown, optionsRaw: unknown) => {
                const sessionId = assertValidSessionId(sessionIdRaw);
                const options = parseScrollbackFilterPayload(optionsRaw);
                return terminalService.filterSessionScrollback(sessionId, options);
            },
            []
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
