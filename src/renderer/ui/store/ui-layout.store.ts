/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useSyncExternalStore } from 'react';

const CURRENT_STORAGE_KEY = 'tengra.ui-layout.v3';
const LEGACY_STORAGE_KEY = 'tengra.ui-layout.v1';
const UI_LAYOUT_SCHEMA_VERSION = 3;

export interface WorkspaceShellState {
    sidebarCollapsed: boolean;
    showAgentPanel: boolean;
    agentPanelWidth: number;
    showTerminal: boolean;
    terminalHeight: number;
    terminalFloating: boolean;
    terminalMaximized: boolean;
}

export interface UiLayoutState {
    version: number;
    activityBar: {
        activeItem: string;
        collapsed: boolean;
    };
    appShell: {
        sidebarCollapsed: boolean;
    };
    workspaceShell: WorkspaceShellState;
    workspaceProfiles: Record<string, WorkspaceShellState>;
}

type Listener = () => void;

const listeners = new Set<Listener>();

const defaultWorkspaceShellState: WorkspaceShellState = {
    sidebarCollapsed: false,
    showAgentPanel: false,
    agentPanelWidth: 500,
    showTerminal: false,
    terminalHeight: 250,
    terminalFloating: false,
    terminalMaximized: false,
};

const defaultState: UiLayoutState = {
    version: UI_LAYOUT_SCHEMA_VERSION,
    activityBar: {
        activeItem: 'chat',
        collapsed: false,
    },
    appShell: {
        sidebarCollapsed: false,
    },
    workspaceShell: defaultWorkspaceShellState,
    workspaceProfiles: {},
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

function isObject(value: RendererDataValue): value is Record<string, RendererDataValue> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toBoolean(value: RendererDataValue, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function toBoundedNumber(
    value: RendererDataValue,
    fallback: number,
    min: number,
    max: number
): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, Math.floor(value)));
}

function sanitizeActivityBar(value: RendererDataValue): UiLayoutState['activityBar'] {
    if (!isObject(value)) {
        return defaultState.activityBar;
    }
    const activeItemRaw = typeof value.activeItem === 'string' ? value.activeItem.trim() : '';
    return {
        activeItem: activeItemRaw || defaultState.activityBar.activeItem,
        collapsed: toBoolean(value.collapsed, defaultState.activityBar.collapsed),
    };
}

function sanitizeAppShell(value: RendererDataValue): UiLayoutState['appShell'] {
    if (!isObject(value)) {
        return defaultState.appShell;
    }
    return {
        sidebarCollapsed: toBoolean(value.sidebarCollapsed, defaultState.appShell.sidebarCollapsed),
    };
}

function sanitizeWorkspaceShell(value: RendererDataValue): WorkspaceShellState {
    if (!isObject(value)) {
        return defaultState.workspaceShell;
    }
    return {
        sidebarCollapsed: toBoolean(
            value.sidebarCollapsed,
            defaultState.workspaceShell.sidebarCollapsed
        ),
        showAgentPanel: toBoolean(
            value.showAgentPanel,
            defaultState.workspaceShell.showAgentPanel
        ),
        agentPanelWidth: toBoundedNumber(
            value.agentPanelWidth,
            defaultState.workspaceShell.agentPanelWidth,
            260,
            640
        ),
        showTerminal: toBoolean(
            value.showTerminal,
            defaultState.workspaceShell.showTerminal
        ),
        terminalHeight: toBoundedNumber(
            value.terminalHeight,
            defaultState.workspaceShell.terminalHeight,
            150,
            900
        ),
        terminalFloating: toBoolean(
            value.terminalFloating,
            defaultState.workspaceShell.terminalFloating
        ),
        terminalMaximized: toBoolean(
            value.terminalMaximized,
            defaultState.workspaceShell.terminalMaximized
        ),
    };
}

function sanitizeWorkspaceProfiles(
    value: RendererDataValue
): Record<string, WorkspaceShellState> {
    if (!isObject(value)) {
        return {};
    }

    const profiles: Record<string, WorkspaceShellState> = {};
    for (const [workspaceId, rawProfile] of Object.entries(value)) {
        const normalizedWorkspaceId = workspaceId.trim();
        if (!normalizedWorkspaceId) {
            continue;
        }
        profiles[normalizedWorkspaceId] = sanitizeWorkspaceShell(rawProfile);
    }

    return profiles;
}

function migrateLegacyUiLayout(raw: RendererDataValue): UiLayoutState | null {
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

export function sanitizeUiLayoutState(raw: RendererDataValue): UiLayoutState {
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
        workspaceShell: sanitizeWorkspaceShell(raw.workspaceShell),
        workspaceProfiles: sanitizeWorkspaceProfiles(raw.workspaceProfiles),
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

export function selectWorkspaceShellState(
    snapshot: UiLayoutState,
    workspaceId?: string | null
): WorkspaceShellState {
    if (!workspaceId) {
        return snapshot.workspaceShell;
    }

    return snapshot.workspaceProfiles[workspaceId] ?? snapshot.workspaceShell;
}

export function getWorkspaceShellState(workspaceId?: string | null): WorkspaceShellState {
    return selectWorkspaceShellState(state, workspaceId);
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

function areWorkspaceShellStatesEqual(
    left: WorkspaceShellState,
    right: WorkspaceShellState
): boolean {
    return (
        left.sidebarCollapsed === right.sidebarCollapsed &&
        left.showAgentPanel === right.showAgentPanel &&
        left.agentPanelWidth === right.agentPanelWidth &&
        left.showTerminal === right.showTerminal &&
        left.terminalHeight === right.terminalHeight &&
        left.terminalFloating === right.terminalFloating &&
        left.terminalMaximized === right.terminalMaximized
    );
}

export function setWorkspaceShellState(update: Partial<WorkspaceShellState>): void;
export function setWorkspaceShellState(
    workspaceId: string,
    update: Partial<WorkspaceShellState>
): void;
export function setWorkspaceShellState(
    workspaceIdOrUpdate: string | Partial<WorkspaceShellState>,
    maybeUpdate?: Partial<WorkspaceShellState>
): void {
    if (typeof workspaceIdOrUpdate === 'string') {
        const workspaceId = workspaceIdOrUpdate.trim();
        if (!workspaceId) {
            return;
        }

        const update = maybeUpdate ?? {};
        const currentProfile = selectWorkspaceShellState(state, workspaceId);
        const nextProfile = {
            ...currentProfile,
            ...update,
        };

        if (areWorkspaceShellStatesEqual(currentProfile, nextProfile)) {
            return;
        }

        state = {
            ...state,
            workspaceProfiles: {
                ...state.workspaceProfiles,
                [workspaceId]: nextProfile,
            },
        };
        persist();
        emit();
        return;
    }

    const update = workspaceIdOrUpdate;
    const next = {
        ...state.workspaceShell,
        ...update,
    };
    if (areWorkspaceShellStatesEqual(next, state.workspaceShell)) {
        return;
    }
    state = {
        ...state,
        workspaceShell: next,
    };
    persist();
    emit();
}

export function importUiLayoutState(raw: RendererDataValue): UiLayoutState {
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
    const snapshot = useSyncExternalStore(subscribeUiLayout, getUiLayoutSnapshot);
    return selector(snapshot);
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


