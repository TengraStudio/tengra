/**
 * Workspace List State Machine
 * 
 * Implements a reducer-based state machine for workspace list operations
 * to prevent race conditions and ensure consistent state transitions.
 */
import { useCallback, useReducer } from 'react';

import { Workspace, WorkspaceMount } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

export type WorkspaceListViewMode = 'grid' | 'list';
export type WorkspaceListSortBy = 'title' | 'updatedAt' | 'createdAt';
export type WorkspaceListSortDirection = 'asc' | 'desc';
export type WorkspaceListPreset = 'recent' | 'oldest' | 'name-az' | 'name-za';

export interface WorkspaceListPreferences {
    viewMode: WorkspaceListViewMode;
    sortBy: WorkspaceListSortBy;
    sortDirection: WorkspaceListSortDirection;
    listPreset: WorkspaceListPreset;
}

export const loadWorkspaceListPreferences = (
    storageKey: string,
    fallback: WorkspaceListPreferences
): WorkspaceListPreferences => {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
            return fallback;
        }
        const parsed = JSON.parse(raw) as Partial<WorkspaceListPreferences>;
        return {
            viewMode: parsed.viewMode ?? fallback.viewMode,
            sortBy: parsed.sortBy ?? fallback.sortBy,
            sortDirection: parsed.sortDirection ?? fallback.sortDirection,
            listPreset: parsed.listPreset ?? fallback.listPreset,
        };
    } catch {
        return fallback;
    }
};

export const saveWorkspaceListPreferences = (
    storageKey: string,
    preferences: WorkspaceListPreferences
): void => {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
};

// ============================================================================
// State Machine Types
// ============================================================================

export type WorkspaceListStatus =
    | 'idle'
    | 'loading'
    | 'editing'
    | 'deleting'
    | 'archiving'
    | 'bulk_deleting'
    | 'bulk_archiving'
    | 'creating'
    | 'error'

export interface WorkspaceListState {
    status: WorkspaceListStatus
    // Target workspace for single operations
    targetWorkspace: Workspace | null
    // Edit form data
    editForm: { title: string; description: string }
    // Selection
    selectedWorkspaceIds: Set<string>
    // Error tracking
    error: string | null
    // Loading message
    loadingMessage: string | null
}

// ============================================================================
// Action Types
// ============================================================================

type WorkspaceListAction =
    | { type: 'START_EDIT'; workspace: Workspace }
    | { type: 'UPDATE_EDIT_FORM'; form: { title: string; description: string } }
    | { type: 'CANCEL_EDIT' }
    | { type: 'START_DELETE'; workspace: Workspace }
    | { type: 'CANCEL_DELETE' }
    | { type: 'START_ARCHIVE'; workspace: Workspace }
    | { type: 'CANCEL_ARCHIVE' }
    | { type: 'START_BULK_DELETE' }
    | { type: 'CANCEL_BULK_DELETE' }
    | { type: 'START_BULK_ARCHIVE' }
    | { type: 'CANCEL_BULK_ARCHIVE' }
    | { type: 'START_CREATE' }
    | { type: 'CANCEL_CREATE' }
    | { type: 'TOGGLE_SELECTION'; id: string }
    | { type: 'SELECT_ALL'; ids: string[] }
    | { type: 'CLEAR_SELECTION' }
    | { type: 'OPERATION_START'; message?: string }
    | { type: 'OPERATION_SUCCESS' }
    | { type: 'OPERATION_ERROR'; error: string }
    | { type: 'RESET' }

// ============================================================================
// Initial State
// ============================================================================

const initialState: WorkspaceListState = {
    status: 'idle',
    targetWorkspace: null,
    editForm: { title: '', description: '' },
    selectedWorkspaceIds: new Set(),
    error: null,
    loadingMessage: null
};

// ============================================================================
// Reducer
// ============================================================================

const handleStartEdit = (state: WorkspaceListState, action: Extract<WorkspaceListAction, { type: 'START_EDIT' }>): WorkspaceListState => {
    if (state.status !== 'idle') { return state; }
    return { ...state, status: 'editing', targetWorkspace: action.workspace, editForm: { title: action.workspace.title, description: action.workspace.description }, error: null };
};

const handleCancelEdit = (state: WorkspaceListState): WorkspaceListState =>
    ({ ...state, status: 'idle', targetWorkspace: null, editForm: { title: '', description: '' } });

const handleStartDelete = (state: WorkspaceListState, workspace: Workspace): WorkspaceListState => {
    if (state.status !== 'idle') { return state; }
    return { ...state, status: 'deleting', targetWorkspace: workspace, error: null };
};

