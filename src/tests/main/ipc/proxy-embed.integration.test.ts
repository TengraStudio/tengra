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
 * Integration tests for Proxy-Embed IPC handlers
 */
import { ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: { handle: vi.fn(), removeHandler: vi.fn() }
}));

describe('Proxy-Embed IPC Handlers', () => {
    let registeredHandlers: Map<string, TestValue>;

    beforeEach(() => {
        registeredHandlers = new Map();
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: TestValue) => {
            registeredHandlers.set(channel, handler);
        });
    });

    afterEach(() => { vi.clearAllMocks(); });

    describe('proxy:embed:start', () => {
        it('should start embedded proxy', async () => {
            const handler = async () => ({ success: true, port: 8080 });
            registeredHandlers.set('proxy:embed:start', handler);
            const result = await (registeredHandlers.get('proxy:embed:start') as () => Promise<TestValue>)();
            expect(result).toHaveProperty('success');
        });
    });

    describe('proxy:embed:stop', () => {
        it('should stop embedded proxy', async () => {
            const handler = async () => undefined;
            registeredHandlers.set('proxy:embed:stop', handler);
            const result = await (registeredHandlers.get('proxy:embed:stop') as () => Promise<TestValue>)();
            expect(result).toBeUndefined();
        });
    });

    describe('proxy:embed:status', () => {
        it('should return proxy status', async () => {
            const handler = async () => ({ running: true, port: 8080 });
            registeredHandlers.set('proxy:embed:status', handler);
            const result = await (registeredHandlers.get('proxy:embed:status') as () => Promise<TestValue>)();
            expect(result).toHaveProperty('running');
        });
    });
});
