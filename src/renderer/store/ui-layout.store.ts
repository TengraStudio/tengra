import { useSyncExternalStore } from 'react';

const CURRENT_STORAGE_KEY = 'tengra.ui-layout.v2';
const LEGACY_STORAGE_KEY = 'tengra.ui-layout.v1';
const UI_LAYOUT_SCHEMA_VERSION = 2;

export interface UiLayoutState {
    version: number;
    activityBar: {
        activeItem: string;
        collapsed: boolean;
    };
    appShell: {
        sidebarCollapsed: boolean;
    };
    projectShell: {
        sidebarCollapsed: boolean;
        agentPanelWidth: number;
        terminalHeight: number;
    };
}

type Listener = () => void;

const listeners = new Set<Listener>();

const defaultState: UiLayoutState = {
    version: UI_LAYOUT_SCHEMA_VERSION,
    activityBar: {
        activeItem: 'chat',
        collapsed: false,
    },
    appShell: {
        sidebarCollapsed: false,
    },
    projectShell: {
        sidebarCollapsed: false,
        agentPanelWidth: 380,
        terminalHeight: 250,
    },
};

let state: UiLayoutState = defaultState;

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

function persist(): void {
    try {
        localStorage.setItem(CURRENT_STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Ignore persistence failures in restricted environments.
    }
}

function isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function toBoundedNumber(
    value: unknown,
    fallback: number,
    min: number,
    max: number
): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, Math.floor(value)));
}

function sanitizeActivityBar(value: unknown): UiLayoutState['activityBar'] {
    if (!isObject(value)) {
        return defaultState.activityBar;
    }
    const activeItemRaw = typeof value.activeItem === 'string' ? value.activeItem.trim() : '';
    return {
        activeItem: activeItemRaw || defaultState.activityBar.activeItem,
        collapsed: toBoolean(value.collapsed, defaultState.activityBar.collapsed),
    };
}

function sanitizeAppShell(value: unknown): UiLayoutState['appShell'] {
    if (!isObject(value)) {
        return defaultState.appShell;
    }
    return {
        sidebarCollapsed: toBoolean(value.sidebarCollapsed, defaultState.appShell.sidebarCollapsed),
    };
}

function sanitizeProjectShell(value: unknown): UiLayoutState['projectShell'] {
    if (!isObject(value)) {
        return defaultState.projectShell;
    }
    return {
        sidebarCollapsed: toBoolean(
            value.sidebarCollapsed,
            defaultState.projectShell.sidebarCollapsed
        ),
        agentPanelWidth: toBoundedNumber(
            value.agentPanelWidth,
            defaultState.projectShell.agentPanelWidth,
            260,
            640
        ),
        terminalHeight: toBoundedNumber(
            value.terminalHeight,
            defaultState.projectShell.terminalHeight,
            150,
            900
        ),
    };
}

function migrateLegacyUiLayout(raw: unknown): UiLayoutState | null {
    if (!isObject(raw)) {
        return null;
    }
    const hasLegacyActivityBar = isObject(raw.activityBar);
    if (!hasLegacyActivityBar) {
        return null;
    }
    return {
        ...defaultState,
        version: UI_LAYOUT_SCHEMA_VERSION,
        activityBar: sanitizeActivityBar(raw.activityBar),
    };
}

export function sanitizeUiLayoutState(raw: unknown): UiLayoutState {
    const migratedLegacy = migrateLegacyUiLayout(raw);
    if (migratedLegacy) {
        return migratedLegacy;
    }

    if (!isObject(raw)) {
        return defaultState;
    }

    return {
        version: UI_LAYOUT_SCHEMA_VERSION,
        activityBar: sanitizeActivityBar(raw.activityBar),
        appShell: sanitizeAppShell(raw.appShell),
        projectShell: sanitizeProjectShell(raw.projectShell),
    };
}

function hydrate(): void {
    try {
        const currentRaw = localStorage.getItem(CURRENT_STORAGE_KEY);
        if (currentRaw) {
            state = sanitizeUiLayoutState(JSON.parse(currentRaw));
            return;
        }

        const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyRaw) {
            state = sanitizeUiLayoutState(JSON.parse(legacyRaw));
            persist();
            return;
        }
    } catch {
        // Fall through to defaults.
    }
    state = defaultState;
}

hydrate();

export function getUiLayoutSnapshot(): UiLayoutState {
    return state;
}

export function subscribeUiLayout(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function setActivityBarState(update: Partial<UiLayoutState['activityBar']>): void {
    const next = {
        ...state.activityBar,
        ...update,
    };
    if (
        next.activeItem === state.activityBar.activeItem &&
        next.collapsed === state.activityBar.collapsed
    ) {
        return;
    }
    state = {
        ...state,
        activityBar: next,
    };
    persist();
    emit();
}

export function setAppShellState(update: Partial<UiLayoutState['appShell']>): void {
    const next = {
        ...state.appShell,
        ...update,
    };
    if (next.sidebarCollapsed === state.appShell.sidebarCollapsed) {
        return;
    }
    state = {
        ...state,
        appShell: next,
    };
    persist();
    emit();
}

export function setProjectShellState(update: Partial<UiLayoutState['projectShell']>): void {
    const next = {
        ...state.projectShell,
        ...update,
    };
    if (
        next.sidebarCollapsed === state.projectShell.sidebarCollapsed &&
        next.agentPanelWidth === state.projectShell.agentPanelWidth &&
        next.terminalHeight === state.projectShell.terminalHeight
    ) {
        return;
    }
    state = {
        ...state,
        projectShell: next,
    };
    persist();
    emit();
}

export function importUiLayoutState(raw: unknown): UiLayoutState {
    state = sanitizeUiLayoutState(raw);
    persist();
    emit();
    return state;
}

export function exportUiLayoutState(): {
    exportedAt: number;
    state: UiLayoutState;
} {
    return {
        exportedAt: Date.now(),
        state,
    };
}

export function useUiLayoutStore<T>(selector: (snapshot: UiLayoutState) => T): T {
    return useSyncExternalStore(
        subscribeUiLayout,
        () => selector(getUiLayoutSnapshot()),
        () => selector(getUiLayoutSnapshot())
    );
}

export function __resetUiLayoutStoreForTests(): void {
    state = defaultState;
    try {
        localStorage.removeItem(CURRENT_STORAGE_KEY);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
        // Ignore storage cleanup issues in tests.
    }
    emit();
}

