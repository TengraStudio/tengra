import { randomUUID } from 'crypto';

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import {
    TerminalProfile,
    TerminalProfileService,
} from '@main/services/terminal/terminal-profile.service';
import { DockerService } from '@main/services/workspace/docker.service';
import { TerminalService } from '@main/services/workspace/terminal.service';
import {
    ExplainCommandOptions,
    ExplainErrorOptions,
    FixErrorOptions,
    SuggestionOptions,
    TerminalSmartService,
} from '@main/services/workspace/terminal-smart.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import {
    terminalGetBackendsResponseSchema,
    terminalGetDiscoverySnapshotArgsSchema,
    terminalGetDiscoverySnapshotResponseSchema,
    terminalGetShellsResponseSchema,
} from '@shared/schemas/terminal.schema';
import { getErrorMessage } from '@shared/utils/error.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';

const MAX_COLS = 500;
const MAX_ROWS = 200;
const MAX_WRITE_SIZE = 1024 * 1024; // 1MB
const MAX_SESSION_ID_LENGTH = 128;
const SESSION_ID_PATTERN = /^[\w.:-]+$/;
const TERMINAL_BATCH_INTERVAL_MS = 50;

// --- Schemas ---

const sessionIdSchema = z.string().trim().min(1).max(MAX_SESSION_ID_LENGTH).regex(SESSION_ID_PATTERN);

const terminalProfileSchema = z.object({
    id: z.string().max(128),
    name: z.string().max(128),
    shell: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string().optional()).optional(),
    icon: z.string().optional(),
    isDefault: z.boolean().optional()
}).passthrough();

const createOptionsSchema = z.object({
    id: sessionIdSchema.optional(),
    shell: z.string().trim().optional(),
    cwd: z.string().trim().optional(),
    cols: z.number().int().min(1).max(MAX_COLS).optional(),
    rows: z.number().int().min(1).max(MAX_ROWS).optional(),
    backendId: z.string().trim().optional(),
    workspaceId: z.string().optional(),
    title: z.string().trim().max(120).optional(),
    metadata: z.record(z.string(), z.custom<RuntimeValue>(() => true)).optional()
}).optional();

const searchOptionsSchema = z.object({
    regex: z.boolean().optional(),
    caseSensitive: z.boolean().optional(),
    limit: z.number().int().min(1).max(1000).optional()
}).optional();

const searchQuerySchema = z.string().trim().min(1).max(500);

const exportSearchOptionsSchema = z.object({
    regex: z.boolean().optional(),
    caseSensitive: z.boolean().optional(),
    limit: z.number().int().min(1).max(1000).optional(),
    exportPath: z.string().optional(),
    format: z.string().optional()
}).optional();

const scrollbackFilterSchema = z.object({
    query: z.string().optional(),
    fromLine: z.number().int().optional(),
    toLine: z.number().int().optional(),
    caseSensitive: z.boolean().optional()
});

const importSessionOptionsSchema = z.object({
    overwrite: z.boolean().optional(),
    sessionId: sessionIdSchema.optional()
}).optional();

const templateSavePayloadSchema = z.object({
    sessionId: sessionIdSchema.optional(),
    templateId: z.string().trim().optional(),
    name: z.string().trim().optional()
});

const suggestionOptionsSchema = z.object({
    command: z.string(),
    shell: z.string(),
    cwd: z.string(),
    historyLimit: z.number().int().optional()
});

const explainCommandOptionsSchema = z.object({
    command: z.string(),
    shell: z.string(),
    cwd: z.string().optional()
});

const explainErrorOptionsSchema = z.object({
    errorOutput: z.string(),
    command: z.string().optional(),
    shell: z.string(),
    cwd: z.string().optional()
});

const fixErrorOptionsSchema = z.object({
    errorOutput: z.string(),
    command: z.string(),
    shell: z.string(),
    cwd: z.string().optional()
});

// --- Types ---
type CreateOptions = z.infer<typeof createOptionsSchema>;
type TerminalCreateOptions = NonNullable<CreateOptions>;
type SearchOptions = z.infer<typeof searchOptionsSchema>;
type ScrollbackFilter = z.infer<typeof scrollbackFilterSchema>;
type ImportSessionOptions = z.infer<typeof importSessionOptionsSchema>;
type TemplateSavePayload = z.infer<typeof templateSavePayloadSchema>;

