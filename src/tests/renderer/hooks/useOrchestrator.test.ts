import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetState = vi.fn();
const mockStart = vi.fn();
const mockApprove = vi.fn();
const mockStop = vi.fn();
let onUpdateCallback: ((state: Record<string, unknown>) => void) | null = null;
const mockUnsubscribe = vi.fn();

Object.defineProperty(window, 'electron', {
    value: {
        orchestrator: {
            onUpdate: vi.fn((cb: (state: Record<string, unknown>) => void) => {
                onUpdateCallback = cb;
                return mockUnsubscribe;
            }),
            getState: mockGetState,
            start: mockStart,
            approve: mockApprove,
            stop: mockStop,
        },
    },
    configurable: true,
    writable: true,
});

vi.mock('../../../renderer/electron', () => ({
    OrchestratorStateView: {},
}));

import { useOrchestrator } from '@/hooks/useOrchestrator';

describe('useOrchestrator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        onUpdateCallback = null;
        mockGetState.mockResolvedValue({ phase: 'idle' });
    });

    it('fetches initial state on mount', async () => {
        const { result } = renderHook(() => useOrchestrator());

        await act(async () => {
            await Promise.resolve();
        });

        await vi.waitFor(() => {
            expect(result.current.state).toEqual({ phase: 'idle' });
        });
        expect(mockGetState).toHaveBeenCalledOnce();
    });

    it('subscribes to updates and unsubscribes on unmount', () => {
        const { unmount } = renderHook(() => useOrchestrator());

        expect(window.electron.orchestrator.onUpdate).toHaveBeenCalledOnce();

        unmount();
        expect(mockUnsubscribe).toHaveBeenCalledOnce();
    });

    it('updates state on IPC update', async () => {
        const { result } = renderHook(() => useOrchestrator());

        await act(async () => {
            await Promise.resolve();
        });

        await vi.waitFor(() => {
            expect(result.current.state).not.toBeNull();
        });

        act(() => {
            onUpdateCallback?.({ phase: 'planning' });
        });

        expect(result.current.state).toEqual({ phase: 'planning' });
    });

    it('start sets loading and calls IPC', async () => {
        mockStart.mockResolvedValue(undefined);
        const { result } = renderHook(() => useOrchestrator());

        await act(async () => {
            await result.current.start('build feature');
        });

        expect(mockStart).toHaveBeenCalledWith('build feature', undefined);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('start sets error on failure', async () => {
        mockStart.mockRejectedValue(new Error('Connection lost'));
        const { result } = renderHook(() => useOrchestrator());

        await act(async () => {
            await result.current.start('task');
        });

        expect(result.current.error).toBe('Connection lost');
        expect(result.current.loading).toBe(false);
    });

    it('approve calls IPC with plan', async () => {
        mockApprove.mockResolvedValue(undefined);
        const { result } = renderHook(() => useOrchestrator());
        const plan = [{ id: 's1', action: 'create', description: 'step 1' }];

        await act(async () => {
            await result.current.approve(plan as never);
        });

        expect(mockApprove).toHaveBeenCalledWith(plan);
    });

    it('stop calls IPC', async () => {
        mockStop.mockResolvedValue(undefined);
        const { result } = renderHook(() => useOrchestrator());

        await act(async () => {
            await result.current.stop();
        });

        expect(mockStop).toHaveBeenCalledOnce();
    });

    it('stop sets error on failure', async () => {
        mockStop.mockRejectedValue(new Error('Cannot stop'));
        const { result } = renderHook(() => useOrchestrator());

        await act(async () => {
            await result.current.stop();
        });

        expect(result.current.error).toBe('Cannot stop');
    });

    it('refresh fetches fresh state', async () => {
        mockGetState.mockResolvedValueOnce({ phase: 'idle' }).mockResolvedValueOnce({ phase: 'executing' });
        const { result } = renderHook(() => useOrchestrator());

        await act(async () => {
            await Promise.resolve();
        });

        await vi.waitFor(() => {
            expect(result.current.state).toEqual({ phase: 'idle' });
        });

        await act(async () => {
            await result.current.refresh();
        });

        expect(result.current.state).toEqual({ phase: 'executing' });
    });

    it('does not update state after unmount', async () => {
        const { result, unmount } = renderHook(() => useOrchestrator());

        await act(async () => {
            await Promise.resolve();
        });

        await vi.waitFor(() => {
            expect(result.current.state).not.toBeNull();
        });

        unmount();

        // Callback should not throw after unmount
        act(() => {
            onUpdateCallback?.({ phase: 'should-not-appear' });
        });
    });
});
