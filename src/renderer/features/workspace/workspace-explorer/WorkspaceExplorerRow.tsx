/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useDraggable, useDroppable } from '@dnd-kit/core';
import { IconAlertTriangle, IconBraces, IconChevronDown, IconChevronRight, IconCircleDot, IconFlask, IconFolder, IconHelpCircle, IconLoader2, IconPlus, IconRobot, IconRotate, IconServer, IconX } from '@tabler/icons-react';
import React from 'react';

import { FileIcon, FolderIcon } from '@/lib/file-icons';
import { cn } from '@/lib/utils';
import { WorkspaceEntry } from '@/types';

import {
    WorkspaceEntryRow,
    WorkspaceExplorerRow,
    WorkspaceMountRow,
} from '../hooks/useWorkspaceExplorerTree';

interface WorkspaceExplorerRowProps {
    row: WorkspaceExplorerRow;
    isSelected: boolean;
    isFocused: boolean;
    onOpenFile: (entry: WorkspaceEntry) => void;
    onSelectEntry: (entry: WorkspaceEntry, e?: React.MouseEvent) => void;
    onToggleMount: (mountRow: WorkspaceMountRow) => void;
    onToggleNode: (entryRow: WorkspaceEntryRow) => void;
    onRemoveMount: (mountId: string) => void;
    onMountContextMenu: (e: React.MouseEvent, mountId: string) => void;
    onEntryContextMenu: (e: React.MouseEvent, row: WorkspaceEntryRow) => void;
    setRowRef?: (rowKey: string, element: HTMLDivElement | null) => void;
}

function GitStatusIndicator({ status, rawStatus }: { status: string; rawStatus?: string }): React.ReactElement | null {
    if (status === 'M') {
        return (
            <div className="flex items-center text-git-modified" title="Modified">
                <IconCircleDot className="w-3 h-3" />
            </div>
        );
    }
    if (status === 'A') {
        return (
            <div className="flex items-center text-git-added" title="Added">
                <IconPlus className="w-3 h-3" />
            </div>
        );
    }
    if (status === 'D') {
        return (
            <div className="flex items-center text-git-deleted" title="Deleted">
                <IconX className="w-3 h-3" />
            </div>
        );
    }
    if (status === 'U' || status === '?' || status === '?') {
        return (
            <div className="flex items-center text-git-untracked" title="Untracked">
                <IconHelpCircle className="w-3 h-3" />
            </div>
        );
    }
    if (status === 'I') {
        return (
            <div className="flex items-center text-git-ignored" title="Ignored">
                <IconHelpCircle className="w-3 h-3" />
            </div>
        );
    }
    if (status === 'R') {
        return (
            <div className="flex items-center text-git-renamed" title="Renamed">
                <IconRotate className="w-3 h-3 -scale-x-100" />
            </div>
        );
    }

    return (
        <span className="typo-overline font-bold text-muted-foreground" title={rawStatus ?? status}>
            {status}
        </span>
    );
}

function getIgnoredEntryClassName(isIgnored?: boolean): string {
    return isIgnored === true ? 'opacity-30 grayscale brightness-90 saturate-50' : '';
}

function WorkspaceExplorerDiagnosticsBadges({
    diagnostics,
}: {
    diagnostics?: WorkspaceEntryRow['diagnostics'] | WorkspaceMountRow['diagnostics'];
}): React.ReactElement | null {
    if (!diagnostics || diagnostics.total === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-1 typo-overline font-semibold leading-none">
            {diagnostics.typescript > 0 && (
                <span className="flex items-center gap-0.5 rounded-sm bg-primary/10 px-1 py-0.5 text-primary">
                    <IconBraces className="h-2.5 w-2.5" />
                    <span>{diagnostics.typescript}</span>
                </span>
            )}
            {diagnostics.test > 0 && (
                <span className="flex items-center gap-0.5 rounded-sm bg-success/10 px-1 py-0.5 text-success">
                    <IconFlask className="h-2.5 w-2.5" />
                    <span>{diagnostics.test}</span>
                </span>
            )}
            {diagnostics.agent > 0 && (
                <span className="flex items-center gap-0.5 rounded-sm bg-warning/10 px-1 py-0.5 text-warning">
                    <IconRobot className="h-2.5 w-2.5" />
                    <span>{diagnostics.agent}</span>
                </span>
            )}
            {diagnostics.lint > 0 && (
                <span className="flex items-center gap-0.5 rounded-sm bg-destructive/10 px-1 py-0.5 text-destructive">
                    <IconAlertTriangle className="h-2.5 w-2.5" />
                    <span>{diagnostics.lint}</span>
                </span>
            )}
        </div>
    );
}

