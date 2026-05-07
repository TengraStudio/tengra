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
    const health = vi.fn().mockResolvedValue({
        success: true,
        data: {
            status: 'healthy',
            uiState: 'ready',
            budgets: { fastMs: 40, standardMs: 120, heavyMs: 250 },
            metrics: {
                totalCalls: 1,
                totalFailures: 0,
                totalRetries: 0,
                validationFailures: 0,
                budgetExceededCount: 0,
                errorRate: 0,
            },
            memoryContext: {
                cacheHits: 2,
                cacheMisses: 1,
                inflightReuseCount: 0,
                lookupCount: 3,
                lookupTimeoutCount: 0,
                lookupFailureCount: 0,
                lastLookupDurationMs: 8,
                averageLookupDurationMs: 6.5,
                cacheSize: 2,
                inflightSize: 0,
            }
        }
    });
    const importMemory = vi.fn().mockResolvedValue({ success: true, data: { imported: 1, pendingImported: 0, skipped: 0, errors: [] } });

    return {
        getPending,
        getStats,
        getSearchAnalytics,
        recall,
        search,
        health,
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
                health: mocks.health,
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

        expect(getPendingMock.mock.calls.length).toBeGreaterThanOrEqual(2);
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

    it('hydrates memory health metrics from advanced memory health endpoint', async () => {
        const { result } = renderHook(() => useMemory('', 'stats'));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.memoryHealth?.status).toBe('healthy');
        expect(result.current.memoryHealth?.memoryContext?.lookupCount).toBe(3);
    });
});

