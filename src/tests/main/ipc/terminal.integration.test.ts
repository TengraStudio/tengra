import { registerTerminalIpc } from '@main/ipc/terminal';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import { IpcMainInvokeEvent } from 'electron';
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
    }
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
        getSessionBuffer: vi.fn().mockReturnValue('buffer'),
        getCommandHistory: vi.fn().mockReturnValue([]),
        clearCommandHistory: vi.fn().mockResolvedValue(true)
    };
    const mockProfileService = {
        getProfiles: vi.fn().mockReturnValue([]),
        saveProfile: vi.fn().mockReturnValue(true),
        deleteProfile: vi.fn().mockReturnValue(true)
    };
    const mockSmartService = {
        getSuggestions: vi.fn().mockResolvedValue([])
    };
    const mockDockerService = {
        listContainers: vi.fn().mockResolvedValue([])
    };

    const mockWindow = {
        webContents: {
            send: vi.fn()
        }
    };

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
        expect(ipcMainHandlers.has('terminal:isAvailable')).toBe(true);
        expect(ipcMainHandlers.has('terminal:getShells')).toBe(true);
        expect(ipcMainHandlers.has('terminal:getBackends')).toBe(true);
        expect(ipcMainHandlers.has('terminal:create')).toBe(true);
        expect(ipcMainHandlers.has('terminal:close')).toBe(true);
        expect(ipcMainHandlers.has('terminal:write')).toBe(true);
        expect(ipcMainHandlers.has('terminal:resize')).toBe(true);
        expect(ipcMainHandlers.has('terminal:kill')).toBe(true);
        expect(ipcMainHandlers.has('terminal:getSessions')).toBe(true);
        expect(ipcMainHandlers.has('terminal:readBuffer')).toBe(true);
        expect(ipcMainHandlers.has('terminal:getCommandHistory')).toBe(true);
        expect(ipcMainHandlers.has('terminal:getSuggestions')).toBe(true);
        expect(ipcMainHandlers.has('terminal:clearCommandHistory')).toBe(true);
    });

    it('creates session with generated id when options are missing', async () => {
        const handler = ipcMainHandlers.get('terminal:create')!;
        const result = await handler({} as IpcMainInvokeEvent, undefined);

        expect(typeof result).toBe('string');
        expect(result).toMatch(/^term-/);
        expect(mockTerminalService.createSession).toHaveBeenCalledWith(expect.objectContaining({
            id: expect.stringMatching(/^term-/),
            onData: expect.any(Function),
            onExit: expect.any(Function)
        }));
    });

    it('loads available backends', async () => {
        const handler = ipcMainHandlers.get('terminal:getBackends')!;
        const result = await handler({} as IpcMainInvokeEvent);

        expect(Array.isArray(result)).toBe(true);
        expect(mockTerminalService.getAvailableBackends).toHaveBeenCalledTimes(1);
    });

    it('rejects invalid dimensions on create', async () => {
        const handler = ipcMainHandlers.get('terminal:create')!;
        await expect(handler({} as IpcMainInvokeEvent, { cols: 0, rows: 24 })).rejects.toThrow('cols must be an integer between 1 and 500');
    });

    it('returns false for invalid session id on write', async () => {
        const handler = ipcMainHandlers.get('terminal:write')!;
        const result = await handler({} as IpcMainInvokeEvent, '', 'echo hello');

        expect(result).toBe(false);
        expect(mockTerminalService.write).not.toHaveBeenCalled();
    });

    it('applies rate limit and writes for valid payload', async () => {
        const handler = ipcMainHandlers.get('terminal:write')!;
        const result = await handler({} as IpcMainInvokeEvent, 'term-1', 'echo hello');

        expect(result).toBe(true);
        expect(withRateLimit).toHaveBeenCalledWith('terminal', expect.any(Function));
        expect(mockTerminalService.write).toHaveBeenCalledWith('term-1', 'echo hello');
    });

    it('returns false when write payload exceeds max size', async () => {
        const handler = ipcMainHandlers.get('terminal:write')!;
        const tooLarge = 'x'.repeat(1024 * 1024 + 1);
        const result = await handler({} as IpcMainInvokeEvent, 'term-1', tooLarge);

        expect(result).toBe(false);
        expect(mockTerminalService.write).not.toHaveBeenCalled();
    });

    it('returns empty string for invalid session id on readBuffer', async () => {
        const handler = ipcMainHandlers.get('terminal:readBuffer')!;
        const result = await handler({} as IpcMainInvokeEvent, 'bad id with spaces');

        expect(result).toBe('');
        expect(mockTerminalService.getSessionBuffer).not.toHaveBeenCalled();
    });

    it('loads command history with query and limit', async () => {
        mockTerminalService.getCommandHistory.mockReturnValue([{ command: 'npm test', timestamp: Date.now(), sessionId: 'term-1' }]);
        const handler = ipcMainHandlers.get('terminal:getCommandHistory')!;
        const result = await handler({} as IpcMainInvokeEvent, 'npm', 20);

        expect(Array.isArray(result)).toBe(true);
        expect(mockTerminalService.getCommandHistory).toHaveBeenCalledWith('npm', 20);
    });

    it('returns smart command suggestions', async () => {
        mockSmartService.getSuggestions.mockResolvedValue(['npm test']);
        const handler = ipcMainHandlers.get('terminal:getSuggestions')!;
        const result = await handler({} as IpcMainInvokeEvent, { command: 'npm t', shell: 'bash', cwd: '/repo' });

        expect(result).toEqual(['npm test']);
        expect(mockSmartService.getSuggestions).toHaveBeenCalledWith({ command: 'npm t', shell: 'bash', cwd: '/repo' });
    });

    it('clears command history', async () => {
        const handler = ipcMainHandlers.get('terminal:clearCommandHistory')!;
        const result = await handler({} as IpcMainInvokeEvent);

        expect(result).toBe(true);
        expect(mockTerminalService.clearCommandHistory).toHaveBeenCalledTimes(1);
    });
});