const handleCancelDelete = (state: WorkspaceListState): WorkspaceListState =>
    ({ ...state, status: 'idle', targetWorkspace: null });

const handleStartArchive = (state: WorkspaceListState, workspace: Workspace): WorkspaceListState => {
    if (state.status !== 'idle') { return state; }
    return { ...state, status: 'archiving', targetWorkspace: workspace, error: null };
};

const handleCancelArchive = (state: WorkspaceListState): WorkspaceListState =>
    ({ ...state, status: 'idle', targetWorkspace: null });

const handleStartBulkDelete = (state: WorkspaceListState): WorkspaceListState => {
    if (state.status !== 'idle' || state.selectedWorkspaceIds.size === 0) { return state; }
    return { ...state, status: 'bulk_deleting', error: null };
};

const handleStartBulkArchive = (state: WorkspaceListState): WorkspaceListState => {
    if (state.status !== 'idle' || state.selectedWorkspaceIds.size === 0) { return state; }
    return { ...state, status: 'bulk_archiving', error: null };
};

const handleStartCreate = (state: WorkspaceListState): WorkspaceListState => {
    if (state.status !== 'idle') { return state; }
    return { ...state, status: 'creating', error: null };
};

const handleToggleSelection = (state: WorkspaceListState, id: string): WorkspaceListState => {
    if (state.status !== 'idle') { return state; }
    const next = new Set(state.selectedWorkspaceIds);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    return { ...state, selectedWorkspaceIds: next };
};

const handleSelectAll = (state: WorkspaceListState, ids: string[]): WorkspaceListState => {
    if (state.status !== 'idle') { return state; }
    return { ...state, selectedWorkspaceIds: new Set(ids) };
};

const handleOperationStart = (state: WorkspaceListState, message?: string): WorkspaceListState =>
    ({ ...state, status: 'loading', loadingMessage: message ?? null });

const handleOperationSuccess = (): WorkspaceListState =>
    ({ ...initialState, selectedWorkspaceIds: new Set() });

const handleOperationError = (state: WorkspaceListState, error: string): WorkspaceListState =>
    ({ ...state, status: 'error', error, loadingMessage: null });

// Simple action handlers that return a function
type ActionHandler = (state: WorkspaceListState, action: WorkspaceListAction) => WorkspaceListState;

const actionHandlers: Record<WorkspaceListAction['type'], ActionHandler> = {
    'START_EDIT': (state, action) =>
        action.type === 'START_EDIT' ? handleStartEdit(state, action) : state,
    'UPDATE_EDIT_FORM': (state, action) =>
        action.type === 'UPDATE_EDIT_FORM' ? { ...state, editForm: action.form } : state,
    'CANCEL_EDIT': (state) => handleCancelEdit(state),
    'START_DELETE': (state, action) =>
        action.type === 'START_DELETE' ? handleStartDelete(state, action.workspace) : state,
    'CANCEL_DELETE': (state) => handleCancelDelete(state),
    'START_ARCHIVE': (state, action) =>
        action.type === 'START_ARCHIVE' ? handleStartArchive(state, action.workspace) : state,
    'CANCEL_ARCHIVE': (state) => handleCancelArchive(state),
    'START_BULK_DELETE': (state) => handleStartBulkDelete(state),
    'CANCEL_BULK_DELETE': (state) => ({ ...state, status: 'idle' }),
    'START_BULK_ARCHIVE': (state) => handleStartBulkArchive(state),
    'CANCEL_BULK_ARCHIVE': (state) => ({ ...state, status: 'idle' }),
    'START_CREATE': (state) => handleStartCreate(state),
    'CANCEL_CREATE': (state) => ({ ...state, status: 'idle' }),
    'TOGGLE_SELECTION': (state, action) =>
        action.type === 'TOGGLE_SELECTION' ? handleToggleSelection(state, action.id) : state,
    'SELECT_ALL': (state, action) =>
        action.type === 'SELECT_ALL' ? handleSelectAll(state, action.ids) : state,
    'CLEAR_SELECTION': (state) => ({ ...state, selectedWorkspaceIds: new Set() }),
    'OPERATION_START': (state, action) =>
        action.type === 'OPERATION_START' ? handleOperationStart(state, action.message) : state,
    'OPERATION_SUCCESS': () => handleOperationSuccess(),
    'OPERATION_ERROR': (state, action) =>
        action.type === 'OPERATION_ERROR' ? handleOperationError(state, action.error) : state,
    'RESET': () => initialState
};

function workspaceListReducer(state: WorkspaceListState, action: WorkspaceListAction): WorkspaceListState {
    const handler = actionHandlers[action.type];
    return handler(state, action);
}

