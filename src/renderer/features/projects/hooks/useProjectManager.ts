import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { Folder, Project, TerminalTab } from '@/types';

export function useProjectManager() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [terminalTabs, setTerminalTabs] = useState<TerminalTab[]>([]);
    const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);

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
        setTerminalTabs(prev => [...prev, newTab]);
        setActiveTerminalId(id);
    }, []);

    const loadFolders = useCallback(async () => {
        try {
            const data = await window.electron.db.getFolders();
            setFolders(data);
        } catch (e) {
            console.error('Failed to load folders:', e);
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
            setProjects(loadedProjects);

            // Sync selectedProject if it exists
            if (selectedProject) {
                const updated = loadedProjects.find(p => p.id === selectedProject.id);
                if (updated) {
                    setSelectedProject(updated);
                }
            }
        } catch (e) {
            console.error('Failed to load projects:', e);
        }
    }, [selectedProject]);

    const handleCreateFolder = useCallback(async (name: string) => {
        try {
            await window.electron.db.createFolder(name);
            await loadFolders();
        } catch (e) {
            console.error('Failed to create folder:', e);
        }
    }, [loadFolders]);

    const handleDeleteFolder = useCallback(async (id: string, onFolderDeleted?: () => void) => {
        console.warn('Klasörü silmek istediğinize emin misiniz?');
        try {
            await window.electron.db.deleteFolder(id);
            await loadFolders();
            if (onFolderDeleted) { onFolderDeleted(); }
        } catch (e) {
            console.error('Failed to delete folder:', e);
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
        loadFolders, loadProjects, handleCreateFolder, handleDeleteFolder, handleOpenTerminal
    ]);
}
