/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { FileNode } from '@renderer/features/workspace/components/WorkspaceTreeItem';
import { applyGitTreeStatus } from '@renderer/features/workspace/utils/gitTreeStatus';
import {
    joinPath,
    loadExpandedMountState,
    saveExpandedMountState,
    sortNodes,
} from '@renderer/features/workspace/utils/workspaceUtils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { WorkspaceEntry, WorkspaceMount } from '@/types';
import { performanceMonitor } from '@/utils/performance';
import { appLogger } from '@/utils/renderer-logger';

import { ContextMenuAction, ContextMenuState, MountFileEntry } from '../components/workspace/types';

export function useWorkspaceExplorerLogic(
    mounts: WorkspaceMount[],
    refreshSignal: number,
    onEnsureMount?: (mount: WorkspaceMount) => Promise<boolean> | boolean,
    onContextAction?: (action: ContextMenuAction) => void,
    storageKey?: string
) {
    const initialExpandedState = useMemo(
        () => (storageKey ? loadExpandedMountState(storageKey) : {}),
        [storageKey]
    );
    const [expandedMounts, setExpandedMounts] = useState<Record<string, boolean>>(initialExpandedState);
    const [rootNodes, setRootNodes] = useState<Record<string, FileNode[]>>({});
    const [loadingMounts, setLoadingMounts] = useState<Record<string, boolean>>({});
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const loadDebounceRef = useRef<number | null>(null);

    const loadRoot = useCallback(
        async (mount: WorkspaceMount) => {
            setLoadingMounts(prev => ({ ...prev, [mount.id]: true }));
            const isReady = onEnsureMount ? await onEnsureMount(mount) : true;
            if (!isReady) {
                setLoadingMounts(prev => ({ ...prev, [mount.id]: false }));
                return;
            }
            try {
                const result =
                    mount.type === 'local'
                        ? await window.electron.files.listDirectory(mount.rootPath)
                        : await window.electron.ssh.listDir(mount.id, mount.rootPath);
                if (result.success) {
                    const anyResult = result as {
                        files?: MountFileEntry[];
                        data?: MountFileEntry[];
                    };
                    const fileList = anyResult.files ?? anyResult.data ?? [];
                    if (Array.isArray(fileList)) {
                        const mapped = fileList.map((item: MountFileEntry) => ({
                            name: item.name,
                            isDirectory: Boolean(item.isDirectory),
                            path: joinPath(mount.rootPath, item.name, mount.type),
                        }));
                        const sorted = sortNodes(mapped);
                        setRootNodes(prev => ({ ...prev, [mount.id]: sorted }));
                        if (!performanceMonitor.hasMark('workspace:explorer:ready')) {
                            performanceMonitor.mark('workspace:explorer:ready');
                        }
                        if (mount.type === 'local') {
                            void applyGitTreeStatus(mount.rootPath, mount.rootPath, sorted)
                                .then(withGit => {
                                    setRootNodes(prev => ({
                                        ...prev,
                                        [mount.id]: sortNodes(withGit),
                                    }));
                                })
                                .catch(error => {
                                    appLogger.error(
                                        'WorkspaceExplorer',
                                        'Failed to apply git tree preview',
                                        error as Error
                                    );
                                });
                        }
                    }
                }
            } catch (error) {
                appLogger.error('WorkspaceExplorer', 'Failed to load mount root', error as Error);
            } finally {
                setLoadingMounts(prev => ({ ...prev, [mount.id]: false }));
            }
        },
        [onEnsureMount]
    );

    useEffect(() => {
        if (loadDebounceRef.current !== null) {
            window.clearTimeout(loadDebounceRef.current);
        }
        loadDebounceRef.current = window.setTimeout(() => {
            mounts.forEach(mount => {
                const shouldLoad =
                    expandedMounts[mount.id] || (mounts.length === 1 && mount.type === 'local');
                if (shouldLoad) {
                    void loadRoot(mount);
                }
            });
            loadDebounceRef.current = null;
        }, 120);

        return () => {
            if (loadDebounceRef.current !== null) {
                window.clearTimeout(loadDebounceRef.current);
                loadDebounceRef.current = null;
            }
        };
    }, [refreshSignal, mounts, expandedMounts, loadRoot]);

    useEffect(() => {
        setExpandedMounts(initialExpandedState);
    }, [initialExpandedState]);

    useEffect(() => {
        const mountIds = new Set(mounts.map(mount => mount.id));
        setExpandedMounts(prev =>
            Object.fromEntries(Object.entries(prev).filter(([mountId]) => mountIds.has(mountId)))
        );
    }, [mounts]);

    useEffect(() => {
        if (!storageKey) {
            return;
        }
        saveExpandedMountState(storageKey, expandedMounts);
    }, [expandedMounts, storageKey]);

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        if (contextMenu) {
            document.addEventListener('click', handleClick);
            return () => document.removeEventListener('click', handleClick);
        }
        return undefined;
    }, [contextMenu]);

    const toggleMount = useCallback(
        (mount: WorkspaceMount) => {
            setExpandedMounts(prev => {
                const next = { ...prev, [mount.id]: !prev[mount.id] };
                if (!prev[mount.id]) {
                    void loadRoot(mount);
                }
                return next;
            });
        },
        [loadRoot]
    );

    const handleContextMenu = useCallback((e: React.MouseEvent, entry: WorkspaceEntry) => {
        setContextMenu({ x: e.clientX, y: e.clientY, entry });
    }, []);

    const handleMountContextMenu = useCallback((e: React.MouseEvent, mountId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, mountId });
    }, []);

    const handleContextActionInternal = useCallback(
        (type: ContextMenuAction['type']) => {
            if (contextMenu?.entry && onContextAction) {
                onContextAction({ type, entry: contextMenu.entry });
            }
            setContextMenu(null);
        },
        [contextMenu, onContextAction]
    );

    const closeContextMenu = useCallback(() => setContextMenu(null), []);

    return {
        expandedMounts,
        rootNodes,
        loadingMounts,
        contextMenu,
        toggleMount,
        handleContextMenu,
        handleMountContextMenu,
        handleContextAction: handleContextActionInternal,
        closeContextMenu,
    };
}
