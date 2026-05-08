/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { FILES_CHANNELS } from '@shared/constants/ipc-channels';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWorkspaceExplorerWatchers } from '@/features/workspace/hooks/useWorkspaceExplorerWatchers';
import { applyGitTreeStatus } from '@/features/workspace/utils/gitTreeStatus';
import type { WorkspaceExplorerDiagnosticCounts } from '@/features/workspace/utils/workspace-explorer-diagnostics';
import {
    joinPath,
    loadExpandedMountState,
    loadExpandedTreeState,
    saveExpandedMountState,
    saveExpandedTreeState,
    sortNodes,
} from '@/features/workspace/utils/workspaceUtils';
import { WorkspaceEntry, WorkspaceMount } from '@/types';
import { performanceMonitor } from '@/utils/performance';
import { appLogger } from '@/utils/renderer-logger';

import { ContextMenuAction, ContextMenuState, MountFileEntry } from '../workspace-explorer/types';
import { FileNode } from '../workspace-explorer/WorkspaceTreeItem';

interface ExplorerNodeRecord {
    key: string;
    mountId: string;
    parentKey: string | null;
    node: FileNode;
    childKeys: string[];
    loaded: boolean;
    loading: boolean;
}

export interface WorkspaceMountRow {
    type: 'mount';
    key: string;
    mount: WorkspaceMount;
    expanded: boolean;
    loading: boolean;
    diagnostics?: WorkspaceExplorerDiagnosticCounts;
}

export interface WorkspaceEntryRow {
    type: 'entry';
    key: string;
    mount: WorkspaceMount;
    entry: WorkspaceEntry;
    depth: number;
    expanded: boolean;
    loading: boolean;
    gitStatus?: FileNode['gitStatus'];
    gitRawStatus?: string;
    diagnostics?: WorkspaceExplorerDiagnosticCounts;
}

export type WorkspaceExplorerRow = WorkspaceMountRow | WorkspaceEntryRow;

interface UseWorkspaceExplorerTreeArgs {
    workspaceId: string;
    mounts: WorkspaceMount[];
    refreshSignal: number;
    onEnsureMount?: (mount: WorkspaceMount) => Promise<boolean> | boolean;
    onContextAction?: (action: ContextMenuAction) => void;
    storageKey: string;
}

function buildNodeKey(mountId: string, path: string): string {
    return `${mountId}:${path}`;
}

function normalizePath(value: string): string {
    return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function trimLeadingSeparators(value: string): string {
    return value.replace(/^[\\/]+/, '');
}

function shouldShowMountHeader(mounts: WorkspaceMount[], mount: WorkspaceMount): boolean {
    return mounts.length > 1 || mount.type !== 'local';
}

function shouldMountBeOpen(
    mounts: WorkspaceMount[],
    mount: WorkspaceMount,
    expandedMounts: Record<string, boolean>
): boolean {
    if (!shouldShowMountHeader(mounts, mount)) {
        return true;
    }
    return Boolean(expandedMounts[mount.id]);
}

function extractFileList(result: unknown): MountFileEntry[] {
    if (Array.isArray(result)) {
        return result.filter((item): item is MountFileEntry =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as { name?: unknown }).name === 'string'
        );
    }

    if (!result || typeof result !== 'object') {
        return [];
    }

    const candidate = result as {
        files?: unknown;
        data?: unknown;
        result?: unknown;
        content?: unknown;
    };

    const directCollections = [candidate.files, candidate.data, candidate.result, candidate.content];
    for (const value of directCollections) {
        const fileList = extractFileList(value);
        if (fileList.length > 0) {
            return fileList;
        }
    }

    return [];
}

function mapFileEntries(
    fileList: MountFileEntry[],
    nodePath: string,
    mountType: WorkspaceMount['type'],
    mountId: string
): FileNode[] {
    return fileList.map(item => ({
        mountId,
        name: item.name,
        isDirectory: Boolean(item.isDirectory),
        path: joinPath(nodePath, item.name, mountType),
    }));
}

async function listLocalDirectory(path: string): Promise<DirectoryListingResult> {
    return await window.electron.invoke<DirectoryListingResult>(FILES_CHANNELS.LIST_DIRECTORY, path);
}

function makeWorkspaceEntry(mountId: string, node: FileNode): WorkspaceEntry {
    return {
        mountId,
        name: node.name,
        path: node.path,
        isDirectory: node.isDirectory,
        isGitIgnored: node.isGitIgnored,
    };
}

function buildMountRootSnapshot(
    mount: WorkspaceMount,
    nodes: FileNode[]
): {
    childKeys: string[];
    nextRecords: Record<string, ExplorerNodeRecord>;
} {
    const childKeys = nodes.map(node => buildNodeKey(mount.id, node.path));
    const nextRecords = Object.fromEntries(
        nodes.map(node => {
            const key = buildNodeKey(mount.id, node.path);
            return [key, {
                key,
                mountId: mount.id,
                parentKey: null,
                node,
                childKeys: [],
                loaded: false,
                loading: false,
            } satisfies ExplorerNodeRecord];
        })
    );

    return { childKeys, nextRecords };
}

