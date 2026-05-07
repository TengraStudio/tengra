/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useRef, useState } from 'react';

interface RovingTabIndexOptions {
    /** Total number of items in the grid */
    itemCount: number;
    /** Number of columns in the grid (for up/down navigation) */
    columns: number;
    /** Callback when Enter/Space is pressed on focused item */
    onSelect?: (index: number) => void;
}

interface RovingTabIndexResult {
    /** Index of the currently focused item */
    focusedIndex: number;
    /** Get tabIndex for a given item index */
    getTabIndex: (index: number) => 0 | -1;
    /** Get keyboard and focus props for a grid item */
    getItemProps: (index: number) => RovingItemProps;
    /** Ref for the grid container */
    containerRef: React.RefObject<HTMLDivElement>;
}

interface RovingItemProps {
    tabIndex: 0 | -1;
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
    onFocus: () => void;
    'data-roving-index': number;
}

/**
 * Hook implementing roving tabindex pattern for grid keyboard navigation.
 * Arrow keys move focus between items; Enter/Space triggers selection.
 */
export function useRovingTabIndex({
    itemCount,
    columns,
    onSelect
}: RovingTabIndexOptions): RovingTabIndexResult {
    const [focusedIndex, setFocusedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const focusItem = useCallback((index: number) => {
        if (index < 0 || index >= itemCount) { return; }
        setFocusedIndex(index);
        const el = containerRef.current?.querySelector(
            `[data-roving-index="${index}"]`
        ) as HTMLElement | null;
        el?.focus();
    }, [itemCount]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>, index: number) => {
        let nextIndex = index;
        switch (e.key) {
            case 'ArrowRight': nextIndex = index + 1; break;
            case 'ArrowLeft': nextIndex = index - 1; break;
            case 'ArrowDown': nextIndex = index + columns; break;
            case 'ArrowUp': nextIndex = index - columns; break;
            case 'Home': nextIndex = 0; break;
            case 'End': nextIndex = itemCount - 1; break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                onSelect?.(index);
                return;
            default:
                return;
        }
        if (nextIndex >= 0 && nextIndex < itemCount) {
            e.preventDefault();
            focusItem(nextIndex);
        }
    }, [columns, itemCount, onSelect, focusItem]);

    const getTabIndex = useCallback(
        (index: number): 0 | -1 => (index === focusedIndex ? 0 : -1),
        [focusedIndex]
    );

    const getItemProps = useCallback((index: number): RovingItemProps => ({
        tabIndex: index === focusedIndex ? 0 : -1,
        onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => handleKeyDown(e, index),
        onFocus: () => setFocusedIndex(index),
        'data-roving-index': index,
    }), [focusedIndex, handleKeyDown]);

    return { focusedIndex, getTabIndex, getItemProps, containerRef };
}

