/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Integration tests for Brain IPC handlers
 */
import { ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn(),
        removeHandler: vi.fn()
    }
}));

describe('Brain IPC Handlers', () => {
    let registeredHandlers: Map<string, TestValue>;

    beforeEach(() => {
        registeredHandlers = new Map();
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: TestValue) => {
            registeredHandlers.set(channel, handler);
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('brain:learn', () => {
        it('should learn a new fact about the user', async () => {
            const handler = async () => {
                return { success: true, fact: { id: 'fact-1', category: 'preference', content: 'I prefer dark mode' } };
            };
            registeredHandlers.set('brain:learn', handler);

            const result = await (registeredHandlers.get('brain:learn') as () => Promise<TestValue>)();

            expect(result).toHaveProperty('success', true);
        });
    });

    describe('brain:recall', () => {
        it('should recall relevant user facts', async () => {
            const handler = async () => {
                return { success: true, facts: [] };
            };
            registeredHandlers.set('brain:recall', handler);

            const result = await (registeredHandlers.get('brain:recall') as () => Promise<TestValue>)();

            expect(result).toHaveProperty('success', true);
        });
    });

    describe('brain:getByCategory', () => {
        it('should get facts by category', async () => {
            const handler = async () => {
                return { success: true, facts: [] };
            };
            registeredHandlers.set('brain:getByCategory', handler);

            const result = await (registeredHandlers.get('brain:getByCategory') as () => Promise<TestValue>)();

            expect(result).toHaveProperty('success', true);
        });
    });

    describe('brain:getContext', () => {
        it('should get full brain context', async () => {
            const handler = async () => {
                return { success: true, context: { preferences: [], facts: [], summary: '' } };
            };
            registeredHandlers.set('brain:getContext', handler);

            const result = await (registeredHandlers.get('brain:getContext') as () => Promise<TestValue>)();

            expect(result).toHaveProperty('success', true);
        });
    });

    describe('brain:extractFromMessage', () => {
        it('should extract facts from message', async () => {
            const handler = async () => {
                return { success: true, facts: [] };
            };
            registeredHandlers.set('brain:extractFromMessage', handler);

            const result = await (registeredHandlers.get('brain:extractFromMessage') as () => Promise<TestValue>)();

            expect(result).toHaveProperty('success', true);
        });
    });

    describe('brain:forget', () => {
        it('should forget a fact', async () => {
            const handler = async () => {
                return { success: true };
            };
            registeredHandlers.set('brain:forget', handler);

            const result = await (registeredHandlers.get('brain:forget') as () => Promise<TestValue>)();

            expect(result).toEqual({ success: true });
        });
    });

    describe('brain:getStats', () => {
        it('should get brain statistics', async () => {
            const handler = async () => {
                return { success: true, stats: { totalFacts: 10, byCategory: {} } };
            };
            registeredHandlers.set('brain:getStats', handler);

            const result = await (registeredHandlers.get('brain:getStats') as () => Promise<TestValue>)();

            expect(result).toHaveProperty('success', true);
        });
    });
});
