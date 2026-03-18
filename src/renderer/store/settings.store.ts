import { useSyncExternalStore } from 'react';

import { AppSettings, JsonValue } from '@/types';
import { unwrapSettingsResponse } from '@/utils/app-settings.util';

const SETTINGS_DRAFT_STORAGE_KEY = 'tengra.settings.draft.v1';
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

const isObjectValue = (value: JsonValue): value is Record<string, JsonValue | undefined> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const deepEqual = (obj1: JsonValue, obj2: JsonValue): boolean => {
    if (obj1 === obj2) {
        return true;
    }

    if (obj1 === null || obj2 === null) {
        return false;
    }

    if (Array.isArray(obj1) || Array.isArray(obj2)) {
        if (!Array.isArray(obj1) || !Array.isArray(obj2) || obj1.length !== obj2.length) {
            return false;
        }

        for (let index = 0; index < obj1.length; index += 1) {
            if (!deepEqual(obj1[index] ?? null, obj2[index] ?? null)) {
                return false;
            }
        }

        return true;
    }

    if (!isObjectValue(obj1) || !isObjectValue(obj2)) {
        return false;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length) {
        return false;
    }

    for (const key of keys1) {
        if (!(key in obj2) || !deepEqual(obj1[key] ?? null, obj2[key] ?? null)) {
            return false;
        }
    }

    return true;
};

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
        const response = await window.electron.getSettings();
        const persisted = unwrapSettingsResponse(response);
        if (!persisted) {
            throw new Error('SETTINGS_INVALID_RESPONSE');
        }
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
        const response = await window.electron.saveSettings(current);
        const saved = unwrapSettingsResponse(response);
        if (!saved) {
            throw new Error('SETTINGS_INVALID_SAVE_RESPONSE');
        }
        setState({ originalSettings: structuredClone(saved) });
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

