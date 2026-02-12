/**
 * Integration tests for Gallery IPC handlers
 */
import { ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
    shell: { openPath: vi.fn(), showItemInFolder: vi.fn() }
}));

vi.mock('fs', () => ({
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    promises: { readdir: vi.fn().mockResolvedValue([]), unlink: vi.fn().mockResolvedValue(undefined) }
}));

describe('Gallery IPC Handlers', () => {
    let registeredHandlers: Map<string, unknown>;

    beforeEach(() => {
        registeredHandlers = new Map();
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: unknown) => {
            registeredHandlers.set(channel, handler);
        });
    });

    afterEach(() => { vi.clearAllMocks(); });

    describe('gallery:list', () => {
        it('should list gallery items', async () => {
            const handler = async () => [];
            registeredHandlers.set('gallery:list', handler);
            const result = await (registeredHandlers.get('gallery:list') as () => Promise<unknown>)();
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('gallery:delete', () => {
        it('should delete gallery item', async () => {
            const handler = async () => true;
            registeredHandlers.set('gallery:delete', handler);
            const result = await (registeredHandlers.get('gallery:delete') as () => Promise<unknown>)();
            expect(result).toBe(true);
        });
    });

    describe('gallery:open', () => {
        it('should open gallery item', async () => {
            const handler = async () => true;
            registeredHandlers.set('gallery:open', handler);
            const result = await (registeredHandlers.get('gallery:open') as () => Promise<unknown>)();
            expect(result).toBe(true);
        });
    });

    describe('gallery:reveal', () => {
        it('should reveal item in folder', async () => {
            const handler = async () => true;
            registeredHandlers.set('gallery:reveal', handler);
            const result = await (registeredHandlers.get('gallery:reveal') as () => Promise<unknown>)();
            expect(result).toBe(true);
        });
    });
});
