import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useRovingTabIndex } from '@/hooks/useRovingTabIndex';

type KeyboardEventStub = Pick<React.KeyboardEvent<HTMLElement>, 'key' | 'preventDefault'>;

function createKeyboardEvent(key: string): React.KeyboardEvent<HTMLElement> {
    const event: KeyboardEventStub = {
        key,
        preventDefault: vi.fn(),
    };
    return event as React.KeyboardEvent<HTMLElement>;
}

describe('useRovingTabIndex', () => {
    it('initializes with focusedIndex 0', () => {
        const { result } = renderHook(() =>
            useRovingTabIndex({ itemCount: 6, columns: 3 })
        );
        expect(result.current.focusedIndex).toBe(0);
    });

    it('getTabIndex returns 0 for focused, -1 for others', () => {
        const { result } = renderHook(() =>
            useRovingTabIndex({ itemCount: 6, columns: 3 })
        );
        expect(result.current.getTabIndex(0)).toBe(0);
        expect(result.current.getTabIndex(1)).toBe(-1);
        expect(result.current.getTabIndex(5)).toBe(-1);
    });

    it('getItemProps returns correct shape', () => {
        const { result } = renderHook(() =>
            useRovingTabIndex({ itemCount: 6, columns: 3 })
        );
        const props = result.current.getItemProps(2);
        expect(props.tabIndex).toBe(-1);
        expect(props['data-roving-index']).toBe(2);
        expect(typeof props.onKeyDown).toBe('function');
        expect(typeof props.onFocus).toBe('function');
    });

    it('onFocus updates focusedIndex', () => {
        const { result } = renderHook(() =>
            useRovingTabIndex({ itemCount: 6, columns: 3 })
        );

        act(() => {
            result.current.getItemProps(3).onFocus();
        });

        expect(result.current.focusedIndex).toBe(3);
        expect(result.current.getTabIndex(3)).toBe(0);
        expect(result.current.getTabIndex(0)).toBe(-1);
    });

    it('ArrowRight moves focus forward', () => {
        const { result } = renderHook(() =>
            useRovingTabIndex({ itemCount: 6, columns: 3 })
        );

        const event = createKeyboardEvent('ArrowRight');
        act(() => {
            result.current.getItemProps(0).onKeyDown(event);
        });

        expect(result.current.focusedIndex).toBe(1);
    });

    it('ArrowDown moves focus by columns', () => {
        const { result } = renderHook(() =>
            useRovingTabIndex({ itemCount: 6, columns: 3 })
        );

        const event = createKeyboardEvent('ArrowDown');
        act(() => {
            result.current.getItemProps(1).onKeyDown(event);
        });

        expect(result.current.focusedIndex).toBe(4);
    });

    it('does not move past boundaries', () => {
        const { result } = renderHook(() =>
            useRovingTabIndex({ itemCount: 3, columns: 3 })
        );

        const event = createKeyboardEvent('ArrowDown');
        act(() => {
            result.current.getItemProps(0).onKeyDown(event);
        });

        // No row below, should stay at 0
        expect(result.current.focusedIndex).toBe(0);
    });

    it('Home moves to first, End moves to last', () => {
        const { result } = renderHook(() =>
            useRovingTabIndex({ itemCount: 6, columns: 3 })
        );

        // Move to index 3 first
        act(() => { result.current.getItemProps(3).onFocus(); });

        const homeEvent = createKeyboardEvent('Home');
        act(() => { result.current.getItemProps(3).onKeyDown(homeEvent); });
        expect(result.current.focusedIndex).toBe(0);

        const endEvent = createKeyboardEvent('End');
        act(() => { result.current.getItemProps(0).onKeyDown(endEvent); });
        expect(result.current.focusedIndex).toBe(5);
    });

    it('Enter/Space calls onSelect', () => {
        const onSelect = vi.fn();
        const { result } = renderHook(() =>
            useRovingTabIndex({ itemCount: 6, columns: 3, onSelect })
        );

        const enterEvent = createKeyboardEvent('Enter');
        act(() => { result.current.getItemProps(2).onKeyDown(enterEvent); });

        expect(onSelect).toHaveBeenCalledWith(2);
    });

    it('provides a containerRef', () => {
        const { result } = renderHook(() =>
            useRovingTabIndex({ itemCount: 6, columns: 3 })
        );
        expect(result.current.containerRef).toBeDefined();
        expect(result.current.containerRef.current).toBeNull();
    });
});
