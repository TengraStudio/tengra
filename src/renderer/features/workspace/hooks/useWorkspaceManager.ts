import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    buildWorkspaceBulkRenamePlan,
    buildWorkspaceBulkTransferPlan,
    canUseSharedTargetDirectory,
} from '@/features/workspace/utils/workspace-bulk-actions';
import {
    EditorTab,
    ServiceResponse,
    Workspace,
    WorkspaceDashboardTab,
    WorkspaceEntry,
    WorkspaceMount,
} from '@/types';
import { appLogger } from '@/utils/renderer-logger';

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

interface SaveActiveTabOptions {
    silent?: boolean;
}

function normalizeEditorTabPath(filePath: string): string {
    const normalizedPath = normalizePath(filePath).replace(/\/+/g, '/');
    return /^[a-z]:/i.test(normalizedPath)
        ? normalizedPath.toLowerCase()
        : normalizedPath;
}

function buildEditorTabId(mountId: string, filePath: string): string {
    return `${mountId}:${normalizeEditorTabPath(filePath)}`;
}

function normalizeEditorTab(tab: EditorTab): EditorTab {
    return {
        ...tab,
        id: buildEditorTabId(tab.mountId, tab.path),
    };
}

function deduplicateEditorTabs(tabs: EditorTab[]): EditorTab[] {
    const nextTabsById = new Map<string, EditorTab>();
    for (const tab of tabs) {
        const normalizedTab = normalizeEditorTab(tab);
        nextTabsById.set(normalizedTab.id, normalizedTab);
    }
    return Array.from(nextTabsById.values());
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

function getPathSeparator(filePath: string): '/' | '\\' {
    return filePath.includes('\\') ? '\\' : '/';
}

interface WorkspaceEntryOperationResult {
    success: boolean;
    error?: string;
    mountType?: WorkspaceMount['type'];
}

// Helper hook for file operations
function useFileOperations(
    mounts: WorkspaceMount[],
    notify: (type: 'success' | 'error' | 'info', message: string) => void,
    logActivity: (title: string, detail?: string) => void,
    t: (key: string, options?: Record<string, string | number>) => string
) {
    const [refreshSignal, setRefreshSignal] = useState(0);
    const requestExplorerRefresh = useCallback((mountType: WorkspaceMount['type']) => {
        if (mountType === 'local') {
            return;
        }
        setRefreshSignal(signal => signal + 1);
    }, []);
    const requestExplorerRefreshForEntries = useCallback((entryMountTypes: WorkspaceMount['type'][]) => {
        if (entryMountTypes.some(mountType => mountType === 'ssh')) {
            setRefreshSignal(signal => signal + 1);
        }
    }, []);
    const resolveMountForEntry = useCallback(
        (entry: WorkspaceEntry): WorkspaceMount | undefined =>
            mounts.find(mount => mount.id === entry.mountId),
        [mounts]
    );
    const executeRenamePath = useCallback(
        async (mount: WorkspaceMount, sourcePath: string, targetPath: string) =>
            mount.type === 'local'
                ? window.electron.files.renamePath(sourcePath, targetPath)
                : window.electron.ssh.rename(mount.id, sourcePath, targetPath),
        []
    );
    const executeCopyPath = useCallback(
        async (mount: WorkspaceMount, sourcePath: string, targetPath: string) =>
            mount.type === 'local'
                ? window.electron.files.copyPath(sourcePath, targetPath)
                : window.electron.ssh.copyPath(mount.id, sourcePath, targetPath),
        []
    );
    const executeDeletePath = useCallback(
        async (mount: WorkspaceMount, entry: WorkspaceEntry) =>
            mount.type === 'local'
                ? entry.isDirectory
                    ? window.electron.files.deleteDirectory(entry.path)
                    : window.electron.files.deleteFile(entry.path)
                : entry.isDirectory
                    ? window.electron.ssh.deleteDir(mount.id, entry.path)
                    : window.electron.ssh.deleteFile(mount.id, entry.path),
        []
    );
    const runRenameEntry = useCallback(
        async (entry: WorkspaceEntry, newName: string): Promise<WorkspaceEntryOperationResult> => {
            const mount = resolveMountForEntry(entry);
            if (!mount) {
                return {
                    success: false,
                    error: t('workspace.errors.explorer.mountNotFound'),
                };
            }
            const parentPath = getDirectoryPath(entry.path);
            const separator = getPathSeparator(entry.path);
            const newPath = parentPath ? `${parentPath}${separator}${newName}` : newName;
            const result = await executeRenamePath(mount, entry.path, newPath);
            return {
                success: result.success,
                error: result.error,
                mountType: mount.type,
            };
        },
        [executeRenamePath, resolveMountForEntry, t]
    );
    const runDeleteEntry = useCallback(
        async (entry: WorkspaceEntry): Promise<WorkspaceEntryOperationResult> => {
            const mount = resolveMountForEntry(entry);
            if (!mount) {
                return {
                    success: false,
                    error: t('workspace.errors.explorer.mountNotFound'),
                };
            }
            const result = await executeDeletePath(mount, entry);
            return {
                success: result.success,
                error: result.error,
                mountType: mount.type,
            };
        },
        [executeDeletePath, resolveMountForEntry, t]
    );
    const runTransferEntry = useCallback(
        async (
            entry: WorkspaceEntry,
            targetPath: string,
            mode: 'copy' | 'move'
        ): Promise<WorkspaceEntryOperationResult> => {
            const mount = resolveMountForEntry(entry);
            if (!mount) {
                return {
                    success: false,
                    error: t('workspace.errors.explorer.mountNotFound'),
                };
            }

            if (entry.path === targetPath) {
                return {
                    success: true,
                    mountType: mount.type,
                };
            }

            const result = mode === 'move'
                ? await executeRenamePath(mount, entry.path, targetPath)
                : await executeCopyPath(mount, entry.path, targetPath);
            return {
                success: result.success,
                error: result.error,
                mountType: mount.type,
            };
        },
        [executeCopyPath, executeRenamePath, resolveMountForEntry, t]
    );

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
                requestExplorerRefresh(targetMount.type);
                logActivity('Created file', path);
                notify('success', t('workspace.notifications.fileCreated'));
            } else {
                notify('error', result.error ?? t('workspace.errors.fileOps.create'));
            }
        },
        [mounts, logActivity, notify, requestExplorerRefresh, t]
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
                requestExplorerRefresh(targetMount.type);
                logActivity('Created folder', path);
                notify('success', t('workspace.notifications.folderCreated'));
            } else {
                notify('error', result.error ?? t('workspace.errors.fileOps.create'));
            }
        },
        [mounts, logActivity, notify, requestExplorerRefresh, t]
    );

    const renameEntry = useCallback(
        async (entry: WorkspaceEntry, newName: string) => {
            const result = await runRenameEntry(entry, newName);
            if (result.success) {
                requestExplorerRefresh(result.mountType ?? 'local');
                logActivity('Renamed entry', `${entry.name} -> ${newName}`);
                notify('success', t('workspace.notifications.entryRenamed'));
            } else {
                notify('error', result.error ?? t('workspace.errors.fileOps.rename'));
            }
            return result;
        },
        [logActivity, notify, requestExplorerRefresh, runRenameEntry, t]
    );

    const deleteEntry = useCallback(
        async (entry: WorkspaceEntry) => {
            const result = await runDeleteEntry(entry);
            if (result.success) {
                requestExplorerRefresh(result.mountType ?? 'local');
                logActivity('Deleted entry', entry.path);
                notify('success', t('workspace.notifications.entryDeleted'));
            } else {
                notify('error', result.error ?? t('workspace.errors.fileOps.delete'));
            }
            return result;
        },
        [logActivity, notify, requestExplorerRefresh, runDeleteEntry, t]
    );

    const moveEntry = useCallback(
        async (entry: WorkspaceEntry, targetDirPath: string) => {
            const fileName = entry.path.split(/[\\/]/).pop() || '';
            const separator = getPathSeparator(entry.path);
            const normalizedTargetDirPath = targetDirPath.replace(/[\\/]+$/, '');
            const newPath = `${normalizedTargetDirPath}${separator}${fileName}`;
            const result = await runTransferEntry(entry, newPath, 'move');
            if (result.success) {
                requestExplorerRefresh(result.mountType ?? 'local');
                logActivity('Moved entry', `${entry.path} -> ${newPath}`);
                notify('success', t('workspace.notifications.entryMoved'));
            } else {
                notify('error', result.error ?? t('workspace.errors.fileOps.move'));
            }
            return result;
        },
        [logActivity, notify, requestExplorerRefresh, runTransferEntry, t]
    );
    const copyEntry = useCallback(
        async (entry: WorkspaceEntry, targetDirPath: string) => {
            const separator = getPathSeparator(entry.path);
            const fileName = entry.path.split(/[\\/]/).pop() || '';
            const normalizedTargetDirPath = targetDirPath.replace(/[\\/]+$/, '');
            const nextPath = `${normalizedTargetDirPath}${separator}${fileName}`;
            const result = await runTransferEntry(entry, nextPath, 'copy');
            if (result.success) {
                requestExplorerRefresh(result.mountType ?? 'local');
                logActivity('Copied entry', `${entry.path} -> ${nextPath}`);
                notify('success', t('common.copy'));
            } else {
                notify('error', result.error ?? t('workspace.errors.fileOps.copy'));
            }
            return result;
        },
        [logActivity, notify, requestExplorerRefresh, runTransferEntry, t]
    );
    const bulkRenameEntries = useCallback(
        async (entries: WorkspaceEntry[], baseName: string) => {
            const renamePlan = buildWorkspaceBulkRenamePlan(entries, baseName);
            let successCount = 0;
            const refreshedMountTypes: WorkspaceMount['type'][] = [];
            for (const item of renamePlan) {
                const result = await runRenameEntry(item.entry, item.newName);
                if (!result.success) {
                    notify('error', result.error ?? t('workspace.errors.fileOps.rename'));
                    continue;
                }
                successCount += 1;
                if (result.mountType) {
                    refreshedMountTypes.push(result.mountType);
                }
            }
            requestExplorerRefreshForEntries(refreshedMountTypes);
            if (successCount > 0) {
                logActivity('Bulk renamed entries', `${successCount}`);
                notify(
                    'success',
                    `${t('common.itemsSelected', { count: successCount })} ${t('workspace.notifications.entryRenamed')}`
                );
            }
            return successCount === entries.length;
        },
        [logActivity, notify, requestExplorerRefreshForEntries, runRenameEntry, t]
    );
    const bulkDeleteEntries = useCallback(
        async (entries: WorkspaceEntry[]) => {
            let successCount = 0;
            const refreshedMountTypes: WorkspaceMount['type'][] = [];
            for (const entry of entries) {
                const result = await runDeleteEntry(entry);
                if (!result.success) {
                    notify('error', result.error ?? t('workspace.errors.fileOps.delete'));
                    continue;
                }
                successCount += 1;
                if (result.mountType) {
                    refreshedMountTypes.push(result.mountType);
                }
            }
            requestExplorerRefreshForEntries(refreshedMountTypes);
            if (successCount > 0) {
                logActivity('Bulk deleted entries', `${successCount}`);
                notify(
                    'success',
                    `${t('common.itemsSelected', { count: successCount })} ${t('workspace.notifications.entryDeleted')}`
                );
            }
            return successCount === entries.length;
        },
        [logActivity, notify, requestExplorerRefreshForEntries, runDeleteEntry, t]
    );
    const bulkMoveEntries = useCallback(
        async (entries: WorkspaceEntry[], targetDirectoryPath: string) => {
            if (!canUseSharedTargetDirectory(entries)) {
                notify('error', t('workspace.errors.explorer.validationError'));
                return false;
            }
            const transferPlan = buildWorkspaceBulkTransferPlan(entries, targetDirectoryPath);
            let successCount = 0;
            const refreshedMountTypes: WorkspaceMount['type'][] = [];
            for (const item of transferPlan) {
                const result = await runTransferEntry(item.entry, item.targetPath, 'move');
                if (!result.success) {
                    notify('error', result.error ?? t('workspace.errors.fileOps.move'));
                    continue;
                }
                successCount += 1;
                if (result.mountType) {
                    refreshedMountTypes.push(result.mountType);
                }
            }
            requestExplorerRefreshForEntries(refreshedMountTypes);
            if (successCount > 0) {
                logActivity('Bulk moved entries', `${successCount}`);
                notify(
                    'success',
                    `${t('common.itemsSelected', { count: successCount })} ${t('workspace.notifications.entryMoved')}`
                );
            }
            return successCount === entries.length;
        },
        [logActivity, notify, requestExplorerRefreshForEntries, runTransferEntry, t]
    );
    const bulkCopyEntries = useCallback(
        async (entries: WorkspaceEntry[], targetDirectoryPath: string) => {
            if (!canUseSharedTargetDirectory(entries)) {
                notify('error', t('workspace.errors.explorer.validationError'));
                return false;
            }
            const transferPlan = buildWorkspaceBulkTransferPlan(entries, targetDirectoryPath);
            let successCount = 0;
            const refreshedMountTypes: WorkspaceMount['type'][] = [];
            for (const item of transferPlan) {
                const result = await runTransferEntry(item.entry, item.targetPath, 'copy');
                if (!result.success) {
                    notify('error', result.error ?? t('workspace.errors.fileOps.copy'));
                    continue;
                }
                successCount += 1;
                if (result.mountType) {
                    refreshedMountTypes.push(result.mountType);
                }
            }
            requestExplorerRefreshForEntries(refreshedMountTypes);
            if (successCount > 0) {
                logActivity('Bulk copied entries', `${successCount}`);
                notify(
                    'success',
                    `${t('common.itemsSelected', { count: successCount })} ${t('common.copy')}`
                );
            }
            return successCount === entries.length;
        },
        [logActivity, notify, requestExplorerRefreshForEntries, runTransferEntry, t]
    );

    return {
        createFile,
        createFolder,
        renameEntry,
        deleteEntry,
        moveEntry,
        copyEntry,
        bulkRenameEntries,
        bulkDeleteEntries,
        bulkMoveEntries,
        bulkCopyEntries,
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

function normalizePersistedActiveTabId(activeTabId: string | null): string | null {
    if (!activeTabId) {
        return null;
    }
    const separatorIndex = activeTabId.indexOf(':');
    if (separatorIndex <= 0) {
        return null;
    }
    return buildEditorTabId(
        activeTabId.slice(0, separatorIndex),
        activeTabId.slice(separatorIndex + 1)
    );
}

const getWorkspaceTabsStorageKey = (workspaceId: string): string =>
    `workspace.tabs.state.v1:${workspaceId}`;

const loadPersistedTabsState = (workspaceId: string): PersistedTabsState => {
    try {
        const raw = localStorage.getItem(getWorkspaceTabsStorageKey(workspaceId));
        if (!raw) {
            return { openTabs: [], activeTabId: null };
        }
        const parsed = JSON.parse(raw) as PersistedTabsState & {
            recentFiles?: Array<{
                id: string;
                mountId: string;
                path: string;
            }>;
        };
        const openTabs = Array.isArray(parsed.openTabs)
            ? deduplicateEditorTabs(parsed.openTabs)
            : [];
        const activeTabId = typeof parsed.activeTabId === 'string'
            ? parsed.activeTabId
            : null;
        const normalizedActiveTabId = normalizePersistedActiveTabId(activeTabId);
        const hasNormalizedActiveTab = normalizedActiveTabId
            ? openTabs.some(tab => tab.id === normalizedActiveTabId)
            : false;

        return {
            openTabs,
            activeTabId: hasNormalizedActiveTab ? normalizedActiveTabId : null,
        };
    } catch {
        return { openTabs: [], activeTabId: null };
    }
};

function useTabManagement(workspaceId: string) {
    const persistedTabsState = useMemo(() => loadPersistedTabsState(workspaceId), [workspaceId]);
    const [openTabs, setOpenTabsState] = useState<EditorTab[]>(persistedTabsState.openTabs);
    const [activeTabId, setActiveEditorTabIdState] = useState<string | null>(persistedTabsState.activeTabId);
    const [dashboardTab, setDashboardTab] = useState<WorkspaceDashboardTab>(
        persistedTabsState.activeTabId ? 'editor' : 'overview'
    );
    const setOpenTabs = useCallback(
        (value: EditorTab[] | ((prev: EditorTab[]) => EditorTab[])) => {
            setOpenTabsState(previousTabs => {
                const nextTabs =
                    typeof value === 'function'
                        ? value(previousTabs)
                        : value;
                return deduplicateEditorTabs(nextTabs);
            });
        },
        []
    );

    const activeTab = useMemo(
        () => openTabs.find(t => t.id === activeTabId) ?? null,
        [openTabs, activeTabId]
    );

    const setActiveEditorTabId = useCallback((tabId: string | null) => {
        setActiveEditorTabIdState(tabId);
    }, []);

    const applyTabUpdate = useCallback(
        (nextTabs: EditorTab[], preferredActiveTabId?: string | null) => {
            const normalizedTabs = deduplicateEditorTabs(nextTabs);
            setOpenTabs(normalizedTabs);
            const currentTabStillOpen = Boolean(
                activeTabId && normalizedTabs.some(tab => tab.id === activeTabId)
            );
            const preferredTabStillOpen = Boolean(
                preferredActiveTabId &&
                    normalizedTabs.some(tab => tab.id === preferredActiveTabId)
            );

            const nextActiveTabId = preferredTabStillOpen
                ? (preferredActiveTabId ?? null)
                : currentTabStillOpen
                    ? activeTabId
                    : findFallbackTabId(normalizedTabs);

            setActiveEditorTabIdState(nextActiveTabId);
            if (!nextActiveTabId) {
                setDashboardTab('overview');
            }
        },
        [activeTabId, setOpenTabs]
    );

    const closeTab = useCallback(
        (tabId: string) => {
            const tab = openTabs.find(t => t.id === tabId);
            if (tab && tab.content !== tab.savedContent) {
                appLogger.warn('useWorkspaceManager', 'Unsaved tab close blocked. Save before closing.');
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
    }, [setOpenTabs]);

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
        [activeTabId, setOpenTabs]
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
        copyEntry,
        bulkRenameEntries,
        bulkDeleteEntries,
        bulkMoveEntries,
        bulkCopyEntries,
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

            const normalizedEntryPath = normalizeEditorTabPath(entry.path);
            const tabId = buildEditorTabId(entry.mountId, entry.path);
            const existing = openTabs.find(
                tab =>
                    tab.mountId === entry.mountId &&
                    normalizeEditorTabPath(tab.path) === normalizedEntryPath
            );
            if (existing) {
                if (entry.initialLine !== undefined) {
                    setOpenTabs(prev =>
                        prev.map(t =>
                            t.id === existing.id ? { ...t, initialLine: entry.initialLine } : t
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
            setOpenTabs(prev => {
                const existingTab = prev.find(
                    item =>
                        item.mountId === entry.mountId &&
                        normalizeEditorTabPath(item.path) === normalizedEntryPath
                );
                if (!existingTab) {
                    return [...prev, tab];
                }
                if (entry.initialLine === undefined) {
                    return prev;
                }
                return prev.map(item =>
                    item.id === existingTab.id
                        ? { ...item, initialLine: entry.initialLine }
                        : item
                );
            });
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

    const saveActiveTab = useCallback(async (options?: SaveActiveTabOptions) => {
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
        if (!options?.silent) {
            notify('success', t('workspace.notifications.fileSaved'));
        }
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
                appLogger.error('useWorkspaceManager', 'Reveal in explorer failed', error as Error);
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
        copyEntry,
        bulkRenameEntries,
        bulkDeleteEntries,
        bulkMoveEntries,
        bulkCopyEntries,
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

