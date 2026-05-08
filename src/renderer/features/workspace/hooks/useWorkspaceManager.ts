/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
    logActivity: (title: string, detail?: string) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}

interface FileOpenEntry {
    mountId: string;
    path: string;
    name: string;
    isDirectory: boolean;
    initialLine?: number;
    readOnly?: boolean;
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

function sanitizeWorkspaceMounts(mounts: WorkspaceMount[] | undefined): WorkspaceMount[] {
    if (!Array.isArray(mounts)) {
        return [];
    }

    return mounts.filter(mount => typeof mount.rootPath === 'string' && mount.rootPath.trim().length > 0);
}

function buildWorkspaceMounts(workspace: Workspace): WorkspaceMount[] {
    const sanitizedMounts = sanitizeWorkspaceMounts(workspace.mounts);
    if (sanitizedMounts.length > 0) {
        return sanitizedMounts;
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

    useEffect(() => {
        const nextMounts = buildWorkspaceMounts(workspace);
        setMounts(currentMounts =>
            areMountListsEqual(currentMounts, nextMounts) ? currentMounts : nextMounts
        );
    }, [workspace]);

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
                return false;
            }
            if (!mount.ssh.host || !mount.ssh.username) {
                return false;
            }
            return true;
        },
        []
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
                    appLogger.debug(`SSH connection established for mount: `, mount.id);
                    return true;
                }

                if (attempt < MAX_CONNECT_RETRIES) {
                    await waitFor(backoffMs);
                    backoffMs *= 2;
                }
            }
            return false;
        },
        [validateSSHMount, waitFor]
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
    filePath: string
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
        // Only fallback to image reading if it actually looks like an image extension
        if (isImageFile(filePath)) {
            const imgResult = await window.electron.files.readImage(filePath);
            if (imgResult.success) {
                return {
                    content: extractContentFromResult(imgResult),
                    type: 'image',
                    result: imgResult,
                };
            }
        }
    }

    return { content, type: 'code', result };
}

