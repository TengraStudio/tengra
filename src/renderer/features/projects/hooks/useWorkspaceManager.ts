import { useCallback, useEffect, useMemo, useState } from 'react';


import {
    EditorTab,
    Project,
    ServiceResponse,
    WorkspaceDashboardTab,
    WorkspaceEntry,
    WorkspaceMount,
} from '@/types';

import { useMountManagement } from './useMountManagement';

interface UseWorkspaceManagerProps {
    project: Project;
    notify: (type: 'success' | 'error' | 'info', message: string) => void;
    logActivity: (title: string, detail?: string) => void;
    t: (key: string) => string;
}

interface FileOpenEntry {
    mountId: string;
    path: string;
    name: string;
    isDirectory: boolean;
    initialLine?: number;
}

// Helper hook for mount state initialization and sync
function useMountState(project: Project): [WorkspaceMount[], (mounts: WorkspaceMount[]) => void] {
    const [mounts, setMounts] = useState<WorkspaceMount[]>(() => {
        if (Array.isArray(project.mounts) && project.mounts.length > 0) {
            return project.mounts;
        }
        return project.path
            ? [{ id: `local-${project.id}`, name: 'Local', type: 'local', rootPath: project.path }]
            : [];
    });
    const [prevProjectData, setPrevProjectData] = useState({
        id: project.id,
        mounts: project.mounts,
        path: project.path,
    });

    // Adjust state during render when props change (React recommended pattern)
    if (
        project.id !== prevProjectData.id ||
        project.mounts !== prevProjectData.mounts ||
        project.path !== prevProjectData.path
    ) {
        setPrevProjectData({ id: project.id, mounts: project.mounts, path: project.path });
        const nextMounts: WorkspaceMount[] =
            Array.isArray(project.mounts) && project.mounts.length > 0
                ? project.mounts
                : project.path
                    ? [
                        {
                            id: `local-${project.id}`,
                            name: 'Local',
                            type: 'local',
                            rootPath: project.path,
                        },
                    ]
                    : [];

        if (JSON.stringify(nextMounts) !== JSON.stringify(mounts)) {
            setMounts(nextMounts);
        }
    }

    return [mounts, setMounts];
}

// Helper hook for SSH mount status sync
function useMountStatusSync(
    mounts: WorkspaceMount[]
): Record<string, 'connected' | 'disconnected' | 'connecting'> {
    const [mountStatus, setMountStatus] = useState<
        Record<string, 'connected' | 'disconnected' | 'connecting'>
    >({});

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
            if (!cancelled) {
                setMountStatus(next);
            }
        };
        void syncStatus();
        return () => {
            cancelled = true;
        };
    }, [mounts]);

    return mountStatus;
}

// Helper hook for SSH operations
function useSSHOperations(
    notify: (type: 'success' | 'error' | 'info', message: string) => void,
    mountStatus: Record<string, 'connected' | 'disconnected' | 'connecting'>,
    t: (key: string) => string
) {
    const MAX_CONNECT_RETRIES = 3;
    const INITIAL_BACKOFF_MS = 400;

    const waitFor = useCallback(async (delayMs: number) => {
        await new Promise<void>(resolve => {
            window.setTimeout(() => resolve(), delayMs);
        });
    }, []);

    const validateSSHMount = useCallback(
        (mount: WorkspaceMount): boolean => {
            if (!mount.ssh) {
                notify('error', t('errors.unexpected'));
                return false;
            }
            if (!mount.ssh.host || !mount.ssh.username) {
                notify('error', t('errors.unexpected'));
                return false;
            }
            return true;
        },
        [notify, t]
    );

    const ensureMountReady = useCallback(
        async (mount: WorkspaceMount): Promise<boolean> => {
            if (mount.type === 'local') {
                return true;
            }
            if (!validateSSHMount(mount)) {
                return false;
            }
            if (mountStatus[mount.id] === 'connected') {
                return true;
            }

            const sshConfig = mount.ssh;
            if (!sshConfig) {
                return false;
            }
            let backoffMs = INITIAL_BACKOFF_MS;
            let lastError = t('errors.unexpected');
            for (let attempt = 1; attempt <= MAX_CONNECT_RETRIES; attempt++) {
                const result = await window.electron.ssh.connect({
                    id: mount.id,
                    name: mount.name,
                    host: sshConfig.host,
                    port: sshConfig.port ? Number(sshConfig.port) : 22,
                    username: sshConfig.username,
                    authType: sshConfig.authType ?? (sshConfig.privateKey ? 'key' : 'password'),
                    password: sshConfig.password,
                    privateKey: sshConfig.privateKey,
                    passphrase: sshConfig.passphrase,
                });
                if (result.success) {
                    if (attempt > 1) {
                        notify('info', `SSH connected after ${attempt} attempts.`);
                    }
                    return true;
                }

                const diagnosticHint = result.diagnostics?.hint;
                lastError = diagnosticHint
                    ? `${result.error ?? t('errors.unexpected')} ${diagnosticHint}`
                    : result.error ?? t('errors.unexpected');
                if (attempt < MAX_CONNECT_RETRIES) {
                    notify('info', `SSH connect retry ${attempt}/${MAX_CONNECT_RETRIES - 1}...`);
                    await waitFor(backoffMs);
                    backoffMs *= 2;
                }
            }
            notify('error', lastError);
            return false;
        },
        [mountStatus, notify, t, validateSSHMount, waitFor]
    );

    return { ensureMountReady };
}

