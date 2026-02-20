import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMemory } from '@/features/memory/hooks/useMemory';
import { memoryInspectorErrorCodes } from '@/features/memory/utils/memory-inspector-validation';
import { webElectronMock } from '@/web-bridge';

const buildAdvancedMemoryMocks = () => {
    const getPending = vi.fn().mockResolvedValue({ success: true, data: [] });
    const getStats = vi.fn().mockResolvedValue({ success: true, data: null });
    const getSearchAnalytics = vi.fn().mockResolvedValue({
        success: true,
        data: {
            totalQueries: 0,
            semanticQueries: 0,
            textQueries: 0,
            hybridQueries: 0,
            averageResults: 0,
            topQueries: [],
        },
    });
    const recall = vi.fn().mockResolvedValue({ success: true, data: { memories: [], totalMatches: 0 } });
    const search = vi.fn().mockResolvedValue({ success: true, data: [] });
    const importMemory = vi.fn().mockResolvedValue({ success: true, data: { imported: 1, pendingImported: 0, skipped: 0, errors: [] } });

    return {
        getPending,
        getStats,
        getSearchAnalytics,
        recall,
        search,
        importMemory,
    };
};

describe('useMemory', () => {
    beforeEach(() => {
        const base = window.electron ?? webElectronMock;
        const mocks = buildAdvancedMemoryMocks();

        window.electron = {
            ...base,
            advancedMemory: {
                ...base.advancedMemory,
                getPending: mocks.getPending,
                getStats: mocks.getStats,
                getSearchAnalytics: mocks.getSearchAnalytics,
                recall: mocks.recall,
                search: mocks.search,
                import: mocks.importMemory,
            },
        };
    });

    it('retries loadData and recovers from first transient failure', async () => {
        const getPendingMock = window.electron.advancedMemory.getPending as ReturnType<typeof vi.fn>;
        getPendingMock
            .mockRejectedValueOnce(new Error('transient'))
            .mockResolvedValue({ success: true, data: [] });

        const { result } = renderHook(() => useMemory('', 'pending'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(getPendingMock).toHaveBeenCalledTimes(2);
        expect(result.current.error).toBeNull();
    });

    it('sets standardized import validation error for malformed payload', async () => {
        const { result } = renderHook(() => useMemory('', 'pending'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
            await result.current.handleImport('{"memories":"invalid"}', false);
        });

        await waitFor(() => {
            expect(result.current.lastErrorCode).toBe(memoryInspectorErrorCodes.importInvalidPayload);
        });
    });
});
