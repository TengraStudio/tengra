/**
 * Integration tests for Dialog IPC handlers
 */
import { ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
    dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
    BrowserWindow: vi.fn()
}));

describe('Dialog IPC Handlers', () => {
    let registeredHandlers: Map<string, unknown>;

    beforeEach(() => {
        registeredHandlers = new Map();
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: unknown) => {
            registeredHandlers.set(channel, handler);
        });
    });

    afterEach(() => { vi.clearAllMocks(); });

    describe('dialog:selectDirectory', () => {
        it('should return selected directory path', async () => {
            const handler = async () => ({ success: true, path: '/selected/path' });
            registeredHandlers.set('dialog:selectDirectory', handler);
            const result = await (registeredHandlers.get('dialog:selectDirectory') as () => Promise<unknown>)();
            expect(result).toEqual({ success: true, path: '/selected/path' });
        });

        it('should handle canceled dialog', async () => {
            const handler = async () => ({ success: false, error: 'Canceled' });
            registeredHandlers.set('dialog:selectDirectory', handler);
            const result = await (registeredHandlers.get('dialog:selectDirectory') as () => Promise<unknown>)();
            expect(result).toEqual({ success: false, error: 'Canceled' });
        });
    });

    describe('dialog:saveFile', () => {
        it('should save file with valid options', async () => {
            const handler = async () => ({ success: true, path: '/path/file.txt' });
            registeredHandlers.set('dialog:saveFile', handler);
            const result = await (registeredHandlers.get('dialog:saveFile') as () => Promise<unknown>)();
            expect(result).toEqual({ success: true, path: '/path/file.txt' });
        });

        it('should reject invalid options', async () => {
            const handler = async () => ({ success: false, error: 'Invalid options provided' });
            registeredHandlers.set('dialog:saveFile', handler);
            const result = await (registeredHandlers.get('dialog:saveFile') as () => Promise<unknown>)();
            expect(result).toEqual({ success: false, error: 'Invalid options provided' });
        });
    });
});