const MountRowView: React.FC<{
    row: WorkspaceMountRow;
    onToggleMount: (mountRow: WorkspaceMountRow) => void;
    onRemoveMount: (mountId: string) => void;
    onMountContextMenu: (e: React.MouseEvent, mountId: string) => void;
}> = ({ row, onToggleMount, onRemoveMount, onMountContextMenu }) => (
    <div
        className={cn(
            'flex w-full min-w-0 items-center gap-1.5 px-3 py-1 cursor-pointer overflow-hidden transition-all duration-200',
            'hover:bg-muted/20 text-muted-foreground hover:text-foreground group/mount border-b border-border/10'
        )}
        onClick={() => onToggleMount(row)}
        onContextMenu={e => onMountContextMenu(e, row.mount.id)}
    >
        <span className="opacity-50 group-hover/mount:opacity-100 transition-opacity">
            {row.expanded ? <IconChevronDown className="w-3 h-3" /> : <IconChevronRight className="w-3 h-3" />}
        </span>
        {row.mount.type === 'ssh' ? (
            <IconServer className="w-3.5 h-3.5 text-primary/70" />
        ) : (
            <IconFolder className="w-3.5 h-3.5 text-success/70" />
        )}
        <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="typo-overline font-bold uppercase truncate text-muted-foreground/50">
                {row.mount.name}
            </div>
            {row.loading && <IconLoader2 className="w-3 h-3 text-muted-foreground/60 animate-spin" />}
        </div>
        <WorkspaceExplorerDiagnosticsBadges diagnostics={row.diagnostics} />
        <button
            onClick={e => {
                e.stopPropagation();
                onRemoveMount(row.mount.id);
            }}
            className="p-1 rounded opacity-0 group-hover/mount:opacity-100 hover:text-destructive transition-all"
        >
            <IconX className="w-3 h-3" />
        </button>
    </div>
);