// ============================================================================
// Hook
// ============================================================================

export interface UseWorkspaceListStateMachineOptions {
    filteredWorkspaces: Workspace[]
    onError?: (error: string) => void
}

const useWorkspaceListOperations = (
    state: WorkspaceListState,
    dispatch: React.Dispatch<WorkspaceListAction>,
    onError?: (error: string) => void
) => {
    const normalizePathKey = useCallback((value: string): string => {
        return value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
    }, []);

    const buildMountKey = useCallback((mount: WorkspaceMount): string => {
        if (mount.type === 'ssh') {
            const host = mount.ssh?.host?.toLowerCase() ?? '';
            const user = mount.ssh?.username?.toLowerCase() ?? '';
            const port = mount.ssh?.port ?? 22;
            return `ssh:${user}@${host}:${port}:${normalizePathKey(mount.rootPath)}`;
        }
        return `local:${normalizePathKey(mount.rootPath)}`;
    }, [normalizePathKey]);

    const executeUpdate = useCallback(async (): Promise<boolean> => {
        if (state.status !== 'editing' || !state.targetWorkspace) { return false; }
        dispatch({ type: 'OPERATION_START', message: 'Updating workspace...' });
        try {
            await window.electron.db.updateWorkspace(state.targetWorkspace.id, state.editForm);
            dispatch({ type: 'OPERATION_SUCCESS' });
            return true;
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to update workspace';
            dispatch({ type: 'OPERATION_ERROR', error: msg });
            onError?.(msg);
            return false;
        }
    }, [state.status, state.targetWorkspace, state.editForm, dispatch, onError]);

    const executeDelete = useCallback(async (deleteFiles: boolean = false) => {
        if (state.status !== 'deleting' || !state.targetWorkspace) { return; }
        dispatch({ type: 'OPERATION_START', message: 'Deleting workspace...' });
        try {
            await window.electron.db.deleteWorkspace(state.targetWorkspace.id, deleteFiles);
            dispatch({ type: 'OPERATION_SUCCESS' });
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to delete workspace';
            dispatch({ type: 'OPERATION_ERROR', error: msg });
            onError?.(msg);
        }
    }, [state.status, state.targetWorkspace, dispatch, onError]);

    const executeArchive = useCallback(async () => {
        if (state.status !== 'archiving' || !state.targetWorkspace) { return; }
        dispatch({ type: 'OPERATION_START', message: 'Archiving workspace...' });
        try {
            const newStatus = state.targetWorkspace.status === 'archived' ? 'active' : 'archived';
            await window.electron.db.archiveWorkspace(state.targetWorkspace.id, newStatus === 'archived');
            dispatch({ type: 'OPERATION_SUCCESS' });
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to archive workspace';
            dispatch({ type: 'OPERATION_ERROR', error: msg });
            onError?.(msg);
        }
    }, [state.status, state.targetWorkspace, dispatch, onError]);

    const executeBulkDelete = useCallback(async (deleteFiles: boolean = false) => {
        if (state.status !== 'bulk_deleting' || state.selectedWorkspaceIds.size === 0) { return; }
        dispatch({ type: 'OPERATION_START', message: `Deleting ${state.selectedWorkspaceIds.size} workspaces...` });
        try {
            await window.electron.db.bulkDeleteWorkspaces(Array.from(state.selectedWorkspaceIds), deleteFiles);
            dispatch({ type: 'OPERATION_SUCCESS' });
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to bulk delete workspaces';
            dispatch({ type: 'OPERATION_ERROR', error: msg });
            onError?.(msg);
        }
    }, [state.status, state.selectedWorkspaceIds, dispatch, onError]);

    const executeBulkArchive = useCallback(async (isArchived: boolean = true) => {
        if (state.status !== 'bulk_archiving' || state.selectedWorkspaceIds.size === 0) { return; }
        dispatch({ type: 'OPERATION_START', message: `Archiving ${state.selectedWorkspaceIds.size} workspaces...` });
        try {
            await window.electron.db.bulkArchiveWorkspaces(Array.from(state.selectedWorkspaceIds), isArchived);
            dispatch({ type: 'OPERATION_SUCCESS' });
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to bulk archive workspaces';
            dispatch({ type: 'OPERATION_ERROR', error: msg });
            onError?.(msg);
        }
    }, [state.status, state.selectedWorkspaceIds, dispatch, onError]);

    const executeCreate = useCallback(async (path: string, name: string, description: string, userMounts?: WorkspaceMount[]): Promise<boolean> => {
        dispatch({ type: 'OPERATION_START', message: 'Creating workspace...' });
        try {
            const mounts = userMounts && userMounts.length > 0 ? userMounts : [{
                id: `local-${Date.now()}`,
                name: name,
                type: 'local' as const,
                rootPath: path
            }];
            const existingWorkspaces = await window.electron.db.getWorkspaces();
            const existingMounts = new Set<string>();
            for (const workspace of existingWorkspaces) {
                const workspaceMounts = Array.isArray(workspace.mounts) && workspace.mounts.length > 0
                    ? workspace.mounts
                    : [{
                        id: `local-${workspace.id}`,
                        name: workspace.title,
                        type: 'local' as const,
                        rootPath: workspace.path
                    }];
                for (const workspaceMount of workspaceMounts) {
                    existingMounts.add(buildMountKey(workspaceMount));
                }
            }

            for (const mount of mounts) {
                if (existingMounts.has(buildMountKey(mount))) {
                    throw new Error(`A workspace already exists for ${mount.type === 'ssh' ? 'this remote path' : 'this local directory'}.`);
                }
            }

            await window.electron.db.createWorkspace(name, path, description, JSON.stringify(mounts));
            dispatch({ type: 'OPERATION_SUCCESS' });
            return true;
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to create workspace';
            dispatch({ type: 'OPERATION_ERROR', error: msg });
            onError?.(msg);
            appLogger.error('useWorkspaceListStateMachine', 'executeCreate failed', error as Error);
            return false;
        }
    }, [buildMountKey, dispatch, onError]);

    return {
        executeUpdate,
        executeDelete,
        executeArchive,
        executeBulkDelete,
        executeBulkArchive,
        executeCreate
    };
};