function pruneTreeState(
    treeState: Record<string, boolean>,
    mounts: WorkspaceMount[]
): Record<string, boolean> {
    const mountIds = new Set(mounts.map(mount => mount.id));
    return Object.fromEntries(
        Object.entries(treeState).filter(([nodeKey]) => {
            const mountId = nodeKey.split(':', 1)[0] ?? '';
            return mountIds.has(mountId);
        })
    );
}

function pruneMountState(
    mountState: Record<string, boolean>,
    mounts: WorkspaceMount[]
): Record<string, boolean> {
    const mountIds = new Set(mounts.map(mount => mount.id));
    return Object.fromEntries(
        Object.entries(mountState).filter(([mountId]) => mountIds.has(mountId))
    );
}

function areBooleanMapsEqual(
    left: Record<string, boolean>,
    right: Record<string, boolean>
): boolean {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
        return false;
    }

    for (const key of leftKeys) {
        if (left[key] !== right[key]) {
            return false;
        }
    }

    return true;
}

function syncPrunedMountState(
    mounts: WorkspaceMount[],
    storageKey: string,
    setState: Dispatch<SetStateAction<Record<string, boolean>>>
): void {
    setState(prev => {
        const prunedPrev = pruneTreeState(prev, mounts);
        const persistedState = loadExpandedMountState(storageKey);
        const nextState = { ...prunedPrev, ...persistedState };
        return areBooleanMapsEqual(prev, nextState) ? prev : nextState;
    });
}

function syncPrunedTreeState(
    mounts: WorkspaceMount[],
    setState: Dispatch<SetStateAction<Record<string, boolean>>>
): void {
    setState(prev => {
        const nextState = pruneTreeState(prev, mounts);
        return areBooleanMapsEqual(prev, nextState) ? prev : nextState;
    });
}

function syncPrunedLoadedState(
    mounts: WorkspaceMount[],
    setState: Dispatch<SetStateAction<Record<string, boolean>>>
): void {
    setState(prev => {
        const nextState = pruneMountState(prev, mounts);
        return areBooleanMapsEqual(prev, nextState) ? prev : nextState;
    });
}

function loadVisibleMountDirectories(
    mounts: WorkspaceMount[],
    expandedMounts: Record<string, boolean>,
    loadedMounts: Record<string, boolean>,
    rootNodeKeys: Record<string, string[]>,
    loadDirectory: (
        mount: WorkspaceMount,
        directoryPath: string,
        parentKey: string | null,
        updateLoadState?: boolean
    ) => Promise<void>
): void {
    for (const mount of mounts) {
        if (!shouldMountBeOpen(mounts, mount, expandedMounts)) {
            continue;
        }
        const mountRootKeys = rootNodeKeys[mount.id] ?? [];
        if (loadedMounts[mount.id] && mountRootKeys.length > 0) {
            continue;
        }
        void loadDirectory(mount, mount.rootPath, null, loadedMounts[mount.id] === true);
    }
}

function recoverBlankMountRootsIfNeeded(
    mounts: WorkspaceMount[],
    expandedMounts: Record<string, boolean>,
    loadingMounts: Record<string, boolean>,
    rootNodeKeys: Record<string, string[]>,
    recoverBlankMountRoots: () => Promise<void>
): void {
    const hasVisibleMount = mounts.some(mount => shouldMountBeOpen(mounts, mount, expandedMounts));
    const isAnyMountLoading = mounts.some(mount => Boolean(loadingMounts[mount.id]));
    const hasAnyRootRows = mounts.some(mount => (rootNodeKeys[mount.id] ?? []).length > 0);

    if (!hasVisibleMount || isAnyMountLoading || hasAnyRootRows) {
        return;
    }

    void recoverBlankMountRoots();
}

function loadExpandedTreeDirectories(
    mounts: WorkspaceMount[],
    expandedTreeNodes: Record<string, boolean>,
    nodeRecords: Record<string, ExplorerNodeRecord>,
    loadDirectory: (
        mount: WorkspaceMount,
        directoryPath: string,
        parentKey: string | null,
        updateLoadState?: boolean
    ) => Promise<void>
): void {
    for (const [nodeKey, isExpanded] of Object.entries(expandedTreeNodes)) {
        if (!isExpanded) {
            continue;
        }

        const record = nodeRecords[nodeKey];
        if (!record?.node.isDirectory || record.loaded || record.loading) {
            continue;
        }

        const mount = mounts.find(item => item.id === record.mountId);
        if (!mount) {
            continue;
        }

        void loadDirectory(mount, record.node.path, nodeKey);
    }
}

