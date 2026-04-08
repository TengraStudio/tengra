import { useSyncExternalStore } from 'react';

export type DownloadStatus =
    | 'queued'
    | 'starting'
    | 'downloading'
    | 'installing'
    | 'paused'
    | 'cancelled'
    | 'completed'
    | 'error';

export interface DownloadTaskState {
    downloadId: string;
    modelRef: string;
    provider: 'ollama' | 'huggingface';
    status: DownloadStatus;
    message?: string;
    received?: number;
    total?: number;
    speed?: number;
    eta?: number;
}

export interface DownloadHistoryItem extends DownloadTaskState {
    id: string;
    startedAt: number;
    completedAt?: number;
    error?: string;
}

interface DownloadState {
    activeDownloads: Record<string, DownloadTaskState>;
    history: DownloadHistoryItem[];
}

type Listener = () => void;

const listeners = new Set<Listener>();
let state: DownloadState = {
    activeDownloads: {},
    history: []
};

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function getSnapshot(): DownloadState {
    return state;
}

function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export const downloadStore = {
    updateActiveDownload(task: DownloadTaskState): void {
        const nextActive = { ...state.activeDownloads };
        if (['completed', 'cancelled', 'error'].includes(task.status)) {
            delete nextActive[task.modelRef];
        } else {
            nextActive[task.modelRef] = task;
        }
        state = { ...state, activeDownloads: nextActive };
        emit();
    },

    syncActiveDownloads(tasks: DownloadTaskState[]): void {
        const nextActive: Record<string, DownloadTaskState> = {};
        tasks.forEach(task => {
            nextActive[task.modelRef] = task;
        });
        state = { ...state, activeDownloads: nextActive };
        emit();
    },

    clearActiveDownload(modelRef: string): void {
        const nextActive = { ...state.activeDownloads };
        delete nextActive[modelRef];
        state = { ...state, activeDownloads: nextActive };
        emit();
    },

    getSnapshot,
    subscribe
};

export function useDownloadStore<T>(selector: (s: DownloadState) => T): T {
    return useSyncExternalStore(
        subscribe,
        () => selector(getSnapshot()),
        () => selector(getSnapshot())
    );
}
