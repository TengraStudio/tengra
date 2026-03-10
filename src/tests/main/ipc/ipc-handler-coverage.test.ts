import { registerCodeIntelligenceIpc } from '@main/ipc/code-intelligence';
import { registerProcessIpc } from '@main/ipc/process';
import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: { handle: vi.fn() }
}));

type IpcHandler = (event: unknown, ...args: unknown[]) => Promise<unknown>;

const getRegisteredHandlers = (): Map<string, IpcHandler> => {
    const handlers = new Map<string, IpcHandler>();
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: unknown) => {
        handlers.set(channel, handler as IpcHandler);
    });
    return handlers;
};

describe('IPC Handler Coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('validates args and executes process handlers through wrapper behavior', async () => {
        const handlers = getRegisteredHandlers();
        const processService = {
            spawn: vi.fn(() => 'task-1'),
            kill: vi.fn(() => true),
            getRunningTasks: vi.fn(() => []),
            scanScripts: vi.fn(async () => ({})),
            resize: vi.fn(() => true),
            write: vi.fn(() => true),
            on: vi.fn(),
        };

        const mockWin = {
            webContents: { id: 1 }
        } as any;

        const mockEvent = {
            sender: { id: 1 }
        } as any;

        registerProcessIpc(() => mockWin, processService as any);

        const spawn = handlers.get('process:spawn');
        expect(spawn).toBeDefined();

        const blocked = await spawn?.(mockEvent, 'npm; rm -rf /', [], 'C:/repo');
        expect(blocked).toBeNull();
        expect(processService.spawn).not.toHaveBeenCalled();

        const ok = await spawn?.(mockEvent, 'npm', ['run', 'test'], 'C:/repo');
        expect(ok).toBe('task-1');
        expect(processService.spawn).toHaveBeenCalledWith('npm', ['run', 'test'], 'C:/repo');
    });

    it('uses default fallback values for validated code intelligence handlers', async () => {
        const handlers = getRegisteredHandlers();
        const service = {
            scanWorkspaceTodos: vi.fn(async () => []),
            findSymbols: vi.fn(async () => [{ symbol: 'A' }]),
            searchFiles: vi.fn(async () => []),
            indexWorkspace: vi.fn(async () => undefined),
            queryIndexedSymbols: vi.fn(async () => []),
            getFileOutline: vi.fn(async () => []),
            findDefinition: vi.fn(async () => null),
            findUsage: vi.fn(async () => []),
            getSymbolRelationships: vi.fn(async () => []),
            getSymbolAnalytics: vi.fn(async () => null),
            scanTodos: vi.fn(async () => []),
            analyzeCodeQuality: vi.fn(async () => null),
        };


        const mockEvent = {
            sender: { id: 1 }
        } as any;

        registerCodeIntelligenceIpc(service as any);


        const findSymbols = handlers.get('code:findSymbols');
        expect(findSymbols).toBeDefined();

        const invalid = await findSymbols?.(mockEvent, '', 'query');
        expect(invalid).toEqual([]);
        expect(service.findSymbols).not.toHaveBeenCalled();

        const valid = await findSymbols?.(mockEvent, 'C:/repo', 'query');
        expect(valid).toEqual([{ symbol: 'A' }]);
        expect(service.findSymbols).toHaveBeenCalledWith('C:/repo', 'query');
    });

});
