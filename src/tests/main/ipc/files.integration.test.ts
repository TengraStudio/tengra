import { registerFilesIpc } from '@main/ipc/files';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type IpcPayload = object | string | number | boolean | null | undefined;
type IpcHandler = (event: IpcMainInvokeEvent, ...args: IpcPayload[]) => Promise<IpcPayload>;

const ipcHandlers = new Map<string, IpcHandler>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: IpcHandler) => {
            ipcHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn()
    },
    dialog: {
        showOpenDialog: vi.fn(async () => ({
            canceled: false,
            filePaths: ['C:/workspace']
        }))
    }
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

describe('Files IPC Handlers', () => {
    const mockEvent = {
        sender: {
            id: 1,
            send: vi.fn()
        }
    } as never as IpcMainInvokeEvent;
    const mockMainWindow = {
        webContents: {
            id: 1
        }
    };
    const allowedRoots = new Set<string>(['C:/workspace']);

    const fileSystemService = {
        updateAllowedRoots: vi.fn(),
        fileExists: vi.fn(async () => ({ exists: true })),
        listDirectory: vi.fn(async () => ({ success: true, data: [{ name: 'src', isDirectory: true }] })),
        readFile: vi.fn(async () => ({ success: true, data: 'file-content' })),
        readImage: vi.fn(async () => ({ success: true, data: 'img-data' })),
        writeFile: vi.fn(async () => ({ success: true })),
        writeFileWithTracking: vi.fn(async () => ({ success: true })),
        createDirectory: vi.fn(async () => ({ success: true })),
        deleteFile: vi.fn(async () => ({ success: true })),
        deleteDirectory: vi.fn(async () => ({ success: true })),
        moveFile: vi.fn(async () => ({ success: true })),
        searchFiles: vi.fn(async () => ({ success: true, data: ['C:/workspace/src/app.ts'] })),
        searchFilesStream: vi.fn(async () => undefined),
    };

    beforeEach(() => {
        ipcHandlers.clear();
        vi.clearAllMocks();
        registerFilesIpc(
            () => mockMainWindow as never,
            fileSystemService as never,
            allowedRoots
        );
    });

    it('registers core file handlers', () => {
        expect(ipcMain.handle).toHaveBeenCalled();
        expect(ipcHandlers.has('files:exists')).toBe(true);
        expect(ipcHandlers.has('files:readFile')).toBe(true);
        expect(ipcHandlers.has('files:writeFile')).toBe(true);
        expect(ipcHandlers.has('files:searchFiles')).toBe(true);
        expect(ipcHandlers.has('files:selectDirectory')).toBe(true);
    });

    it('writes with tracking when ai context is provided', async () => {
        const handler = ipcHandlers.get('files:writeFile')!;
        const result = await handler(
            mockEvent,
            'C:/workspace/src/app.ts',
            'export const value = 1;',
            { aiSystem: 'workspace', chatSessionId: 'chat-1' }
        ) as { success?: boolean };

        expect(result.success).toBe(true);
        expect(fileSystemService.writeFileWithTracking).toHaveBeenCalledWith(
            'C:/workspace/src/app.ts',
            'export const value = 1;',
            {
                aiSystem: 'workspace',
                chatSessionId: 'chat-1',
                changeReason: 'AI file modification'
            }
        );
        expect(fileSystemService.writeFile).not.toHaveBeenCalled();
    });

    it('returns validation fallback for invalid write context', async () => {
        const handler = ipcHandlers.get('files:writeFile')!;
        const result = await handler(
            mockEvent,
            'C:/workspace/src/app.ts',
            'export const value = 1;',
            { aiSystem: 'invalid' }
        );

        expect(result).toMatchObject({
            success: false,
            error: 'Write failed',
            errorCode: 'FILES_VALIDATION_ERROR'
        });
        expect(fileSystemService.writeFileWithTracking).not.toHaveBeenCalled();
        expect(fileSystemService.writeFile).not.toHaveBeenCalled();
    });

    it('returns fallback payload when files:exists operation fails', async () => {
        fileSystemService.fileExists.mockRejectedValueOnce(new Error('permission denied'));

        const handler = ipcHandlers.get('files:exists')!;
        const result = await handler(mockEvent, 'C:/workspace/secret.txt');

        expect(result).toMatchObject({
            success: true,
            data: false,
            errorCode: 'FILES_OPERATION_FAILED'
        });
    });

    it('maps search results to stable response shape', async () => {
        const handler = ipcHandlers.get('files:searchFiles')!;
        const result = await handler(mockEvent, 'C:/workspace', 'app');

        expect(result).toEqual({
            success: true,
            results: ['C:/workspace/src/app.ts'],
            uiState: 'ready'
        });
    });

    it('returns operation fallback when file search fails', async () => {
        fileSystemService.searchFiles.mockRejectedValueOnce(new Error('search failed'));

        const handler = ipcHandlers.get('files:searchFiles')!;
        const result = await handler(mockEvent, 'C:/workspace', 'app');

        expect(result).toMatchObject({
            success: false,
            results: [],
            errorCode: 'FILES_OPERATION_FAILED'
        });
    });

    it('exposes files telemetry and health summary', async () => {
        fileSystemService.searchFiles.mockRejectedValueOnce(new Error('search failed'));
        const searchHandler = ipcHandlers.get('files:searchFiles')!;
        const existsHandler = ipcHandlers.get('files:exists')!;
        const healthHandler = ipcHandlers.get('files:health')!;

        await searchHandler(mockEvent, 'C:/workspace', 'app');
        await existsHandler(mockEvent, 'C:/workspace/src/app.ts');
        const health = await healthHandler(mockEvent) as {
            success: boolean;
            data: {
                status: string;
                metrics: {
                    totalCalls: number;
                    totalFailures: number;
                };
            };
        };

        expect(health.success).toBe(true);
        expect(health.data.metrics.totalCalls).toBeGreaterThanOrEqual(2);
        expect(health.data.metrics.totalFailures).toBeGreaterThanOrEqual(1);
    });
});
