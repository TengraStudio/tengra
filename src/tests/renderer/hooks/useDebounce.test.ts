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
import { describe, expect, it, vi } from 'vitest';

import { useDebounce } from '@/hooks/useDebounce';

describe('useDebounce', () => {
    it('returns initial value immediately', () => {
        const { result } = renderHook(() => useDebounce('hello', 300));
        expect(result.current).toBe('hello');
    });

    it('does not update value before delay', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
            { initialProps: { value: 'a', delay: 300 } }
        );

        rerender({ value: 'b', delay: 300 });

        // Value should still be 'a' before timeout fires
        expect(result.current).toBe('a');
    });

    it('updates value after delay', () => {
        vi.useFakeTimers();
        const { result, rerender } = renderHook(
            ({ value }: { value: string }) => useDebounce(value, 300),
            { initialProps: { value: 'a' } }
        );

        rerender({ value: 'b' });

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(result.current).toBe('b');
        vi.useRealTimers();
    });

    it('resets timer on rapid changes', () => {
        vi.useFakeTimers();
        const { result, rerender } = renderHook(
            ({ value }: { value: string }) => useDebounce(value, 300),
            { initialProps: { value: 'a' } }
        );

        rerender({ value: 'b' });
        act(() => { vi.advanceTimersByTime(200); });

        rerender({ value: 'c' });
        act(() => { vi.advanceTimersByTime(200); });

        // 'b' should never appear; only 'a' still active
        expect(result.current).toBe('a');

        act(() => { vi.advanceTimersByTime(100); });
        expect(result.current).toBe('c');

        vi.useRealTimers();
    });

    it('uses default delay of 300ms', () => {
        vi.useFakeTimers();
        const { result, rerender } = renderHook(
            ({ value }: { value: string }) => useDebounce(value),
            { initialProps: { value: 'x' } }
        );

        rerender({ value: 'y' });

        act(() => { vi.advanceTimersByTime(299); });
        expect(result.current).toBe('x');

        act(() => { vi.advanceTimersByTime(1); });
        expect(result.current).toBe('y');

        vi.useRealTimers();
    });

    it('cleans up timeout on unmount', () => {
        vi.useFakeTimers();
        const clearSpy = vi.spyOn(global, 'clearTimeout');
        const { unmount } = renderHook(() => useDebounce('val', 300));

        unmount();
        expect(clearSpy).toHaveBeenCalled();

        clearSpy.mockRestore();
        vi.useRealTimers();
    });

    it('works with non-string types', () => {
        vi.useFakeTimers();
        const { result, rerender } = renderHook(
            ({ value }: { value: number }) => useDebounce(value, 100),
            { initialProps: { value: 1 } }
        );

        rerender({ value: 42 });
        act(() => { vi.advanceTimersByTime(100); });
        expect(result.current).toBe(42);

        vi.useRealTimers();
    });
});