// Helper for reading file content based on mount type
async function readFileContent(
    mount: WorkspaceMount,
    filePath: string
): Promise<{
    content: string;
    type: 'code' | 'image';
    result: ServiceResponse<string> | undefined;
}> {
    if (isImageFile(filePath)) {
        return readImageFile(mount, filePath);
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
    logActivity: (title: string, detail?: string) => void,
    t: (key: string, options?: Record<string, string | number>) => string
) {
    const [refreshSignal, setRefreshSignal] = useState(0);
    const requestExplorerRefresh = useCallback((mountType: WorkspaceMount['type']) => {
        void mountType;
        setRefreshSignal(signal => signal + 1);
    }, []);
    const requestExplorerRefreshForEntries = useCallback((entryMountTypes: WorkspaceMount['type'][]) => {
        if (entryMountTypes.length === 0) {
            return;
        }
        setRefreshSignal(signal => signal + 1);
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
                    error: t('frontend.workspace.errors.explorer.mountNotFound'),
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
                    error: t('frontend.workspace.errors.explorer.mountNotFound'),
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
                    error: t('frontend.workspace.errors.explorer.mountNotFound'),
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
            } else {
                appLogger.error('Failed to create file', result.error || 'Unknown error');
            }
        },
        [mounts, logActivity, requestExplorerRefresh]
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
            } else {
                appLogger.error('Failed to create folder', result.error || 'Unknown error');
            }
        },
        [mounts, logActivity, requestExplorerRefresh]
    );

    const renameEntry = useCallback(
        async (entry: WorkspaceEntry, newName: string) => {
            const result = await runRenameEntry(entry, newName);
            if (result.success) {
                requestExplorerRefresh(result.mountType ?? 'local');
                logActivity('Renamed entry', `${entry.name} -> ${newName}`);
            } else {
                appLogger.error('Failed to rename entry', result.error || 'Unknown error');
            }
            return result;
        },
        [logActivity, requestExplorerRefresh, runRenameEntry]
    );

    const deleteEntry = useCallback(
        async (entry: WorkspaceEntry) => {
            const result = await runDeleteEntry(entry);
            if (result.success) {
                requestExplorerRefresh(result.mountType ?? 'local');
                logActivity('Deleted entry', entry.path);
            } else {
                appLogger.error('Failed to delete entry', result.error || 'Unknown error');
            }
            return result;
        },
        [logActivity, requestExplorerRefresh, runDeleteEntry]
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
            } else {
                appLogger.error('Failed to move entry', result.error || 'Unknown error');
            }
            return result;
        },
        [logActivity, requestExplorerRefresh, runTransferEntry]
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
            } else {
                appLogger.error('Failed to copy entry', result.error || 'Unknown error');
            }
            return result;
        },
        [logActivity, requestExplorerRefresh, runTransferEntry]
    );
    const bulkRenameEntries = useCallback(
        async (entries: WorkspaceEntry[], baseName: string) => {
            const renamePlan = buildWorkspaceBulkRenamePlan(entries, baseName);
            let successCount = 0;
            const refreshedMountTypes: WorkspaceMount['type'][] = [];
            for (const item of renamePlan) {
                const result = await runRenameEntry(item.entry, item.newName);
                if (!result.success) {
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
            }
            return successCount === entries.length;
        },
        [logActivity, requestExplorerRefreshForEntries, runRenameEntry]
    );
    const bulkDeleteEntries = useCallback(
        async (entries: WorkspaceEntry[]) => {
            let successCount = 0;
            const refreshedMountTypes: WorkspaceMount['type'][] = [];
            for (const entry of entries) {
                const result = await runDeleteEntry(entry);
                if (!result.success) {
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

            }
            return successCount === entries.length;
        },
        [logActivity, requestExplorerRefreshForEntries, runDeleteEntry]
    );
    const bulkMoveEntries = useCallback(
        async (entries: WorkspaceEntry[], targetDirectoryPath: string) => {
            if (!canUseSharedTargetDirectory(entries)) {
                return false;
            }
            const transferPlan = buildWorkspaceBulkTransferPlan(entries, targetDirectoryPath);
            let successCount = 0;
            const refreshedMountTypes: WorkspaceMount['type'][] = [];
            for (const item of transferPlan) {
                const result = await runTransferEntry(item.entry, item.targetPath, 'move');
                if (!result.success) {
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
            }
            return successCount === entries.length;
        },
        [logActivity, requestExplorerRefreshForEntries, runTransferEntry]
    );
    const bulkCopyEntries = useCallback(
        async (entries: WorkspaceEntry[], targetDirectoryPath: string) => {
            if (!canUseSharedTargetDirectory(entries)) {
                return false;
            }
            const transferPlan = buildWorkspaceBulkTransferPlan(entries, targetDirectoryPath);
            let successCount = 0;
            const refreshedMountTypes: WorkspaceMount['type'][] = [];
            for (const item of transferPlan) {
                const result = await runTransferEntry(item.entry, item.targetPath, 'copy');
                if (!result.success) {
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
            }
            return successCount === entries.length;
        },
        [logActivity, requestExplorerRefreshForEntries, runTransferEntry]
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
    const [openTabs, setOpenTabs] = useState<EditorTab[]>(() => {
        const persisted = loadPersistedTabsState(workspaceId);
        return persisted.openTabs;
    });
    const [activeTabId, setActiveEditorTabId] = useState<string | null>(() => {
        const persisted = loadPersistedTabsState(workspaceId);
        return persisted.activeTabId;
    });

    // Reset tabs when workspaceId changes to prevent leakage between workspaces
    useEffect(() => {
        const persisted = loadPersistedTabsState(workspaceId);
        setOpenTabs(persisted.openTabs);
        setActiveEditorTabId(persisted.activeTabId);
    }, [workspaceId]);

    const [dashboardTab, setDashboardTab] = useState<WorkspaceDashboardTab>(
        activeTabId ? 'editor' : 'overview'
    );

    const activeTab = useMemo(
        () => openTabs.find(t => t.id === activeTabId) ?? null,
        [openTabs, activeTabId]
    );

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

            setActiveEditorTabId(nextActiveTabId);
            if (!nextActiveTabId) {
                setDashboardTab('overview');
            }
        },
        [activeTabId, setOpenTabs]
    );

    const closeTab = useCallback(
        (tabId: string) => {
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

    const revertTab = useCallback(
        (tabId: string) => {
            setOpenTabs(prev =>
                prev.map(t => (t.id === tabId ? { ...t, content: t.savedContent } : t))
            );
        },
        [setOpenTabs]
    );

    const updateTabContent = useCallback(
        (tabId: string, content: string) => {
            setOpenTabs(prev => prev.map(t => (t.id === tabId ? { ...t, content } : t)));
        },
        [setOpenTabs]
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
        revertTab,
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
export function useWorkspaceManager({ workspace, logActivity, t }: UseWorkspaceManagerProps) {
    const [mounts, setMounts] = useMountState(workspace);
    const { ensureMountReady } = useSSHOperations();
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
    } = useFileOperations(mounts, logActivity, t);
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
        revertTab,
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

            const { content, type, result } = await readFileContent(mount, entry.path);

            if (!result?.success) {
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
                readOnly: entry.readOnly,
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
            setOpenTabs,
            setActiveEditorTabId,
            setDashboardTab,
        ]
    );

    const openDiff = useCallback(
        async (diffId: string) => {
            const result = await window.electron.files.getFileDiff(diffId);
            if (!result.success || !result.data) {
                appLogger.error('useWorkspaceManager', 'Failed to load diff', diffId);
                return;
            }

            const diff = result.data;
            const tabId = `diff:${diffId}`;
            const existing = openTabs.find(tab => tab.id === tabId);

            if (existing) {
                setActiveEditorTabId(tabId);
                setDashboardTab('editor');
                return;
            }

            const fileName = diff.filePath.split(/[\\/]/).pop() ?? 'file';
            const mountId = mounts[0]?.id || `local-${workspace.id}`;

            const tab: EditorTab = {
                id: tabId,
                mountId,
                path: diff.filePath,
                name: `${fileName} (Diff)`,
                content: diff.afterContent,
                originalContent: diff.beforeContent,
                savedContent: diff.afterContent,
                type: 'diff',
                isDirty: false,
                isPinned: false,
                readOnly: true,
                diffId: diffId,
            };

            setOpenTabs(prev => [...prev, tab]);
            setActiveEditorTabId(tabId);
            setDashboardTab('editor');
        },
        [mounts, workspace.id, openTabs, setActiveEditorTabId, setDashboardTab, setOpenTabs]
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
            return;
        }
        setOpenTabs(prev =>
            prev.map(t => (t.id === activeTabData.id ? { ...t, savedContent: t.content } : t))
        );
        window.dispatchEvent(new CustomEvent('tengra:file-saved', { 
            detail: { filePath: activeTabData.path, workspaceId: workspace.id } 
        }));
        logActivity('Saved file', activeTabData.path);
        if (!options?.silent) {
            appLogger.info('useWorkspaceManager', 'File saved successfully', activeTabData.path);
        }
    }, [activeTabId, openTabs, mounts, ensureMountReady, logActivity, setOpenTabs, workspace.id]);

    const copyTabAbsolutePath = useCallback(
        async (tabId: string) => {
            const tab = openTabs.find(item => item.id === tabId);
            if (!tab) {
                return;
            }
            const result = await window.electron.clipboard.writeText(tab.path);
            if (result.success) {
                logActivity('Copied tab path', tab.path);
                return;
            }
        },
        [logActivity, openTabs]
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
                logActivity('Copied tab relative path', relativePath);
                return;
            }
        },
        [logActivity, mounts, openTabs]
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
                logActivity('Revealed file in explorer', tab.path);
                return;
            } catch (error) {
                appLogger.error('useWorkspaceManager', 'Reveal in explorer failed', error as Error);
            }
        },
        [logActivity, openTabs]
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
        openDiff,
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
        revertTab,
        dashboardTab,
        setDashboardTab,
        mountForm,
        setMountForm,
        addMount,
        pickLocalFolder,
        testConnection,
    };
}

