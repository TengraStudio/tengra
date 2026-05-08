/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useSyncExternalStore } from 'react';

import { WorkspaceEntry } from '@/types';

type Listener = () => void;
type SetStateAction<T> = T | ((prevState: T) => T);

export type WorkspaceInlineActionType = 'rename' | 'createFile' | 'createFolder';
export type WorkspaceBulkActionType = 'rename' | 'move' | 'copy';

export interface WorkspaceInlineAction {
    type: WorkspaceInlineActionType;
    entry: WorkspaceEntry;
    draftName: string;
}

export interface WorkspaceBulkAction {
    type: WorkspaceBulkActionType;
    draftValue: string;
}

export interface WorkspaceExplorerStoreState {
    selectedEntries: WorkspaceEntry[];
    lastSelectedEntry: WorkspaceEntry | null;
    focusedRowKey: string | null;
    filterQuery: string;
    inlineAction: WorkspaceInlineAction | null;
    bulkAction: WorkspaceBulkAction | null;
}

const defaultState = (): WorkspaceExplorerStoreState => ({
    selectedEntries: [],
    lastSelectedEntry: null,
    focusedRowKey: null,
    filterQuery: '',
    inlineAction: null,
    bulkAction: null,
});

const workspaceState = new Map<string, WorkspaceExplorerStoreState>();
const workspaceListeners = new Map<string, Set<Listener>>();

function getWorkspaceListeners(workspaceId: string): Set<Listener> {
    const listeners = workspaceListeners.get(workspaceId);
    if (listeners) {
        return listeners;
    }
    const nextListeners = new Set<Listener>();
    workspaceListeners.set(workspaceId, nextListeners);
    return nextListeners;
}

function emit(workspaceId: string): void {
    for (const listener of getWorkspaceListeners(workspaceId)) {
        listener();
    }
}

function getState(workspaceId: string): WorkspaceExplorerStoreState {
    const existingState = workspaceState.get(workspaceId);
    if (existingState) {
        return existingState;
    }
    const nextState = defaultState();
    workspaceState.set(workspaceId, nextState);
    return nextState;
}

function updateState(
    workspaceId: string,
    updater: (prevState: WorkspaceExplorerStoreState) => WorkspaceExplorerStoreState
): void {
    const previousState = getState(workspaceId);
    const nextState = updater(previousState);
    if (nextState === previousState) {
        return;
    }
    workspaceState.set(workspaceId, nextState);
    emit(workspaceId);
}

function updateSelectionState(
    workspaceId: string,
    nextSelectedEntries: WorkspaceEntry[]
): void {
    updateState(workspaceId, prevState => ({
        ...prevState,
        selectedEntries: nextSelectedEntries,
        bulkAction: nextSelectedEntries.length > 1 ? prevState.bulkAction : null,
    }));
}

export function clearWorkspaceExplorerFilterQuery(workspaceId: string): void {
    updateState(workspaceId, prevState => ({
        ...prevState,
        filterQuery: '',
    }));
}

export function subscribeWorkspaceExplorerStore(
    workspaceId: string,
    listener: Listener
): () => void {
    const listeners = getWorkspaceListeners(workspaceId);
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getWorkspaceExplorerSnapshot(workspaceId: string): WorkspaceExplorerStoreState {
    return getState(workspaceId);
}

export function useWorkspaceExplorerStore<T>(
    workspaceId: string,
    selector: (snapshot: WorkspaceExplorerStoreState) => T
): T {
    const subscribe = useCallback((listener: () => void) => subscribeWorkspaceExplorerStore(workspaceId, listener), [workspaceId]);
    const getSnapshot = useCallback(() => getWorkspaceExplorerSnapshot(workspaceId), [workspaceId]);
    const state = useSyncExternalStore(subscribe, getSnapshot);
    return selector(state);
}

export function setWorkspaceExplorerSelectedEntries(
    workspaceId: string,
    update: SetStateAction<WorkspaceEntry[]>
): void {
    const previousEntries = getState(workspaceId).selectedEntries;
    const nextEntries =
        typeof update === 'function'
            ? update(previousEntries)
            : update;
    updateSelectionState(workspaceId, nextEntries);
}

export function setWorkspaceExplorerLastSelectedEntry(
    workspaceId: string,
    entry: WorkspaceEntry | null
): void {
    updateState(workspaceId, prevState => ({
        ...prevState,
        lastSelectedEntry: entry,
    }));
}

export function setWorkspaceExplorerFocusedRowKey(
    workspaceId: string,
    rowKey: string | null
): void {
    updateState(workspaceId, prevState => ({
        ...prevState,
        focusedRowKey: rowKey,
    }));
}

export function setWorkspaceExplorerFilterQuery(
    workspaceId: string,
    filterQuery: string
): void {
    updateState(workspaceId, prevState => ({
        ...prevState,
        filterQuery,
    }));
}

export function startWorkspaceInlineRename(
    workspaceId: string,
    entry: WorkspaceEntry
): void {
    updateState(workspaceId, prevState => ({
        ...prevState,
        focusedRowKey: `inline:${entry.mountId}:${entry.path}`,
        bulkAction: null,
        inlineAction: {
            type: 'rename',
            entry,
            draftName: entry.name,
        },
    }));
}

export function startWorkspaceInlineCreate(
    workspaceId: string,
    type: WorkspaceInlineActionType,
    entry: WorkspaceEntry
): void {
    updateState(workspaceId, prevState => ({
        ...prevState,
        focusedRowKey: `inline:${entry.mountId}:${entry.path}`,
        bulkAction: null,
        inlineAction: {
            type,
            entry,
            draftName: '',
        },
    }));
}

export function setWorkspaceInlineDraftName(
    workspaceId: string,
    draftName: string
): void {
    updateState(workspaceId, prevState => ({
        ...prevState,
        inlineAction: prevState.inlineAction
            ? {
                ...prevState.inlineAction,
                draftName,
            }
            : null,
    }));
}

export function clearWorkspaceInlineAction(workspaceId: string): void {
    updateState(workspaceId, prevState => ({
        ...prevState,
        inlineAction: null,
    }));
}

export function startWorkspaceBulkAction(
    workspaceId: string,
    type: WorkspaceBulkActionType,
    draftValue: string = ''
): void {
    updateState(workspaceId, prevState => ({
        ...prevState,
        inlineAction: null,
        bulkAction: {
            type,
            draftValue,
        },
    }));
}

export function setWorkspaceBulkActionDraftValue(
    workspaceId: string,
    draftValue: string
): void {
    updateState(workspaceId, prevState => ({
        ...prevState,
        bulkAction: prevState.bulkAction
            ? {
                ...prevState.bulkAction,
                draftValue,
            }
            : null,
    }));
}

export function clearWorkspaceBulkAction(workspaceId: string): void {
    updateState(workspaceId, prevState => ({
        ...prevState,
        bulkAction: null,
    }));
}

export function clearWorkspaceExplorerSelection(workspaceId: string): void {
    updateState(workspaceId, prevState => ({
        ...prevState,
        selectedEntries: [],
        lastSelectedEntry: null,
        focusedRowKey: null,
        bulkAction: null,
    }));
}

export function resetWorkspaceExplorerStore(workspaceId: string): void {
    workspaceState.set(workspaceId, defaultState());
    emit(workspaceId);
}

export function __resetWorkspaceExplorerStoreForTests(): void {
    workspaceState.clear();
    workspaceListeners.clear();
}