const EntryRowView: React.FC<{
    row: WorkspaceEntryRow;
    isSelected: boolean;
    isFocused: boolean;
    onOpenFile: (entry: WorkspaceEntry) => void;
    onSelectEntry: (entry: WorkspaceEntry, e?: React.MouseEvent) => void;
    onToggleNode: (entryRow: WorkspaceEntryRow) => void;
    onEntryContextMenu: (e: React.MouseEvent, row: WorkspaceEntryRow) => void;
    setRowRef?: (rowKey: string, element: HTMLDivElement | null) => void;
}> = ({
    row,
    isSelected,
    isFocused,
    onOpenFile,
    onSelectEntry,
    onToggleNode,
    onEntryContextMenu,
    setRowRef,
}) => {
        const entryId = `item:${row.entry.mountId}:${row.entry.path}`;
        const {
            attributes,
            listeners,
            setNodeRef: setDraggableNodeRef,
            transform,
            isDragging,
        } = useDraggable({
            id: entryId,
            data: row.entry,
        });
        const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
            id: `drop:${row.entry.mountId}:${row.entry.path}`,
            disabled: !row.entry.isDirectory,
            data: { mountId: row.entry.mountId, path: row.entry.path, isDirectory: true },
        });

        const combinedRef = (element: HTMLDivElement | null) => {
            setDraggableNodeRef(element);
            if (row.entry.isDirectory) {
                setDroppableNodeRef(element);
            }
            setRowRef?.(row.key, element);
        };

        const style = transform
            ? {
                transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
                zIndex: 'var(--tengra-z-100)',
                opacity: 0.5,
            }
            : undefined;

        return (
            <div
                ref={combinedRef}
                {...attributes}
                {...listeners}
                data-entry-id={entryId}
                className={cn(
                    'flex w-full min-w-0 items-center gap-1.5 py-0 px-2 cursor-pointer overflow-hidden transition-all select-none group border-y border-transparent outline-none relative h-22',
                    isSelected
                        ? 'bg-git-vsc-selected text-foreground'
                        : 'hover:bg-git-vsc-hover text-git-vsc-dim hover:text-foreground',
                    isFocused && !isSelected && 'bg-git-vsc-selected/50',
                    isOver && 'bg-primary/20',
                    isDragging && 'opacity-20 cursor-grabbing bg-muted/40',
                    getIgnoredEntryClassName(row.entry.isGitIgnored)
                )}
                style={{ ...style }}
                onClick={e => {
                    e.stopPropagation();
                    onSelectEntry(row.entry, e);
                    if (row.entry.isDirectory) {
                        onToggleNode(row);
                        return;
                    }
                    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                        onOpenFile(row.entry);
                    }
                }}
                onContextMenu={e => onEntryContextMenu(e, row)}
                tabIndex={-1}
            >
                {/* Indentation Guides */}
                {Array.from({ length: row.depth }).map((_, i) => (
                    <div
                        key={i}
                        className="absolute h-full w-px bg-border/30 group-hover:bg-border/50 transition-colors pointer-events-none"
                        style={{ left: `${(i + 1) * 12 + 4}px` }}
                    />
                ))}

                <div
                    className="flex items-center gap-1.5 min-w-0"
                    style={{ paddingLeft: `${row.depth * 12}px`, zIndex: 'var(--tengra-z-1)' }}
                >
                    {row.entry.isDirectory ? (
                        <span className="opacity-70 group-hover:opacity-100 shrink-0">
                            {row.loading ? (
                                <IconLoader2 className="w-3 h-3 animate-spin" />
                            ) : row.expanded ? (
                                <IconChevronDown className="w-3.5 h-3.5" />
                            ) : (
                                <IconChevronRight className="w-3.5 h-3.5" />
                            )}
                        </span>
                    ) : (
                        <span className="w-3.5 shrink-0" />
                    )}
                    {row.entry.isDirectory ? (
                        <FolderIcon folderName={row.entry.name} isOpen={row.expanded} className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                        <FileIcon fileName={row.entry.name} className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className={cn(
                        "flex-1 min-w-0 truncate typo-overline font-normal transition-colors",
                        row.gitStatus === 'M' ? 'text-git-modified' :
                            row.gitStatus === 'A' ? 'text-git-added' :
                                row.gitStatus === '?' ? 'text-git-untracked' :
                                    isSelected ? 'text-foreground' : ''
                    )}>
                        {row.entry.name}
                    </span>
                </div>

                <div className="ml-auto flex items-center gap-1.5 pl-2 shrink-0 pr-1" style={{ zIndex: 'var(--tengra-z-1)' }}>
                    <WorkspaceExplorerDiagnosticsBadges diagnostics={row.diagnostics} />
                    {row.gitStatus && (
                        <GitStatusIndicator status={row.gitStatus} rawStatus={row.gitRawStatus} />
                    )}
                </div>
            </div>
        );
    };

export const WorkspaceExplorerRowView: React.FC<WorkspaceExplorerRowProps> = props => {
    if (props.row.type === 'mount') {
        return (
            <MountRowView
                row={props.row}
                onToggleMount={props.onToggleMount}
                onRemoveMount={props.onRemoveMount}
                onMountContextMenu={props.onMountContextMenu}
            />
        );
    }

    return (
        <EntryRowView
            row={props.row}
            isSelected={props.isSelected}
            isFocused={props.isFocused}
            onOpenFile={props.onOpenFile}
            onSelectEntry={props.onSelectEntry}
            onToggleNode={props.onToggleNode}
            onEntryContextMenu={props.onEntryContextMenu}
            setRowRef={props.setRowRef}
        />
    );
};

