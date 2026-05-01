/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { Folder, TerminalTab, Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

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
            name,
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
        } catch (error) {
            appLogger.error('WorkspaceManager', 'Failed to load folders', error as Error);
        }
    }, []);

    const loadWorkspaces = useCallback(async () => {
        try {
            const data = await window.electron.db.getWorkspaces();
            const loadedWorkspaces = (Array.isArray(data) ? data : []).map(workspace => ({
                ...workspace,
                createdAt: workspace.createdAt instanceof Date
                    ? workspace.createdAt
                    : new Date(workspace.createdAt ?? Date.now()),
                mounts: Array.isArray(workspace.mounts) && workspace.mounts.length > 0
                    ? workspace.mounts
                    : workspace.path
                        ? [{ id: `local-${workspace.id}`, name: 'Local', type: 'local' as const, rootPath: workspace.path }]
                        : []
            }));

            setState(prev => ({
                ...prev,
                workspaces: loadedWorkspaces,
                selectedWorkspace: prev.selectedWorkspace
                    ? loadedWorkspaces.find(workspace => workspace.id === prev.selectedWorkspace?.id) ?? prev.selectedWorkspace
                    : null
            }));
        } catch (error) {
            appLogger.error('WorkspaceManager', 'Failed to load workspaces', error as Error);
        }
    }, []);

    const handleCreateFolder = useCallback(async (name: string) => {
        try {
            await window.electron.db.createFolder(name);
            await loadFolders();
        } catch (error) {
            appLogger.error('WorkspaceManager', 'Failed to create folder', error as Error);
        }
    }, [loadFolders]);

    const handleDeleteFolder = useCallback(async (id: string, onFolderDeleted?: () => void) => {
        appLogger.warn('WorkspaceManager', 'Are you sure you want to delete this folder?');

        try {
            await window.electron.db.deleteFolder(id);
            await loadFolders();
            onFolderDeleted?.();
        } catch (error) {
            appLogger.error('WorkspaceManager', 'Failed to delete folder', error as Error);
        }
    }, [loadFolders]);

    const loadWorkspacesRef = useRef(loadWorkspaces);

    useEffect(() => {
        loadWorkspacesRef.current = loadWorkspaces;
    }, [loadWorkspaces]);

    useEffect(() => {
        const unsubscribe = window.electron.db.onWorkspaceUpdated(() => {
            void loadWorkspacesRef.current();
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        let cancelled = false;
        let timeoutId: number | null = null;
        const requestIdle = (window as Window & {
            requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
        }).requestIdleCallback;

        const loadWorkspaceState = () => {
            if (cancelled) {
                return;
            }
            void (async () => {
                await loadFolders();
                await loadWorkspaces();
            })();
        };

        if (requestIdle) {
            requestIdle(() => {
                loadWorkspaceState();
            }, { timeout: 1500 });
        } else {
            timeoutId = window.setTimeout(() => {
                loadWorkspaceState();
            }, 250);
        }

        return () => {
            cancelled = true;
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [loadFolders, loadWorkspaces]);

    const { workspaces, folders, selectedWorkspace, terminalTabs, activeTerminalId } = state;

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

    const setActiveTerminalId = useCallback((activeTerminalId: string | null) => {
        setState(prev => ({ ...prev, activeTerminalId }));
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
        workspaces,
        folders,
        selectedWorkspace,
        terminalTabs,
        activeTerminalId,
        setWorkspaces,
        setFolders,
        setSelectedWorkspace,
        setTerminalTabs,
        setActiveTerminalId,
        loadFolders,
        loadWorkspaces,
        handleCreateFolder,
        handleDeleteFolder,
        handleOpenTerminal
    ]);
}