function refreshExplorerDirectories(options: {
    mounts: WorkspaceMount[];
    expandedMounts: Record<string, boolean>;
    expandedTreeNodes: Record<string, boolean>;
    nodeRecords: Record<string, ExplorerNodeRecord>;
    loadedMounts: Record<string, boolean>;
    rootNodeKeys: Record<string, string[]>;
    loadDirectory: (
        mount: WorkspaceMount,
        directoryPath: string,
        parentKey: string | null,
        updateLoadState?: boolean
    ) => Promise<void>;
    refreshTokenRef: { current: number };
    refreshSignal: number;
}): void {
    if (options.refreshSignal === options.refreshTokenRef.current) {
        return;
    }

    options.refreshTokenRef.current = options.refreshSignal;
    void loadVisibleMountDirectories(options.mounts, options.expandedMounts, options.loadedMounts, options.rootNodeKeys, options.loadDirectory);
    void loadExpandedTreeDirectories(options.mounts, options.expandedTreeNodes, options.nodeRecords, options.loadDirectory);
}

async function revealPathInTree(options: {
    targetPath: string;
    mountsRef: React.MutableRefObject<WorkspaceMount[]>;
    loadedMountsRef: React.MutableRefObject<Record<string, boolean>>;
    nodeRecordsRef: React.MutableRefObject<Record<string, ExplorerNodeRecord>>;
    setExpandedTreeNodes: Dispatch<SetStateAction<Record<string, boolean>>>;
    loadDirectory: (
        mount: WorkspaceMount,
        directoryPath: string,
        parentKey: string | null,
        updateLoadState?: boolean
    ) => Promise<void>;
    waitForTreeState: (predicate: () => boolean, timeoutMs?: number) => Promise<boolean>;
}): Promise<string | null> {
    const normalizedTarget = normalizePath(options.targetPath);
    const mount = options.mountsRef.current.find(item => {
        const mountRoot = normalizePath(item.rootPath);
        return (
            normalizedTarget === mountRoot ||
            normalizedTarget.startsWith(`${mountRoot}/`)
        );
    });

    if (!mount) {
        return null;
    }

    if (!(options.loadedMountsRef.current[mount.id] ?? false)) {
        await options.loadDirectory(mount, mount.rootPath, null);
        await options.waitForTreeState(() => options.loadedMountsRef.current[mount.id] ?? false);
    }

    const normalizedRoot = normalizePath(mount.rootPath);
    const relativePath = trimLeadingSeparators(
        normalizedTarget.slice(normalizedRoot.length)
    );
    const segments = relativePath.split('/').filter(Boolean);

    if (segments.length <= 1) {
        return buildNodeKey(mount.id, options.targetPath);
    }

    let currentPath = mount.rootPath;
    for (let index = 0; index < segments.length - 1; index += 1) {
        currentPath = joinPath(currentPath, segments[index] ?? '', mount.type);
        const nodeKey = buildNodeKey(mount.id, currentPath);
        if (!options.nodeRecordsRef.current[nodeKey]) {
            const rootKey = buildNodeKey(mount.id, mount.rootPath);
            await options.waitForTreeState(() => {
                if (currentPath === mount.rootPath) {
                    return options.loadedMountsRef.current[mount.id] ?? false;
                }
                return Boolean(options.nodeRecordsRef.current[nodeKey] ?? options.nodeRecordsRef.current[rootKey]);
            });
        }

        options.setExpandedTreeNodes(prev => {
            if (prev[nodeKey]) {
                return prev;
            }
            return { ...prev, [nodeKey]: true };
        });

        const currentRecord = options.nodeRecordsRef.current[nodeKey];
        if (!currentRecord?.loaded) {
            await options.loadDirectory(mount, currentPath, nodeKey);
            await options.waitForTreeState(() => {
                const nextRecord = options.nodeRecordsRef.current[nodeKey];
                return Boolean(nextRecord?.loaded);
            });
        }
    }

    return buildNodeKey(mount.id, options.targetPath);
}

function createHandleContextMenu(options: {
    setContextMenu: Dispatch<SetStateAction<ContextMenuState | null>>;
}): (
    e: React.MouseEvent,
    row: Pick<WorkspaceEntryRow, 'entry' | 'gitStatus' | 'gitRawStatus' | 'mount'>
) => void {
    return (e, row) => {
        e.preventDefault();
        e.stopPropagation();
        options.setContextMenu({
            x: e.clientX,
            y: e.clientY,
            entry: row.entry,
            entryGitStatus: row.gitStatus,
            entryGitRawStatus: row.gitRawStatus,
            entryMountType: row.mount.type,
        });
    };
}

