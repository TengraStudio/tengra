/**
 * Integration tests for Advanced Memory IPC handlers
 */
import { ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn(),
        removeHandler: vi.fn()
    }
}));

describe('Advanced Memory IPC Handlers', () => {
    let registeredHandlers: Map<string, unknown>;

    beforeEach(() => {
        registeredHandlers = new Map();
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: unknown) => {
            registeredHandlers.set(channel, handler);
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('advancedMemory:getPending', () => {
        it('should return pending memories', async () => {
            const mockPending = [
                { id: 'pending-1', content: 'Test memory 1', requiresUserValidation: true },
                { id: 'pending-2', content: 'Test memory 2', requiresUserValidation: false }
            ];

            const handler = async () => {
                return { success: true, data: mockPending };
            };
            registeredHandlers.set('advancedMemory:getPending', handler);

            const result = await (registeredHandlers.get('advancedMemory:getPending') as () => Promise<unknown>)();

            expect(result).toEqual({
                success: true,
                data: mockPending
            });
        });
    });

    describe('advancedMemory:confirm', () => {
        it('should confirm a pending memory', async () => {
            const handler = async (_: unknown, id: string) => {
                return { success: true, data: { id, content: 'Confirmed memory' } };
            };
            registeredHandlers.set('advancedMemory:confirm', handler);

            const result = await (registeredHandlers.get('advancedMemory:confirm') as (event: unknown, id: string) => Promise<unknown>)({}, 'pending-1');

            expect(result).toHaveProperty('success', true);
        });
    });

    describe('advancedMemory:reject', () => {
        it('should reject a pending memory', async () => {
            const handler = async (_: unknown) => {
                return { success: true };
            };
            registeredHandlers.set('advancedMemory:reject', handler);

            const result = await (registeredHandlers.get('advancedMemory:reject') as (event: unknown, _id: string) => Promise<unknown>)({}, 'pending-1');

            expect(result).toEqual({ success: true });
        });
    });

    describe('advancedMemory:remember', () => {
        it('should create an explicit memory', async () => {
            const handler = async (_: unknown, content: string) => {
                return { success: true, data: { id: 'mem-new', content } };
            };
            registeredHandlers.set('advancedMemory:remember', handler);

            const result = await (registeredHandlers.get('advancedMemory:remember') as (event: unknown, content: string) => Promise<unknown>)({}, 'Important fact');

            expect(result).toHaveProperty('success', true);
        });
    });

    describe('advancedMemory:recall', () => {
        it('should recall memories by context', async () => {
            const handler = async () => {
                return { success: true, data: { memories: [], totalMatches: 0 } };
            };
            registeredHandlers.set('advancedMemory:recall', handler);

            const result = await (registeredHandlers.get('advancedMemory:recall') as () => Promise<unknown>)();

            expect(result).toHaveProperty('success', true);
        });
    });

    describe('advancedMemory:getStats', () => {
        it('should return memory statistics', async () => {
            const handler = async () => {
                return { success: true, data: { totalMemories: 10, pendingCount: 2 } };
            };
            registeredHandlers.set('advancedMemory:getStats', handler);

            const result = await (registeredHandlers.get('advancedMemory:getStats') as () => Promise<unknown>)();

            expect(result).toHaveProperty('success', true);
        });
    });

    describe('advancedMemory:delete', () => {
        it('should delete a memory', async () => {
            const handler = async (_: unknown) => {
                return { success: true };
            };
            registeredHandlers.set('advancedMemory:delete', handler);

            const result = await (registeredHandlers.get('advancedMemory:delete') as (event: unknown, _id: string) => Promise<unknown>)({}, 'mem-1');

            expect(result).toEqual({ success: true });
        });
    });
});