// Helper for detecting image files
function isImageFile(fileName: string): boolean {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
}

// Extract content from result object
function extractContentFromResult(result: ServiceResponse<string>): string {
    return result.data ?? result.content ?? '';
}

// Handle image file reading
async function readImageFile(
    mount: WorkspaceMount,
    filePath: string,
    notify: (type: 'success' | 'error' | 'info', message: string) => void
): Promise<{
    content: string;
    type: 'code' | 'image';
    result: ServiceResponse<string> | undefined;
}> {
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
async function readCodeFile(
    mount: WorkspaceMount,
    filePath: string
): Promise<{ content: string; type: 'code' | 'image'; result: ServiceResponse<string> }> {
    const result =
        mount.type === 'local'
            ? await window.electron.readFile(filePath)
            : await window.electron.ssh.readFile(mount.id, filePath);
    const content = result.success ? extractContentFromResult(result) : '';

    if (!result.success && result.error === 'File is binary' && mount.type === 'local') {
        const imgResult = await window.electron.files.readImage(filePath);
        if (imgResult.success) {
            return {
                content: extractContentFromResult(imgResult),
                type: 'image',
                result: imgResult,
            };
        }
    }

    return { content, type: 'code', result };
}

// Helper for reading file content based on mount type
async function readFileContent(
    mount: WorkspaceMount,
    filePath: string,
    notify: (type: 'success' | 'error' | 'info', message: string) => void
): Promise<{
    content: string;
    type: 'code' | 'image';
    result: ServiceResponse<string> | undefined;
}> {
    if (isImageFile(filePath)) {
        return readImageFile(mount, filePath, notify);
    }
    return readCodeFile(mount, filePath);
}

function normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
}

function trimTrailingSeparator(path: string): string {
    return path.replace(/[\\/]+$/, '');
}

function getRelativePath(filePath: string, rootPath: string): string {
    const normalizedFilePath = normalizePath(filePath);
    const normalizedRootPath = trimTrailingSeparator(normalizePath(rootPath));

    if (!normalizedRootPath) {
        return filePath;
    }

    const lowerFilePath = normalizedFilePath.toLowerCase();
    const lowerRootPath = normalizedRootPath.toLowerCase();

    if (lowerFilePath === lowerRootPath) {
        return filePath.split(/[\\/]/).pop() ?? filePath;
    }

    const rootWithSlash = `${lowerRootPath}/`;
    if (lowerFilePath.startsWith(rootWithSlash)) {
        return normalizedFilePath.slice(normalizedRootPath.length + 1);
    }

    return filePath.split(/[\\/]/).pop() ?? filePath;
}

function getDirectoryPath(filePath: string): string {
    const lastSlashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    if (lastSlashIndex <= 0) {
        return filePath;
    }
    return filePath.slice(0, lastSlashIndex);
}

