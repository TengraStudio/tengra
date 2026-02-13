import { useSyncExternalStore } from 'react';

import { AppSettings, JsonValue } from '@/types';

const SETTINGS_DRAFT_STORAGE_KEY = 'tandem.settings.draft.v1';
const AUTO_SAVE_DELAY_MS = 2000;

interface SettingsStoreState {
    settings: AppSettings | null;
    originalSettings: AppSettings | null;
    isLoading: boolean;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

let state: SettingsStoreState = {
    settings: null,
    originalSettings: null,
    isLoading: true
};

const deepEqual = (obj1: JsonValue, obj2: JsonValue) => JSON.stringify(obj1) === JSON.stringify(obj2);

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function setState(partial: Partial<SettingsStoreState>): void {
    state = { ...state, ...partial };
    emit();
}

function clearDraft(): void {
    localStorage.removeItem(SETTINGS_DRAFT_STORAGE_KEY);
}

function persistDraft(settings: AppSettings): void {
    localStorage.setItem(SETTINGS_DRAFT_STORAGE_KEY, JSON.stringify(settings));
}

function readDraft(): AppSettings | null {
    const raw = localStorage.getItem(SETTINGS_DRAFT_STORAGE_KEY);
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw) as AppSettings;
    } catch {
        clearDraft();
        return null;
    }
}

function scheduleAutoSave(): void {
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }

    autoSaveTimer = setTimeout(() => {
        void flushSettings();
    }, AUTO_SAVE_DELAY_MS);
}

export async function loadSettings(): Promise<void> {
    setState({ isLoading: true });

    try {
        const persisted = await window.electron.getSettings();
        const draft = readDraft();
        const resolved = draft ?? persisted;

        setState({
            settings: resolved,
            originalSettings: structuredClone(persisted)
        });
    } catch (error) {
        window.electron.log.error('Failed to load settings', error as Error);
    } finally {
        setState({ isLoading: false });
    }
}

export async function flushSettings(): Promise<void> {
    const current = state.settings;
    if (!current) {
        return;
    }

    try {
        await window.electron.saveSettings(current);
        setState({ originalSettings: structuredClone(current) });
        clearDraft();
    } catch (error) {
        window.electron.log.error('Failed to save settings', error as Error);
        persistDraft(current);
    }
}

export async function updateSettings(newSettings: AppSettings, saveImmediately = true): Promise<void> {
    setState({ settings: newSettings });

    if (saveImmediately) {
        await flushSettings();
        return;
    }

    const original = state.originalSettings;
    if (!original || deepEqual(newSettings, original)) {
        return;
    }

    persistDraft(newSettings);
    scheduleAutoSave();
}

export function subscribeSettings(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getSettingsSnapshot(): SettingsStoreState {
    return state;
}

export function useSettingsStore<T>(selector: (snapshot: SettingsStoreState) => T): T {
    return useSyncExternalStore(
        subscribeSettings,
        () => selector(getSettingsSnapshot()),
        () => selector(getSettingsSnapshot())
    );
}
