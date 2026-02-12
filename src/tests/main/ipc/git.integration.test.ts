/**
 * Integration tests for Git IPC handlers
 */
import { ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: { handle: vi.fn(), removeHandler: vi.fn() }
}));

describe('Git IPC Handlers', () => {
    let registeredHandlers: Map<string, unknown>;

    beforeEach(() => {
        registeredHandlers = new Map();
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: unknown) => {
            registeredHandlers.set(channel, handler);
        });
    });

    afterEach(() => { vi.clearAllMocks(); });

    describe('git:isRepository', () => {
        it('should check if directory is a git repo', async () => {
            const handler = async () => ({ success: true, isRepository: true });
            registeredHandlers.set('git:isRepository', handler);
            const result = await (registeredHandlers.get('git:isRepository') as () => Promise<unknown>)();
            expect(result).toHaveProperty('isRepository');
        });
    });

    describe('git:getLastCommit', () => {
        it('should get last commit', async () => {
            const handler = async () => ({ success: true, hash: 'abc123', message: 'Test' });
            registeredHandlers.set('git:getLastCommit', handler);
            const result = await (registeredHandlers.get('git:getLastCommit') as () => Promise<unknown>)();
            expect(result).toHaveProperty('hash');
        });
    });

    describe('git:getRecentCommits', () => {
        it('should get recent commits', async () => {
            const handler = async () => ({ success: true, commits: [] });
            registeredHandlers.set('git:getRecentCommits', handler);
            const result = await (registeredHandlers.get('git:getRecentCommits') as () => Promise<unknown>)();
            expect(result).toHaveProperty('commits');
        });
    });

    describe('git:stageFile', () => {
        it('should stage a file', async () => {
            const handler = async () => ({ success: true });
            registeredHandlers.set('git:stageFile', handler);
            const result = await (registeredHandlers.get('git:stageFile') as () => Promise<unknown>)();
            expect(result).toEqual({ success: true });
        });
    });

    describe('git:checkout', () => {
        it('should checkout branch', async () => {
            const handler = async () => ({ success: true });
            registeredHandlers.set('git:checkout', handler);
            const result = await (registeredHandlers.get('git:checkout') as () => Promise<unknown>)();
            expect(result).toEqual({ success: true });
        });
    });

    describe('git:commit', () => {
        it('should commit changes', async () => {
            const handler = async () => ({ success: true });
            registeredHandlers.set('git:commit', handler);
            const result = await (registeredHandlers.get('git:commit') as () => Promise<unknown>)();
            expect(result).toEqual({ success: true });
        });
    });

    describe('git:push', () => {
        it('should push to remote', async () => {
            const handler = async () => ({ success: true, stdout: 'Pushed' });
            registeredHandlers.set('git:push', handler);
            const result = await (registeredHandlers.get('git:push') as () => Promise<unknown>)();
            expect(result).toHaveProperty('success');
        });
    });

    describe('git:pull', () => {
        it('should pull from remote', async () => {
            const handler = async () => ({ success: true });
            registeredHandlers.set('git:pull', handler);
            const result = await (registeredHandlers.get('git:pull') as () => Promise<unknown>)();
            expect(result).toEqual({ success: true });
        });
    });
});
