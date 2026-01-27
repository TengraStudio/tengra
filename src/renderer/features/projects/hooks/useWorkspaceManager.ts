import { useCallback, useEffect, useMemo, useState } from 'react';

import { EditorTab, Project, ServiceResponse, WorkspaceDashboardTab, WorkspaceEntry, WorkspaceMount } from '@/types';

interface UseWorkspaceManagerProps {
    project: Project
    notify: (type: 'success' | 'error' | 'info', message: string) => void
    logActivity: (title: string, detail?: string) => void
}

/**
 * useWorkspaceManager Hook
 * 
 * Centralizes state and logic for:
 * - Mount management (local/SSH)
 * - File operations (read/write/create/delete/rename)
 * - Tab management (open/close/save)
 * - Agent Council configuration
 */
export function useWorkspaceManager({
    project,
    notify,
    logActivity
}: UseWorkspaceManagerProps) {
    const [mounts, setMounts] = useState<WorkspaceMount[]>(() => {
        if (Array.isArray(project.mounts) && project.mounts.length > 0) { return project.mounts; }
        return project.path ? [{ id: `local-${project.id}`, name: 'Local', type: 'local', rootPath: project.path }] : [];
    });
    const [prevProjectData, setPrevProjectData] = useState({ id: project.id, mounts: project.mounts, path: project.path });

    // Adjust state during render when props change (React recommended pattern)
    if (project.id !== prevProjectData.id || project.mounts !== prevProjectData.mounts || project.path !== prevProjectData.path) {
        setPrevProjectData({ id: project.id, mounts: project.mounts, path: project.path });
        const nextMounts: WorkspaceMount[] = (Array.isArray(project.mounts) && project.mounts.length > 0)
            ? project.mounts
            : project.path
                ? [{ id: `local-${project.id}`, name: 'Local', type: 'local', rootPath: project.path }]
                : [];

        if (JSON.stringify(nextMounts) !== JSON.stringify(mounts)) {
            setMounts(nextMounts);
        }
    }

    const [mountStatus, setMountStatus] = useState<Record<string, 'connected' | 'disconnected' | 'connecting'>>({});
    const [openTabs, setOpenTabs] = useState<EditorTab[]>([]);
    const [activeTabId, setActiveEditorTabId] = useState<string | null>(null);
    const [refreshSignal, setRefreshSignal] = useState(0);
    const [councilEnabled, setCouncilEnabled] = useState(Boolean(project.councilConfig.enabled));
    const [dashboardTab, setDashboardTab] = useState<WorkspaceDashboardTab>('overview');

    const activeTab = useMemo(() => openTabs.find(t => t.id === activeTabId) ?? null, [openTabs, activeTabId]);



    // SSH Connection Status Sync
    useEffect(() => {
        let cancelled = false;
        const syncStatus = async () => {
            const next: Record<string, 'connected' | 'disconnected' | 'connecting'> = {};
            for (const mount of mounts) {
                if (mount.type === 'local') {
                    next[mount.id] = 'connected';
                } else {
                    try {
                        const isConnected = await window.electron.ssh.isConnected(mount.id);
                        next[mount.id] = isConnected ? 'connected' : 'disconnected';
                    } catch {
                        next[mount.id] = 'disconnected';
                    }
                }
            }
            if (!cancelled) { setMountStatus(next); }
        };
        void syncStatus();
        return () => { cancelled = true; };
    }, [mounts]);

    const ensureMountReady = useCallback(async (mount: WorkspaceMount) => {
        if (mount.type === 'local') { return true; }
        if (!mount.ssh?.host || !mount.ssh?.username) {
            notify('error', 'SSH config is missing.');
            return false;
        }
        if (mountStatus[mount.id] === 'connected') { return true; }
        setMountStatus(prev => ({ ...prev, [mount.id]: 'connecting' }));
        const result = await window.electron.ssh.connect({
            id: mount.id,
            name: mount.name,
            host: mount.ssh.host,
            port: mount.ssh.port ? Number(mount.ssh.port) : 22,
            username: mount.ssh.username,
            authType: mount.ssh.authType ?? (mount.ssh.privateKey ? 'key' : 'password'),
            password: mount.ssh.password,
            privateKey: mount.ssh.privateKey,
            passphrase: mount.ssh.passphrase
        });
        if (!result.success) {
            setMountStatus(prev => ({ ...prev, [mount.id]: 'disconnected' }));
            notify('error', result.error ?? 'SSH connection failed.');
            return false;
        }
        setMountStatus(prev => ({ ...prev, [mount.id]: 'connected' }));
        return true;
    }, [mountStatus, notify]);

    const openFile = useCallback(async (entry: { mountId: string, path: string, name: string, isDirectory: boolean, initialLine?: number }) => {
        if (entry.isDirectory) { return; }
        const mount = mounts.find(m => m.id === entry.mountId);
        if (!mount) { return; }

        const tabId = `${entry.mountId}:${entry.path}`;
        const existing = openTabs.find(tab => tab.id === tabId);
        if (existing) {
            // If it has an initialLine, we should update the tab to trigger a scroll
            if (entry.initialLine !== undefined) {
                setOpenTabs(prev => prev.map(t => t.id === tabId ? { ...t, initialLine: entry.initialLine } : t));
            }
            setActiveEditorTabId(existing.id);
            return;
        }

        const isReady = await ensureMountReady(mount);
        if (!isReady) { return; }

        const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
        const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);

        let result: ServiceResponse<string> | undefined;
        let content = '';
        let type: 'code' | 'image' = 'code';

        if (isImage) {
            if (mount.type === 'local') { result = await window.electron.files.readImage(entry.path); }
            else { notify('info', 'SSH image preview not supported yet.'); return; }
            if (result.success) {
                const contentData = (result.data ?? result.content) ?? '';
                content = contentData;
                type = 'image';
            }
        } else {
            result = (mount.type === 'local' ? await window.electron.readFile(entry.path) : await window.electron.ssh.readFile(mount.id, entry.path));
            if (!result.success && result.error === 'File is binary' && mount.type === 'local') {
                const imgResult = await window.electron.files.readImage(entry.path);
                if (imgResult.success) { result = imgResult; type = 'image'; }
            }
            if (result.success) {
                const contentData = (result.data ?? result.content) ?? '';
                content = contentData;
            }
        }

        if (!result.success) { notify('error', result.error ?? 'Failed to read file.'); return; }

        const tab: EditorTab = {
            id: tabId,
            mountId: entry.mountId,
            path: entry.path,
            name: entry.name,
            content,
            savedContent: content,
            type,
            isDirty: false,
            initialLine: entry.initialLine
        };
        setOpenTabs(prev => [...prev, tab]);
        setActiveEditorTabId(tabId);
        setDashboardTab('editor');
    }, [mounts, openTabs, ensureMountReady, notify]);

    const saveActiveTab = useCallback(async () => {
        const activeTab = openTabs.find(t => t.id === activeTabId);
        if (!activeTab) { return; }
        const mount = mounts.find(m => m.id === activeTab.mountId);
        if (!mount) { return; }
        const isReady = await ensureMountReady(mount);
        if (!isReady) { return; }

        const result = mount.type === 'local'
            ? await window.electron.writeFile(activeTab.path, activeTab.content)
            : await window.electron.ssh.writeFile(mount.id, activeTab.path, activeTab.content);

        if (!result.success) { notify('error', result.error ?? 'Save failed.'); return; }
        setOpenTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, savedContent: t.content } : t));
        logActivity('Saved file', activeTab.path);
        notify('success', 'File saved.');
    }, [activeTabId, openTabs, mounts, ensureMountReady, notify, logActivity]);

    const closeTab = useCallback((tabId: string) => {
        const tab = openTabs.find(t => t.id === tabId);
        if (tab && tab.content !== tab.savedContent) {
            console.warn(`Close without saving "${tab.name}"?`);
        }
        setOpenTabs(prev => prev.filter(t => t.id !== tabId));
        if (activeTabId === tabId) {
            const remainingTabs = openTabs.filter(t => t.id !== tabId);
            const next = remainingTabs.pop();
            setActiveEditorTabId(next?.id ?? null);
            if (!next) {
                setDashboardTab('overview');
            }
        }
    }, [activeTabId, openTabs]);

    const persistMounts = useCallback(async (nextMounts: WorkspaceMount[]) => {
        setMounts(nextMounts);
        try {
            await window.electron.db.updateProject(project.id, { mounts: JSON.stringify(nextMounts) });
        } catch (error) {
            console.error('Failed to save mounts', error);
            notify('error', 'Failed to save mounts.');
        }
    }, [project.id, notify]);

    const createFile = useCallback(async (path: string, mount?: WorkspaceMount) => {
        const targetMount = mount ?? mounts[0];
        if (!targetMount) { return; }
        const result = targetMount.type === 'local' ? await window.electron.writeFile(path, '') : await window.electron.ssh.writeFile(targetMount.id, path, '');
        if (result.success) {
            setRefreshSignal(s => s + 1);
            logActivity('Created file', path);
        } else {
            notify('error', result.error ?? 'Failed to create file.');
        }
    }, [mounts, logActivity, notify]);

    const createFolder = useCallback(async (path: string, mount?: WorkspaceMount) => {
        const targetMount = mount ?? mounts[0];
        if (!targetMount) { return; }
        const result = targetMount.type === 'local' ? await window.electron.createDirectory(path) : await window.electron.ssh.mkdir(targetMount.id, path);
        if (result.success) {
            setRefreshSignal(s => s + 1);
            logActivity('Created folder', path);
        } else {
            notify('error', result.error ?? 'Failed to create folder.');
        }
    }, [mounts, logActivity, notify]);

    const renameEntry = useCallback(async (entry: WorkspaceEntry, newName: string) => {
        const mount = mounts.find(m => m.id === entry.mountId);
        if (!mount) { return; }
        const parentPath = entry.path.substring(0, entry.path.lastIndexOf('/'));
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;
        const result = mount.type === 'local' ? await window.electron.renamePath(entry.path, newPath) : await window.electron.ssh.rename(mount.id, entry.path, newPath);
        if (result.success) {
            setRefreshSignal(s => s + 1);
            logActivity('Renamed entry', `${entry.name} -> ${newName}`);
        } else {
            notify('error', result.error ?? 'Failed to rename.');
        }
    }, [mounts, logActivity, notify]);

    const deleteEntry = useCallback(async (entry: WorkspaceEntry) => {
        const mount = mounts.find(m => m.id === entry.mountId);
        if (!mount) { return; }
        const result = mount.type === 'local'
            ? (entry.isDirectory ? await window.electron.deleteDirectory(entry.path) : await window.electron.deleteFile(entry.path))
            : (entry.isDirectory ? await window.electron.ssh.deleteDir(mount.id, entry.path) : await window.electron.ssh.deleteFile(mount.id, entry.path));
        if (result.success) {
            setRefreshSignal(s => s + 1);
            logActivity('Deleted entry', entry.path);
        } else {
            notify('error', result.error ?? 'Failed to delete.');
        }
    }, [mounts, logActivity, notify]);

    const updateTabContent = useCallback((content: string) => {
        if (!activeTabId) { return; }
        setOpenTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, content } : t));
    }, [activeTabId]);

    return {
        mounts, mountStatus, openTabs, activeTabId, setActiveEditorTabId, refreshSignal, setRefreshSignal,
        councilEnabled, setCouncilEnabled, openFile, saveActiveTab, closeTab, ensureMountReady, persistMounts,
        setOpenTabs, activeTab, createFile, createFolder, renameEntry, deleteEntry, updateTabContent,
        dashboardTab, setDashboardTab
    };
}