// Helper hook for file operations
function useFileOperations(
    mounts: WorkspaceMount[],
    notify: (type: 'success' | 'error' | 'info', message: string) => void,
    logActivity: (title: string, detail?: string) => void
) {
    const [refreshSignal, setRefreshSignal] = useState(0);

    const createFile = useCallback(
        async (path: string, mount?: WorkspaceMount) => {
            const targetMount = mount ?? (mounts.length > 0 ? mounts[0] : undefined);
            if (!targetMount) {
                return;
            }
            const result =
                targetMount.type === 'local'
                    ? await window.electron.writeFile(path, '')
                    : await window.electron.ssh.writeFile(targetMount.id, path, '');
            if (result.success) {
                setRefreshSignal(s => s + 1);
                logActivity('Created file', path);
                notify('success', 'File created.');
            } else {
                notify('error', result.error ?? 'Failed to create file.');
            }
        },
        [mounts, logActivity, notify]
    );

    const createFolder = useCallback(
        async (path: string, mount?: WorkspaceMount) => {
            const targetMount = mount ?? (mounts.length > 0 ? mounts[0] : undefined);
            if (!targetMount) {
                return;
            }
            const result =
                targetMount.type === 'local'
                    ? await window.electron.createDirectory(path)
                    : await window.electron.ssh.mkdir(targetMount.id, path);
            if (result.success) {
                setRefreshSignal(s => s + 1);
                logActivity('Created folder', path);
                notify('success', 'Folder created.');
            } else {
                notify('error', result.error ?? 'Failed to create folder.');
            }
        },
        [mounts, logActivity, notify]
    );

    const renameEntry = useCallback(
        async (entry: WorkspaceEntry, newName: string) => {
            const mount = mounts.find(m => m.id === entry.mountId);
            if (!mount) {
                return;
            }
            const lastSlashIndex = Math.max(
                entry.path.lastIndexOf('/'),
                entry.path.lastIndexOf('\\')
            );
            const parentPath = lastSlashIndex !== -1 ? entry.path.substring(0, lastSlashIndex) : '';
            const separator = entry.path.includes('\\') ? '\\' : '/';
            const newPath = parentPath ? `${parentPath}${separator}${newName}` : newName;
            const result =
                mount.type === 'local'
                    ? await window.electron.renamePath(entry.path, newPath)
                    : await window.electron.ssh.rename(mount.id, entry.path, newPath);
            if (result.success) {
                setRefreshSignal(s => s + 1);
                logActivity('Renamed entry', `${entry.name} -> ${newName}`);
                notify('success', 'Entry renamed.');
            } else {
                notify('error', result.error ?? 'Failed to rename.');
            }
        },
        [mounts, logActivity, notify]
    );

    const deleteEntry = useCallback(
        async (entry: WorkspaceEntry) => {
            const mount = mounts.find(m => m.id === entry.mountId);
            if (!mount) {
                return;
            }
            const result =
                mount.type === 'local'
                    ? entry.isDirectory
                        ? await window.electron.deleteDirectory(entry.path)
                        : await window.electron.deleteFile(entry.path)
                    : entry.isDirectory
                        ? await window.electron.ssh.deleteDir(mount.id, entry.path)
                        : await window.electron.ssh.deleteFile(mount.id, entry.path);
            if (result.success) {
                setRefreshSignal(s => s + 1);
                logActivity('Deleted entry', entry.path);
                notify('success', 'Entry deleted.');
            } else {
                notify('error', result.error ?? 'Failed to delete.');
            }
        },
        [mounts, logActivity, notify]
    );

    const moveEntry = useCallback(
        async (entry: WorkspaceEntry, targetDirPath: string) => {
            const mount = mounts.find(m => m.id === entry.mountId);
            if (!mount) {
                return;
            }
            const fileName = entry.path.split(/[\\/]/).pop() || '';
            const separator = entry.path.includes('\\') ? '\\' : '/';
            const newPath = `${targetDirPath}${separator}${fileName}`;

            if (entry.path === newPath) {
                return;
            }

            const result =
                mount.type === 'local'
                    ? await window.electron.renamePath(entry.path, newPath)
                    : await window.electron.ssh.rename(mount.id, entry.path, newPath);

            if (result.success) {
                setRefreshSignal(s => s + 1);
                logActivity('Moved entry', `${entry.path} -> ${newPath}`);
                notify('success', 'Entry moved.');
            } else {
                notify('error', result.error ?? 'Failed to move.');
            }
        },
        [mounts, logActivity, notify]
    );

    return {
        createFile,
        createFolder,
        renameEntry,
        deleteEntry,
        moveEntry,
        refreshSignal,
        setRefreshSignal,
    };
}

