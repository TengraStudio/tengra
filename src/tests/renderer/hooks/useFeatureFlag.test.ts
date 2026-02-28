import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Must clear module-level state between tests
let mockInvoke: ReturnType<typeof vi.fn>;

beforeEach(() => {
    mockInvoke = vi.fn();
    Object.defineProperty(window, 'api', {
        value: { invoke: mockInvoke },
        configurable: true,
        writable: true,
    });
});

afterEach(() => {
    // Reset module cache to clear shared state (flagState, pending, listeners)
    vi.resetModules();
});

describe('useFeatureFlag', () => {
    it('returns loading state initially', async () => {
        mockInvoke.mockReturnValue(new Promise(() => { /* never resolves */ }));
        const { useFeatureFlag } = await import('@/hooks/useFeatureFlag');

        const { result } = renderHook(() => useFeatureFlag('test.flag'));

        expect(result.current.isLoading).toBe(true);
        expect(result.current.isEnabled).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('returns enabled state after IPC resolves', async () => {
        mockInvoke.mockResolvedValue(true);
        const { useFeatureFlag } = await import('@/hooks/useFeatureFlag');

        const { result } = renderHook(() => useFeatureFlag('enabled.flag'));

        // Wait for async IPC to resolve
        await vi.waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isEnabled).toBe(true);
        expect(result.current.error).toBeNull();
    });

    it('returns disabled state for false flag', async () => {
        mockInvoke.mockResolvedValue(false);
        const { useFeatureFlag } = await import('@/hooks/useFeatureFlag');

        const { result } = renderHook(() => useFeatureFlag('disabled.flag'));

        await vi.waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isEnabled).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('handles IPC error gracefully', async () => {
        mockInvoke.mockRejectedValue(new Error('IPC failed'));
        const { useFeatureFlag } = await import('@/hooks/useFeatureFlag');

        const { result } = renderHook(() => useFeatureFlag('error.flag'));

        await vi.waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.isEnabled).toBe(false);
        expect(result.current.error).toBe('IPC failed');
    });

    it('invalidateFeatureFlag causes re-fetch', async () => {
        mockInvoke.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        const { useFeatureFlag, invalidateFeatureFlag } = await import('@/hooks/useFeatureFlag');

        const { result } = renderHook(() => useFeatureFlag('toggle.flag'));

        await vi.waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });
        expect(result.current.isEnabled).toBe(false);

        invalidateFeatureFlag('toggle.flag');

        await vi.waitFor(() => {
            expect(result.current.isEnabled).toBe(true);
        });
    });

    it('clearFeatureFlagCache clears all flags', async () => {
        mockInvoke.mockResolvedValue(true);
        const { useFeatureFlag, clearFeatureFlagCache } = await import('@/hooks/useFeatureFlag');

        const { result } = renderHook(() => useFeatureFlag('cached.flag'));

        await vi.waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        mockInvoke.mockResolvedValue(false);
        clearFeatureFlagCache();

        await vi.waitFor(() => {
            expect(result.current.isEnabled).toBe(false);
        });
    });

    it('falls back to false when window.api is undefined', async () => {
        Object.defineProperty(window, 'api', {
            value: undefined,
            configurable: true,
            writable: true,
        });
        const { useFeatureFlag } = await import('@/hooks/useFeatureFlag');

        const { result } = renderHook(() => useFeatureFlag('no-api.flag'));

        await vi.waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });
        expect(result.current.isEnabled).toBe(false);
    });
});
