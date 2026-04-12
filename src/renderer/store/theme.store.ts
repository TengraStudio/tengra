import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'tengra.theme.v1';

/** Theme loading status for UX states */
export type ThemeLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ThemeState {
    theme: 'black' | 'white' | string;
    /** Current loading status for skeleton/spinner rendering */
    status: ThemeLoadStatus;
    /** Last error message when status is 'error' */
    errorMessage: string | null;
}

type Listener = () => void;

const listeners = new Set<Listener>();

const defaultState: ThemeState = {
    theme: 'black',
    status: 'idle',
    errorMessage: null,
};

let state: ThemeState = defaultState;

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function persist(): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: state.theme }));
    } catch {
        // Ignore persistence failures
    }
}

function hydrate(): void {
    state = { ...defaultState, status: 'loading' };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            state = { ...defaultState, status: 'ready' };
            return;
        }
        const parsed = JSON.parse(raw) as Partial<ThemeState>;
        state = {
            ...defaultState,
            ...parsed,
            status: 'ready',
            errorMessage: null,
        };
    } catch {
        state = { ...defaultState, status: 'error', errorMessage: 'Failed to load theme preferences' };
    }
}

hydrate();

export function getThemeSnapshot(): ThemeState {
    return state;
}

export function subscribeTheme(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function setTheme(newTheme: ThemeState['theme']): void {
    state = { ...state, theme: newTheme, status: 'ready', errorMessage: null };
    persist();
    emit();

    // Apply theme to DOM
    const root = window.document.documentElement;
    root.setAttribute('data-theme', newTheme);
}

export function toggleTheme(): void {
    const newTheme = state.theme === 'black' ? 'white' : 'black';
    setTheme(newTheme);
}

/** Resets theme store to defaults (useful after persistent error). */
export function resetTheme(): void {
    state = { ...defaultState, status: 'ready' };
    persist();
    emit();
    const root = window.document.documentElement;
    root.setAttribute('data-theme', defaultState.theme);
}

export function useThemeStore<T>(selector: (snapshot: ThemeState) => T): T {
    const snapshot = useSyncExternalStore(subscribeTheme, getThemeSnapshot);
    return selector(snapshot);
}

