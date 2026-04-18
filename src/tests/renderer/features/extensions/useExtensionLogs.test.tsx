/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExtensionLogEntry,useExtensionLogs } from '@/features/extensions/hooks/useExtensionLogs';

type IpcRendererListener = Parameters<typeof window.electron.ipcRenderer.on>[1];
type IpcRendererEventLike = Parameters<IpcRendererListener>[0];
type LogCallback = (_event: IpcRendererEventLike, log: ExtensionLogEntry) => void;

describe('useExtensionLogs', () => {
    let logCallback: LogCallback | null = null;
    const removeListener = vi.fn();

    beforeEach(() => {
        logCallback = null;
        removeListener.mockClear();

        window.electron = {
            ...window.electron,
            ipcRenderer: {
                ...window.electron?.ipcRenderer,
                on: vi.fn((channel: string, callback: LogCallback) => {
                    if (channel === 'extension:log-update') {
                        logCallback = callback;
                    }
                    return removeListener;
                }),
            },
        } as typeof window.electron;
    });

    it('should start with empty logs', () => {
        const { result } = renderHook(() => useExtensionLogs('ext-1'));
        expect(result.current.logs).toHaveLength(0);
    });

    it('should register listener on mount', () => {
        renderHook(() => useExtensionLogs('ext-1'));
        expect(window.electron.ipcRenderer.on).toHaveBeenCalledWith(
            'extension:log-update',
            expect.anything()
        );
    });

    it('should add matching logs', () => {
        const { result } = renderHook(() => useExtensionLogs('ext-1'));
        const event = {} as IpcRendererEventLike;

        act(() => {
            logCallback?.(event, {
                extensionId: 'ext-1',
                level: 'info',
                message: 'Hello',
                timestamp: Date.now(),
            });
        });

        expect(result.current.logs).toHaveLength(1);
        expect(result.current.logs[0].message).toBe('Hello');
    });

    it('should filter logs by extensionId', () => {
        const { result } = renderHook(() => useExtensionLogs('ext-1'));
        const event = {} as IpcRendererEventLike;

        act(() => {
            logCallback?.(event, {
                extensionId: 'ext-2',
                level: 'info',
                message: 'Wrong ext',
                timestamp: Date.now(),
            });
        });

        expect(result.current.logs).toHaveLength(0);
    });

    it('should clear logs', () => {
        const { result } = renderHook(() => useExtensionLogs('ext-1'));
        const event = {} as IpcRendererEventLike;

        act(() => {
            logCallback?.(event, {
                extensionId: 'ext-1',
                level: 'error',
                message: 'Error!',
                timestamp: Date.now(),
            });
        });

        expect(result.current.logs).toHaveLength(1);

        act(() => {
            result.current.clearLogs();
        });

        expect(result.current.logs).toHaveLength(0);
    });

    it('should remove listener on unmount', () => {
        const { unmount } = renderHook(() => useExtensionLogs('ext-1'));
        unmount();
        expect(removeListener).toHaveBeenCalled();
    });
});
