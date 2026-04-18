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

import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';

interface TestItem {
    name: string;
    tag: string;
}

const ITEMS: TestItem[] = [
    { name: 'Alpha', tag: 'first' },
    { name: 'Beta', tag: 'second' },
    { name: 'Gamma', tag: 'third' },
];

const searchFn = (item: TestItem) => `${item.name} ${item.tag}`;

describe('useDebouncedSearch', () => {
    it('returns all items when search term is empty', () => {
        const { result } = renderHook(() => useDebouncedSearch(ITEMS, searchFn, 100));
        expect(result.current.filteredItems).toEqual(ITEMS);
        expect(result.current.searchTerm).toBe('');
        expect(result.current.debouncedSearchTerm).toBe('');
    });

    it('filters items after debounce delay', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useDebouncedSearch(ITEMS, searchFn, 100));

        act(() => { result.current.setSearchTerm('alpha'); });
        // Before debounce, still shows all items
        expect(result.current.filteredItems).toEqual(ITEMS);

        act(() => { vi.advanceTimersByTime(100); });
        expect(result.current.filteredItems).toHaveLength(1);
        expect(result.current.filteredItems[0].name).toBe('Alpha');

        vi.useRealTimers();
    });

    it('is case-insensitive', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useDebouncedSearch(ITEMS, searchFn, 100));

        act(() => { result.current.setSearchTerm('BETA'); });
        act(() => { vi.advanceTimersByTime(100); });

        expect(result.current.filteredItems).toHaveLength(1);
        expect(result.current.filteredItems[0].name).toBe('Beta');

        vi.useRealTimers();
    });

    it('returns all items for whitespace-only search', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useDebouncedSearch(ITEMS, searchFn, 100));

        act(() => { result.current.setSearchTerm('   '); });
        act(() => { vi.advanceTimersByTime(100); });

        expect(result.current.filteredItems).toEqual(ITEMS);
        vi.useRealTimers();
    });

    it('updates searchTerm immediately', () => {
        const { result } = renderHook(() => useDebouncedSearch(ITEMS, searchFn, 100));

        act(() => { result.current.setSearchTerm('query'); });
        expect(result.current.searchTerm).toBe('query');
    });

    it('returns empty array when no items match', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useDebouncedSearch(ITEMS, searchFn, 100));

        act(() => { result.current.setSearchTerm('zzz'); });
        act(() => { vi.advanceTimersByTime(100); });

        expect(result.current.filteredItems).toHaveLength(0);
        vi.useRealTimers();
    });

    it('responds to items changing', () => {
        vi.useFakeTimers();
        const { result, rerender } = renderHook(
            ({ items }: { items: TestItem[] }) => useDebouncedSearch(items, searchFn, 100),
            { initialProps: { items: ITEMS } }
        );

        act(() => { result.current.setSearchTerm('alpha'); });
        act(() => { vi.advanceTimersByTime(100); });
        expect(result.current.filteredItems).toHaveLength(1);

        rerender({ items: [] });
        expect(result.current.filteredItems).toHaveLength(0);

        vi.useRealTimers();
    });
});