function createHandleMountContextMenu(options: {
    setContextMenu: Dispatch<SetStateAction<ContextMenuState | null>>;
}): (e: React.MouseEvent, mountId: string) => void {
    return (e, mountId) => {
        e.preventDefault();
        e.stopPropagation();
        options.setContextMenu({ x: e.clientX, y: e.clientY, mountId });
    };
}

function createHandleContextAction(options: {
    contextMenu: ContextMenuState | null;
    onContextAction?: (action: ContextMenuAction) => void;
    setContextMenu: Dispatch<SetStateAction<ContextMenuState | null>>;
}): (type: ContextMenuAction['type']) => void {
    return (type) => {
        if (options.contextMenu?.entry) {
            options.onContextAction?.({ type, entry: options.contextMenu.entry });
        }
        options.setContextMenu(null);
    };
}

function createCollapseAll(
    treeStorageKey: string,
    setExpandedTreeNodes: Dispatch<SetStateAction<Record<string, boolean>>>
): () => void {
    return () => {
        setExpandedTreeNodes({});
        saveExpandedTreeState(treeStorageKey, {});
    };
}

interface ExplorerTreeSnapshot {
    rootNodeKeys: Record<string, string[]>;
    nodeRecords: Record<string, ExplorerNodeRecord>;
    expandedMounts: Record<string, boolean>;
    expandedTreeNodes: Record<string, boolean>;
    loadingMounts: Record<string, boolean>;
}

interface PendingDirectoryReload {
    mountId: string;
    directoryPath: string;
    parentKey: string | null;
}

interface DirectoryListingResult {
    success: boolean;
    error?: string;
    files?: unknown;
    data?: unknown;
    result?: unknown;
    content?: unknown;
}

function buildVisibleRows(
    mounts: WorkspaceMount[],
    snapshot: ExplorerTreeSnapshot
): WorkspaceExplorerRow[] {
    const rows: WorkspaceExplorerRow[] = [];
    const {
        rootNodeKeys,
        nodeRecords,
        expandedMounts,
        expandedTreeNodes,
        loadingMounts,
    } = snapshot;

    const appendChildren = (mount: WorkspaceMount, nodeKey: string, depth: number, isParentIgnored = false) => {
        const record = nodeRecords[nodeKey];
        if (!record) {
            return;
        }

        const isActuallyIgnored = isParentIgnored || record.node.isGitIgnored === true;

        rows.push({
            type: 'entry',
            key: nodeKey,
            mount,
            entry: {
                ...makeWorkspaceEntry(mount.id, record.node),
                isGitIgnored: isActuallyIgnored,
            },
            depth,
            expanded: Boolean(expandedTreeNodes[nodeKey]),
            loading: record.loading,
            gitStatus: record.node.gitStatus,
            gitRawStatus: record.node.gitRawStatus,
        });

        if (!record.node.isDirectory || !expandedTreeNodes[nodeKey]) {
            return;
        }

        for (const childKey of record.childKeys) {
            appendChildren(mount, childKey, depth + 1, isActuallyIgnored);
        }
    };

    for (const mount of mounts) {
        const showHeader = shouldShowMountHeader(mounts, mount);
        const mountExpanded = shouldMountBeOpen(mounts, mount, expandedMounts);
        if (showHeader) {
            rows.push({
                type: 'mount',
                key: `mount:${mount.id}`,
                mount,
                expanded: mountExpanded,
                loading: Boolean(loadingMounts[mount.id]),
            });
        }

        if (!mountExpanded) {
            continue;
        }

        const mountRootKeys = rootNodeKeys[mount.id] ?? [];
        for (const rootKey of mountRootKeys) {
            appendChildren(mount, rootKey, 0);
        }
    }

    return rows;
}