// Helper hook for tab management
function sortTabsForDisplay(tabs: EditorTab[]): EditorTab[] {
    const pinnedTabs = tabs.filter(tab => tab.isPinned);
    const regularTabs = tabs.filter(tab => !tab.isPinned);
    return [...pinnedTabs, ...regularTabs];
}

function findFallbackTabId(tabs: EditorTab[]): string | null {
    const orderedTabs = sortTabsForDisplay(tabs);
    return orderedTabs.length > 0 ? (orderedTabs[orderedTabs.length - 1]?.id ?? null) : null;
}

interface PersistedTabsState {
    openTabs: EditorTab[];
    activeTabId: string | null;
}

const getWorkspaceTabsStorageKey = (projectId: string): string =>
    `workspace.tabs.state.v1:${projectId}`;

const loadPersistedTabsState = (projectId: string): PersistedTabsState => {
    try {
        const raw = localStorage.getItem(getWorkspaceTabsStorageKey(projectId));
        if (!raw) {
            return { openTabs: [], activeTabId: null };
        }
        const parsed = JSON.parse(raw) as PersistedTabsState;
        return {
            openTabs: Array.isArray(parsed.openTabs) ? parsed.openTabs : [],
            activeTabId: parsed.activeTabId ?? null,
        };
    } catch {
        return { openTabs: [], activeTabId: null };
    }
};

