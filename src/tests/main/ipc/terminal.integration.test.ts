import { registerTerminalIpc } from '@main/ipc/terminal';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import { beforeEach, describe, expect, it, vi } from 'vitest';


const ipcMainHandlers = new Map<string, (...args: any[]) => any>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
            ipcMainHandlers.set(channel, handler);
        }),
        setMaxListeners: vi.fn()
    },
    BrowserWindow: vi.fn()
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('@main/utils/ipc-wrapper.util', () => ({
    createIpcHandler: (_name: string, handler: (...args: any[]) => any) => async (...args: any[]) => handler(...args),
    createSafeIpcHandler: (_name: string, handler: (...args: any[]) => any, defaultValue: unknown) => async (...args: any[]) => {
        try {
            return await handler(...args);
        } catch {
            return defaultValue;
        }
    },
    createValidatedIpcHandler: (
        _name: string,
        handler: (...args: any[]) => any,
        options?: { argsSchema?: { parse: (args: unknown[]) => unknown[] }; defaultValue?: unknown }
    ) => async (event: unknown, ...args: unknown[]) => {
        try {
            const parsedArgs = options?.argsSchema ? options.argsSchema.parse(args) : args;
            return await handler(event, ...(parsedArgs as unknown[]));
        } catch {
            if (options && Object.prototype.hasOwnProperty.call(options, 'defaultValue')) {
                return options.defaultValue;
            }
            throw new Error('Validation failed');
        }
    },
}));

vi.mock('@main/utils/rate-limiter.util', () => ({
    withRateLimit: vi.fn(async (_scope: string, fn: () => Promise<unknown>) => fn())
}));

