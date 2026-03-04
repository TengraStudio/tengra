import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { Folder, Project, TerminalTab } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

// PERF-002-1: Consolidate related state to reduce re-renders
interface ProjectManagerState {
    projects: Project[];
    folders: Folder[];
    selectedProject: Project | null;
    terminalTabs: TerminalTab[];
    activeTerminalId: string | null;
}

export function useWorkspaceListManager() {
    const [state, setState] = useState<ProjectManagerState>({
        projects: [],
        folders: [],
        selectedProject: null,
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
            appLogger.error('ProjectManager', 'Failed to load folders', e as Error);
        }
    }, []);

    const loadProjects = useCallback(async () => {
        try {
            const data = await window.electron.db.getProjects();
            // Database now returns properly typed Project data
            // Only need to convert timestamp to Date for frontend use
            const loadedProjects = (Array.isArray(data) ? data : []).map((project) => ({
                ...project,
                createdAt: project.createdAt instanceof Date
                    ? project.createdAt
                    : new Date(project.createdAt ?? Date.now()),
                // Ensure mounts has a default local mount if empty
                mounts: Array.isArray(project.mounts) && project.mounts.length > 0
                    ? project.mounts
                    : project.path
                        ? [{ id: `local-${project.id}`, name: 'Local', type: 'local' as const, rootPath: project.path }]
                        : []
            }));

            setState(prev => {
                // Sync selectedProject if it exists
                const updatedSelected = prev.selectedProject
                    ? loadedProjects.find(p => p.id === prev.selectedProject?.id) ?? prev.selectedProject
                    : null;

                return {
                    ...prev,
                    projects: loadedProjects,
                    selectedProject: updatedSelected
                };
            });
        } catch (e) {
            appLogger.error('ProjectManager', 'Failed to load projects', e as Error);
        }
    }, []);

    const handleCreateFolder = useCallback(async (name: string) => {
        try {
            await window.electron.db.createFolder(name);
            await loadFolders();
        } catch (e) {
            appLogger.error('ProjectManager', 'Failed to create folder', e as Error);
        }
    }, [loadFolders]);

    const handleDeleteFolder = useCallback(async (id: string, onFolderDeleted?: () => void) => {
        appLogger.warn('ProjectManager', 'Are you sure you want to delete this folder?');
        try {
            await window.electron.db.deleteFolder(id);
            await loadFolders();
            if (onFolderDeleted) { onFolderDeleted(); }
        } catch (e) {
            appLogger.error('ProjectManager', 'Failed to delete folder', e as Error);
        }
    }, [loadFolders]);

    const loadProjectsRef = useRef(loadProjects);
    useEffect(() => {
        loadProjectsRef.current = loadProjects;
    }, [loadProjects]);

    useEffect(() => {
        const handleProjectUpdated = (_event: unknown, _data?: { id?: string }) => {
            void loadProjectsRef.current();
        };

        const unsubscribe = window.electron.ipcRenderer.on('project:updated', handleProjectUpdated);
        return () => {
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        const fetchInitialData = async () => {
            await loadFolders();
            await loadProjects();
        };
        void fetchInitialData();
    }, [loadFolders, loadProjects]);

    // Destructure state for return object
    const { projects, folders, selectedProject, terminalTabs, activeTerminalId } = state;

    // Setters that update specific parts of state
    const setProjects = useCallback((projects: Project[]) => {
        setState(prev => ({ ...prev, projects }));
    }, []);

    const setFolders = useCallback((folders: Folder[]) => {
        setState(prev => ({ ...prev, folders }));
    }, []);

    const setSelectedProject = useCallback((selectedProject: Project | null) => {
        setState(prev => ({ ...prev, selectedProject }));
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
        projects,
        setProjects,
        folders,
        setFolders,
        selectedProject,
        setSelectedProject,
        terminalTabs,
        setTerminalTabs,
        activeTerminalId,
        setActiveTerminalId,
        loadFolders,
        loadProjects,
        handleCreateFolder,
        handleDeleteFolder,
        handleOpenTerminal
    }), [
        projects, folders, selectedProject, terminalTabs, activeTerminalId,
        setProjects, setFolders, setSelectedProject, setTerminalTabs, setActiveTerminalId,
        loadFolders, loadProjects, handleCreateFolder, handleDeleteFolder, handleOpenTerminal
    ]);
}