function useTabManagement(projectId: string) {
    const persistedTabsState = useMemo(() => loadPersistedTabsState(projectId), [projectId]);
    const [openTabs, setOpenTabs] = useState<EditorTab[]>(persistedTabsState.openTabs);
    const [activeTabId, setActiveEditorTabId] = useState<string | null>(persistedTabsState.activeTabId);
    const [dashboardTab, setDashboardTab] = useState<WorkspaceDashboardTab>('overview');
    const [activeProjectId, setActiveProjectId] = useState(projectId);

    if (activeProjectId !== projectId) {
        setActiveProjectId(projectId);
        setOpenTabs(persistedTabsState.openTabs);
        setActiveEditorTabId(persistedTabsState.activeTabId);
        setDashboardTab(persistedTabsState.activeTabId ? 'editor' : 'overview');
    }

    const activeTab = useMemo(
        () => openTabs.find(t => t.id === activeTabId) ?? null,
        [openTabs, activeTabId]
    );

    const applyTabUpdate = useCallback(
        (nextTabs: EditorTab[], preferredActiveTabId?: string | null) => {
            setOpenTabs(nextTabs);
            const currentTabStillOpen = Boolean(
                activeTabId && nextTabs.some(tab => tab.id === activeTabId)
            );
            const preferredTabStillOpen = Boolean(
                preferredActiveTabId && nextTabs.some(tab => tab.id === preferredActiveTabId)
            );

            const nextActiveTabId = preferredTabStillOpen
                ? (preferredActiveTabId ?? null)
                : currentTabStillOpen
                    ? activeTabId
                    : findFallbackTabId(nextTabs);

            setActiveEditorTabId(nextActiveTabId);
            if (!nextActiveTabId) {
                setDashboardTab('overview');
            }
        },
        [activeTabId]
    );

    const closeTab = useCallback(
        (tabId: string) => {
            const tab = openTabs.find(t => t.id === tabId);
            if (tab && tab.content !== tab.savedContent) {
                window.electron.log.warn('Unsaved tab close blocked. Save before closing.');
                return;
            }
            const nextTabs = openTabs.filter(t => t.id !== tabId);
            applyTabUpdate(nextTabs);
        },
        [applyTabUpdate, openTabs]
    );

    const togglePinTab = useCallback((tabId: string) => {
        setOpenTabs(prev =>
            prev.map(tab => (tab.id === tabId ? { ...tab, isPinned: !tab.isPinned } : tab))
        );
    }, []);

    const closeAllTabs = useCallback(() => {
        const nextTabs = openTabs.filter(tab => tab.isPinned);
        applyTabUpdate(nextTabs);
    }, [applyTabUpdate, openTabs]);

    const closeTabsToRight = useCallback(
        (tabId: string) => {
            const orderedTabs = sortTabsForDisplay(openTabs);
            const tabIndex = orderedTabs.findIndex(tab => tab.id === tabId);
            if (tabIndex < 0) {
                return;
            }
            const closeableIds = new Set(
                orderedTabs
                    .slice(tabIndex + 1)
                    .filter(tab => !tab.isPinned)
                    .map(tab => tab.id)
            );

            if (closeableIds.size === 0) {
                return;
            }

            const nextTabs = openTabs.filter(tab => !closeableIds.has(tab.id));
            applyTabUpdate(nextTabs, tabId);
        },
        [applyTabUpdate, openTabs]
    );

    const closeOtherTabs = useCallback(
        (tabId: string) => {
            const selectedTab = openTabs.find(tab => tab.id === tabId);
            if (!selectedTab) {
                return;
            }
            const nextTabs = openTabs.filter(tab => tab.id === tabId || tab.isPinned);
            applyTabUpdate(nextTabs, tabId);
        },
        [applyTabUpdate, openTabs]
    );

    const updateTabContent = useCallback(
        (content: string) => {
            if (!activeTabId) {
                return;
            }
            setOpenTabs(prev => prev.map(t => (t.id === activeTabId ? { ...t, content } : t)));
        },
        [activeTabId]
    );

    useEffect(() => {
        localStorage.setItem(
            getWorkspaceTabsStorageKey(projectId),
            JSON.stringify({
                openTabs,
                activeTabId,
            } satisfies PersistedTabsState)
        );
    }, [activeTabId, openTabs, projectId]);

    return {
        openTabs,
        activeTabId,
        setActiveEditorTabId,
        activeTab,
        closeTab,
        togglePinTab,
        closeAllTabs,
        closeTabsToRight,
        closeOtherTabs,
        updateTabContent,
        dashboardTab,
        setDashboardTab,
        setOpenTabs,
    };
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
export function useWorkspaceManager({ project, notify, logActivity, t }: UseWorkspaceManagerProps) {
    const [mounts, setMounts] = useMountState(project);
    const mountStatus = useMountStatusSync(mounts);
    const { ensureMountReady } = useSSHOperations(notify, mountStatus, t);
    const {
        createFile,
        createFolder,
        renameEntry,
        deleteEntry,
        moveEntry,
        refreshSignal,
        setRefreshSignal,
    } = useFileOperations(mounts, notify, logActivity);
    const {
        openTabs,
        activeTabId,
        setActiveEditorTabId,
        activeTab,
        closeTab,
        togglePinTab,
        closeAllTabs,
        closeTabsToRight,
        closeOtherTabs,
        updateTabContent,
        dashboardTab,
        setDashboardTab,
        setOpenTabs,
    } = useTabManagement(project.id);
    const [councilEnabled, setCouncilEnabled] = useState(Boolean(project.councilConfig.enabled));
    const {
        persistMounts,
        mountForm,
        setMountForm,
        addMount,
        testConnection,
        pickLocalFolder,
    } = useMountManagement({
        projectId: project.id,
        mounts,
        setMounts,
        notify,
        t,
    });

    const openFile = useCallback(
        async (entry: FileOpenEntry) => {
            if (entry.isDirectory) {
                return;
            }
            const mount = mounts.find(m => m.id === entry.mountId);
            if (!mount) {
                return;
            }

            const tabId = `${entry.mountId}:${entry.path}`;
            const existing = openTabs.find(tab => tab.id === tabId);
            if (existing) {
                if (entry.initialLine !== undefined) {
                    setOpenTabs(prev =>
                        prev.map(t =>
                            t.id === tabId ? { ...t, initialLine: entry.initialLine } : t
                        )
                    );
                }
                setActiveEditorTabId(existing.id);
                return;
            }

            const isReady = await ensureMountReady(mount);
            if (!isReady) {
                return;
            }

            const { content, type, result } = await readFileContent(mount, entry.path, notify);

            if (!result?.success) {
                notify('error', result?.error ?? 'Failed to read file.');
                return;
            }

            const tab: EditorTab = {
                id: tabId,
                mountId: entry.mountId,
                path: entry.path,
                name: entry.name,
                content,
                savedContent: content,
                type,
                isDirty: false,
                isPinned: false,
                initialLine: entry.initialLine,
            };
            setOpenTabs(prev => [...prev, tab]);
            setActiveEditorTabId(tabId);
            setDashboardTab('editor');
        },
        [
            mounts,
            openTabs,
            ensureMountReady,
            notify,
            setOpenTabs,
            setActiveEditorTabId,
            setDashboardTab,
        ]
    );

    const saveActiveTab = useCallback(async () => {
        const activeTabData = openTabs.find(t => t.id === activeTabId);
        if (!activeTabData) {
            return;
        }
        const mount = mounts.find(m => m.id === activeTabData.mountId);
        if (!mount) {
            return;
        }
        const isReady = await ensureMountReady(mount);
        if (!isReady) {
            return;
        }

        const result =
            mount.type === 'local'
                ? await window.electron.writeFile(activeTabData.path, activeTabData.content)
                : await window.electron.ssh.writeFile(
                    mount.id,
                    activeTabData.path,
                    activeTabData.content
                );

        if (!result.success) {
            notify('error', result.error ?? 'Save failed.');
            return;
        }
        setOpenTabs(prev =>
            prev.map(t => (t.id === activeTabData.id ? { ...t, savedContent: t.content } : t))
        );
        logActivity('Saved file', activeTabData.path);
        notify('success', 'File saved.');
    }, [activeTabId, openTabs, mounts, ensureMountReady, notify, logActivity, setOpenTabs]);

    const copyTabAbsolutePath = useCallback(
        async (tabId: string) => {
            const tab = openTabs.find(item => item.id === tabId);
            if (!tab) {
                return;
            }
            const result = await window.electron.clipboard.writeText(tab.path);
            if (result.success) {
                notify('success', t('workspace.pathCopied'));
                logActivity('Copied tab path', tab.path);
                return;
            }
            notify('error', t('workspace.pathCopyFailed'));
        },
        [logActivity, notify, openTabs, t]
    );

    const copyTabRelativePath = useCallback(
        async (tabId: string) => {
            const tab = openTabs.find(item => item.id === tabId);
            if (!tab) {
                return;
            }
            const mount = mounts.find(item => item.id === tab.mountId);
            const relativePath = mount?.rootPath
                ? getRelativePath(tab.path, mount.rootPath)
                : tab.name;
            const result = await window.electron.clipboard.writeText(relativePath);
            if (result.success) {
                notify('success', t('workspace.relativePathCopied'));
                logActivity('Copied tab relative path', relativePath);
                return;
            }
            notify('error', t('workspace.pathCopyFailed'));
        },
        [logActivity, mounts, notify, openTabs, t]
    );

    const revealTabInExplorer = useCallback(
        (tabId: string): void => {
            const tab = openTabs.find(item => item.id === tabId);
            if (!tab) {
                return;
            }
            const directoryPath = getDirectoryPath(tab.path);
            const encodedPath = encodeURIComponent(directoryPath);
            try {
                window.electron.openExternal(`safe-file://${encodedPath}`);
                notify('success', t('workspace.revealedInExplorer'));
                logActivity('Revealed file in explorer', tab.path);
                return;
            } catch (error) {
                window.electron.log.error('Reveal in explorer failed', error as Error);
            }
            notify('error', t('workspace.revealInExplorerFailed'));
        },
        [logActivity, notify, openTabs, t]
    );

    return {
        mounts,
        mountStatus,
        openTabs,
        activeTabId,
        setActiveEditorTabId,
        refreshSignal,
        setRefreshSignal,
        councilEnabled,
        setCouncilEnabled,
        openFile,
        saveActiveTab,
        closeTab,
        togglePinTab,
        closeAllTabs,
        closeTabsToRight,
        closeOtherTabs,
        copyTabAbsolutePath,
        copyTabRelativePath,
        revealTabInExplorer,
        ensureMountReady,
        persistMounts,
        setOpenTabs,
        activeTab,
        createFile,
        createFolder,
        renameEntry,
        deleteEntry,
        moveEntry,
        updateTabContent,
        dashboardTab,
        setDashboardTab,
        mountForm,
        setMountForm,
        addMount,
        pickLocalFolder,
        testConnection,
    };
}

