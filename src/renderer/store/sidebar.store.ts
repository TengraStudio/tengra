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

const STORAGE_KEY = 'tengra.sidebar.v1';

interface SidebarState {
    collapsed: boolean;
    width: number;
    activeSection: 'chat' | 'workspaces' | 'settings' | 'tools' | 'providers';
}

type Listener = () => void;

const listeners = new Set<Listener>();

const defaultState: SidebarState = {
    collapsed: false,
    width: 260,
    activeSection: 'chat'
};

let state: SidebarState = defaultState;

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
        const parsed = JSON.parse(raw) as Partial<SidebarState>;
        state = {
            ...defaultState,
            ...parsed,
            width: Math.max(200, Math.min(400, parsed.width ?? defaultState.width))
        };
    } catch {
        state = defaultState;
    }
}

hydrate();

export function getSidebarSnapshot(): SidebarState {
    return state;
}

export function subscribeSidebar(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function setSidebarCollapsed(collapsed: boolean): void {
    state = { ...state, collapsed };
    persist();
    emit();
}

export function toggleSidebarCollapsed(): void {
    setSidebarCollapsed(!state.collapsed);
}

export function setSidebarWidth(width: number): void {
    const clampedWidth = Math.max(200, Math.min(400, width));
    state = { ...state, width: clampedWidth };
    persist();
    emit();
}

export function setSidebarActiveSection(section: SidebarState['activeSection']): void {
    state = { ...state, activeSection: section };
    persist();
    emit();
}

export function useSidebarStore<T>(selector: (snapshot: SidebarState) => T): T {
    const snapshot = useSyncExternalStore(subscribeSidebar, getSidebarSnapshot);
    return selector(snapshot);
}


