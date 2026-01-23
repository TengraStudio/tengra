/**
 * Project List State Machine
 * 
 * Implements a reducer-based state machine for project list operations
 * to prevent race conditions and ensure consistent state transitions.
 */
import { useCallback, useReducer } from 'react'

import { Project, WorkspaceMount } from '@/types'

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
}

// ============================================================================
// Reducer
// ============================================================================

function projectListReducer(state: ProjectListState, action: ProjectListAction): ProjectListState {
    switch (action.type) {
        case 'START_EDIT':
            // Only allow edit from idle state
            if (state.status !== 'idle') { return state }
            return {
                ...state,
                status: 'editing',
                targetProject: action.project,
                editForm: { title: action.project.title, description: action.project.description },
                error: null
            }

        case 'UPDATE_EDIT_FORM':
            return {
                ...state,
                editForm: action.form
            }

        case 'CANCEL_EDIT':
            return {
                ...state,
                status: 'idle',
                targetProject: null,
                editForm: { title: '', description: '' }
            }

        case 'START_DELETE':
            if (state.status !== 'idle') { return state }
            return {
                ...state,
                status: 'deleting',
                targetProject: action.project,
                error: null
            }

        case 'CANCEL_DELETE':
            return {
                ...state,
                status: 'idle',
                targetProject: null
            }

        case 'START_ARCHIVE':
            if (state.status !== 'idle') { return state }
            return {
                ...state,
                status: 'archiving',
                targetProject: action.project,
                error: null
            }

        case 'CANCEL_ARCHIVE':
            return {
                ...state,
                status: 'idle',
                targetProject: null
            }

        case 'START_BULK_DELETE':
            if (state.status !== 'idle' || state.selectedProjectIds.size === 0) { return state }
            return {
                ...state,
                status: 'bulk_deleting',
                error: null
            }

        case 'CANCEL_BULK_DELETE':
            return {
                ...state,
                status: 'idle'
            }

        case 'START_BULK_ARCHIVE':
            if (state.status !== 'idle' || state.selectedProjectIds.size === 0) { return state }
            return {
                ...state,
                status: 'bulk_archiving',
                error: null
            }

        case 'CANCEL_BULK_ARCHIVE':
            return {
                ...state,
                status: 'idle'
            }

        case 'START_CREATE':
            if (state.status !== 'idle') { return state }
            return {
                ...state,
                status: 'creating',
                error: null
            }

        case 'CANCEL_CREATE':
            return {
                ...state,
                status: 'idle'
            }

        case 'TOGGLE_SELECTION': {
            // Allow selection changes only in idle state
            if (state.status !== 'idle') { return state }
            const next = new Set(state.selectedProjectIds)
            if (next.has(action.id)) {
                next.delete(action.id)
            } else {
                next.add(action.id)
            }
            return { ...state, selectedProjectIds: next }
        }

        case 'SELECT_ALL':
            if (state.status !== 'idle') { return state }
            return { ...state, selectedProjectIds: new Set(action.ids) }

        case 'CLEAR_SELECTION':
            return { ...state, selectedProjectIds: new Set() }

        case 'OPERATION_START':
            return {
                ...state,
                status: 'loading',
                loadingMessage: action.message ?? null
            }

        case 'OPERATION_SUCCESS':
            return {
                ...initialState,
                selectedProjectIds: new Set() // Clear selection on success
            }

        case 'OPERATION_ERROR':
            return {
                ...state,
                status: 'error',
                error: action.error,
                loadingMessage: null
            }

        case 'RESET':
            return initialState

        default:
            return state
    }
}

// ============================================================================
// Hook
// ============================================================================

export interface UseProjectListStateMachineOptions {
    filteredProjects: Project[]
    onError?: (error: string) => void
}

