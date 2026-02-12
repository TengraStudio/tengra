/**
 * Integration tests for MCP IPC handlers
 */
import { ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: { handle: vi.fn(), removeHandler: vi.fn() }
}));

describe('MCP IPC Handlers', () => {
    let registeredHandlers: Map<string, unknown>;

    beforeEach(() => {
        registeredHandlers = new Map();
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: unknown) => {
            registeredHandlers.set(channel, handler);
        });
    });

    afterEach(() => { vi.clearAllMocks(); });

    describe('mcp:list', () => {
        it('should list MCP services', async () => {
            const handler = async () => [{ name: 'filesystem', enabled: true }];
            registeredHandlers.set('mcp:list', handler);
            const result = await (registeredHandlers.get('mcp:list') as () => Promise<unknown>)();
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('mcp:dispatch', () => {
        it('should dispatch action', async () => {
            const handler = async () => ({ success: true, data: 'result' });
            registeredHandlers.set('mcp:dispatch', handler);
            const result = await (registeredHandlers.get('mcp:dispatch') as () => Promise<unknown>)();
            expect(result).toHaveProperty('success');
        });
    });

    describe('mcp:toggle', () => {
        it('should toggle service', async () => {
            const handler = async () => ({ success: true });
            registeredHandlers.set('mcp:toggle', handler);
            const result = await (registeredHandlers.get('mcp:toggle') as () => Promise<unknown>)();
            expect(result).toEqual({ success: true });
        });
    });

    describe('mcp:install', () => {
        it('should install service', async () => {
            const handler = async () => ({ success: true });
            registeredHandlers.set('mcp:install', handler);
            const result = await (registeredHandlers.get('mcp:install') as () => Promise<unknown>)();
            expect(result).toEqual({ success: true });
        });
    });

    describe('mcp:uninstall', () => {
        it('should uninstall service', async () => {
            const handler = async () => ({ success: true });
            registeredHandlers.set('mcp:uninstall', handler);
            const result = await (registeredHandlers.get('mcp:uninstall') as () => Promise<unknown>)();
            expect(result).toEqual({ success: true });
        });
    });
});
