import { useCallback, useEffect, useMemo, useState } from 'react';

import { EditorTab, Project, ServiceResponse, WorkspaceDashboardTab, WorkspaceEntry, WorkspaceMount } from '@/types';

interface UseWorkspaceManagerProps {
    project: Project
    notify: (type: 'success' | 'error' | 'info', message: string) => void
    logActivity: (title: string, detail?: string) => void
}

interface FileOpenEntry {
    mountId: string
    path: string
    name: string
    isDirectory: boolean
    initialLine?: number
}

// Helper hook for mount state initialization and sync
function useMountState(project: Project): [WorkspaceMount[], (mounts: WorkspaceMount[]) => void] {
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

    return [mounts, setMounts];
}

// Helper hook for SSH mount status sync
function useMountStatusSync(mounts: WorkspaceMount[]): Record<string, 'connected' | 'disconnected' | 'connecting'> {
    const [mountStatus, setMountStatus] = useState<Record<string, 'connected' | 'disconnected' | 'connecting'>>({});

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

    return mountStatus;
}

// Helper hook for SSH operations
function useSSHOperations(notify: (type: 'success' | 'error' | 'info', message: string) => void, mountStatus: Record<string, 'connected' | 'disconnected' | 'connecting'>) {
    const validateSSHMount = useCallback((mount: WorkspaceMount): boolean => {
        if (!mount.ssh) {
            notify('error', 'SSH config is missing.');
            return false;
        }
        if (!mount.ssh.host || !mount.ssh.username) {
            notify('error', 'SSH config is missing.');
            return false;
        }
        return true;
    }, [notify]);

    const ensureMountReady = useCallback(async (mount: WorkspaceMount): Promise<boolean> => {
        if (mount.type === 'local') { return true; }
        if (!validateSSHMount(mount)) { return false; }
        if (mountStatus[mount.id] === 'connected') { return true; }

        const sshConfig = mount.ssh;
        if (!sshConfig) { return false; }
        const result = await window.electron.ssh.connect({
            id: mount.id,
            name: mount.name,
            host: sshConfig.host,
            port: sshConfig.port ? Number(sshConfig.port) : 22,
            username: sshConfig.username,
            authType: sshConfig.authType ?? (sshConfig.privateKey ? 'key' : 'password'),
            password: sshConfig.password,
            privateKey: sshConfig.privateKey,
            passphrase: sshConfig.passphrase
        });
        if (!result.success) {
            notify('error', result.error ?? 'SSH connection failed.');
            return false;
        }
        return true;
    }, [mountStatus, notify, validateSSHMount]);

    return { ensureMountReady };
}

// Helper for detecting image files
function isImageFile(fileName: string): boolean {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
}

// Extract content from result object
function extractContentFromResult(result: ServiceResponse<string>): string {
    return (result.data ?? result.content) ?? '';
}

// Handle image file reading
async function readImageFile(mount: WorkspaceMount, filePath: string, notify: (type: 'success' | 'error' | 'info', message: string) => void): Promise<{ content: string; type: 'code' | 'image'; result: ServiceResponse<string> | undefined }> {
    if (mount.type === 'local') {
        const result = await window.electron.files.readImage(filePath);
        if (result.success) {
            return { content: extractContentFromResult(result), type: 'image', result };
        }
        return { content: '', type: 'code', result };
    }
    notify('info', 'SSH image preview not supported yet.');
    return { content: '', type: 'code', result: undefined };
}

// Handle code file reading
async function readCodeFile(mount: WorkspaceMount, filePath: string): Promise<{ content: string; type: 'code' | 'image'; result: ServiceResponse<string> }> {
    const result = mount.type === 'local' ? await window.electron.readFile(filePath) : await window.electron.ssh.readFile(mount.id, filePath);
    const content = result.success ? extractContentFromResult(result) : '';

    if (!result.success && result.error === 'File is binary' && mount.type === 'local') {
        const imgResult = await window.electron.files.readImage(filePath);
        if (imgResult.success) {
            return { content: extractContentFromResult(imgResult), type: 'image', result: imgResult };
        }
    }

    return { content, type: 'code', result };
}

// Helper for reading file content based on mount type
async function readFileContent(mount: WorkspaceMount, filePath: string, notify: (type: 'success' | 'error' | 'info', message: string) => void): Promise<{ content: string; type: 'code' | 'image'; result: ServiceResponse<string> | undefined }> {
    if (isImageFile(filePath)) {
        return readImageFile(mount, filePath, notify);
    }
    return readCodeFile(mount, filePath);
}

