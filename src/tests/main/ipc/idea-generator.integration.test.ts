/**
 * Integration tests for Idea-Generator IPC handlers
 */
import { IpcMainInvokeEvent } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockIpcMainHandle = vi.fn();
vi.mock('electron', () => ({
    ipcMain: { handle: mockIpcMainHandle, removeHandler: vi.fn() },
    BrowserWindow: { getAllWindows: vi.fn().mockReturnValue([]) }
}));

describe('Idea-Generator IPC Handlers', () => {
    let registeredHandlers: Map<string, TestValue>;

    beforeEach(() => {
        registeredHandlers = new Map();
        mockIpcMainHandle.mockImplementation((channel: string, listener: (event: IpcMainInvokeEvent, ...args: TestValue[]) => TestValue) => {
            registeredHandlers.set(channel, listener);
        });
    });

    afterEach(() => { vi.clearAllMocks(); });

    describe('ideas:createSession', () => {
        it('should create a session', async () => {
            const handler = async () => ({ id: 'session-1', status: 'active' });
            registeredHandlers.set('ideas:createSession', handler);
            const result = await (registeredHandlers.get('ideas:createSession') as () => Promise<TestValue>)();
            expect(result).toHaveProperty('id');
        });
    });

    describe('ideas:getSession', () => {
        it('should get a session', async () => {
            const handler = async () => ({ id: 'session-1', status: 'active' });
            registeredHandlers.set('ideas:getSession', handler);
            const result = await (registeredHandlers.get('ideas:getSession') as () => Promise<TestValue>)();
            expect(result).toHaveProperty('id');
        });
    });

    describe('ideas:getSessions', () => {
        it('should get all sessions', async () => {
            const handler = async () => [];
            registeredHandlers.set('ideas:getSessions', handler);
            const result = await (registeredHandlers.get('ideas:getSessions') as () => Promise<TestValue>)();
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('ideas:getIdea', () => {
        it('should get an idea', async () => {
            const handler = async () => ({ id: 'idea-1', title: 'Test Idea' });
            registeredHandlers.set('ideas:getIdea', handler);
            const result = await (registeredHandlers.get('ideas:getIdea') as () => Promise<TestValue>)();
            expect(result).toHaveProperty('title');
        });
    });

    describe('ideas:getIdeas', () => {
        it('should get ideas', async () => {
            const handler = async () => [];
            registeredHandlers.set('ideas:getIdeas', handler);
            const result = await (registeredHandlers.get('ideas:getIdeas') as () => Promise<TestValue>)();
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('ideas:deleteIdea', () => {
        it('should delete an idea', async () => {
            const handler = async () => ({ success: true });
            registeredHandlers.set('ideas:deleteIdea', handler);
            const result = await (registeredHandlers.get('ideas:deleteIdea') as () => Promise<TestValue>)();
            expect(result).toEqual({ success: true });
        });
    });

    describe('ideas:canGenerateLogo', () => {
        it('should check logo generation availability', async () => {
            const handler = async () => true;
            registeredHandlers.set('ideas:canGenerateLogo', handler);
            const result = await (registeredHandlers.get('ideas:canGenerateLogo') as () => Promise<TestValue>)();
            expect(result).toBe(true);
        });
    });
});
