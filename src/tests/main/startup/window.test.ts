/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createWindow, setMainWindow } from '@main/startup/window';
import { BrowserWindow } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockWindow = {
    isDestroyed: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    loadFile: vi.fn().mockResolvedValue(undefined),
    loadURL: vi.fn().mockResolvedValue(undefined),
    webContents: {
        on: vi.fn(),
        once: vi.fn(),
        setZoomFactor: vi.fn(),
        session: {
            webRequest: {
                onHeadersReceived: vi.fn(),
            },
            setPermissionRequestHandler: vi.fn(),
            setPermissionCheckHandler: vi.fn(),
        },
    },
};

vi.mock('electron', () => ({
    app: {
        isPackaged: false,
        getLoginItemSettings: vi.fn().mockReturnValue({ wasOpenedAtLogin: false }),
    },
    BrowserWindow: vi.fn(class BrowserWindow {
        constructor() {
            return mockWindow;
        }
    }),
    Menu: { buildFromTemplate: vi.fn() },
    Tray: vi.fn(),
    nativeImage: { createFromPath: vi.fn() },
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('createWindow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setMainWindow(null);
        mockWindow.isDestroyed.mockReturnValue(false);
    });

    afterEach(() => {
        setMainWindow(null);
    });

    it('reuses the existing main window', () => {
        const firstWindow = createWindow();
        const secondWindow = createWindow();

        expect(firstWindow).toBe(secondWindow);
        expect(vi.mocked(BrowserWindow).mock.calls).toHaveLength(1);
    });
});
