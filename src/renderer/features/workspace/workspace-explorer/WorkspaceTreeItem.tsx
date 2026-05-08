/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    IconChevronDown,
    IconChevronRight,
    IconFile,
    IconFolder,
    IconFolderOpen,
} from '@tabler/icons-react';
import React, { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import type { WorkspaceEntry, WorkspaceMount } from '@/types';

export interface FileNode {
    mountId: string;
    name: string;
    path: string;
    isDirectory: boolean;
    gitStatus?: string;
    isGitIgnored?: boolean;
    gitRawStatus?: string;
    children?: FileNode[];
}

export interface WorkspaceTreeItemProps {
    node: FileNode;
    mount: WorkspaceMount;
    level: number;
    onSelect: (node: WorkspaceEntry) => void;
    onOpenFile: (entry: WorkspaceEntry) => void;
    onContextMenu: (event: React.MouseEvent, node: WorkspaceEntry) => void;
    onEnsureMount?: (mount: WorkspaceMount) => Promise<boolean> | boolean;
    onMove?: (entry: WorkspaceEntry, targetDirPath: string) => void;
    expandedTreeNodes?: Record<string, boolean>;
    onExpandedTreeNodeChange?: (nodeKey: string, expanded: boolean) => void;
    refreshSignal: number;
    selectedEntries: WorkspaceEntry[];
    t: (key: string) => string;
}

export const WorkspaceTreeItem: React.FC<WorkspaceTreeItemProps> = ({
    node,
    mount,
    level,
    onSelect,
    onOpenFile,
    onContextMenu,
    onEnsureMount,
    expandedTreeNodes,
    onExpandedTreeNodeChange,
    refreshSignal,
    selectedEntries,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);

    const expandedNodeKey = node.path;

    useEffect(() => {
        queueMicrotask(() => {
            setExpanded(Boolean(expandedTreeNodes?.[expandedNodeKey]));
        });
    }, [expandedNodeKey, expandedTreeNodes]);

    const isActive = selectedEntries.some(
        entry => entry.mountId === node.mountId && entry.path === node.path
    );

    const loadChildren = React.useCallback(async () => {
        if (!node.isDirectory || loading) {
            return;
        }

        // Ensure we don't call setState synchronously if called from useEffect
        await Promise.resolve();
        setLoading(true);
        const isReady = onEnsureMount ? await onEnsureMount(mount) : true;
        if (!isReady) {
            setLoading(false);
            return;
        }

        try {
            const result = await window.electron.files.listDirectory(node.path);
            if (result.success && result.data) {
                // Success
            }
        } catch (error) {
            console.error('Failed to load children:', error);
        } finally {
            setLoading(false);
        }
    }, [node.isDirectory, node.path, mount, onEnsureMount, loading]);

    useEffect(() => {
        if (expanded) {
            queueMicrotask(() => {
                void loadChildren();
            });
        }
    }, [expanded, refreshSignal, loadChildren]);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const entry: WorkspaceEntry = {
            mountId: node.mountId ?? mount.id,
            name: node.name,
            path: node.path,
            isDirectory: node.isDirectory,
        };
        onSelect(entry);

        if (node.isDirectory) {
            const nextExpanded = !expanded;
            setExpanded(nextExpanded);
            onExpandedTreeNodeChange?.(expandedNodeKey, nextExpanded);
        } else {
            onOpenFile(entry);
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        const entry: WorkspaceEntry = {
            mountId: node.mountId ?? mount.id,
            name: node.name,
            path: node.path,
            isDirectory: node.isDirectory,
        };
        onContextMenu(e, entry);
    };

    // Diagnostic tracking — simplified without context
    const hasErrors = false;
    const hasWarnings = false;

    const iconColorClass = hasErrors
        ? 'text-destructive'
        : hasWarnings
            ? 'text-warning'
            : node.gitStatus === 'M'
                ? 'text-warning'
                : node.gitStatus === 'A'
                    ? 'text-primary'
                    : node.gitStatus === 'D'
                        ? 'text-destructive'
                        : node.gitStatus === 'U'
                            ? 'text-destructive'
                            : node.gitStatus === 'R'
                                ? 'text-primary'
                                : node.gitStatus === '?'
                                    ? 'text-muted-foreground'
                                    : node.gitStatus === 'T'
                                        ? 'text-primary'
                                        : node.gitStatus === 'I'
                                            ? 'text-muted-foreground/70'
                                            : 'text-muted-foreground';

    return (
        <div
            className={cn(
                'group flex items-center gap-1.5 px-2 py-1 cursor-pointer select-none border-l-2 transition-colors',
                isActive
                    ? 'bg-primary/10 border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
        >
            <div className="flex items-center w-4 h-4 shrink-0">
                {node.isDirectory && (
                    expanded ? (
                        <IconChevronDown className="w-3.5 h-3.5" />
                    ) : (
                        <IconChevronRight className="w-3.5 h-3.5" />
                    )
                )}
            </div>

            <div className={cn('flex items-center w-4 h-4 shrink-0', iconColorClass)}>
                {node.isDirectory ? (
                    expanded ? (
                        <IconFolderOpen className="w-4 h-4" />
                    ) : (
                        <IconFolder className="w-4 h-4" />
                    )
                ) : (
                    <IconFile className="w-4 h-4" />
                )}
            </div>

            <span className={cn('truncate text-sm', isActive && 'font-medium')}>
                {node.name}
            </span>

            {node.gitStatus && (
                <span className={cn('ml-auto text-[10px] font-bold opacity-60', iconColorClass)}>
                    {node.gitStatus}
                </span>
            )}

            {loading && (
                <div className="ml-auto animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
            )}
        </div>
    );
};
