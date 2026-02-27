/**
 * Project List State Machine
 * 
 * Implements a reducer-based state machine for project list operations
 * to prevent race conditions and ensure consistent state transitions.
 */
import { useCallback, useReducer } from 'react';

import { Project, WorkspaceMount } from '@/types';

export type ProjectListViewMode = 'grid' | 'list';
export type ProjectListSortBy = 'title' | 'updatedAt' | 'createdAt';
export type ProjectListSortDirection = 'asc' | 'desc';
export type ProjectListPreset = 'recent' | 'oldest' | 'name-az' | 'name-za';

export interface ProjectListPreferences {
    viewMode: ProjectListViewMode;
    sortBy: ProjectListSortBy;
    sortDirection: ProjectListSortDirection;
    listPreset: ProjectListPreset;
}

export const loadProjectListPreferences = (
    storageKey: string,
    fallback: ProjectListPreferences
): ProjectListPreferences => {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
            return fallback;
        }
        const parsed = JSON.parse(raw) as Partial<ProjectListPreferences>;
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

export const saveProjectListPreferences = (
    storageKey: string,
    preferences: ProjectListPreferences
): void => {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
};

// ============================================================================
// State Machine Types
// ============================================================================

export type ProjectListStatus =
    | 'idle'
    | 'loading'
    | 'editing'
    | 'deleting'
    | 'archiving'
    | 'bulk_deleting'
    | 'bulk_archiving'
    | 'creating'
    | 'error'

export interface ProjectListState {
    status: ProjectListStatus
    // Target project for single operations
    targetProject: Project | null
    // Edit form data
    editForm: { title: string; description: string }
    // Selection
    selectedProjectIds: Set<string>
    // Error tracking
    error: string | null
    // Loading message
    loadingMessage: string | null
}

// ============================================================================
// Action Types
// ============================================================================

type ProjectListAction =
    | { type: 'START_EDIT'; project: Project }
    | { type: 'UPDATE_EDIT_FORM'; form: { title: string; description: string } }
    | { type: 'CANCEL_EDIT' }
    | { type: 'START_DELETE'; project: Project }
    | { type: 'CANCEL_DELETE' }
    | { type: 'START_ARCHIVE'; project: Project }
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

const initialState: ProjectListState = {
    status: 'idle',
    targetProject: null,
    editForm: { title: '', description: '' },
    selectedProjectIds: new Set(),
    error: null,
    loadingMessage: null
};

// ============================================================================
// Reducer
// ============================================================================

const handleStartEdit = (state: ProjectListState, action: Extract<ProjectListAction, { type: 'START_EDIT' }>): ProjectListState => {
    if (state.status !== 'idle') { return state; }
    return { ...state, status: 'editing', targetProject: action.project, editForm: { title: action.project.title, description: action.project.description }, error: null };
};

const handleCancelEdit = (state: ProjectListState): ProjectListState =>
    ({ ...state, status: 'idle', targetProject: null, editForm: { title: '', description: '' } });

const handleStartDelete = (state: ProjectListState, project: Project): ProjectListState => {
    if (state.status !== 'idle') { return state; }
    return { ...state, status: 'deleting', targetProject: project, error: null };
};

const handleCancelDelete = (state: ProjectListState): ProjectListState =>
    ({ ...state, status: 'idle', targetProject: null });

const handleStartArchive = (state: ProjectListState, project: Project): ProjectListState => {
    if (state.status !== 'idle') { return state; }
    return { ...state, status: 'archiving', targetProject: project, error: null };
};

const handleCancelArchive = (state: ProjectListState): ProjectListState =>
    ({ ...state, status: 'idle', targetProject: null });

const handleStartBulkDelete = (state: ProjectListState): ProjectListState => {
    if (state.status !== 'idle' || state.selectedProjectIds.size === 0) { return state; }
    return { ...state, status: 'bulk_deleting', error: null };
};

const handleStartBulkArchive = (state: ProjectListState): ProjectListState => {
    if (state.status !== 'idle' || state.selectedProjectIds.size === 0) { return state; }
    return { ...state, status: 'bulk_archiving', error: null };
};

const handleStartCreate = (state: ProjectListState): ProjectListState => {
    if (state.status !== 'idle') { return state; }
    return { ...state, status: 'creating', error: null };
};

const handleToggleSelection = (state: ProjectListState, id: string): ProjectListState => {
    if (state.status !== 'idle') { return state; }
    const next = new Set(state.selectedProjectIds);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    return { ...state, selectedProjectIds: next };
};

const handleSelectAll = (state: ProjectListState, ids: string[]): ProjectListState => {
    if (state.status !== 'idle') { return state; }
    return { ...state, selectedProjectIds: new Set(ids) };
};

