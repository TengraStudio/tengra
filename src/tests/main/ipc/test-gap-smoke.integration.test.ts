import { registerAdvancedMemoryIpc } from '@main/ipc/advanced-memory';
import { registerDialogIpc } from '@main/ipc/dialog';
import { registerFilesIpc } from '@main/ipc/files';
import { dialog, ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
    dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
    BrowserWindow: { fromId: vi.fn() },
}));


type IpcHandler = (event: TestValue, ...args: TestValue[]) => Promise<TestValue>;

const setupHandlers = (): Map<string, IpcHandler> => {
    const handlers = new Map<string, IpcHandler>();
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: TestValue) => {
        handlers.set(channel, handler as IpcHandler);
    });
    return handlers;
};

describe('Missing IPC TODO coverage (behavior)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('executes advanced memory bulk confirm with service-level filtering', async () => {
        const handlers = setupHandlers();
        const pending = [
            { id: 'p-1', requiresUserValidation: false },
            { id: 'p-2', requiresUserValidation: true },
        ];
        const service = {
            getPendingMemories: vi.fn(() => pending),
            confirmPendingMemory: vi.fn(async () => ({ id: 'p-1' })),
            rejectPendingMemory: vi.fn(async () => undefined),
            rememberExplicit: vi.fn(async () => ({})),
            recall: vi.fn(async () => ({ memories: [], totalMatches: 0 })),
            recallRelevantFacts: vi.fn(async () => []),
            getStatistics: vi.fn(async () => ({ totalMemories: 0 })),
            runDecayMaintenance: vi.fn(async () => undefined),
            extractAndStageFromMessage: vi.fn(async () => []),
            deleteMemory: vi.fn(async () => true),
            deleteMemories: vi.fn(async () => ({ deleted: 0, failed: [] })),
            editMemory: vi.fn(async () => null),
            archiveMemory: vi.fn(async () => true),
            archiveMemories: vi.fn(async () => ({ archived: 0, failed: [] })),
            restoreMemory: vi.fn(async () => true),
            getMemory: vi.fn(async () => null),
        };

        registerAdvancedMemoryIpc(service as never);

        const handler = handlers.get('advancedMemory:confirmAll');
        const result = await handler?.({} as never);

        expect(result).toMatchObject({ success: true, confirmed: 1, uiState: 'ready' });
        expect(service.confirmPendingMemory).toHaveBeenCalledTimes(1);
        expect(service.confirmPendingMemory).toHaveBeenCalledWith('p-1', 'user');
    });

    it('returns validation error for invalid dialog save payloads', async () => {
        const handlers = setupHandlers();
        registerDialogIpc(() => ({}) as never);

        const handler = handlers.get('dialog:saveFile');
        const result = await handler?.({} as never, { filename: '', content: 'x' });

        expect(result).toEqual({
            success: false,
            error: 'Invalid options provided',
            messageKey: 'mainProcess.dialog.invalidOptionsProvided'
        });
        expect(dialog.showSaveDialog).not.toHaveBeenCalled();
    });

    it('updates allowed roots when directory selection succeeds', async () => {
        const handlers = setupHandlers();
        const roots = new Set<string>();
        const fileSystemService = {
            updateAllowedRoots: vi.fn(),
            listDirectory: vi.fn(),
            readFile: vi.fn(),
            readImage: vi.fn(),
            writeFileWithTracking: vi.fn(),
            writeFile: vi.fn(),
            createDirectory: vi.fn(),
            deleteFile: vi.fn(),
            deleteDirectory: vi.fn(),
            moveFile: vi.fn(),
            searchFiles: vi.fn(),
            searchFilesStream: vi.fn(),
        };

        const mockWin = {
            webContents: { id: 1 }
        } as never;

        const mockEvent = {
            sender: { id: 1 }
        } as never;

        vi.mocked(dialog.showOpenDialog).mockResolvedValue({
            canceled: false,
            filePaths: ['C:/workspaces/demo-workspace']
        } as never);

        registerFilesIpc(() => mockWin, fileSystemService as never, roots);

        const handler = handlers.get('files:selectDirectory');
        const result = await handler?.(mockEvent);

        expect(result).toMatchObject({ success: true, path: 'C:/workspaces/demo-workspace' });
        expect(fileSystemService.updateAllowedRoots).toHaveBeenCalledTimes(1);
        expect(Array.from(roots)).toContain('C:/workspaces/demo-workspace');
    });

});