// Helper hook for file operations
function useFileOperations(mounts: WorkspaceMount[], notify: (type: 'success' | 'error' | 'info', message: string) => void, logActivity: (title: string, detail?: string) => void) {
    const [refreshSignal, setRefreshSignal] = useState(0);

    const createFile = useCallback(async (path: string, mount?: WorkspaceMount) => {
        const targetMount = mount ?? (mounts.length > 0 ? mounts[0] : undefined);
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
        const targetMount = mount ?? (mounts.length > 0 ? mounts[0] : undefined);
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

    return { createFile, createFolder, renameEntry, deleteEntry, refreshSignal, setRefreshSignal };
}

// Helper hook for tab management
function useTabManagement() {
    const [openTabs, setOpenTabs] = useState<EditorTab[]>([]);
    const [activeTabId, setActiveEditorTabId] = useState<string | null>(null);
    const [dashboardTab, setDashboardTab] = useState<WorkspaceDashboardTab>('overview');

    const activeTab = useMemo(() => openTabs.find(t => t.id === activeTabId) ?? null, [openTabs, activeTabId]);

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

    const updateTabContent = useCallback((content: string) => {
        if (!activeTabId) { return; }
        setOpenTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, content } : t));
    }, [activeTabId]);

    return { openTabs, activeTabId, setActiveEditorTabId, activeTab, closeTab, updateTabContent, dashboardTab, setDashboardTab, setOpenTabs };
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
    const [mounts, setMounts] = useMountState(project);
    const mountStatus = useMountStatusSync(mounts);
    const { ensureMountReady } = useSSHOperations(notify, mountStatus);
    const { createFile, createFolder, renameEntry, deleteEntry, refreshSignal, setRefreshSignal } = useFileOperations(mounts, notify, logActivity);
    const { openTabs, activeTabId, setActiveEditorTabId, activeTab, closeTab, updateTabContent, dashboardTab, setDashboardTab, setOpenTabs } = useTabManagement();
    const [councilEnabled, setCouncilEnabled] = useState(Boolean(project.councilConfig.enabled));

    const openFile = useCallback(async (entry: FileOpenEntry) => {
        if (entry.isDirectory) { return; }
        const mount = mounts.find(m => m.id === entry.mountId);
        if (!mount) { return; }

        const tabId = `${entry.mountId}:${entry.path}`;
        const existing = openTabs.find(tab => tab.id === tabId);
        if (existing) {
            if (entry.initialLine !== undefined) {
                setOpenTabs(prev => prev.map(t => t.id === tabId ? { ...t, initialLine: entry.initialLine } : t));
            }
            setActiveEditorTabId(existing.id);
            return;
        }

        const isReady = await ensureMountReady(mount);
        if (!isReady) { return; }

        const { content, type, result } = await readFileContent(mount, entry.path, notify);

        if (!result?.success) { notify('error', result?.error ?? 'Failed to read file.'); return; }

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
    }, [mounts, openTabs, ensureMountReady, notify, setOpenTabs, setActiveEditorTabId, setDashboardTab]);

    const saveActiveTab = useCallback(async () => {
        const activeTabData = openTabs.find(t => t.id === activeTabId);
        if (!activeTabData) { return; }
        const mount = mounts.find(m => m.id === activeTabData.mountId);
        if (!mount) { return; }
        const isReady = await ensureMountReady(mount);
        if (!isReady) { return; }

        const result = mount.type === 'local'
            ? await window.electron.writeFile(activeTabData.path, activeTabData.content)
            : await window.electron.ssh.writeFile(mount.id, activeTabData.path, activeTabData.content);

        if (!result.success) { notify('error', result.error ?? 'Save failed.'); return; }
        setOpenTabs(prev => prev.map(t => t.id === activeTabData.id ? { ...t, savedContent: t.content } : t));
        logActivity('Saved file', activeTabData.path);
        notify('success', 'File saved.');
    }, [activeTabId, openTabs, mounts, ensureMountReady, notify, logActivity, setOpenTabs]);

    const persistMounts = useCallback(async (nextMounts: WorkspaceMount[]) => {
        setMounts(nextMounts);
        try {
            await window.electron.db.updateProject(project.id, { mounts: JSON.stringify(nextMounts) });
        } catch (error) {
            console.error('Failed to save mounts', error);
            notify('error', 'Failed to save mounts.');
        }
    }, [project.id, notify, setMounts]);

    return {
        mounts, mountStatus, openTabs, activeTabId, setActiveEditorTabId, refreshSignal, setRefreshSignal,
        councilEnabled, setCouncilEnabled, openFile, saveActiveTab, closeTab, ensureMountReady, persistMounts,
        setOpenTabs, activeTab, createFile, createFolder, renameEntry, deleteEntry, updateTabContent,
        dashboardTab, setDashboardTab
    };
}
