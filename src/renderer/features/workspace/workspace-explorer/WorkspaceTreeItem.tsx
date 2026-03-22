import { useDraggable, useDroppable } from '@dnd-kit/core';
import { applyGitTreeStatus } from '@renderer/features/workspace/utils/gitTreeStatus';
import { joinPath, sortNodes } from '@renderer/features/workspace/utils/workspaceUtils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { FileIcon, FolderIcon } from '@/lib/file-icons';
import { cn } from '@/lib/utils';
import { WorkspaceEntry, WorkspaceMount } from '@/types';

export interface FileNode {
    name: string;
    isDirectory: boolean;
    path: string;
    gitStatus?: 'M' | 'A' | 'D' | 'R' | 'U' | '?' | 'T' | 'I';
    gitRawStatus?: string;
    isGitIgnored?: boolean;
}

type MountFileEntry = { name: string; isDirectory: boolean };

interface DirectoryExpandIconProps {
    loading: boolean;
    expanded: boolean;
}

const DirectoryExpandIcon: React.FC<DirectoryExpandIconProps> = ({ loading, expanded }) => {
    if (loading) {
        return (
            <div className="w-3 h-3 border border-border/50 border-t-foreground/60 rounded-full animate-spin" />
        );
    }
    return expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />;
};

export interface WorkspaceTreeItemProps {
    node: FileNode;
    mount: WorkspaceMount;
    level: number;
    refreshSignal: number;
    onOpenFile: (entry: WorkspaceEntry) => void;
    onSelectEntry: (entry: WorkspaceEntry, e?: React.MouseEvent) => void;
    selectedEntries?: WorkspaceEntry[] | null | undefined;
    onEnsureMount?: ((mount: WorkspaceMount) => Promise<boolean> | boolean) | undefined;
    onContextMenu?: ((e: React.MouseEvent, entry: WorkspaceEntry) => void) | undefined;
    expandedTreeNodes?: Record<string, boolean>;
    onExpandedTreeNodeChange?: (nodeKey: string, expanded: boolean) => void;
    t: (key: string) => string;
}

function mapFileEntries(
    fileList: RendererDataValue[],
    nodePath: string,
    mountType: WorkspaceMount['type']
): FileNode[] {
    return (fileList as MountFileEntry[]).map(item => ({
        name: item.name,
        isDirectory: Boolean(item.isDirectory),
        path: joinPath(nodePath, item.name, mountType),
    }));
}

