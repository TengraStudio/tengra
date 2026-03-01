import { registerSshIpc } from '@main/ipc/ssh';
import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
            handlers.set(channel, handler);
        }),
        removeHandler: vi.fn()
    }
}));

vi.mock('@main/ipc/sender-validator', () => ({
    createMainWindowSenderValidator: () => () => undefined
}));

vi.mock('@main/ipc/validation', () => ({
    validateIpc: vi.fn((_schema: unknown, value: unknown) => value),
    sshConnectionSchema: {},
    sshProfileSchema: {}
}));

describe('SSH IPC Handlers', () => {
    const makeServices = () => {
        const sshService = {
            on: vi.fn(),
            off: vi.fn(),
            connect: vi.fn(async (payload: unknown) => ({ success: true, id: (payload as Record<string, unknown>).id })),
            disconnect: vi.fn(async () => undefined),
            getAllConnections: vi.fn(() => [{ id: 'c1', host: '127.0.0.1', username: 'u', connected: true }]),
            isConnected: vi.fn(() => true),
            getSavedProfiles: vi.fn(async () => [{ id: 'p1', host: 'h', username: 'u', connected: false }]),
            saveProfile: vi.fn(async () => true),
            deleteProfile: vi.fn(async () => true),
            executeCommand: vi.fn(async () => ({ success: true, stdout: 'ok', stderr: '', code: 0 })),
            startShell: vi.fn(async () => ({ success: true })),
            sendShellData: vi.fn(() => true),
            listDirectory: vi.fn(async () => ({ success: true, entries: [] })),
            readFile: vi.fn(async () => 'file-content'),
            writeFile: vi.fn(async () => true),
            deleteDirectory: vi.fn(async () => true),
            deleteFile: vi.fn(async () => true),
            createDirectory: vi.fn(async () => true),
            rename: vi.fn(async () => true),
            uploadFile: vi.fn(async () => true),
            downloadFile: vi.fn(async () => true),
            getSystemStats: vi.fn(async () => ({ uptime: '1h', memory: { total: 1, used: 1, percent: 50 }, cpu: 1, disk: '1%' })),
            getInstalledPackages: vi.fn(async () => []),
            getLogFiles: vi.fn(async () => []),
            readLogFile: vi.fn(async () => 'log'),
            createLocalForward: vi.fn(async () => ({ id: 'f1' })),
            createRemoteForward: vi.fn(async () => ({ id: 'f2' })),
            createDynamicForward: vi.fn(async () => ({ id: 'f3' })),
            getPortForwards: vi.fn(async () => []),
            closePortForward: vi.fn(async () => true),
            saveTunnelPreset: vi.fn(async () => true),
            listTunnelPresets: vi.fn(async () => []),
            deleteTunnelPreset: vi.fn(async () => true),
            searchRemoteFiles: vi.fn(async () => []),
            getSearchHistory: vi.fn(async () => []),
            exportSearchHistory: vi.fn(async () => ''),
            reconnectConnection: vi.fn(async () => ({ success: true })),
            acquireConnection: vi.fn(async () => true),
            releaseConnection: vi.fn(async () => true),
            getConnectionPoolStats: vi.fn(async () => ({ active: 0 })),
            enqueueTransfer: vi.fn(async () => ({ id: 't1' })),
            getTransferQueue: vi.fn(async () => []),
            getTransferStats: vi.fn(async () => ({ pending: 0 })),
            clearTransferHistory: vi.fn(async () => true),
            pauseTransfer: vi.fn(async () => true),
            resumeTransfer: vi.fn(async () => true),
            cancelTransfer: vi.fn(async () => true),
            getSshKeys: vi.fn(async () => []),
            generateSshKey: vi.fn(async () => ({ success: true })),
            importSshKey: vi.fn(async () => ({ success: true })),
            deleteSshKey: vi.fn(async () => true)
        };
        const rateLimitService = {
            waitForToken: vi.fn(async () => undefined)
        };
        return { sshService, rateLimitService };
    };

    beforeEach(() => {
        handlers.clear();
        vi.clearAllMocks();
    });

    it('registers and executes connection/profile handlers', async () => {
        const { sshService, rateLimitService } = makeServices();
        const dispose = registerSshIpc(() => null, sshService as never, rateLimitService as never);
        expect(ipcMain.handle).toHaveBeenCalled();

        const connectResult = await handlers.get('ssh:connect')?.({}, {
            host: 'localhost',
            port: 22,
            username: 'user',
            password: 'pw'
        });
        expect(connectResult).toMatchObject({ success: true });
        expect(sshService.connect).toHaveBeenCalled();

        const profiles = await handlers.get('ssh:getProfiles')?.({});
        expect(profiles).toEqual([{ id: 'p1', host: 'h', username: 'u', connected: false }]);

        dispose();
        expect(sshService.off).toHaveBeenCalled();
    });

    it('handles execute with rate limit and returns safe fallback on error', async () => {
        const { sshService, rateLimitService } = makeServices();
        registerSshIpc(() => null, sshService as never, rateLimitService as never);

        const execute = handlers.get('ssh:execute');
        const ok = await execute?.({}, 'c1', 'ls');
        expect(rateLimitService.waitForToken).toHaveBeenCalledWith('ssh:execute');
        expect(ok).toMatchObject({ success: true, code: 0 });

        sshService.executeCommand.mockRejectedValueOnce(new Error('boom'));
        const failed = await execute?.({}, 'c1', 'ls');
        expect(failed).toMatchObject({ success: false, code: 1 });
    });
});

