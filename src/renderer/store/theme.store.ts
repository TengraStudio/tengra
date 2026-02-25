import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'tengra.theme.v1';

interface ThemeState {
    theme: 'black' | 'white' | string;
}

type Listener = () => void;

const listeners = new Set<Listener>();

const defaultState: ThemeState = {
    theme: 'black'
};

let state: ThemeState = defaultState;

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function persist(): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Ignore persistence failures
    }
}

function hydrate(): void {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return;
        }
        const parsed = JSON.parse(raw) as Partial<ThemeState>;
        state = {
            ...defaultState,
            ...parsed
        };
    } catch {
        state = defaultState;
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
    state = { ...state, theme: newTheme };
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

export function useThemeStore<T>(selector: (snapshot: ThemeState) => T): T {
    return useSyncExternalStore(
        subscribeTheme,
        () => selector(getThemeSnapshot()),
        () => selector(getThemeSnapshot())
    );
}

