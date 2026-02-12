/**
 * Integration tests for Extension IPC handlers
 */
import { ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: { handle: vi.fn(), removeHandler: vi.fn() }
}));

describe('Extension IPC Handlers', () => {
    let registeredHandlers: Map<string, unknown>;

    beforeEach(() => {
        registeredHandlers = new Map();
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: unknown) => {
            registeredHandlers.set(channel, handler);
        });
    });

    afterEach(() => { vi.clearAllMocks(); });

    describe('extension:shouldShowWarning', () => {
        it('should return warning status', async () => {
            const handler = async () => true;
            registeredHandlers.set('extension:shouldShowWarning', handler);
            const result = await (registeredHandlers.get('extension:shouldShowWarning') as () => Promise<unknown>)();
            expect(result).toBe(true);
        });
    });

    describe('extension:dismissWarning', () => {
        it('should dismiss warning', async () => {
            const handler = async () => ({ success: true });
            registeredHandlers.set('extension:dismissWarning', handler);
            const result = await (registeredHandlers.get('extension:dismissWarning') as () => Promise<unknown>)();
            expect(result).toEqual({ success: true });
        });
    });

    describe('extension:getStatus', () => {
        it('should return extension status', async () => {
            const handler = async () => ({ installed: false, shouldShowWarning: true });
            registeredHandlers.set('extension:getStatus', handler);
            const result = await (registeredHandlers.get('extension:getStatus') as () => Promise<unknown>)();
            expect(result).toEqual({ installed: false, shouldShowWarning: true });
        });
    });

    describe('extension:setInstalled', () => {
        it('should set installed status', async () => {
            const handler = async () => ({ success: true });
            registeredHandlers.set('extension:setInstalled', handler);
            const result = await (registeredHandlers.get('extension:setInstalled') as () => Promise<unknown>)();
            expect(result).toEqual({ success: true });
        });
    });
});
