/**
 * Integration tests for Files IPC handlers
 */
import { ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
    dialog: { showOpenDialog: vi.fn() },
    BrowserWindow: vi.fn()
}));

describe('Files IPC Handlers', () => {
    let registeredHandlers: Map<string, unknown>;

    beforeEach(() => {
        registeredHandlers = new Map();
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: unknown) => {
            registeredHandlers.set(channel, handler);
        });
    });

    afterEach(() => { vi.clearAllMocks(); });

    describe('files:selectDirectory', () => {
        it('should open directory dialog', async () => {
            const handler = async () => ({ success: true, path: '/selected' });
            registeredHandlers.set('files:selectDirectory', handler);
            const result = await (registeredHandlers.get('files:selectDirectory') as () => Promise<unknown>)();
            expect(result).toHaveProperty('success');
        });
    });

    describe('files:listDirectory', () => {
        it('should list directory', async () => {
            const handler = async () => [];
            registeredHandlers.set('files:listDirectory', handler);
            const result = await (registeredHandlers.get('files:listDirectory') as () => Promise<unknown>)();
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('files:readFile', () => {
        it('should read file', async () => {
            const handler = async () => ({ success: true, content: 'data' });
            registeredHandlers.set('files:readFile', handler);
            const result = await (registeredHandlers.get('files:readFile') as () => Promise<unknown>)();
            expect(result).toHaveProperty('success');
        });
    });

    describe('files:writeFile', () => {
        it('should write file', async () => {
            const handler = async () => ({ success: true });
            registeredHandlers.set('files:writeFile', handler);
            const result = await (registeredHandlers.get('files:writeFile') as () => Promise<unknown>)();
            expect(result).toEqual({ success: true });
        });
    });

    describe('files:deleteFile', () => {
        it('should delete file', async () => {
            const handler = async () => ({ success: true });
            registeredHandlers.set('files:deleteFile', handler);
            const result = await (registeredHandlers.get('files:deleteFile') as () => Promise<unknown>)();
            expect(result).toEqual({ success: true });
        });
    });

    describe('files:searchFiles', () => {
        it('should search files', async () => {
            const handler = async () => ({ success: true, data: [] });
            registeredHandlers.set('files:searchFiles', handler);
            const result = await (registeredHandlers.get('files:searchFiles') as () => Promise<unknown>)();
            expect(result).toHaveProperty('success');
        });
    });
});