const handleOperationStart = (state: ProjectListState, message?: string): ProjectListState =>
    ({ ...state, status: 'loading', loadingMessage: message ?? null });

const handleOperationSuccess = (): ProjectListState =>
    ({ ...initialState, selectedProjectIds: new Set() });

const handleOperationError = (state: ProjectListState, error: string): ProjectListState =>
    ({ ...state, status: 'error', error, loadingMessage: null });

// Simple action handlers that return a function
type ActionHandler = (state: ProjectListState, action: ProjectListAction) => ProjectListState;

const actionHandlers: Record<ProjectListAction['type'], ActionHandler> = {
    'START_EDIT': (state, action) =>
        action.type === 'START_EDIT' ? handleStartEdit(state, action) : state,
    'UPDATE_EDIT_FORM': (state, action) =>
        action.type === 'UPDATE_EDIT_FORM' ? { ...state, editForm: action.form } : state,
    'CANCEL_EDIT': (state) => handleCancelEdit(state),
    'START_DELETE': (state, action) =>
        action.type === 'START_DELETE' ? handleStartDelete(state, action.project) : state,
    'CANCEL_DELETE': (state) => handleCancelDelete(state),
    'START_ARCHIVE': (state, action) =>
        action.type === 'START_ARCHIVE' ? handleStartArchive(state, action.project) : state,
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
    'CLEAR_SELECTION': (state) => ({ ...state, selectedProjectIds: new Set() }),
    'OPERATION_START': (state, action) =>
        action.type === 'OPERATION_START' ? handleOperationStart(state, action.message) : state,
    'OPERATION_SUCCESS': () => handleOperationSuccess(),
    'OPERATION_ERROR': (state, action) =>
        action.type === 'OPERATION_ERROR' ? handleOperationError(state, action.error) : state,
    'RESET': () => initialState
};

function projectListReducer(state: ProjectListState, action: ProjectListAction): ProjectListState {
    const handler = actionHandlers[action.type];
    return handler(state, action);
}

// ============================================================================
// Hook
// ============================================================================

export interface UseProjectListStateMachineOptions {
    filteredProjects: Project[]
    onError?: (error: string) => void
}

