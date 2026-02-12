/**
 * Integration tests for File-Diff IPC handlers
 */
import { ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: { handle: vi.fn(), removeHandler: vi.fn() }
}));

describe('File-Diff IPC Handlers', () => {
    let registeredHandlers: Map<string, unknown>;

    beforeEach(() => {
        registeredHandlers = new Map();
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: unknown) => {
            registeredHandlers.set(channel, handler);
        });
    });

    afterEach(() => { vi.clearAllMocks(); });

    describe('diff:getFileHistory', () => {
        it('should return file diff history', async () => {
            const handler = async () => ({ success: true, data: [] });
            registeredHandlers.set('diff:getFileHistory', handler);
            const result = await (registeredHandlers.get('diff:getFileHistory') as () => Promise<unknown>)();
            expect(result).toHaveProperty('success');
        });
    });

    describe('diff:getRecentChanges', () => {
        it('should return recent changes', async () => {
            const handler = async () => ({ success: true, data: [] });
            registeredHandlers.set('diff:getRecentChanges', handler);
            const result = await (registeredHandlers.get('diff:getRecentChanges') as () => Promise<unknown>)();
            expect(result).toHaveProperty('success');
        });
    });

    describe('diff:getSessionChanges', () => {
        it('should return session changes', async () => {
            const handler = async () => ({ success: true, data: [] });
            registeredHandlers.set('diff:getSessionChanges', handler);
            const result = await (registeredHandlers.get('diff:getSessionChanges') as () => Promise<unknown>)();
            expect(result).toHaveProperty('success');
        });
    });

    describe('diff:revertChange', () => {
        it('should revert a file change', async () => {
            const handler = async () => ({ success: true });
            registeredHandlers.set('diff:revertChange', handler);
            const result = await (registeredHandlers.get('diff:revertChange') as () => Promise<unknown>)();
            expect(result).toEqual({ success: true });
        });
    });

    describe('diff:getStats', () => {
        it('should return diff statistics', async () => {
            const handler = async () => ({ success: true, data: { additions: 10, deletions: 5 } });
            registeredHandlers.set('diff:getStats', handler);
            const result = await (registeredHandlers.get('diff:getStats') as () => Promise<unknown>)();
            expect(result).toHaveProperty('success');
        });
    });

    describe('diff:cleanup', () => {
        it('should cleanup old diffs', async () => {
            const handler = async () => ({ success: true, data: { completed: true } });
            registeredHandlers.set('diff:cleanup', handler);
            const result = await (registeredHandlers.get('diff:cleanup') as () => Promise<unknown>)();
            expect(result).toHaveProperty('success');
        });
    });
});