function normalizeTerminalMetadata(
    metadata: TerminalCreateOptions['metadata']
): Record<string, RuntimeValue> | undefined {
    if (!metadata) {
        return undefined;
    }

    const normalized: Record<string, RuntimeValue> = {};
    for (const [key, value] of Object.entries(metadata)) {
        if (
            value === null ||
            value === undefined ||
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean' ||
            typeof value === 'bigint' ||
            typeof value === 'symbol' ||
            typeof value === 'object'
        ) {
            normalized[key] = value;
        }
    }
    return normalized;
}

// --- Helpers ---
let terminalWindowGetter: (() => BrowserWindow | null) | null = null;
const terminalDataBuffers = new Map<string, string[]>();
const terminalFlushTimers = new Map<string, NodeJS.Timeout>();

function secureHandle<Args extends readonly RuntimeValue[], Result extends RuntimeValue>(
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<Result>
): void {
    ipcMain.handle(channel, async (event, ...args: Args) => {
        const getWindow = terminalWindowGetter;
        if (!getWindow) {
            throw new Error('Terminal window getter not initialized');
        }
        const validateSender = createMainWindowSenderValidator(getWindow, 'terminal operation');
        validateSender(event);

        const startTime = Date.now();
        try {
            const result = await handler(event, ...args);
            appLogger.debug('Terminal', `[${channel}] Success in ${Date.now() - startTime}ms`);
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            appLogger.error('Terminal', `[${channel}] Failed in ${duration}ms: ${getErrorMessage(error as Error)}`);
            throw error;
        }
    });
}