const useProjectListOperations = (
    state: ProjectListState,
    dispatch: React.Dispatch<ProjectListAction>,
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
        if (state.status !== 'editing' || !state.targetProject) { return false; }
        dispatch({ type: 'OPERATION_START', message: 'Updating project...' });
        try {
            await window.electron.db.updateProject(state.targetProject.id, state.editForm);
            dispatch({ type: 'OPERATION_SUCCESS' });
            return true;
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to update project';
            dispatch({ type: 'OPERATION_ERROR', error: msg });
            onError?.(msg);
            return false;
        }
    }, [state.status, state.targetProject, state.editForm, dispatch, onError]);

    const executeDelete = useCallback(async (deleteFiles: boolean = false) => {
        if (state.status !== 'deleting' || !state.targetProject) { return; }
        dispatch({ type: 'OPERATION_START', message: 'Deleting project...' });
        try {
            await window.electron.db.deleteProject(state.targetProject.id, deleteFiles);
            dispatch({ type: 'OPERATION_SUCCESS' });
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to delete project';
            dispatch({ type: 'OPERATION_ERROR', error: msg });
            onError?.(msg);
        }
    }, [state.status, state.targetProject, dispatch, onError]);

    const executeArchive = useCallback(async () => {
        if (state.status !== 'archiving' || !state.targetProject) { return; }
        dispatch({ type: 'OPERATION_START', message: 'Archiving project...' });
        try {
            const newStatus = state.targetProject.status === 'archived' ? 'active' : 'archived';
            await window.electron.db.archiveProject(state.targetProject.id, newStatus === 'archived');
            dispatch({ type: 'OPERATION_SUCCESS' });
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to archive project';
            dispatch({ type: 'OPERATION_ERROR', error: msg });
            onError?.(msg);
        }
    }, [state.status, state.targetProject, dispatch, onError]);

    const executeBulkDelete = useCallback(async (deleteFiles: boolean = false) => {
        if (state.status !== 'bulk_deleting' || state.selectedProjectIds.size === 0) { return; }
        dispatch({ type: 'OPERATION_START', message: `Deleting ${state.selectedProjectIds.size} projects...` });
        try {
            await window.electron.db.bulkDeleteProjects(Array.from(state.selectedProjectIds), deleteFiles);
            dispatch({ type: 'OPERATION_SUCCESS' });
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to bulk delete projects';
            dispatch({ type: 'OPERATION_ERROR', error: msg });
            onError?.(msg);
        }
    }, [state.status, state.selectedProjectIds, dispatch, onError]);

    const executeBulkArchive = useCallback(async (isArchived: boolean = true) => {
        if (state.status !== 'bulk_archiving' || state.selectedProjectIds.size === 0) { return; }
        dispatch({ type: 'OPERATION_START', message: `Archiving ${state.selectedProjectIds.size} projects...` });
        try {
            await window.electron.db.bulkArchiveProjects(Array.from(state.selectedProjectIds), isArchived);
            dispatch({ type: 'OPERATION_SUCCESS' });
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to bulk archive projects';
            dispatch({ type: 'OPERATION_ERROR', error: msg });
            onError?.(msg);
        }
    }, [state.status, state.selectedProjectIds, dispatch, onError]);

    const executeCreate = useCallback(async (path: string, name: string, description: string, userMounts?: WorkspaceMount[]) => {
        dispatch({ type: 'OPERATION_START', message: 'Creating project...' });
        try {
            const mounts = userMounts && userMounts.length > 0 ? userMounts : [{
                id: `local-${Date.now()}`,
                name: name,
                type: 'local' as const,
                rootPath: path
            }];
            const existingProjects = await window.electron.db.getProjects();
            const existingMounts = new Set<string>();
            for (const project of existingProjects) {
                const projectMounts = Array.isArray(project.mounts) && project.mounts.length > 0
                    ? project.mounts
                    : [{
                        id: `local-${project.id}`,
                        name: project.title,
                        type: 'local' as const,
                        rootPath: project.path
                    }];
                for (const projectMount of projectMounts) {
                    existingMounts.add(buildMountKey(projectMount));
                }
            }

            for (const mount of mounts) {
                if (existingMounts.has(buildMountKey(mount))) {
                    throw new Error('Invalid input');
                }
            }

            await window.electron.db.createProject(name, path, description, JSON.stringify(mounts));
            dispatch({ type: 'OPERATION_SUCCESS' });
            return true;
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to create project';
            dispatch({ type: 'OPERATION_ERROR', error: msg });
            onError?.(msg);
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

export function useProjectListStateMachine({ filteredProjects, onError }: UseProjectListStateMachineOptions) {
    const [state, dispatch] = useReducer(projectListReducer, initialState);

    // Action creators
    const startEdit = useCallback((project: Project, e?: React.MouseEvent) => {
        e?.stopPropagation();
        dispatch({ type: 'START_EDIT', project });
    }, []);

    const updateEditForm = useCallback((formOrUpdater: { title: string; description: string } | ((prev: { title: string; description: string }) => { title: string; description: string })) => {
        if (typeof formOrUpdater === 'function') {
            dispatch({ type: 'UPDATE_EDIT_FORM', form: formOrUpdater(state.editForm) });
        } else {
            dispatch({ type: 'UPDATE_EDIT_FORM', form: formOrUpdater });
        }
    }, [state.editForm]);

    const cancelEdit = useCallback(() => dispatch({ type: 'CANCEL_EDIT' }), []);
    const startDelete = useCallback((project: Project, e?: React.MouseEvent) => {
        e?.stopPropagation();
        dispatch({ type: 'START_DELETE', project });
    }, []);
    const cancelDelete = useCallback(() => dispatch({ type: 'CANCEL_DELETE' }), []);
    const startArchive = useCallback((project: Project) => dispatch({ type: 'START_ARCHIVE', project }), []);
    const cancelArchive = useCallback(() => dispatch({ type: 'CANCEL_ARCHIVE' }), []);
    const startBulkDelete = useCallback(() => dispatch({ type: 'START_BULK_DELETE' }), []);
    const cancelBulkDelete = useCallback(() => dispatch({ type: 'CANCEL_BULK_DELETE' }), []);
    const startBulkArchive = useCallback(() => dispatch({ type: 'START_BULK_ARCHIVE' }), []);
    const cancelBulkArchive = useCallback(() => dispatch({ type: 'CANCEL_BULK_ARCHIVE' }), []);
    const toggleSelection = useCallback((id: string) => dispatch({ type: 'TOGGLE_SELECTION', id }), []);
    const toggleSelectAll = useCallback(() => {
        if (state.selectedProjectIds.size === filteredProjects.length) {
            dispatch({ type: 'CLEAR_SELECTION' });
        } else {
            dispatch({ type: 'SELECT_ALL', ids: filteredProjects.map(p => p.id) });
        }
    }, [filteredProjects, state.selectedProjectIds.size]);
    const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

    const executors = useProjectListOperations(state, dispatch, onError);

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
