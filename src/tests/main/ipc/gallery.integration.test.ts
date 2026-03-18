/**
 * Integration tests for Gallery IPC handlers
 */
import * as fs from 'fs';
import path from 'path';

import { registerGalleryIpc } from '@main/ipc/gallery';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type IpcHandler = (event: IpcMainInvokeEvent, ...args: TestValue[]) => Promise<TestValue>;
const ipcHandlers = new Map<string, IpcHandler>();
const GALLERY_ROOT = 'C:\\gallery';
const TARGET_DIRECTORY = 'C:\\downloads';

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: IpcHandler) => {
            ipcHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn()
    },
    shell: { openPath: vi.fn(), showItemInFolder: vi.fn() }
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));


vi.mock('@main/utils/path-security.util', () => ({
    assertPathWithinRoot: (inputPath: string, rootPath: string) => {
        const resolvedInputPath = path.resolve(inputPath);
        const resolvedRootPath = path.resolve(rootPath);
        if (!resolvedInputPath.startsWith(resolvedRootPath)) {
            throw new Error('Path traversal detected');
        }
        return resolvedInputPath;
    }
}));

vi.mock('fs', () => ({
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    promises: {
        readdir: vi.fn().mockResolvedValue([]),
        unlink: vi.fn().mockResolvedValue(undefined),
        access: vi.fn().mockRejectedValue(new Error('not-found')),
        mkdir: vi.fn().mockResolvedValue(undefined),
        copyFile: vi.fn().mockResolvedValue(undefined),
        stat: vi.fn().mockResolvedValue({ mtime: new Date('2024-01-01T00:00:00.000Z') })
    }
}));

describe('Gallery IPC Handlers', () => {
    const mockEvent = { sender: { id: 1 } } as IpcMainInvokeEvent;

    beforeEach(() => {
        ipcHandlers.clear();
        vi.clearAllMocks();
        registerGalleryIpc(GALLERY_ROOT);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    const getRequiredHandler = (channel: string): IpcHandler => {
        const handler = ipcHandlers.get(channel);
        if (!handler) {
            throw new Error(`Missing IPC handler: ${channel}`);
        }
        return handler;
    };

    it('registers gallery IPC channels', () => {
        expect(ipcMain.handle).toHaveBeenCalled();
        expect(ipcHandlers.has('gallery:list')).toBe(true);
        expect(ipcHandlers.has('gallery:delete')).toBe(true);
        expect(ipcHandlers.has('gallery:open')).toBe(true);
        expect(ipcHandlers.has('gallery:reveal')).toBe(true);
        expect(ipcHandlers.has('gallery:batch-download')).toBe(true);
    });

    it('returns batch-download summary with copied and skipped files', async () => {
        const handler = getRequiredHandler('gallery:batch-download');
        const sourceFile = path.join(GALLERY_ROOT, 'images', 'image-1.png');
        const result = await handler(mockEvent, {
            filePaths: [sourceFile, '   '],
            targetDirectory: TARGET_DIRECTORY
        }) as {
            success: boolean;
            copied: number;
            skipped: number;
            errors: string[];
        };
        const copyFileCalls = vi.mocked(fs.promises.copyFile).mock.calls;
        const copiedToPath = copyFileCalls[0]?.[1];

        expect(fs.promises.mkdir).toHaveBeenCalledWith(path.resolve(TARGET_DIRECTORY), { recursive: true });
        expect(fs.promises.copyFile).toHaveBeenCalledTimes(1);
        expect(copiedToPath).toContain('downloads');
        expect(copiedToPath).toContain('image-1.png');
        expect(result).toEqual({
            success: false,
            copied: 1,
            skipped: 1,
            errors: ['Invalid file path in filePaths']
        });
    });
});