function broadcastTerminalEvent(
    getWindow: () => BrowserWindow | null,
    channel: string,
    payload: RuntimeValue
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

function flushTerminalData(sessionId: string): void {
    const chunks = terminalDataBuffers.get(sessionId);
    terminalDataBuffers.delete(sessionId);

    const timer = terminalFlushTimers.get(sessionId);
    if (timer) {
        clearTimeout(timer);
        terminalFlushTimers.delete(sessionId);
    }

    if (!chunks || chunks.length === 0) {
        return;
    }

    const payload = chunks.join('');
    const getWindow = terminalWindowGetter;
    if (!getWindow) {
        return;
    }

    broadcastTerminalEvent(getWindow, 'terminal:data', { id: sessionId, data: payload });
    broadcastTerminalEvent(getWindow, `terminal:data:${sessionId}`, payload);
}

function queueTerminalData(sessionId: string, data: string): void {
    const existing = terminalDataBuffers.get(sessionId);
    if (existing) {
        existing.push(data);
    } else {
        terminalDataBuffers.set(sessionId, [data]);
    }

    if (!terminalFlushTimers.has(sessionId)) {
        const timer = setTimeout(() => flushTerminalData(sessionId), TERMINAL_BATCH_INTERVAL_MS);
        terminalFlushTimers.set(sessionId, timer);
    }
}

function buildSessionId(): string {
    return `term-${randomUUID()}`;
}

// --- Registration Functions ---

function registerProfileIpc(profileService: TerminalProfileService) {
    secureHandle(
        'terminal:getProfiles',
        createValidatedIpcHandler(
            'terminal:getProfiles',
            async () => {
                return profileService.getProfiles();
            },
            { defaultValue: [] }
        )
    );

    secureHandle(
        'terminal:saveProfile',
        createValidatedIpcHandler(
            'terminal:saveProfile',
            async (_event, profile: TerminalProfile) => {
                return profileService.saveProfile(profile);
            },
            {
                defaultValue: undefined,
                argsSchema: z.tuple([terminalProfileSchema])
            }
        )
    );

    secureHandle(
        'terminal:deleteProfile',
        createValidatedIpcHandler(
            'terminal:deleteProfile',
            async (_event, id: string) => {
                return profileService.deleteProfile(id);
            },
            {
                defaultValue: undefined,
                argsSchema: z.tuple([z.string()])
            }
        )
    );

    secureHandle(
        'terminal:validateProfile',
        createValidatedIpcHandler(
            'terminal:validateProfile',
            async (_event, profile: TerminalProfile) => {
                return profileService.validateProfile(profile);
            },
            {
                defaultValue: { valid: false, errors: ['validation failed'] },
                argsSchema: z.tuple([terminalProfileSchema])
            }
        )
    );

    secureHandle(
        'terminal:getProfileTemplates',
        createValidatedIpcHandler(
            'terminal:getProfileTemplates',
            async () => {
                return profileService.getProfileTemplates();
            },
            { defaultValue: [] }
        )
    );

    secureHandle(
        'terminal:exportProfiles',
        createValidatedIpcHandler(
            'terminal:exportProfiles',
            async () => {
                return profileService.exportProfiles();
            },
            { defaultValue: '' }
        )
    );

    secureHandle(
        'terminal:exportProfileShareCode',
        createValidatedIpcHandler(
            'terminal:exportProfileShareCode',
            async (_event, profileId: string) => {
                return profileService.exportProfileShareCode(profileId);
            },
            {
                defaultValue: null,
                argsSchema: z.tuple([z.string().min(1, 'profileId is required')])
            }
        )
    );

    secureHandle(
        'terminal:importProfileShareCode',
        createValidatedIpcHandler(
            'terminal:importProfileShareCode',
            async (_event, shareCode: string, options?: { overwrite?: boolean }) => {
                return profileService.importProfileShareCode(shareCode, options);
            },
            {
                defaultValue: { success: false, imported: false, error: 'import failed' },
                argsSchema: z.tuple([
                    z.string(),
                    z.object({ overwrite: z.boolean().optional() }).optional()
                ])
            }
        )
    );

    secureHandle(
        'terminal:importProfiles',
        createValidatedIpcHandler(
            'terminal:importProfiles',
            async (_event, payload: string, options?: { overwrite?: boolean }) => {
                return profileService.importProfiles(payload, options);
            },
            {
                defaultValue: { success: false, imported: 0, skipped: 0, errors: ['import failed'] },
                argsSchema: z.tuple([
                    z.string(),
                    z.object({ overwrite: z.boolean().optional() }).optional()
                ])
            }
        )
    );
}

function registerSessionLifecycleIpc(getWindow: () => BrowserWindow | null, terminalService: TerminalService) {
    // Create session
    secureHandle(
        'terminal:create',
        createValidatedIpcHandler(
            'terminal:create',
            async (_event, optionsRaw?: CreateOptions) => {
                const options = optionsRaw ?? {};
                const sessionId = options.id ?? buildSessionId();

                appLogger.info('ipc', `terminal:create called for session ${sessionId}`);

                const success = await terminalService.createSession({
                    ...options,
                    id: sessionId,
                    metadata: normalizeTerminalMetadata(options.metadata),
                    onData: (data: string) => {
                        queueTerminalData(sessionId, data);
                    },
                    onExit: (code: number) => {
                        flushTerminalData(sessionId);
                        broadcastTerminalEvent(getWindow, 'terminal:exit', { id: sessionId, code });
                    },
                });
                return success ? sessionId : null;
            },
            {
                defaultValue: null,
                argsSchema: z.tuple([createOptionsSchema])
            }
        )
    );

    // Close session
    secureHandle(
        'terminal:close',
        createValidatedIpcHandler(
            'terminal:close',
            async (_event, sessionId: string) => {
                return terminalService.kill(sessionId);
            },
            {
                defaultValue: false,
                argsSchema: z.tuple([sessionIdSchema])
            }
        )
    );

    // Kill session
    secureHandle(
        'terminal:kill',
        createValidatedIpcHandler(
            'terminal:kill',
            async (_event, sessionId: string) => {
                return terminalService.kill(sessionId);
            },
            {
                defaultValue: false,
                argsSchema: z.tuple([sessionIdSchema])
            }
        )
    );

    // Get active sessions
    secureHandle(
        'terminal:getSessions',
        createValidatedIpcHandler(
            'terminal:getSessions',
            async () => {
                return terminalService.getActiveSessions();
            },
            { defaultValue: [] }
        )
    );

    secureHandle(
        'terminal:getSnapshotSessions',
        createValidatedIpcHandler(
            'terminal:getSnapshotSessions',
            async () => {
                return terminalService.getSessionSnapshots();
            },
            { defaultValue: [] }
        )
    );

    secureHandle(
        'terminal:restoreSnapshotSession',
        createValidatedIpcHandler(
            'terminal:restoreSnapshotSession',
            async (_event, snapshotId: string) => {
                return terminalService.restoreSnapshotSession({
                    snapshotId,
                    onData: (data: string) => {
                        queueTerminalData(snapshotId, data);
                    },
                    onExit: (code: number) => {
                        flushTerminalData(snapshotId);
                        broadcastTerminalEvent(getWindow, 'terminal:exit', { id: snapshotId, code });
                    },
                });
            },
            {
                defaultValue: false,
                argsSchema: z.tuple([sessionIdSchema])
            }
        )
    );
}

function registerSessionIOIpc(terminalService: TerminalService) {
    // Write to session
    secureHandle(
        'terminal:write',
        createValidatedIpcHandler(
            'terminal:write',
            async (_event, sessionId: string, data: string) => {
                return withRateLimit('terminal', async () =>
                    terminalService.write(sessionId, data)
                );
            },
            {
                defaultValue: false,
                argsSchema: z.tuple([
                    sessionIdSchema,
                    z.string().max(MAX_WRITE_SIZE, 'Data exceeds maximum size of 1MB')
                ])
            }
        )
    );

    // Resize session
    secureHandle(
        'terminal:resize',
        createValidatedIpcHandler(
            'terminal:resize',
            async (
                _event,
                sessionId: string,
                cols: number,
                rows: number
            ) => {
                return terminalService.resize(sessionId, cols, rows);
            },
            {
                defaultValue: false,
                argsSchema: z.tuple([
                    sessionIdSchema,
                    z.number().int().min(1).max(MAX_COLS),
                    z.number().int().min(1).max(MAX_ROWS)
                ])
            }
        )
    );

    // Read session buffer
    secureHandle(
        'terminal:readBuffer',
        createValidatedIpcHandler(
            'terminal:readBuffer',
            async (_event, sessionId: string) => {
                return terminalService.getSessionBuffer(sessionId);
            },
            {
                defaultValue: '',
                argsSchema: z.tuple([sessionIdSchema])
            }
        )
    );

    secureHandle(
        'terminal:setSessionTitle',
        createValidatedIpcHandler(
            'terminal:setSessionTitle',
            async (_event, sessionId: string, title: string) => {
                return terminalService.setSessionTitle(sessionId, title);
            },
            {
                defaultValue: false,
                argsSchema: z.tuple([sessionIdSchema, z.string()])
            }
        )
    );
}

function registerSessionExportIpc(terminalService: TerminalService) {
    secureHandle(
        'terminal:exportSession',
        createValidatedIpcHandler(
            'terminal:exportSession',
            async (_event, sessionId: string, options?: { includeScrollback?: boolean }) => {
                const includeScrollback = options?.includeScrollback ?? false;
                return terminalService.exportSession(sessionId, { includeScrollback });
            },
            {
                defaultValue: null,
                argsSchema: z.tuple([
                    sessionIdSchema,
                    z.object({ includeScrollback: z.boolean().optional() }).optional()
                ])
            }
        )
    );

    secureHandle(
        'terminal:importSession',
        createValidatedIpcHandler(
            'terminal:importSession',
            async (_event, payload: string, options?: ImportSessionOptions) => {
                return terminalService.importSession(payload, options);
            },
            {
                defaultValue: { success: false, error: 'import failed' },
                argsSchema: z.tuple([
                    z.string(),
                    importSessionOptionsSchema
                ])
            }
        )
    );

    secureHandle(
        'terminal:createSessionShareCode',
        createValidatedIpcHandler(
            'terminal:createSessionShareCode',
            async (_event, sessionId: string, options?: { includeScrollback?: boolean }) => {
                const includeScrollback = options?.includeScrollback ?? false;
                return terminalService.generateSessionShareCode(sessionId, { includeScrollback });
            },
            {
                defaultValue: null,
                argsSchema: z.tuple([
                    sessionIdSchema,
                    z.object({ includeScrollback: z.boolean().optional() }).optional()
                ])
            }
        )
    );

    secureHandle(
        'terminal:importSessionShareCode',
        createValidatedIpcHandler(
            'terminal:importSessionShareCode',
            async (_event, shareCode: string, options?: ImportSessionOptions) => {
                return terminalService.importSessionShareCode(shareCode, options);
            },
            {
                defaultValue: { success: false, error: 'import failed' },
                argsSchema: z.tuple([
                    z.string(),
                    importSessionOptionsSchema
                ])
            }
        )
    );

    secureHandle(
        'terminal:exportScrollback',
        createValidatedIpcHandler(
            'terminal:exportScrollback',
            async (
                _event,
                sessionId: string,
                exportPath?: string
            ) => {
                return terminalService.exportSessionScrollback(sessionId, exportPath);
            },
            {
                defaultValue: { success: false, error: 'export failed' },
                argsSchema: z.tuple([
                    sessionIdSchema,
                    z.string().optional()
                ])
            }
        )
    );
}

function registerSessionTemplateIpc(getWindow: () => BrowserWindow | null, terminalService: TerminalService) {
    secureHandle(
        'terminal:getSessionTemplates',
        createValidatedIpcHandler(
            'terminal:getSessionTemplates',
            async () => {
                return terminalService.getSessionTemplates();
            },
            { defaultValue: [] }
        )
    );

    secureHandle(
        'terminal:saveSessionTemplate',
        createValidatedIpcHandler(
            'terminal:saveSessionTemplate',
            async (_event, payload: TemplateSavePayload) => {
                if (!payload.sessionId) {
                    throw new Error('sessionId is required');
                }
                return terminalService.createSessionTemplate(payload.sessionId, {
                    templateId: payload.templateId,
                    name: payload.name,
                });
            },
            {
                defaultValue: null,
                argsSchema: z.tuple([templateSavePayloadSchema])
            }
        )
    );

    secureHandle(
        'terminal:deleteSessionTemplate',
        createValidatedIpcHandler(
            'terminal:deleteSessionTemplate',
            async (_event, templateId: string) => {
                return terminalService.deleteSessionTemplate(templateId.trim());
            },
            {
                defaultValue: false,
                argsSchema: z.tuple([z.string().min(1, 'templateId is required')])
            }
        )
    );

    secureHandle(
        'terminal:createFromSessionTemplate',
        createValidatedIpcHandler(
            'terminal:createFromSessionTemplate',
            async (
                _event,
                templateId: string,
                optionsRaw?: { sessionId?: string; title?: string }
            ) => {
                const options = optionsRaw ?? {};
                const requestedSessionIdRaw = options.sessionId?.trim();
                const requestedSessionId =
                    requestedSessionIdRaw && requestedSessionIdRaw.length > 0
                        ? requestedSessionIdRaw
                        : buildSessionId();
                const title = options.title?.trim();
                let activeSessionId = requestedSessionId;
                const createdSessionId = await terminalService.restoreSessionTemplate(templateId.trim(), {
                    sessionId: requestedSessionId,
                    title,
                    onData: (data: string) => {
                        const id = activeSessionId;
                        if (id.trim().length > 0) {
                            queueTerminalData(id, data);
                        }
                    },
                    onExit: (code: number) => {
                        const id = activeSessionId;
                        if (id.trim().length > 0) {
                            flushTerminalData(id);
                            broadcastTerminalEvent(getWindow, 'terminal:exit', { id, code });
                        }
                    },
                });
                activeSessionId = createdSessionId ?? activeSessionId;
                return createdSessionId;
            },
            {
                defaultValue: null,
                argsSchema: z.tuple([
                    z.string().min(1, 'templateId is required'),
                    z.object({
                        sessionId: z.string().optional(),
                        title: z.string().optional()
                    }).passthrough().optional()
                ])
            }
        )
    );

    secureHandle(
        'terminal:restoreAllSnapshots',
        createValidatedIpcHandler(
            'terminal:restoreAllSnapshots',
            async () => {
                return terminalService.restoreAllSnapshots({
                    onData: (sessionId: string, data: string) => {
                        queueTerminalData(sessionId, data);
                    },
                    onExit: (sessionId: string, code: number) => {
                        flushTerminalData(sessionId);
                        broadcastTerminalEvent(getWindow, 'terminal:exit', { id: sessionId, code });
                    },
                });
            },
            { defaultValue: { restored: 0, failed: 0, sessionIds: [] } }
        )
    );
}

function registerSessionSearchIpc(terminalService: TerminalService) {
    secureHandle(
        'terminal:searchScrollback',
        createValidatedIpcHandler(
            'terminal:searchScrollback',
            async (
                _event,
                sessionId: string,
                query: string,
                options?: SearchOptions
            ) => {
                return terminalService.searchSessionScrollback(sessionId, query, options);
            },
            {
                defaultValue: [],
                argsSchema: z.tuple([
                    sessionIdSchema,
                    searchQuerySchema,
                    searchOptionsSchema
                ])
            }
        )
    );

    secureHandle(
        'terminal:getSessionAnalytics',
        createValidatedIpcHandler(
            'terminal:getSessionAnalytics',
            async (_event, sessionId: string) => {
                return terminalService.getSessionAnalytics(sessionId);
            },
            {
                defaultValue: { sessionId: '', bytes: 0, lineCount: 0, commandCount: 0, updatedAt: 0 },
                argsSchema: z.tuple([sessionIdSchema])
            }
        )
    );

    secureHandle(
        'terminal:getSearchAnalytics',
        createValidatedIpcHandler(
            'terminal:getSearchAnalytics',
            async () => {
                return terminalService.getSearchAnalytics();
            },
            { defaultValue: { totalSearches: 0, regexSearches: 0, plainSearches: 0, lastSearchAt: 0 } }
        )
    );

    secureHandle(
        'terminal:getSearchSuggestions',
        createValidatedIpcHandler(
            'terminal:getSearchSuggestions',
            async (_event, query?: string, limit?: number) => {
                return terminalService.getSearchSuggestions(query ?? '', limit ?? 10);
            },
            {
                defaultValue: [],
                argsSchema: z.tuple([
                    z.string().optional(),
                    z.number().int().optional()
                ])
            }
        )
    );

    secureHandle(
        'terminal:exportSearchResults',
        createValidatedIpcHandler(
            'terminal:exportSearchResults',
            async (
                _event,
                sessionId: string,
                query: string,
                options: (SearchOptions & { exportPath?: string; format?: string }) | undefined
            ) => {
                const { exportPath, format, ...searchOptions } = options ?? {};
                const fmt = format === 'txt' ? 'txt' : 'json';
                return terminalService.exportSearchResults(
                    sessionId,
                    query,
                    searchOptions,
                    exportPath,
                    fmt
                );
            },
            {
                defaultValue: { success: false, error: 'export failed' },
                argsSchema: z.tuple([
                    sessionIdSchema,
                    searchQuerySchema,
                    exportSearchOptionsSchema
                ])
            }
        )
    );

    secureHandle(
        'terminal:addScrollbackMarker',
        createValidatedIpcHandler(
            'terminal:addScrollbackMarker',
            async (_event, sessionId: string, label: string, lineNumber?: number) => {
                return terminalService.addScrollbackMarker(sessionId, label, lineNumber);
            },
            {
                defaultValue: null,
                argsSchema: z.tuple([
                    sessionIdSchema,
                    z.string(),
                    z.number().int().optional()
                ])
            }
        )
    );

    secureHandle(
        'terminal:listScrollbackMarkers',
        createValidatedIpcHandler(
            'terminal:listScrollbackMarkers',
            async (_event, sessionId?: string) => {
                return terminalService.listScrollbackMarkers(sessionId);
            },
            {
                defaultValue: [],
                argsSchema: z.tuple([sessionIdSchema.optional()])
            }
        )
    );

    secureHandle(
        'terminal:deleteScrollbackMarker',
        createValidatedIpcHandler(
            'terminal:deleteScrollbackMarker',
            async (_event, markerId: string) => {
                return terminalService.deleteScrollbackMarker(markerId.trim());
            },
            {
                defaultValue: false,
                argsSchema: z.tuple([z.string().min(1, 'markerId is required')])
            }
        )
    );

    secureHandle(
        'terminal:filterScrollback',
        createValidatedIpcHandler(
            'terminal:filterScrollback',
            async (_event, sessionId: string, options: ScrollbackFilter) => {
                return terminalService.filterSessionScrollback(sessionId, options);
            },
            {
                defaultValue: [],
                argsSchema: z.tuple([
                    sessionIdSchema,
                    scrollbackFilterSchema
                ])
            }
        )
    );

    // Command history
    secureHandle(
        'terminal:getCommandHistory',
        createValidatedIpcHandler(
            'terminal:getCommandHistory',
            async (_event, query?: string, limit?: number) => {
                const q = typeof query === 'string' ? query.slice(0, 256) : '';
                const l = typeof limit === 'number' ? Math.max(1, Math.min(Math.floor(limit), 500)) : 100;
                return terminalService.getCommandHistory(q, l);
            },
            {
                defaultValue: [],
                argsSchema: z.tuple([
                    z.string().optional(),
                    z.number().optional()
                ])
            }
        )
    );

    secureHandle(
        'terminal:clearCommandHistory',
        createValidatedIpcHandler(
            'terminal:clearCommandHistory',
            async () => {
                return terminalService.clearCommandHistory();
            },
            { defaultValue: false }
        )
    );
}

function registerSmartIpc(smartService: TerminalSmartService) {
    secureHandle(
        'terminal:getSuggestions',
        createValidatedIpcHandler(
            'terminal:getSuggestions',
            async (_event, options: SuggestionOptions) => {
                return smartService.getSuggestions(options);
            },
            {
                defaultValue: [],
                argsSchema: z.tuple([suggestionOptionsSchema])
            }
        )
    );

    secureHandle(
        'terminal:explainCommand',
        createValidatedIpcHandler(
            'terminal:explainCommand',
            async (_event, options: ExplainCommandOptions) => {
                return withRateLimit('terminal', async () => smartService.explainCommand(options));
            },
            {
                defaultValue: { explanation: 'Service unavailable', breakdown: [] },
                argsSchema: z.tuple([explainCommandOptionsSchema])
            }
        )
    );

    secureHandle(
        'terminal:explainError',
        createValidatedIpcHandler(
            'terminal:explainError',
            async (_event, options: ExplainErrorOptions) => {
                return withRateLimit('terminal', async () => smartService.explainError(options));
            },
            {
                defaultValue: { summary: 'Service unavailable', cause: 'Unknown', solution: 'Please try again later' },
                argsSchema: z.tuple([explainErrorOptionsSchema])
            }
        )
    );

    secureHandle(
        'terminal:fixError',
        createValidatedIpcHandler(
            'terminal:fixError',
            async (_event, options: FixErrorOptions) => {
                return withRateLimit('terminal', async () => smartService.fixError(options));
            },
            {
                defaultValue: { suggestedCommand: '', explanation: 'Service unavailable', confidence: 'low' as const },
                argsSchema: z.tuple([fixErrorOptionsSchema])
            }
        )
    );
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
    terminalWindowGetter = getWindow;
    ipcMain.setMaxListeners(60);
    appLogger.info('terminal', '[IPC] Terminal service registered');

    // Register Subgroups
    registerProfileIpc(profileService);
    registerSessionLifecycleIpc(getWindow, terminalService);
    registerSessionIOIpc(terminalService);
    registerSessionExportIpc(terminalService);
    registerSessionTemplateIpc(getWindow, terminalService);
    registerSessionSearchIpc(terminalService);
    registerSmartIpc(smartService);

    // Misc
    secureHandle(
        'terminal:isAvailable',
        createValidatedIpcHandler('terminal:isAvailable', async () => {
            return terminalService.isAvailable();
        }, { defaultValue: false })
    );

    secureHandle(
        'terminal:getShells',
        createValidatedIpcHandler(
            'terminal:getShells',
            async () => {
                return terminalService.getAvailableShells();
            },
            {
                defaultValue: [],
                responseSchema: terminalGetShellsResponseSchema,
            }
        )
    );

    secureHandle(
        'terminal:getBackends',
        createValidatedIpcHandler(
            'terminal:getBackends',
            async () => {
                return terminalService.getAvailableBackends();
            },
            {
                defaultValue: [],
                responseSchema: terminalGetBackendsResponseSchema,
            }
        )
    );

    secureHandle(
        'terminal:getDiscoverySnapshot',
        createValidatedIpcHandler(
            'terminal:getDiscoverySnapshot',
            async (_event, options?: { refresh?: boolean }) => {
                return terminalService.getDiscoverySnapshot(options);
            },
            {
                argsSchema: terminalGetDiscoverySnapshotArgsSchema,
                defaultValue: {
                    terminalAvailable: false,
                    shells: [],
                    backends: [],
                    refreshedAt: 0,
                },
                responseSchema: terminalGetDiscoverySnapshotResponseSchema,
            }
        )
    );

    secureHandle(
        'terminal:getRuntimeHealth',
        createValidatedIpcHandler(
            'terminal:getRuntimeHealth',
            async () => {
                return terminalService.getRuntimeHealth();
            },
            {
                defaultValue: {
                    terminalAvailable: false,
                    totalBackends: 0,
                    availableBackends: 0,
                    backends: [],
                }
            }
        )
    );

    secureHandle(
        'terminal:getDockerContainers',
        createValidatedIpcHandler(
            'terminal:getDockerContainers',
            async () => {
                return dockerService.listContainers();
            },
            {
                defaultValue: { success: false, containers: [] }
            }
        )
    );
}