export function useWorkspaceListStateMachine({ filteredWorkspaces, onError }: UseWorkspaceListStateMachineOptions) {
    const [state, dispatch] = useReducer(workspaceListReducer, initialState);

    // Action creators
    const startEdit = useCallback((workspace: Workspace, e?: React.MouseEvent) => {
        e?.stopPropagation();
        dispatch({ type: 'START_EDIT', workspace });
    }, []);

    const updateEditForm = useCallback((formOrUpdater: { title: string; description: string } | ((prev: { title: string; description: string }) => { title: string; description: string })) => {
        if (typeof formOrUpdater === 'function') {
            dispatch({ type: 'UPDATE_EDIT_FORM', form: formOrUpdater(state.editForm) });
        } else {
            dispatch({ type: 'UPDATE_EDIT_FORM', form: formOrUpdater });
        }
    }, [state.editForm]);

    const cancelEdit = useCallback(() => dispatch({ type: 'CANCEL_EDIT' }), []);
    const startDelete = useCallback((workspace: Workspace, e?: React.MouseEvent) => {
        e?.stopPropagation();
        dispatch({ type: 'START_DELETE', workspace });
    }, []);
    const cancelDelete = useCallback(() => dispatch({ type: 'CANCEL_DELETE' }), []);
    const startArchive = useCallback((workspace: Workspace) => dispatch({ type: 'START_ARCHIVE', workspace }), []);
    const cancelArchive = useCallback(() => dispatch({ type: 'CANCEL_ARCHIVE' }), []);
    const startBulkDelete = useCallback(() => dispatch({ type: 'START_BULK_DELETE' }), []);
    const cancelBulkDelete = useCallback(() => dispatch({ type: 'CANCEL_BULK_DELETE' }), []);
    const startBulkArchive = useCallback(() => dispatch({ type: 'START_BULK_ARCHIVE' }), []);
    const cancelBulkArchive = useCallback(() => dispatch({ type: 'CANCEL_BULK_ARCHIVE' }), []);
    const toggleSelection = useCallback((id: string) => dispatch({ type: 'TOGGLE_SELECTION', id }), []);
    const toggleSelectAll = useCallback(() => {
        if (state.selectedWorkspaceIds.size === filteredWorkspaces.length) {
            dispatch({ type: 'CLEAR_SELECTION' });
        } else {
            dispatch({ type: 'SELECT_ALL', ids: filteredWorkspaces.map(p => p.id) });
        }
    }, [filteredWorkspaces, state.selectedWorkspaceIds.size]);
    const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

    const executors = useWorkspaceListOperations(state, dispatch, onError);

    return {
        state,
        isOperationInProgress: state.status === 'loading',
        canPerformActions: state.status === 'idle',
        startEdit,
        updateEditForm,
        cancelEdit,
        startDelete,
        cancelDelete,
        startArchive,
        cancelArchive,
        startBulkDelete,
        cancelBulkDelete,
        startBulkArchive,
        cancelBulkArchive,
        toggleSelection,
        toggleSelectAll,
        reset,
        ...executors
    };
}
