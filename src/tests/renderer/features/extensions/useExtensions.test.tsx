/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useExtensions } from '@/features/extensions/hooks/useExtensions';

const mockExtensions = [
    {
        manifest: { id: 'ext-1', name: 'Test Extension', version: '1.0.0' },
        status: 'active' as const,
    },
    {
        manifest: { id: 'ext-2', name: 'Another Extension', version: '2.0.0' },
        status: 'inactive' as const,
    },
];

const buildExtensionMocks = () => ({
    getAll: vi.fn().mockResolvedValue({ success: true, extensions: mockExtensions }),
    install: vi.fn().mockResolvedValue({ success: true, extensionId: 'ext-new' }),
    uninstall: vi.fn().mockResolvedValue({ success: true }),
    activate: vi.fn().mockResolvedValue({ success: true }),
    deactivate: vi.fn().mockResolvedValue({ success: true }),
    devStart: vi.fn().mockResolvedValue({ success: true }),
    devStop: vi.fn().mockResolvedValue({ success: true }),
    devReload: vi.fn().mockResolvedValue({ success: true }),
    test: vi.fn().mockResolvedValue({ success: true, passed: 5, failed: 0, skipped: 0, duration: 100 }),
    publish: vi.fn().mockResolvedValue({ success: true, extensionId: 'ext-1', version: '1.0.1' }),
    getProfile: vi.fn().mockResolvedValue({ success: true, profile: { activationTime: 50, memoryUsage: 1024, callCount: 10, errorCount: 0, timestamps: {} } }),
    getState: vi.fn().mockResolvedValue({ success: true, state: { global: {}, workspace: {} } }),
});

describe('useExtensions', () => {
    let mocks: ReturnType<typeof buildExtensionMocks>;

    beforeEach(() => {
        mocks = buildExtensionMocks();
        const baseElectron = window.electron ?? ({} as typeof window.electron);
        const baseExtension = baseElectron.extension ?? ({} as typeof window.electron.extension);
        window.electron = {
            ...baseElectron,
            extension: {
                ...baseExtension,
                ...mocks,
            },
        } as typeof window.electron;
    });

    it('should load extensions on mount', async () => {
        const { result } = renderHook(() => useExtensions());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.extensions).toHaveLength(2);
        expect(result.current.extensions[0].manifest.id).toBe('ext-1');
        expect(result.current.error).toBeNull();
    });

    it('should handle load error', async () => {
        mocks.getAll.mockRejectedValue(new Error('Failed to load'));
        const { result } = renderHook(() => useExtensions());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe('Failed to load');
        expect(result.current.extensions).toHaveLength(0);
    });

    it('should install extension and refresh', async () => {
        const { result } = renderHook(() => useExtensions());

        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            const installResult = await result.current.install('/path/to/ext');
            expect(installResult.success).toBe(true);
            expect(installResult.extensionId).toBe('ext-new');
        });

        expect(mocks.install).toHaveBeenCalledWith('/path/to/ext');
        // refresh should have been called after install
        expect(mocks.getAll.mock.calls.length).toBeGreaterThan(1);
    });

    it('should uninstall extension and refresh', async () => {
        const { result } = renderHook(() => useExtensions());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            const uninstallResult = await result.current.uninstall('ext-1');
            expect(uninstallResult.success).toBe(true);
        });

        expect(mocks.uninstall).toHaveBeenCalledWith('ext-1');
    });

    it('should activate and deactivate extensions', async () => {
        const { result } = renderHook(() => useExtensions());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.activate('ext-2');
        });
        expect(mocks.activate).toHaveBeenCalledWith('ext-2');

        await act(async () => {
            await result.current.deactivate('ext-1');
        });
        expect(mocks.deactivate).toHaveBeenCalledWith('ext-1');
    });

    it('should handle API not available gracefully', async () => {
        mocks.getAll.mockResolvedValue(undefined);
        const { result } = renderHook(() => useExtensions());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe('Failed to fetch extensions');
    });
});

