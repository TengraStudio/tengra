import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { Folder, TerminalTab, Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

// PERF-002-1: Consolidate related state to reduce re-renders
interface WorkspaceManagerState {
    workspaces: Workspace[];
    folders: Folder[];
    selectedWorkspace: Workspace | null;
    terminalTabs: TerminalTab[];
    activeTerminalId: string | null;
}

export function useWorkspaceListManager() {
    const [state, setState] = useState<WorkspaceManagerState>({
        workspaces: [],
        folders: [],
        selectedWorkspace: null,
        terminalTabs: [],
        activeTerminalId: null
    });

    const handleOpenTerminal = useCallback((name: string, command?: string) => {
        const id = uuidv4();
        const newTab: TerminalTab = {
            id,
            name: name,
            type: 'bash',
            status: 'idle',
            history: [],
            command: command ?? ''
        };
        setState(prev => ({
            ...prev,
            terminalTabs: [...prev.terminalTabs, newTab],
            activeTerminalId: id
        }));
    }, []);

    const loadFolders = useCallback(async () => {
        try {
            const data = await window.electron.db.getFolders();
            setState(prev => ({ ...prev, folders: data }));
        } catch (e) {
            appLogger.error('WorkspaceManager', 'Failed to load folders', e as Error);
        }
    }, []);

    const loadWorkspaces = useCallback(async () => {
        try {
            const data = await window.electron.db.getWorkspaces();
            // Database now returns properly typed Workspace data
            // Only need to convert timestamp to Date for frontend use
            const loadedWorkspaces = (Array.isArray(data) ? data : []).map((workspace) => ({
                ...workspace,
                createdAt: workspace.createdAt instanceof Date
                    ? workspace.createdAt
                    : new Date(workspace.createdAt ?? Date.now()),
                // Ensure mounts has a default local mount if empty
                mounts: Array.isArray(workspace.mounts) && workspace.mounts.length > 0
                    ? workspace.mounts
                    : workspace.path
                        ? [{ id: `local-${workspace.id}`, name: 'Local', type: 'local' as const, rootPath: workspace.path }]
                        : []
            }));

            setState(prev => {
                // Sync selectedWorkspace if it exists
                const updatedSelected = prev.selectedWorkspace
                    ? loadedWorkspaces.find(p => p.id === prev.selectedWorkspace?.id) ?? prev.selectedWorkspace
                    : null;

                return {
                    ...prev,
                    workspaces: loadedWorkspaces,
                    selectedWorkspace: updatedSelected
                };
            });
        } catch (e) {
            appLogger.error('WorkspaceManager', 'Failed to load workspaces', e as Error);
        }
    }, []);

    const handleCreateFolder = useCallback(async (name: string) => {
        try {
            await window.electron.db.createFolder(name);
            await loadFolders();
        } catch (e) {
            appLogger.error('WorkspaceManager', 'Failed to create folder', e as Error);
        }
    }, [loadFolders]);

    const handleDeleteFolder = useCallback(async (id: string, onFolderDeleted?: () => void) => {
        appLogger.warn('WorkspaceManager', 'Are you sure you want to delete this folder?');
        try {
            await window.electron.db.deleteFolder(id);
            await loadFolders();
            if (onFolderDeleted) { onFolderDeleted(); }
        } catch (e) {
            appLogger.error('WorkspaceManager', 'Failed to delete folder', e as Error);
        }
    }, [loadFolders]);

    const loadWorkspacesRef = useRef(loadWorkspaces);
    useEffect(() => {
        loadWorkspacesRef.current = loadWorkspaces;
    }, [loadWorkspaces]);

    useEffect(() => {
        const handleWorkspaceUpdated = (_payload: { id?: string }) => {
            void loadWorkspacesRef.current();
        };

        const unsubscribe = window.electron.db.onWorkspaceUpdated(handleWorkspaceUpdated);
        return () => {
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        const fetchInitialData = async () => {
            await loadFolders();
            await loadWorkspaces();
        };
        void fetchInitialData();
    }, [loadFolders, loadWorkspaces]);

    // Destructure state for return object
    const { workspaces, folders, selectedWorkspace, terminalTabs, activeTerminalId } = state;

    // Setters that update specific parts of state
    const setWorkspaces = useCallback((workspaces: Workspace[]) => {
        setState(prev => ({ ...prev, workspaces }));
    }, []);

    const setFolders = useCallback((folders: Folder[]) => {
        setState(prev => ({ ...prev, folders }));
    }, []);

    const setSelectedWorkspace = useCallback((selectedWorkspace: Workspace | null) => {
        setState(prev => ({ ...prev, selectedWorkspace }));
    }, []);

    const setTerminalTabs = useCallback((tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => {
        setState(prev => ({
            ...prev,
            terminalTabs: typeof tabs === 'function' ? tabs(prev.terminalTabs) : tabs
        }));
    }, []);

    const setActiveTerminalId = useCallback((id: string | null) => {
        setState(prev => ({ ...prev, activeTerminalId: id }));
    }, []);

    return useMemo(() => ({
        workspaces,
        setWorkspaces,
        folders,
        setFolders,
        selectedWorkspace,
        setSelectedWorkspace,
        terminalTabs,
        setTerminalTabs,
        activeTerminalId,
        setActiveTerminalId,
        loadFolders,
        loadWorkspaces,
        handleCreateFolder,
        handleDeleteFolder,
        handleOpenTerminal
    }), [
        workspaces, folders, selectedWorkspace, terminalTabs, activeTerminalId,
        setWorkspaces, setFolders, setSelectedWorkspace, setTerminalTabs, setActiveTerminalId,
        loadFolders, loadWorkspaces, handleCreateFolder, handleDeleteFolder, handleOpenTerminal
    ]);
}
