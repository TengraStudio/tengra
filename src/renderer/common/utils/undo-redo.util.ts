/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Generic undo/redo stack using immutable state snapshots.
 * @template T - The state type to track
 */
export class UndoRedoStack<T> {
  private past: T[] = [];
  private future: T[] = [];
  private current: T;
  private readonly maxHistory: number;

  constructor(initialState: T, maxHistory = 20) {
    this.current = structuredClone(initialState);
    this.maxHistory = maxHistory;
  }

  /** Push a new state, clearing any redo history. */
  push(state: T): void {
    this.past.push(structuredClone(this.current));
    if (this.past.length > this.maxHistory) {
      this.past.shift();
    }
    this.current = structuredClone(state);
    this.future = [];
  }

  /** Undo to the previous state. Returns the restored state or `undefined`. */
  undo(): T | undefined {
    const previous = this.past.pop();
    if (previous === undefined) {return undefined;}
    this.future.push(structuredClone(this.current));
    this.current = previous;
    return structuredClone(this.current);
  }

  /** Redo to the next state. Returns the restored state or `undefined`. */
  redo(): T | undefined {
    const next = this.future.pop();
    if (next === undefined) {return undefined;}
    this.past.push(structuredClone(this.current));
    this.current = next;
    return structuredClone(this.current);
  }

  /** Whether an undo operation is available. */
  get canUndo(): boolean {
    return this.past.length > 0;
  }

  /** Whether a redo operation is available. */
  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Returns an immutable copy of the current state. */
  get state(): T {
    return structuredClone(this.current);
  }
}
