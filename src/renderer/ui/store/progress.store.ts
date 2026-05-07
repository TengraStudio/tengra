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
 * Global progress store for tracking concurrent download/backup/export operations.
 * Uses pub-sub pattern with useSyncExternalStore for React integration.
 */
import { useSyncExternalStore } from 'react';

export interface ProgressItem {
  id: string
  label: string
  percent: number
  status: 'active' | 'completing' | 'done'
}

interface ProgressState {
  items: Map<string, ProgressItem>
}

type Listener = () => void

const listeners = new Set<Listener>();
let state: ProgressState = { items: new Map() };

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function getSnapshot(): ProgressState {
  return state;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Start tracking a new progress operation. */
export function startProgress(id: string, label: string): void {
  const next = new Map(state.items);
  next.set(id, { id, label, percent: 0, status: 'active' });
  state = { items: next };
  emit();
}

/** Update the percent (0–100) of an in-progress operation. */
export function updateProgress(id: string, percent: number): void {
  const existing = state.items.get(id);
  if (!existing) {return;}
  const clamped = Math.max(0, Math.min(100, percent));
  const next = new Map(state.items);
  next.set(id, { ...existing, percent: clamped });
  state = { items: next };
  emit();
}

/** Mark an operation as complete; it auto-removes after a short delay. */
export function completeProgress(id: string): void {
  const existing = state.items.get(id);
  if (!existing) {return;}
  const next = new Map(state.items);
  next.set(id, { ...existing, percent: 100, status: 'completing' });
  state = { items: next };
  emit();

  setTimeout(() => {
    const removal = new Map(state.items);
    removal.delete(id);
    state = { items: removal };
    emit();
  }, 600);
}

/** React hook to consume progress state. */
export function useProgressStore<T>(selector: (s: ProgressState) => T): T {
  const snapshotValue = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  );
  return selector(snapshotValue);
}

