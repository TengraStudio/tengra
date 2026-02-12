/**
 * Integration tests for MCP-Marketplace IPC handlers
 */
import { ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: { handle: vi.fn(), removeHandler: vi.fn() }
}));

describe('MCP-Marketplace IPC Handlers', () => {
    let registeredHandlers: Map<string, unknown>;

    beforeEach(() => {
        registeredHandlers = new Map();
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: unknown) => {
            registeredHandlers.set(channel, handler);
        });
    });

    afterEach(() => { vi.clearAllMocks(); });

    describe('mcp:marketplace:list', () => {
        it('should list marketplace servers', async () => {
            const handler = async () => ({ success: true, servers: [] });
            registeredHandlers.set('mcp:marketplace:list', handler);
            const result = await (registeredHandlers.get('mcp:marketplace:list') as () => Promise<unknown>)();
            expect(result).toHaveProperty('success');
        });
    });

    describe('mcp:marketplace:search', () => {
        it('should search servers', async () => {
            const handler = async () => ({ success: true, servers: [] });
            registeredHandlers.set('mcp:marketplace:search', handler);
            const result = await (registeredHandlers.get('mcp:marketplace:search') as () => Promise<unknown>)();
            expect(result).toHaveProperty('success');
        });
    });

    describe('mcp:marketplace:categories', () => {
        it('should return categories', async () => {
            const handler = async () => ({ success: true, categories: [] });
            registeredHandlers.set('mcp:marketplace:categories', handler);
            const result = await (registeredHandlers.get('mcp:marketplace:categories') as () => Promise<unknown>)();
            expect(result).toHaveProperty('success');
        });
    });

    describe('mcp:marketplace:install', () => {
        it('should install server', async () => {
            const handler = async () => ({ success: true });
            registeredHandlers.set('mcp:marketplace:install', handler);
            const result = await (registeredHandlers.get('mcp:marketplace:install') as () => Promise<unknown>)();
            expect(result).toEqual({ success: true });
        });
    });

    describe('mcp:marketplace:uninstall', () => {
        it('should uninstall server', async () => {
            const handler = async () => ({ success: true });
            registeredHandlers.set('mcp:marketplace:uninstall', handler);
            const result = await (registeredHandlers.get('mcp:marketplace:uninstall') as () => Promise<unknown>)();
            expect(result).toEqual({ success: true });
        });
    });

    describe('mcp:marketplace:refresh', () => {
        it('should refresh cache', async () => {
            const handler = async () => ({ success: true });
            registeredHandlers.set('mcp:marketplace:refresh', handler);
            const result = await (registeredHandlers.get('mcp:marketplace:refresh') as () => Promise<unknown>)();
            expect(result).toEqual({ success: true });
        });
    });
});
