import { registerCodeIntelligenceIpc } from '@main/ipc/code-intelligence';
import { registerMcpMarketplaceHandlers } from '@main/ipc/mcp-marketplace';
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

    it('enforces validated wrapper behavior for mcp marketplace handlers', async () => {
        const handlers = getRegisteredHandlers();
        const marketplaceService = {
            listServers: vi.fn(async () => [{ id: 'srv-1', name: 'Srv', command: 'npx srv', description: 'd' }]),
            searchServers: vi.fn(async () => [{ id: 'srv-1' }]),
            filterByCategory: vi.fn(async () => []),
            getCategories: vi.fn(async () => ['dev']),
            refreshCache: vi.fn(async () => undefined),
        };
        const settingsService = {
            getSettings: vi.fn(() => ({ mcpUserServers: [] })),
            saveSettings: vi.fn(async () => undefined),
        };
        const pluginService = {
            listPlugins: vi.fn(async () => []),
            getDispatchMetrics: vi.fn(() => ({ totalDispatches: 0 })),
        };


        const mockEvent = {
            sender: { id: 1 }
        } as any;

        registerMcpMarketplaceHandlers(
            marketplaceService as any,
            settingsService as any,
            pluginService as any
        );



        const search = handlers.get('mcp:marketplace:search');
        const list = handlers.get('mcp:marketplace:list');
        expect(search).toBeDefined();
        expect(list).toBeDefined();

        const invalidSearch = await search?.(mockEvent, '');
        expect(invalidSearch).toMatchObject({ success: false });
        expect(marketplaceService.searchServers).not.toHaveBeenCalled();

        const listResult = await list?.(mockEvent);
        expect(listResult).toMatchObject({ success: true, servers: expect.any(Array) });
    });

    it('uses default fallback values for validated code intelligence handlers', async () => {
        const handlers = getRegisteredHandlers();
        const service = {
            scanProjectTodos: vi.fn(async () => []),
            findSymbols: vi.fn(async () => [{ symbol: 'A' }]),
            searchFiles: vi.fn(async () => []),
            indexProject: vi.fn(async () => undefined),
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