export const WorkspaceTreeItem: React.FC<WorkspaceTreeItemProps> = ({
    node,
    mount,
    level,
    refreshSignal,
    onOpenFile,
    onSelectEntry,
    selectedEntries,
    onEnsureMount,
    onContextMenu,
    expandedTreeNodes,
    onExpandedTreeNodeChange,
    t,
}) => {
    const expandedNodeKey = `${mount.id}:${node.path}`;
    const [expanded, setExpanded] = useState(
        () => Boolean(expandedTreeNodes?.[expandedNodeKey])
    );
    const [children, setChildren] = useState<FileNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        setExpanded(Boolean(expandedTreeNodes?.[expandedNodeKey]));
    }, [expandedNodeKey, expandedTreeNodes]);

    const entryId = `item:${mount.id}:${node.path}`;
    const {
        attributes,
        listeners,
        setNodeRef: setDraggableNodeRef,
        transform,
        isDragging,
    } = useDraggable({
        id: entryId,
        data: {
            mountId: mount.id,
            name: node.name,
            path: node.path,
            isDirectory: node.isDirectory,
        },
    });

    const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
        id: `drop:${mount.id}:${node.path}`,
        disabled: !node.isDirectory,
        data: { mountId: mount.id, path: node.path, isDirectory: true },
    });

    const style = transform
        ? {
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
            zIndex: 100,
            opacity: 0.5,
        }
        : undefined;

    const loadChildren = React.useCallback(async () => {
        if (!node.isDirectory || loading) {
            return;
        }

        // Prevent reloading if already loaded unless refreshSignal changed since last load
        if (loaded && !refreshSignal) {
            return;
        }

        setLoading(true);
        const isReady = onEnsureMount ? await onEnsureMount(mount) : true;
        if (!isReady) {
            setLoading(false);
            return;
        }
        try {
            const result =
                mount.type === 'local'
                    ? await window.electron.files.listDirectory(node.path)
                    : await window.electron.ssh.listDir(mount.id, node.path);

            if (result.success) {
                const fileList =
                    (result as Record<string, RendererDataValue>).files ??
                    (result as Record<string, RendererDataValue>).data;
                if (Array.isArray(fileList)) {
                    const mapped = sortNodes(mapFileEntries(fileList, node.path, mount.type));
                    const withGit =
                        mount.type === 'local'
                            ? await applyGitTreeStatus(mount.rootPath, node.path, mapped)
                            : mapped;
                    setChildren(sortNodes(withGit));
                    setLoaded(true);
                }
            }
        } catch {
            // Directory loading failed silently
        } finally {
            setLoading(false);
        }
    }, [node.isDirectory, node.path, mount, onEnsureMount, refreshSignal, loaded, loading]);

    useEffect(() => {
        if (expanded) {
            void loadChildren();
        }
    }, [expanded, refreshSignal, loadChildren]);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const entry = {
            mountId: mount.id,
            name: node.name,
            path: node.path,
            isDirectory: node.isDirectory,
        };

        const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;
        onSelectEntry(entry, e);

        if (node.isDirectory) {
            setExpanded(prev => {
                const next = !prev;
                onExpandedTreeNodeChange?.(expandedNodeKey, next);
                return next;
            });
            return;
        }

        if (!isMulti) {
            onOpenFile(entry);
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const entry = {
            mountId: mount.id,
            name: node.name,
            path: node.path,
            isDirectory: node.isDirectory,
        };
        onSelectEntry(entry, e);
        onContextMenu?.(e, entry);
    };

    const isSelected = Boolean(
        selectedEntries?.some(e => e.mountId === mount.id && e.path === node.path)
    );

    const gitBadgeClass =
        node.gitStatus === 'M'
            ? 'text-warning'
            : node.gitStatus === 'A'
                ? 'text-success'
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

    const combinedRef = (nodeElement: HTMLDivElement | null) => {
        setDraggableNodeRef(nodeElement);
        if (node.isDirectory) {
            setDroppableNodeRef(nodeElement);
        }
    };

    return (
        <div>
            <div
                ref={combinedRef}
                {...attributes}
                {...listeners}
                data-entry-id={entryId}
                className={cn(
                    'flex items-center gap-1.5 py-[5px] px-2 rounded-sm cursor-pointer transition-all select-none group border border-transparent outline-none',
                    isSelected
                        ? 'bg-primary/10 text-primary border-primary/20 focus:bg-primary/20'
                        : 'hover:bg-muted/20 text-muted-foreground/80 hover:text-foreground focus:bg-muted/30',
                    isOver &&
                    'bg-primary/20 border-dashed border-primary ring-2 ring-primary/20 ring-offset-1 ring-offset-background',
                    isDragging && 'opacity-20 cursor-grabbing bg-muted/40'
                )}
                style={{ ...style, paddingLeft: `${level * 12 + 8}px` }}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                tabIndex={-1}
            >
                {node.isDirectory ? (
                    <span className="opacity-70 group-hover:opacity-100">
                        <DirectoryExpandIcon loading={loading} expanded={expanded} />
                    </span>
                ) : (
                    <span className="w-3" />
                )}

                {node.isDirectory ? (
                    <FolderIcon folderName={node.name} isOpen={expanded} className="w-3.5 h-3.5" />
                ) : (
                    <FileIcon fileName={node.name} className="w-3.5 h-3.5" />
                )}
                <span className="flex-1 min-w-0 truncate text-xs font-normal tracking-tight">
                    {node.name}
                </span>
                {node.gitStatus && (
                    <span
                        className={cn('ml-1 text-[10px] font-bold leading-none', gitBadgeClass)}
                        title={`Git: ${node.gitRawStatus ?? node.gitStatus}`}
                    >
                        {node.gitStatus}
                    </span>
                )}
            </div>

            {expanded && (
                <div className="flex flex-col">
                    {children.map(child => (
                        <WorkspaceTreeItem
                            key={`${mount.id}:${child.path}`}
                            node={child}
                            mount={mount}
                            level={level + 1}
                            refreshSignal={refreshSignal}
                            onOpenFile={onOpenFile}
                            onSelectEntry={onSelectEntry}
                            selectedEntries={selectedEntries}
                            onEnsureMount={onEnsureMount}
                            onContextMenu={onContextMenu}
                            expandedTreeNodes={expandedTreeNodes}
                            onExpandedTreeNodeChange={onExpandedTreeNodeChange}
                            t={t}
                        />
                    ))}
                    {children.length === 0 && loaded && (
                        <div className="text-xxs text-muted-foreground/40 pl-8 py-0.5 italic">
                            {t('workspace.emptyFolder')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
