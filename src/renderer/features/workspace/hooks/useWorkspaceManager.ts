import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    EditorTab,
    ServiceResponse,
    Workspace,
    WorkspaceDashboardTab,
    WorkspaceEntry,
    WorkspaceMount,
} from '@/types';

import { useMountManagement } from './useMountManagement';

interface UseWorkspaceManagerProps {
    workspace: Workspace;
    notify: (type: 'success' | 'error' | 'info', message: string) => void;
    logActivity: (title: string, detail?: string) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}

interface FileOpenEntry {
    mountId: string;
    path: string;
    name: string;
    isDirectory: boolean;
    initialLine?: number;
}

function buildWorkspaceMounts(workspace: Workspace): WorkspaceMount[] {
    if (Array.isArray(workspace.mounts) && workspace.mounts.length > 0) {
        return workspace.mounts;
    }
    return workspace.path
        ? [{ id: `local-${workspace.id}`, name: 'Local', type: 'local', rootPath: workspace.path }]
        : [];
}

function areMountListsEqual(left: WorkspaceMount[], right: WorkspaceMount[]): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

// Helper hook for mount state initialization and sync
function useMountState(workspace: Workspace): [WorkspaceMount[], (mounts: WorkspaceMount[]) => void] {
    const [mounts, setMounts] = useState<WorkspaceMount[]>(() => buildWorkspaceMounts(workspace));
    return [
        mounts,
        nextMounts => {
            setMounts(currentMounts =>
                areMountListsEqual(currentMounts, nextMounts) ? currentMounts : nextMounts
            );
        },
    ];
}

// Helper hook for SSH operations
function useSSHOperations(
    notify: (type: 'success' | 'error' | 'info', message: string) => void,
    t: (key: string, options?: Record<string, string | number>) => string
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
                        notify('info', t('workspace.notifications.sshConnectedAfterAttempts', { count: attempt }));
                    }
                    return true;
                }

                const diagnosticHint = result.diagnostics?.hint;
                lastError = diagnosticHint
                    ? `${result.error ?? t('errors.unexpected')} ${diagnosticHint}`
                    : result.error ?? t('errors.unexpected');
                if (attempt < MAX_CONNECT_RETRIES) {
                    notify('info', t('workspace.notifications.sshConnectRetry', {
                        attempt,
                        max: MAX_CONNECT_RETRIES - 1
                    }));
                    await waitFor(backoffMs);
                    backoffMs *= 2;
                }
            }
            notify('error', lastError);
            return false;
        },
        [notify, t, validateSSHMount, waitFor]
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
    notify: (type: 'success' | 'error' | 'info', message: string) => void,
    t: (key: string, options?: Record<string, string | number>) => string
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
    notify('info', t('workspace.notifications.sshImagePreviewNotSupported'));
    return { content: '', type: 'code', result: undefined };
}

