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

vi.mock('@/utils/undo-redo.util', () => {
    class MockUndoRedoStack<T> {
        private past: T[] = [];
        private future: T[] = [];
        private _state: T;

        constructor(initial: T, private maxHistory: number) {
            this._state = initial;
        }

        get state(): T { return this._state; }
        get canUndo(): boolean { return this.past.length > 0; }
        get canRedo(): boolean { return this.future.length > 0; }

        push(value: T): void {
            this.past.push(this._state);
            if (this.past.length > this.maxHistory) { this.past.shift(); }
            this._state = value;
            this.future = [];
        }

        undo(): T | undefined {
            const prev = this.past.pop();
            if (prev !== undefined) {
                this.future.push(this._state);
                this._state = prev;
            }
            return prev;
        }

        redo(): T | undefined {
            const next = this.future.pop();
            if (next !== undefined) {
                this.past.push(this._state);
                this._state = next;
            }
            return next;
        }
    }
    return { UndoRedoStack: MockUndoRedoStack };
});

import { useUndoRedo } from '@/hooks/useUndoRedo';

describe('useUndoRedo', () => {
    it('returns initial state', () => {
        const { result } = renderHook(() => useUndoRedo('init'));
        expect(result.current.state).toBe('init');
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(false);
    });

    it('updates state via set', () => {
        const { result } = renderHook(() => useUndoRedo(0));

        act(() => { result.current.set(1); });
        expect(result.current.state).toBe(1);
        expect(result.current.canUndo).toBe(true);
        expect(result.current.canRedo).toBe(false);
    });

    it('undoes to previous state', () => {
        const { result } = renderHook(() => useUndoRedo('a'));

        act(() => { result.current.set('b'); });
        act(() => { result.current.undo(); });

        expect(result.current.state).toBe('a');
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(true);
    });

    it('redoes after undo', () => {
        const { result } = renderHook(() => useUndoRedo('a'));

        act(() => { result.current.set('b'); });
        act(() => { result.current.undo(); });
        act(() => { result.current.redo(); });

        expect(result.current.state).toBe('b');
        expect(result.current.canUndo).toBe(true);
        expect(result.current.canRedo).toBe(false);
    });

    it('clears redo stack on new set after undo', () => {
        const { result } = renderHook(() => useUndoRedo(0));

        act(() => { result.current.set(1); });
        act(() => { result.current.set(2); });
        act(() => { result.current.undo(); });

        expect(result.current.canRedo).toBe(true);

        act(() => { result.current.set(3); });
        expect(result.current.canRedo).toBe(false);
        expect(result.current.state).toBe(3);
    });

    it('undo on empty history is no-op', () => {
        const { result } = renderHook(() => useUndoRedo('x'));

        act(() => { result.current.undo(); });
        expect(result.current.state).toBe('x');
    });

    it('redo on empty future is no-op', () => {
        const { result } = renderHook(() => useUndoRedo('x'));

        act(() => { result.current.redo(); });
        expect(result.current.state).toBe('x');
    });

    it('supports multiple sequential operations', () => {
        const { result } = renderHook(() => useUndoRedo(0));

        act(() => { result.current.set(1); });
        act(() => { result.current.set(2); });
        act(() => { result.current.set(3); });

        act(() => { result.current.undo(); });
        expect(result.current.state).toBe(2);

        act(() => { result.current.undo(); });
        expect(result.current.state).toBe(1);

        act(() => { result.current.redo(); });
        expect(result.current.state).toBe(2);
    });
});

