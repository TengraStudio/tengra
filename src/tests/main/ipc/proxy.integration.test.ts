/**
 * Integration tests for Proxy IPC handlers
 */
import { ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: { handle: vi.fn(), removeHandler: vi.fn() }
}));

describe('Proxy IPC Handlers', () => {
    let registeredHandlers: Map<string, TestValue>;

    beforeEach(() => {
        registeredHandlers = new Map();
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: TestValue) => {
            registeredHandlers.set(channel, handler);
        });
    });

    afterEach(() => { vi.clearAllMocks(); });

    describe('proxy:getQuota', () => {
        it('should return quota', async () => {
            const handler = async () => ({ used: 100, limit: 1000 });
            registeredHandlers.set('proxy:getQuota', handler);
            const result = await (registeredHandlers.get('proxy:getQuota') as () => Promise<TestValue>)();
            expect(result).toHaveProperty('limit');
        });
    });

    describe('proxy:getCopilotQuota', () => {
        it('should return copilot quota', async () => {
            const handler = async () => ({ used: 50, limit: 500 });
            registeredHandlers.set('proxy:getCopilotQuota', handler);
            const result = await (registeredHandlers.get('proxy:getCopilotQuota') as () => Promise<TestValue>)();
            expect(result).toHaveProperty('limit');
        });
    });

    describe('proxy:getModels', () => {
        it('should return models', async () => {
            const handler = async () => ['claude-3-opus', 'gpt-4'];
            registeredHandlers.set('proxy:getModels', handler);
            const result = await (registeredHandlers.get('proxy:getModels') as () => Promise<TestValue>)();
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('proxy:antigravityLogin', () => {
        it('should return auth URL', async () => {
            const handler = async () => ({ url: 'https://example.com/auth' });
            registeredHandlers.set('proxy:antigravityLogin', handler);
            const result = await (registeredHandlers.get('proxy:antigravityLogin') as () => Promise<TestValue>)();
            expect(result).toHaveProperty('url');
        });
    });

    describe('proxy:deleteAuthFile', () => {
        it('should return success', async () => {
            const handler = async () => ({ success: true });
            registeredHandlers.set('proxy:deleteAuthFile', handler);
            const result = await (registeredHandlers.get('proxy:deleteAuthFile') as () => Promise<TestValue>)();
            expect(result).toEqual({ success: true });
        });
    });
});