// Handle code file reading
async function readCodeFile(
    mount: WorkspaceMount,
    filePath: string
): Promise<{ content: string; type: 'code' | 'image'; result: ServiceResponse<string> }> {
    const result =
        mount.type === 'local'
            ? await window.electron.files.readFile(filePath)
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
    notify: (type: 'success' | 'error' | 'info', message: string) => void,
    t: (key: string, options?: Record<string, string | number>) => string
): Promise<{
    content: string;
    type: 'code' | 'image';
    result: ServiceResponse<string> | undefined;
}> {
    if (isImageFile(filePath)) {
        return readImageFile(mount, filePath, notify, t);
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
    logActivity: (title: string, detail?: string) => void,
    t: (key: string, options?: Record<string, string | number>) => string
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
                    ? await window.electron.files.writeFile(path, '')
                    : await window.electron.ssh.writeFile(targetMount.id, path, '');
            if (result.success) {
                setRefreshSignal(s => s + 1);
                logActivity('Created file', path);
                notify('success', t('workspace.notifications.fileCreated'));
            } else {
                notify('error', result.error ?? t('workspace.errors.fileOps.create'));
            }
        },
        [mounts, logActivity, notify, t]
    );

    const createFolder = useCallback(
        async (path: string, mount?: WorkspaceMount) => {
            const targetMount = mount ?? (mounts.length > 0 ? mounts[0] : undefined);
            if (!targetMount) {
                return;
            }
            const result =
                targetMount.type === 'local'
                    ? await window.electron.files.createDirectory(path)
                    : await window.electron.ssh.mkdir(targetMount.id, path);
            if (result.success) {
                setRefreshSignal(s => s + 1);
                logActivity('Created folder', path);
                notify('success', t('workspace.notifications.folderCreated'));
            } else {
                notify('error', result.error ?? t('workspace.errors.fileOps.create'));
            }
        },
        [mounts, logActivity, notify, t]
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
                    ? await window.electron.files.renamePath(entry.path, newPath)
                    : await window.electron.ssh.rename(mount.id, entry.path, newPath);
            if (result.success) {
                setRefreshSignal(s => s + 1);
                logActivity('Renamed entry', `${entry.name} -> ${newName}`);
                notify('success', t('workspace.notifications.entryRenamed'));
            } else {
                notify('error', result.error ?? t('workspace.errors.fileOps.rename'));
            }
        },
        [mounts, logActivity, notify, t]
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
                        ? await window.electron.files.deleteDirectory(entry.path)
                        : await window.electron.files.deleteFile(entry.path)
                    : entry.isDirectory
                        ? await window.electron.ssh.deleteDir(mount.id, entry.path)
                        : await window.electron.ssh.deleteFile(mount.id, entry.path);
            if (result.success) {
                setRefreshSignal(s => s + 1);
                logActivity('Deleted entry', entry.path);
                notify('success', t('workspace.notifications.entryDeleted'));
            } else {
                notify('error', result.error ?? t('workspace.errors.fileOps.delete'));
            }
        },
        [mounts, logActivity, notify, t]
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
                    ? await window.electron.files.renamePath(entry.path, newPath)
                    : await window.electron.ssh.rename(mount.id, entry.path, newPath);

            if (result.success) {
                setRefreshSignal(s => s + 1);
                logActivity('Moved entry', `${entry.path} -> ${newPath}`);
                notify('success', t('workspace.notifications.entryMoved'));
            } else {
                notify('error', result.error ?? t('workspace.errors.fileOps.move'));
            }
        },
        [mounts, logActivity, notify, t]
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

const getWorkspaceTabsStorageKey = (workspaceId: string): string =>
    `workspace.tabs.state.v1:${workspaceId}`;

const loadPersistedTabsState = (workspaceId: string): PersistedTabsState => {
    try {
        const raw = localStorage.getItem(getWorkspaceTabsStorageKey(workspaceId));
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

function useTabManagement(workspaceId: string) {
    const persistedTabsState = useMemo(() => loadPersistedTabsState(workspaceId), [workspaceId]);
    const [openTabs, setOpenTabs] = useState<EditorTab[]>(persistedTabsState.openTabs);
    const [activeTabId, setActiveEditorTabId] = useState<string | null>(persistedTabsState.activeTabId);
    const [dashboardTab, setDashboardTab] = useState<WorkspaceDashboardTab>(
        persistedTabsState.activeTabId ? 'editor' : 'overview'
    );

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
            getWorkspaceTabsStorageKey(workspaceId),
            JSON.stringify({
                openTabs,
                activeTabId,
            } satisfies PersistedTabsState)
        );
    }, [activeTabId, openTabs, workspaceId]);

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
export function useWorkspaceManager({ workspace, notify, logActivity, t }: UseWorkspaceManagerProps) {
    const [mounts, setMounts] = useMountState(workspace);
    const { ensureMountReady } = useSSHOperations(notify, t);
    const {
        createFile,
        createFolder,
        renameEntry,
        deleteEntry,
        moveEntry,
        refreshSignal,
        setRefreshSignal,
    } = useFileOperations(mounts, notify, logActivity, t);
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
    } = useTabManagement(workspace.id);
    const [councilEnabled, setCouncilEnabled] = useState(Boolean(workspace.councilConfig.enabled));
    const {
        persistMounts,
        mountForm,
        setMountForm,
        addMount,
        testConnection,
        pickLocalFolder,
    } = useMountManagement({
        workspaceId: workspace.id,
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

            const { content, type, result } = await readFileContent(mount, entry.path, notify, t);

            if (!result?.success) {
                notify('error', result?.error ?? t('workspace.errors.fileOps.read'));
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
            t,
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
                ? await window.electron.files.writeFile(activeTabData.path, activeTabData.content)
                : await window.electron.ssh.writeFile(
                    mount.id,
                    activeTabData.path,
                    activeTabData.content
                );

        if (!result.success) {
            notify('error', result.error ?? t('workspace.notifications.saveFailed'));
            return;
        }
        setOpenTabs(prev =>
            prev.map(t => (t.id === activeTabData.id ? { ...t, savedContent: t.content } : t))
        );
        logActivity('Saved file', activeTabData.path);
        notify('success', t('workspace.notifications.fileSaved'));
    }, [activeTabId, openTabs, mounts, ensureMountReady, notify, logActivity, setOpenTabs, t]);

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