function isPathInsideMount(mount: WorkspaceMount, targetPath: string): boolean {
    const normalizedRoot = normalizePath(mount.rootPath);
    const normalizedTarget = normalizePath(targetPath);
    return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}/`);
}

function resolveDirectoryReload(
    mount: WorkspaceMount,
    targetPath: string,
    nodeRecords: Record<string, ExplorerNodeRecord>,
    loadedMounts: Record<string, boolean>
): PendingDirectoryReload | null {
    if (!isPathInsideMount(mount, targetPath)) {
        return null;
    }

    const exactKey = buildNodeKey(mount.id, targetPath);
    const exactRecord = nodeRecords[exactKey];
    const normalizedRoot = normalizePath(mount.rootPath);
    const normalizedTarget = normalizePath(targetPath);
    const relativePath = trimLeadingSeparators(normalizedTarget.slice(normalizedRoot.length));
    const pathSegments = relativePath.split('/').filter(Boolean);
    const directorySegments = exactRecord?.node.isDirectory ? pathSegments : pathSegments.slice(0, -1);

    for (let depth = directorySegments.length; depth >= 0; depth -= 1) {
        if (depth === 0) {
            if (loadedMounts[mount.id] ?? false) {
                return {
                    mountId: mount.id,
                    directoryPath: mount.rootPath,
                    parentKey: null,
                };
            }
            continue;
        }

        let currentPath = mount.rootPath;
        for (let index = 0; index < depth; index += 1) {
            currentPath = joinPath(currentPath, directorySegments[index] ?? '', mount.type);
        }

        const parentKey = buildNodeKey(mount.id, currentPath);
        const record = nodeRecords[parentKey];
        if (record?.node.isDirectory && record.loaded) {
            return {
                mountId: mount.id,
                directoryPath: record.node.path,
                parentKey,
            };
        }
    }

    return null;
}

export function useWorkspaceExplorerTree({
    workspaceId,
    mounts,
    refreshSignal,
    onEnsureMount,
    onContextAction,
    storageKey,
}: UseWorkspaceExplorerTreeArgs) {
    const treeStorageKey = useMemo(
        () => `workspace.explorer.tree.v1:${workspaceId}`,
        [workspaceId]
    );
    const [expandedMounts, setExpandedMounts] = useState<Record<string, boolean>>(() =>
        loadExpandedMountState(storageKey)
    );
    const [expandedTreeNodes, setExpandedTreeNodes] = useState<Record<string, boolean>>(() =>
        loadExpandedTreeState(treeStorageKey)
    );
    const [rootNodeKeys, setRootNodeKeys] = useState<Record<string, string[]>>({});
    const [nodeRecords, setNodeRecords] = useState<Record<string, ExplorerNodeRecord>>({});
    const [loadedMounts, setLoadedMounts] = useState<Record<string, boolean>>({});
    const [loadingMounts, setLoadingMounts] = useState<Record<string, boolean>>({});
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const refreshTokenRef = useRef(refreshSignal);
    const mountsRef = useRef(mounts);
    const onEnsureMountRef = useRef(onEnsureMount);
    const nodeRecordsRef = useRef(nodeRecords);
    const loadedMountsRef = useRef(loadedMounts);
    const loadingMountsRef = useRef(loadingMounts);
    const requestTokensRef = useRef<Record<string, number>>({});
    const watchedRootsRef = useRef(new Set<string>());
    const pendingDirectoryReloadsRef = useRef(new Map<string, PendingDirectoryReload>());
    const pendingReloadTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        mountsRef.current = mounts;
    }, [mounts]);

    useEffect(() => {
        onEnsureMountRef.current = onEnsureMount;
    }, [onEnsureMount]);

    useEffect(() => {
        nodeRecordsRef.current = nodeRecords;
    }, [nodeRecords]);

    useEffect(() => {
        loadedMountsRef.current = loadedMounts;
    }, [loadedMounts]);

    useEffect(() => {
        loadingMountsRef.current = loadingMounts;
    }, [loadingMounts]);

    const waitForCommit = useCallback(
        async () =>
            await new Promise<void>(resolve => {
                window.setTimeout(resolve, 0);
            }),
        []
    );
    const waitForTreeState = useCallback(
        async (predicate: () => boolean) => {
            for (let attempt = 0; attempt < 24; attempt += 1) {
                if (predicate()) {
                    return true;
                }
                await waitForCommit();
            }
            return predicate();
        },
        [waitForCommit]
    );

    const loadDirectory = useCallback(
        async (mount: WorkspaceMount, directoryPath: string, parentKey: string | null, force = false) => {
            const requestKey = parentKey ?? buildNodeKey(mount.id, directoryPath);
            const existingRecord = parentKey ? nodeRecordsRef.current[parentKey] : null;
            const mountRootLoaded = loadedMountsRef.current[mount.id] ?? false;
            const mountRootLoading = loadingMountsRef.current[mount.id] ?? false;

            if (!directoryPath) {
                appLogger.error('WorkspaceExplorer', 'loadDirectory called with missing directoryPath', {
                    mountId: mount.id,
                    mountRoot: mount.rootPath,
                    parentKey
                });
                if (!parentKey) {
                    setLoadingMounts(prev => ({ ...prev, [mount.id]: false }));
                }
                return;
            }

            if (!force) {
                if (parentKey && existingRecord?.loading) {
                    return;
                }
                if (parentKey && existingRecord?.loaded) {
                    return;
                }
                if (!parentKey && (mountRootLoaded || mountRootLoading)) {
                    return;
                }
            }

            const requestToken = (requestTokensRef.current[requestKey] ?? 0) + 1;
            requestTokensRef.current[requestKey] = requestToken;
            const isStaleRequest = () =>
                requestTokensRef.current[requestKey] !== requestToken;

            if (parentKey) {
                setNodeRecords(prev => {
                    const parent = prev[parentKey];
                    if (!parent) {
                        return prev;
                    }
                    return { ...prev, [parentKey]: { ...parent, loading: true } };
                });
            } else {
                setLoadingMounts(prev => ({ ...prev, [mount.id]: true }));
            }

            const isReady = onEnsureMountRef.current ? await onEnsureMountRef.current(mount) : true;
            if (!isReady) {
                if (isStaleRequest()) {
                    return;
                }
                if (parentKey) {
                    setNodeRecords(prev => {
                        const parent = prev[parentKey];
                        if (!parent) {
                            return prev;
                        }
                        return { ...prev, [parentKey]: { ...parent, loading: false } };
                    });
                } else {
                    setLoadingMounts(prev => ({ ...prev, [mount.id]: false }));
                }
                return;
            }

            if (!directoryPath || directoryPath.trim().length === 0) {
                appLogger.warn('WorkspaceExplorer', 'Skipping directory listing with empty path', {
                    mountId: mount.id,
                    parentKey,
                });
                return;
            }

            try {
                appLogger.info('WorkspaceExplorer', 'Requesting directory listing', { directoryPath, mountId: mount.id });
                const result: DirectoryListingResult =
                    mount.type === 'local'
                        ? await listLocalDirectory(directoryPath)
                        : await window.electron.ssh.listDir(mount.id, directoryPath) as DirectoryListingResult;

                const fileList = extractFileList(result);

                appLogger.info('WorkspaceExplorer', 'Received directory listing', {
                    directoryPath,
                    success: result.success,
                    entries: fileList.length,
                });

                if (!result.success) {
                    appLogger.warn('WorkspaceExplorer', 'Directory listing failed', {
                        mountId: mount.id,
                        directoryPath,
                        error: 'error' in result ? result.error : undefined,
                    });
                    return;
                }

                const initialNodes = sortNodes(mapFileEntries(fileList, directoryPath, mount.type, mount.id));
                const nextChildKeys = initialNodes.map(node => buildNodeKey(mount.id, node.path));

                // Root listings are the only path that can blank the whole explorer.
                // If duplicate refreshes race, still seed the mount rows from the
                // successful response so the tree can recover.
                if (!parentKey && initialNodes.length > 0) {
                    const snapshot = buildMountRootSnapshot(mount, initialNodes);
                    setNodeRecords(prev => ({
                        ...prev,
                        ...snapshot.nextRecords,
                    }));
                    setRootNodeKeys(prev => ({
                        ...prev,
                        [mount.id]: snapshot.childKeys,
                    }));
                    setLoadedMounts(prev => ({
                        ...prev,
                        [mount.id]: true,
                    }));
                }

                const commitNodes = (
                    nextNodes: FileNode[],
                    options?: { updateLoadState?: boolean }
                ) => {
                    if (isStaleRequest()) {
                        return;
                    }

                    setNodeRecords(prev => {
                        const nextRecords: Record<string, ExplorerNodeRecord> = { ...prev };

                        for (const node of nextNodes) {
                            const key = buildNodeKey(mount.id, node.path);
                            const previousRecord = prev[key];
                            nextRecords[key] = {
                                key,
                                mountId: mount.id,
                                parentKey,
                                node,
                                childKeys: previousRecord?.childKeys ?? [],
                                loaded: previousRecord?.loaded ?? false,
                                loading: false,
                            };
                        }

                        if (parentKey) {
                            const parent = prev[parentKey];
                            if (parent) {
                                nextRecords[parentKey] = {
                                    ...parent,
                                    childKeys: nextChildKeys,
                                    loaded: options?.updateLoadState ?? false ? true : parent.loaded,
                                    loading: false,
                                };
                            }
                        }

                        return nextRecords;
                    });

                    if (options?.updateLoadState ?? false) {
                        if (parentKey) {
                            setExpandedTreeNodes(prev => ({ ...prev, [parentKey]: true }));
                        } else {
                            setRootNodeKeys(prev => ({ ...prev, [mount.id]: nextChildKeys }));
                            setLoadedMounts(prev => ({ ...prev, [mount.id]: true }));
                            if (!performanceMonitor.hasMark('workspace:explorer:ready')) {
                                performanceMonitor.mark('workspace:explorer:ready');
                            }
                        }
                    }
                };

                commitNodes(initialNodes, { updateLoadState: true });

                if (mount.type === 'local' && initialNodes.length > 0) {
                    void applyGitTreeStatus(mount.rootPath, directoryPath, initialNodes)
                        .then(decoratedNodes => {
                            commitNodes(sortNodes(decoratedNodes));
                        })
                        .catch(error => {
                            appLogger.warn(
                                'WorkspaceExplorer',
                                'Failed to load git decorations for explorer tree',
                                { directoryPath, error: error instanceof Error ? error.message : String(error) }
                            );
                        });
                }
            } catch (error) {
                appLogger.error('WorkspaceExplorer', 'Failed to load directory tree', error as Error);
            } finally {
                if (!isStaleRequest()) {
                    if (parentKey) {
                        setNodeRecords(prev => {
                            const parent = prev[parentKey];
                            if (!parent) {
                                return prev;
                            }
                            return { ...prev, [parentKey]: { ...parent, loading: false } };
                        });
                    } else {
                        setLoadingMounts(prev => ({ ...prev, [mount.id]: false }));
                    }
                }
            }
        },
        []
    );

    const recoverBlankMountRoots = useCallback(async () => {
        const candidateMounts = mountsRef.current.filter(mount => {
            if (!shouldMountBeOpen(mountsRef.current, mount, expandedMounts)) {
                return false;
            }

            const mountRootKeys = rootNodeKeys[mount.id] ?? [];
            return mountRootKeys.length === 0 && !(loadingMountsRef.current[mount.id] ?? false);
        });

        for (const mount of candidateMounts) {
            if (!mount.rootPath || mount.rootPath.trim().length === 0) {
                appLogger.warn('WorkspaceExplorer', 'Skipping blank mount recovery with empty rootPath', { mountId: mount.id });
                continue;
            }

            const result: DirectoryListingResult =
                mount.type === 'local'
                    ? await listLocalDirectory(mount.rootPath)
                    : await window.electron.ssh.listDir(mount.id, mount.rootPath) as DirectoryListingResult;

            if (!result.success) {
                continue;
            }

            const fileList = extractFileList(result);
            if (fileList.length === 0) {
                continue;
            }

            const initialNodes = sortNodes(mapFileEntries(fileList, mount.rootPath, mount.type, mount.id));
            const snapshot = buildMountRootSnapshot(mount, initialNodes);

            setNodeRecords(prev => ({
                ...prev,
                ...snapshot.nextRecords,
            }));
            setRootNodeKeys(prev => ({
                ...prev,
                [mount.id]: snapshot.childKeys,
            }));
            setLoadedMounts(prev => ({
                ...prev,
                [mount.id]: true,
            }));

            appLogger.warn('WorkspaceExplorer', 'Recovered blank mount root listing', {
                mountId: mount.id,
                rootPath: mount.rootPath,
                entries: fileList.length,
            });
        }
    }, [expandedMounts, rootNodeKeys]);

    const flushPendingDirectoryReloads = useCallback(() => {
        const pendingReloads = Array.from(pendingDirectoryReloadsRef.current.values());
        pendingDirectoryReloadsRef.current.clear();

        for (const pendingReload of pendingReloads) {
            const mount = mountsRef.current.find(item => item.id === pendingReload.mountId);
            if (!mount) {
                continue;
            }
            void loadDirectory(
                mount,
                pendingReload.directoryPath,
                pendingReload.parentKey,
                true
            );
        }
    }, [loadDirectory]);

    const queueDirectoryReload = useCallback((mount: WorkspaceMount, targetPath: string) => {
        const pendingReload = resolveDirectoryReload(
            mount,
            targetPath,
            nodeRecordsRef.current,
            loadedMountsRef.current
        );
        if (!pendingReload) {
            return;
        }

        const reloadKey = pendingReload.parentKey ?? buildNodeKey(mount.id, pendingReload.directoryPath);
        pendingDirectoryReloadsRef.current.set(reloadKey, pendingReload);

        if (pendingReloadTimeoutRef.current !== null) {
            return;
        }

        pendingReloadTimeoutRef.current = window.setTimeout(() => {
            pendingReloadTimeoutRef.current = null;
            flushPendingDirectoryReloads();
        }, 75);
    }, [flushPendingDirectoryReloads]);

    const loadDirectoryTask = useCallback(
        async (mount: WorkspaceMount, directoryPath: string, parentKey: string | null, updateLoadState?: boolean) => {
            await loadDirectory(mount, directoryPath, parentKey, updateLoadState);
        },
        [loadDirectory]
    );

    const recoverBlankMountRootsTask = useCallback(async () => {
        await recoverBlankMountRoots();
    }, [recoverBlankMountRoots]);

    useWorkspaceExplorerWatchers({
        mounts,
        mountsRef,
        watchedRootsRef,
        pendingReloadTimeoutRef,
        pendingDirectoryReloadsRef,
        queueDirectoryReload,
    });

    useEffect(() => {
        syncPrunedMountState(mounts, storageKey, setExpandedMounts);
    }, [mounts, storageKey]);

    useEffect(() => {
        syncPrunedTreeState(mounts, setExpandedTreeNodes);
    }, [mounts]);

    useEffect(() => {
        saveExpandedMountState(storageKey, expandedMounts);
    }, [expandedMounts, storageKey]);

    useEffect(() => {
        saveExpandedTreeState(treeStorageKey, expandedTreeNodes);
    }, [expandedTreeNodes, treeStorageKey]);

    useEffect(() => {
        syncPrunedLoadedState(mounts, setLoadedMounts);
    }, [mounts]);

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        if (!contextMenu) {
            return undefined;
        }
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [contextMenu]);

    useEffect(() => {
        loadVisibleMountDirectories(mounts, expandedMounts, loadedMounts, rootNodeKeys, loadDirectoryTask);
    }, [expandedMounts, loadDirectoryTask, loadedMounts, mounts, rootNodeKeys]);

    useEffect(() => {
        recoverBlankMountRootsIfNeeded(
            mounts,
            expandedMounts,
            loadingMounts,
            rootNodeKeys,
            recoverBlankMountRootsTask
        );
    }, [expandedMounts, loadingMounts, mounts, recoverBlankMountRootsTask, rootNodeKeys]);

    useEffect(() => {
        loadExpandedTreeDirectories(mounts, expandedTreeNodes, nodeRecords, loadDirectoryTask);
    }, [expandedTreeNodes, loadDirectoryTask, mounts, nodeRecords]);

    useEffect(() => {
        refreshExplorerDirectories({
            mounts,
            expandedMounts,
            expandedTreeNodes,
            nodeRecords,
            loadedMounts,
            rootNodeKeys,
            loadDirectory: loadDirectoryTask,
            refreshTokenRef,
            refreshSignal,
        });
    }, [expandedMounts, expandedTreeNodes, loadDirectoryTask, loadedMounts, mounts, nodeRecords, refreshSignal, rootNodeKeys]);

    const visibleRows = useMemo(
        () =>
            buildVisibleRows(mounts, {
                rootNodeKeys,
                nodeRecords,
                expandedMounts,
                expandedTreeNodes,
                loadingMounts,
            }),
        [expandedMounts, expandedTreeNodes, loadingMounts, mounts, nodeRecords, rootNodeKeys]
    );

    const toggleMount = useCallback(
        (mountRow: WorkspaceMountRow) => {
            setExpandedMounts(prev => {
                const nextExpanded = !shouldMountBeOpen(mountsRef.current, mountRow.mount, prev);
                const next = { ...prev, [mountRow.mount.id]: nextExpanded };
                if (nextExpanded && !(loadedMountsRef.current[mountRow.mount.id] ?? false)) {
                    void loadDirectoryTask(mountRow.mount, mountRow.mount.rootPath, null);
                }
                return next;
            });
        },
        [loadDirectoryTask, loadedMountsRef, mountsRef, setExpandedMounts]
    );

    const toggleNode = useCallback(
        (row: WorkspaceEntryRow) => {
            if (!row.entry.isDirectory) {
                return;
            }

            setExpandedTreeNodes(prev => {
                const nextExpanded = !prev[row.key];
                const next = { ...prev, [row.key]: nextExpanded };
                if (nextExpanded) {
                    void loadDirectoryTask(row.mount, row.entry.path, row.key);
                }
                return next;
            });
        },
        [loadDirectoryTask, setExpandedTreeNodes]
    );

    const revealPath = useCallback(
        (targetPath: string) => revealPathInTree({
            targetPath,
            mountsRef,
            loadedMountsRef,
            nodeRecordsRef,
            setExpandedTreeNodes,
            loadDirectory: loadDirectoryTask,
            waitForTreeState,
        }),
        [loadDirectoryTask, mountsRef, loadedMountsRef, nodeRecordsRef, setExpandedTreeNodes, waitForTreeState]
    );

    const handleContextMenu = useMemo(() => createHandleContextMenu({ setContextMenu }), [setContextMenu]);
    const handleMountContextMenu = useMemo(() => createHandleMountContextMenu({ setContextMenu }), [setContextMenu]);
    const handleContextAction = useMemo(
        () => createHandleContextAction({ contextMenu, onContextAction, setContextMenu }),
        [contextMenu, onContextAction, setContextMenu]
    );
    const closeContextMenu = useMemo(() => () => setContextMenu(null), [setContextMenu]);
    const collapseAll = useMemo(
        () => createCollapseAll(treeStorageKey, setExpandedTreeNodes),
        [setExpandedTreeNodes, treeStorageKey]
    );
    const reloadAll = useCallback(() => {
        for (const mount of mountsRef.current) {
            if (!shouldMountBeOpen(mountsRef.current, mount, expandedMounts)) {
                continue;
            }
            void loadDirectoryTask(mount, mount.rootPath, null, true);
        }
    }, [expandedMounts, loadDirectoryTask, mountsRef]);

    return {
        contextMenu,
        visibleRows,
        loadingMounts,
        toggleMount,
        toggleNode,
        revealPath,
        collapseAll,
        reloadAll,
        handleContextMenu,
        handleMountContextMenu,
        handleContextAction,
        closeContextMenu,
    };
}