export function useProjectListStateMachine({ filteredProjects, onError }: UseProjectListStateMachineOptions) {
    const [state, dispatch] = useReducer(projectListReducer, initialState)

    // ========================================================================
    // Action Creators (safe wrappers that check state before dispatching)
    // ========================================================================

    const startEdit = useCallback((project: Project, e?: React.MouseEvent) => {
        e?.stopPropagation()
        dispatch({ type: 'START_EDIT', project })
    }, [])

    type EditFormInput = { title: string; description: string } | ((prev: { title: string; description: string }) => { title: string; description: string })

    const updateEditForm = useCallback((formOrUpdater: EditFormInput) => {
        if (typeof formOrUpdater === 'function') {
            // It's an updater function - we need to get current state and call it
            // Since we can't access state directly here, dispatch with current value
            // This requires a special action pattern
            dispatch({ type: 'UPDATE_EDIT_FORM', form: formOrUpdater(state.editForm) })
        } else {
            dispatch({ type: 'UPDATE_EDIT_FORM', form: formOrUpdater })
        }
    }, [state.editForm])

    const cancelEdit = useCallback(() => {
        dispatch({ type: 'CANCEL_EDIT' })
    }, [])

    const startDelete = useCallback((project: Project, e?: React.MouseEvent) => {
        e?.stopPropagation()
        dispatch({ type: 'START_DELETE', project })
    }, [])

    const cancelDelete = useCallback(() => {
        dispatch({ type: 'CANCEL_DELETE' })
    }, [])

    const startArchive = useCallback((project: Project) => {
        dispatch({ type: 'START_ARCHIVE', project })
    }, [])

    const cancelArchive = useCallback(() => {
        dispatch({ type: 'CANCEL_ARCHIVE' })
    }, [])

    const startBulkDelete = useCallback(() => {
        dispatch({ type: 'START_BULK_DELETE' })
    }, [])

    const cancelBulkDelete = useCallback(() => {
        dispatch({ type: 'CANCEL_BULK_DELETE' })
    }, [])

    const startBulkArchive = useCallback(() => {
        dispatch({ type: 'START_BULK_ARCHIVE' })
    }, [])

    const cancelBulkArchive = useCallback(() => {
        dispatch({ type: 'CANCEL_BULK_ARCHIVE' })
    }, [])

    const toggleSelection = useCallback((id: string) => {
        dispatch({ type: 'TOGGLE_SELECTION', id })
    }, [])

    const toggleSelectAll = useCallback(() => {
        if (state.selectedProjectIds.size === filteredProjects.length) {
            dispatch({ type: 'CLEAR_SELECTION' })
        } else {
            dispatch({ type: 'SELECT_ALL', ids: filteredProjects.map(p => p.id) })
        }
    }, [filteredProjects, state.selectedProjectIds.size])

    // ========================================================================
    // Async Operation Handlers (with proper state transitions)
    // ========================================================================

    const executeUpdate = useCallback(async () => {
        if (state.status !== 'editing' || !state.targetProject) { return }

        dispatch({ type: 'OPERATION_START', message: 'Updating project...' })
        try {
            await window.electron.db.updateProject(state.targetProject.id, state.editForm)
            dispatch({ type: 'OPERATION_SUCCESS' })
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to update project'
            dispatch({ type: 'OPERATION_ERROR', error: msg })
            onError?.(msg)
        }
    }, [state.status, state.targetProject, state.editForm, onError])

    const executeDelete = useCallback(async (deleteFiles: boolean = false) => {
        if (state.status !== 'deleting' || !state.targetProject) { return }

        dispatch({ type: 'OPERATION_START', message: 'Deleting project...' })
        try {
            await window.electron.db.deleteProject(state.targetProject.id, deleteFiles)
            dispatch({ type: 'OPERATION_SUCCESS' })
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to delete project'
            dispatch({ type: 'OPERATION_ERROR', error: msg })
            onError?.(msg)
        }
    }, [state.status, state.targetProject, onError])

    const executeArchive = useCallback(async () => {
        if (state.status !== 'archiving' || !state.targetProject) { return }

        dispatch({ type: 'OPERATION_START', message: 'Archiving project...' })
        try {
            const newStatus = state.targetProject.status === 'archived' ? 'active' : 'archived'
            await window.electron.db.archiveProject(state.targetProject.id, newStatus === 'archived')
            dispatch({ type: 'OPERATION_SUCCESS' })
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to archive project'
            dispatch({ type: 'OPERATION_ERROR', error: msg })
            onError?.(msg)
        }
    }, [state.status, state.targetProject, onError])

    const executeBulkDelete = useCallback(async (deleteFiles: boolean = false) => {
        if (state.status !== 'bulk_deleting' || state.selectedProjectIds.size === 0) { return }

        dispatch({ type: 'OPERATION_START', message: `Deleting ${state.selectedProjectIds.size} projects...` })
        try {
            await window.electron.db.bulkDeleteProjects(Array.from(state.selectedProjectIds), deleteFiles)
            dispatch({ type: 'OPERATION_SUCCESS' })
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to bulk delete projects'
            dispatch({ type: 'OPERATION_ERROR', error: msg })
            onError?.(msg)
        }
    }, [state.status, state.selectedProjectIds, onError])

    const executeBulkArchive = useCallback(async (isArchived: boolean = true) => {
        if (state.status !== 'bulk_archiving' || state.selectedProjectIds.size === 0) { return }

        dispatch({ type: 'OPERATION_START', message: `Archiving ${state.selectedProjectIds.size} projects...` })
        try {
            await window.electron.db.bulkArchiveProjects(Array.from(state.selectedProjectIds), isArchived)
            dispatch({ type: 'OPERATION_SUCCESS' })
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to bulk archive projects'
            dispatch({ type: 'OPERATION_ERROR', error: msg })
            onError?.(msg)
        }
    }, [state.status, state.selectedProjectIds, onError])

    const executeCreate = useCallback(async (path: string, name: string, description: string, userMounts?: WorkspaceMount[]) => {
        dispatch({ type: 'OPERATION_START', message: 'Creating project...' })
        try {
            const mounts = userMounts && userMounts.length > 0 ? userMounts : [{
                id: `local-${Date.now()}`,
                name: name,
                type: 'local' as const,
                rootPath: path
            }]
            await window.electron.db.createProject(name, path, description, JSON.stringify(mounts))
            dispatch({ type: 'OPERATION_SUCCESS' })
            return true
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to create project'
            dispatch({ type: 'OPERATION_ERROR', error: msg })
            onError?.(msg)
            return false
        }
    }, [onError])

    const reset = useCallback(() => {
        dispatch({ type: 'RESET' })
    }, [])

    // ========================================================================
    // Derived State
    // ========================================================================

    const isOperationInProgress = state.status === 'loading'
    const canPerformActions = state.status === 'idle'

    return {
        // State
        state,
        isOperationInProgress,
        canPerformActions,

        // Single project operations
        startEdit,
        updateEditForm,
        cancelEdit,
        executeUpdate,

        startDelete,
        cancelDelete,
        executeDelete,

        startArchive,
        cancelArchive,
        executeArchive,

        // Bulk operations
        startBulkDelete,
        cancelBulkDelete,
        executeBulkDelete,

        startBulkArchive,
        cancelBulkArchive,
        executeBulkArchive,

        // Selection
        toggleSelection,
        toggleSelectAll,

        // Creation
        executeCreate,

        // Utility
        reset
    }
}
