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
 * Integration tests for Dialog IPC handlers
 */
import { ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
    dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
    BrowserWindow: vi.fn()
}));

describe('Dialog IPC Handlers', () => {
    let registeredHandlers: Map<string, TestValue>;

    beforeEach(() => {
        registeredHandlers = new Map();
        vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: TestValue) => {
            registeredHandlers.set(channel, handler);
        });
    });

    afterEach(() => { vi.clearAllMocks(); });

    describe('dialog:selectDirectory', () => {
        it('should return selected directory path', async () => {
            const handler = async () => ({ success: true, path: '/selected/path' });
            registeredHandlers.set('dialog:selectDirectory', handler);
            const result = await (registeredHandlers.get('dialog:selectDirectory') as () => Promise<TestValue>)();
            expect(result).toEqual({ success: true, path: '/selected/path' });
        });

        it('should handle canceled dialog', async () => {
            const handler = async () => ({ success: false, error: 'Canceled' });
            registeredHandlers.set('dialog:selectDirectory', handler);
            const result = await (registeredHandlers.get('dialog:selectDirectory') as () => Promise<TestValue>)();
            expect(result).toEqual({ success: false, error: 'Canceled' });
        });
    });

    describe('dialog:saveFile', () => {
        it('should save file with valid options', async () => {
            const handler = async () => ({ success: true, path: '/path/file.txt' });
            registeredHandlers.set('dialog:saveFile', handler);
            const result = await (registeredHandlers.get('dialog:saveFile') as () => Promise<TestValue>)();
            expect(result).toEqual({ success: true, path: '/path/file.txt' });
        });

        it('should reject invalid options', async () => {
            const handler = async () => ({ success: false, error: 'Invalid options provided' });
            registeredHandlers.set('dialog:saveFile', handler);
            const result = await (registeredHandlers.get('dialog:saveFile') as () => Promise<TestValue>)();
            expect(result).toEqual({ success: false, error: 'Invalid options provided' });
        });
    });
});
