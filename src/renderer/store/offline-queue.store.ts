import { useSyncExternalStore } from 'react';

const MAX_QUEUE_SIZE = 50;

/** Status of a queued prompt */
type QueuedPromptStatus = 'queued' | 'sending';

/** A chat prompt queued while offline */
export interface QueuedPrompt {
    id: string;
    message: string;
    timestamp: number;
    status: QueuedPromptStatus;
}

interface OfflineQueueState {
    items: QueuedPrompt[];
    isOnline: boolean;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let state: OfflineQueueState = { items: [], isOnline: navigator.onLine };

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

/** Flush callback invoked when the browser comes back online */
let onFlush: ((prompts: QueuedPrompt[]) => void) | undefined;

/** Register a callback that fires with all queued prompts on reconnect */
export function setFlushHandler(handler: (prompts: QueuedPrompt[]) => void): void {
    onFlush = handler;
}

function flush(): void {
    if (state.items.length === 0 || !onFlush) return;
    const toSend = state.items.map((p) => ({ ...p, status: 'sending' as const }));
    state = { ...state, items: toSend };
    emit();
    onFlush(toSend);
    state = { ...state, items: [] };
    emit();
}

/** Add a prompt to the offline queue. Drops oldest if at capacity. */
export function enqueuePrompt(message: string): QueuedPrompt {
    const item: QueuedPrompt = {
        id: `oq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message,
        timestamp: Date.now(),
        status: 'queued'
    };
    const next = [...state.items, item];
    if (next.length > MAX_QUEUE_SIZE) {
        next.splice(0, next.length - MAX_QUEUE_SIZE);
    }
    state = { ...state, items: next };
    emit();
    return item;
}

/** Remove and return all queued prompts */
export function dequeueAll(): QueuedPrompt[] {
    const items = [...state.items];
    state = { ...state, items: [] };
    emit();
    return items;
}

/** Get a snapshot of currently queued prompts */
export function getQueuedPrompts(): QueuedPrompt[] {
    return state.items;
}

/** Clear the queue without returning items */
export function clearQueue(): void {
    state = { ...state, items: [] };
    emit();
}

function getSnapshot(): OfflineQueueState {
    return state;
}

function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** React hook to select from the offline queue store */
export function useOfflineQueueStore<T>(selector: (s: OfflineQueueState) => T): T {
    return useSyncExternalStore(subscribe, () => selector(getSnapshot()), () => selector(getSnapshot()));
}

// Listen for browser online/offline events and auto-flush
window.addEventListener('online', () => {
    state = { ...state, isOnline: true };
    emit();
    flush();
});

window.addEventListener('offline', () => {
    state = { ...state, isOnline: false };
    emit();
});