describe('Terminal IPC Integration', () => {
    const mockTerminalService = {
        isAvailable: vi.fn().mockReturnValue(true),
        getAvailableShells: vi.fn().mockReturnValue([{ id: 'powershell', name: 'PowerShell', path: 'pwsh.exe' }]),
        getAvailableBackends: vi.fn().mockResolvedValue([{ id: 'node-pty', name: 'Integrated Terminal', available: true }]),
        createSession: vi.fn().mockReturnValue(true),
        kill: vi.fn().mockReturnValue(true),
        write: vi.fn().mockResolvedValue(true),
        resize: vi.fn().mockReturnValue(true),
        getActiveSessions: vi.fn().mockReturnValue([]),
        getSessionSnapshots: vi.fn().mockReturnValue([]),
        exportSession: vi.fn().mockResolvedValue('{"version":1}'),
        importSession: vi.fn().mockResolvedValue({ success: true, sessionId: 'term-2' }),
        generateSessionShareCode: vi.fn().mockResolvedValue('termshare:abc'),
        importSessionShareCode: vi.fn().mockResolvedValue({ success: true, sessionId: 'term-3' }),
        getSessionTemplates: vi.fn().mockReturnValue([]),
        createSessionTemplate: vi.fn().mockResolvedValue({
            id: 'tpl-1',
            name: 'Template',
            shell: 'powershell.exe',
            cwd: 'C:/repo',
            cols: 80,
            rows: 24,
            backendId: 'node-pty',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }),
        deleteSessionTemplate: vi.fn().mockResolvedValue(true),
        restoreSessionTemplate: vi.fn().mockResolvedValue('term-template-1'),
        restoreSnapshotSession: vi.fn().mockResolvedValue(true),
        restoreAllSnapshots: vi.fn().mockResolvedValue({ restored: 1, failed: 0, sessionIds: ['term-1'] }),
        getSessionBuffer: vi.fn().mockReturnValue('buffer'),
        searchSessionScrollback: vi.fn().mockResolvedValue([]),
        getSearchSuggestions: vi.fn().mockReturnValue(['npm test']),
        exportSearchResults: vi.fn().mockResolvedValue({ success: true, content: '' }),
        exportSessionScrollback: vi.fn().mockResolvedValue({ success: true }),
        getSessionAnalytics: vi.fn().mockResolvedValue({
            sessionId: 'term-1',
            bytes: 0,
            lineCount: 0,
            commandCount: 0,
            updatedAt: 0,
        }),
        getSearchAnalytics: vi.fn().mockReturnValue({
            totalSearches: 3,
            regexSearches: 1,
            plainSearches: 2,
            lastSearchAt: Date.now(),
        }),
        addScrollbackMarker: vi.fn().mockResolvedValue({
            id: 'marker-1',
            sessionId: 'term-1',
            label: 'checkpoint',
            lineNumber: 12,
            createdAt: Date.now(),
        }),
        listScrollbackMarkers: vi.fn().mockReturnValue([]),
        deleteScrollbackMarker: vi.fn().mockResolvedValue(true),
        filterSessionScrollback: vi.fn().mockResolvedValue(['line 1', 'line 2']),
        setSessionTitle: vi.fn().mockResolvedValue(true),
        getCommandHistory: vi.fn().mockReturnValue([]),
        clearCommandHistory: vi.fn().mockResolvedValue(true)
    };
    const mockProfileService = {
        getProfiles: vi.fn().mockReturnValue([]),
        saveProfile: vi.fn().mockReturnValue(true),
        deleteProfile: vi.fn().mockReturnValue(true),
        validateProfile: vi.fn().mockReturnValue({ valid: true, errors: [] }),
        getProfileTemplates: vi.fn().mockReturnValue([]),
        exportProfiles: vi.fn().mockReturnValue('{"profiles":[]}'),
        importProfiles: vi.fn().mockResolvedValue({ success: true, imported: 1, skipped: 0, errors: [] }),
        exportProfileShareCode: vi.fn().mockReturnValue('termprofile:abc'),
        importProfileShareCode: vi.fn().mockResolvedValue({
            success: true,
            imported: true,
            profileId: 'p1',
        }),
    };
    const mockSmartService = {
        getSuggestions: vi.fn().mockResolvedValue([])
    };
    const mockDockerService = {
        listContainers: vi.fn().mockResolvedValue([])
    };

    const mockWindow = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: {
            id: 1,
            send: vi.fn()
        }
    };

    const mockEvent = { sender: { id: 1 } } as any;


    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();

        registerTerminalIpc(
            () => mockWindow as any,
            mockTerminalService as any,
            mockProfileService as any,
            mockSmartService as any,
            mockDockerService as any
        );
    });

    it('registers all terminal IPC handlers', () => {
        expect(ipcMainHandlers.has('terminal:getProfiles')).toBe(true);
        expect(ipcMainHandlers.has('terminal:saveProfile')).toBe(true);
        expect(ipcMainHandlers.has('terminal:deleteProfile')).toBe(true);
        expect(ipcMainHandlers.has('terminal:validateProfile')).toBe(true);
        expect(ipcMainHandlers.has('terminal:getProfileTemplates')).toBe(true);
        expect(ipcMainHandlers.has('terminal:exportProfiles')).toBe(true);
        expect(ipcMainHandlers.has('terminal:importProfiles')).toBe(true);
        expect(ipcMainHandlers.has('terminal:exportProfileShareCode')).toBe(true);
        expect(ipcMainHandlers.has('terminal:importProfileShareCode')).toBe(true);
        expect(ipcMainHandlers.has('terminal:isAvailable')).toBe(true);
        expect(ipcMainHandlers.has('terminal:getShells')).toBe(true);
        expect(ipcMainHandlers.has('terminal:getBackends')).toBe(true);
        expect(ipcMainHandlers.has('terminal:create')).toBe(true);
        expect(ipcMainHandlers.has('terminal:close')).toBe(true);
        expect(ipcMainHandlers.has('terminal:write')).toBe(true);
        expect(ipcMainHandlers.has('terminal:resize')).toBe(true);
        expect(ipcMainHandlers.has('terminal:kill')).toBe(true);
        expect(ipcMainHandlers.has('terminal:getSessions')).toBe(true);
        expect(ipcMainHandlers.has('terminal:restoreAllSnapshots')).toBe(true);
        expect(ipcMainHandlers.has('terminal:exportSession')).toBe(true);
        expect(ipcMainHandlers.has('terminal:importSession')).toBe(true);
        expect(ipcMainHandlers.has('terminal:createSessionShareCode')).toBe(true);
        expect(ipcMainHandlers.has('terminal:importSessionShareCode')).toBe(true);
        expect(ipcMainHandlers.has('terminal:getSnapshotSessions')).toBe(true);
        expect(ipcMainHandlers.has('terminal:getSessionTemplates')).toBe(true);
        expect(ipcMainHandlers.has('terminal:saveSessionTemplate')).toBe(true);
        expect(ipcMainHandlers.has('terminal:deleteSessionTemplate')).toBe(true);
        expect(ipcMainHandlers.has('terminal:createFromSessionTemplate')).toBe(true);
        expect(ipcMainHandlers.has('terminal:restoreSnapshotSession')).toBe(true);
        expect(ipcMainHandlers.has('terminal:readBuffer')).toBe(true);
        expect(ipcMainHandlers.has('terminal:setSessionTitle')).toBe(true);
        expect(ipcMainHandlers.has('terminal:searchScrollback')).toBe(true);
        expect(ipcMainHandlers.has('terminal:exportScrollback')).toBe(true);
        expect(ipcMainHandlers.has('terminal:getSessionAnalytics')).toBe(true);
        expect(ipcMainHandlers.has('terminal:getSearchAnalytics')).toBe(true);
        expect(ipcMainHandlers.has('terminal:getSearchSuggestions')).toBe(true);
        expect(ipcMainHandlers.has('terminal:exportSearchResults')).toBe(true);
        expect(ipcMainHandlers.has('terminal:addScrollbackMarker')).toBe(true);
        expect(ipcMainHandlers.has('terminal:listScrollbackMarkers')).toBe(true);
        expect(ipcMainHandlers.has('terminal:deleteScrollbackMarker')).toBe(true);
        expect(ipcMainHandlers.has('terminal:filterScrollback')).toBe(true);
        expect(ipcMainHandlers.has('terminal:getCommandHistory')).toBe(true);
        expect(ipcMainHandlers.has('terminal:getSuggestions')).toBe(true);
        expect(ipcMainHandlers.has('terminal:clearCommandHistory')).toBe(true);
    });

    it('creates session with generated id when options are missing', async () => {
        const handler = ipcMainHandlers.get('terminal:create')!;
        const result = await handler(mockEvent, undefined);

        expect(typeof result).toBe('string');
        expect(result).toMatch(/^term-/);
        expect(mockTerminalService.createSession).toHaveBeenCalledWith(expect.objectContaining({
            id: expect.stringMatching(/^term-/),
            onData: expect.any(Function),
            onExit: expect.any(Function)
        }));
    });

    it('validates terminal profile payload', async () => {
        const handler = ipcMainHandlers.get('terminal:validateProfile')!;
        const payload = { id: 'p1', name: 'PowerShell', shell: 'powershell.exe' };
        const result = await handler(mockEvent, payload);

        expect(result).toEqual({ valid: true, errors: [] });
        expect(mockProfileService.validateProfile).toHaveBeenCalledWith(payload);
    });

    it('exports and imports terminal profile share code', async () => {
        const exportHandler = ipcMainHandlers.get('terminal:exportProfileShareCode')!;
        const importHandler = ipcMainHandlers.get('terminal:importProfileShareCode')!;
        const code = await exportHandler(mockEvent, 'p1');
        const result = await importHandler(mockEvent, code, { overwrite: true });

        expect(code).toBe('termprofile:abc');
        expect(result).toEqual({ success: true, imported: true, profileId: 'p1' });
    });

    it('loads available backends', async () => {
        const handler = ipcMainHandlers.get('terminal:getBackends')!;
        const result = await handler(mockEvent);

        expect(Array.isArray(result)).toBe(true);
        expect(mockTerminalService.getAvailableBackends).toHaveBeenCalledTimes(1);
    });

    it('rejects invalid dimensions on create', async () => {
        const handler = ipcMainHandlers.get('terminal:create')!;
        const result = await handler(mockEvent, { cols: 0, rows: 24 });
        expect(result).toBeNull();
    });

    it('returns false for invalid session id on write', async () => {
        const handler = ipcMainHandlers.get('terminal:write')!;
        const result = await handler(mockEvent, '', 'echo hello');

        expect(result).toBe(false);
        expect(mockTerminalService.write).not.toHaveBeenCalled();
    });

    it('applies rate limit and writes for valid payload', async () => {
        const handler = ipcMainHandlers.get('terminal:write')!;
        const result = await handler(mockEvent, 'term-1', 'echo hello');

        expect(result).toBe(true);
        expect(withRateLimit).toHaveBeenCalledWith('terminal', expect.any(Function));
        expect(mockTerminalService.write).toHaveBeenCalledWith('term-1', 'echo hello');
    });

    it('returns false when write payload exceeds max size', async () => {
        const handler = ipcMainHandlers.get('terminal:write')!;
        const tooLarge = 'x'.repeat(1024 * 1024 + 1);
        const result = await handler(mockEvent, 'term-1', tooLarge);

        expect(result).toBe(false);
        expect(mockTerminalService.write).not.toHaveBeenCalled();
    });

    it('returns empty string for invalid session id on readBuffer', async () => {
        const handler = ipcMainHandlers.get('terminal:readBuffer')!;
        const result = await handler(mockEvent, 'bad id with spaces');

        expect(result).toBe('');
        expect(mockTerminalService.getSessionBuffer).not.toHaveBeenCalled();
    });

    it('loads command history with query and limit', async () => {
        mockTerminalService.getCommandHistory.mockReturnValue([{ command: 'npm test', timestamp: Date.now(), sessionId: 'term-1' }]);
        const handler = ipcMainHandlers.get('terminal:getCommandHistory')!;
        const result = await handler(mockEvent, 'npm', 20);

        expect(Array.isArray(result)).toBe(true);
        expect(mockTerminalService.getCommandHistory).toHaveBeenCalledWith('npm', 20);
    });

    it('searches terminal scrollback', async () => {
        mockTerminalService.searchSessionScrollback.mockResolvedValue([
            { lineNumber: 10, line: 'npm test --watch' }
        ]);
        const handler = ipcMainHandlers.get('terminal:searchScrollback')!;
        const result = await handler(
            mockEvent,
            'term-1',
            'npm test',
            { regex: false, caseSensitive: false, limit: 20 }
        );

        expect(result).toEqual([{ lineNumber: 10, line: 'npm test --watch' }]);
        expect(mockTerminalService.searchSessionScrollback).toHaveBeenCalledWith(
            'term-1',
            'npm test',
            { regex: false, caseSensitive: false, limit: 20 }
        );
    });

    it('returns [] for empty search query', async () => {
        const handler = ipcMainHandlers.get('terminal:searchScrollback')!;
        const result = await handler(mockEvent, 'term-1', '   ', { limit: 10 });
        expect(result).toEqual([]);
        expect(mockTerminalService.searchSessionScrollback).not.toHaveBeenCalled();
    });

    it('exports and imports terminal session payloads', async () => {
        const exportHandler = ipcMainHandlers.get('terminal:exportSession')!;
        const importHandler = ipcMainHandlers.get('terminal:importSession')!;
        const codeHandler = ipcMainHandlers.get('terminal:createSessionShareCode')!;

        const exported = await exportHandler(mockEvent, 'term-1', {
            includeScrollback: true,
        });
        const imported = await importHandler(mockEvent, '{"version":1}', {
            overwrite: true,
            sessionId: 'term-2',
        });
        const shareCode = await codeHandler(mockEvent, 'term-1');

        expect(exported).toBe('{"version":1}');
        expect(imported).toEqual({ success: true, sessionId: 'term-2' });
        expect(shareCode).toBe('termshare:abc');
    });

    it('returns search suggestions', async () => {
        const handler = ipcMainHandlers.get('terminal:getSearchSuggestions')!;
        const result = await handler(mockEvent, 'npm', 5);

        expect(result).toEqual(['npm test']);
        expect(mockTerminalService.getSearchSuggestions).toHaveBeenCalledWith('npm', 5);
    });

    it('sets terminal session title', async () => {
        const handler = ipcMainHandlers.get('terminal:setSessionTitle')!;
        const result = await handler(mockEvent, 'term-1', 'Backend Logs');

        expect(result).toBe(true);
        expect(mockTerminalService.setSessionTitle).toHaveBeenCalledWith('term-1', 'Backend Logs');
    });

    it('adds scrollback marker', async () => {
        const handler = ipcMainHandlers.get('terminal:addScrollbackMarker')!;
        const result = await handler(mockEvent, 'term-1', 'checkpoint', 12);

        expect(result).toEqual(expect.objectContaining({
            id: 'marker-1',
            sessionId: 'term-1',
            label: 'checkpoint',
            lineNumber: 12,
        }));
        expect(mockTerminalService.addScrollbackMarker).toHaveBeenCalledWith('term-1', 'checkpoint', 12);
    });

    it('returns smart command suggestions', async () => {
        mockSmartService.getSuggestions.mockResolvedValue(['npm test']);
        const handler = ipcMainHandlers.get('terminal:getSuggestions')!;
        const result = await handler(mockEvent, { command: 'npm t', shell: 'bash', cwd: '/repo' });

        expect(result).toEqual(['npm test']);
        expect(mockSmartService.getSuggestions).toHaveBeenCalledWith({ command: 'npm t', shell: 'bash', cwd: '/repo' });
    });

    it('clears command history', async () => {
        const handler = ipcMainHandlers.get('terminal:clearCommandHistory')!;
        const result = await handler(mockEvent);

        expect(result).toBe(true);
        expect(mockTerminalService.clearCommandHistory).toHaveBeenCalledTimes(1);
    });
});
