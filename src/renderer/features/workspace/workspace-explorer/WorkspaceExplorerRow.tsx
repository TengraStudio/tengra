import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
    AlertTriangle,
    Bot,
    Braces,
    ChevronDown,
    ChevronRight,
    FlaskConical,
    Folder,
    Loader2,
    Server,
    X,
} from 'lucide-react';
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

function getGitBadgeClass(gitStatus?: WorkspaceEntryRow['gitStatus']): string {
    if (gitStatus === 'M') {
        return 'text-warning';
    }
    if (gitStatus === 'A') {
        return 'text-success';
    }
    if (gitStatus === 'D' || gitStatus === 'U') {
        return 'text-destructive';
    }
    if (gitStatus === 'R' || gitStatus === 'T') {
        return 'text-primary';
    }
    if (gitStatus === '?' || gitStatus === 'I') {
        return 'text-muted-foreground';
    }
    return 'text-muted-foreground';
}

function getIgnoredEntryClassName(isIgnored?: boolean): string {
    return isIgnored === true ? 'opacity-55 text-amber-300/80 hover:text-amber-200/90' : '';
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
        <div className="flex items-center gap-1 tw-text-10 font-semibold leading-none">
            {diagnostics.typescript > 0 && (
                <span className="flex items-center gap-0.5 rounded-sm bg-primary/10 px-1 py-0.5 text-primary">
                    <Braces className="h-2.5 w-2.5" />
                    <span>{diagnostics.typescript}</span>
                </span>
            )}
            {diagnostics.test > 0 && (
                <span className="flex items-center gap-0.5 rounded-sm bg-success/10 px-1 py-0.5 text-success">
                    <FlaskConical className="h-2.5 w-2.5" />
                    <span>{diagnostics.test}</span>
                </span>
            )}
            {diagnostics.agent > 0 && (
                <span className="flex items-center gap-0.5 rounded-sm bg-warning/10 px-1 py-0.5 text-warning">
                    <Bot className="h-2.5 w-2.5" />
                    <span>{diagnostics.agent}</span>
                </span>
            )}
            {diagnostics.lint > 0 && (
                <span className="flex items-center gap-0.5 rounded-sm bg-destructive/10 px-1 py-0.5 text-destructive">
                    <AlertTriangle className="h-2.5 w-2.5" />
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
            'flex w-full min-w-0 items-center gap-1.5 px-3 py-1.5 cursor-pointer overflow-hidden transition-all duration-200 border-l-2 border-transparent',
            'hover:bg-muted/30 text-muted-foreground hover:text-foreground group/mount'
        )}
        onClick={() => onToggleMount(row)}
        onContextMenu={e => onMountContextMenu(e, row.mount.id)}
    >
        <span className="opacity-50 group-hover/mount:opacity-100 transition-opacity">
            {row.expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
        {row.mount.type === 'ssh' ? (
            <Server className="w-3.5 h-3.5 text-primary" />
        ) : (
            <Folder className="w-3.5 h-3.5 text-success" />
        )}
        <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="text-xs font-bold truncate text-muted-foreground/70">
                {row.mount.name}
            </div>
            {row.loading && <Loader2 className="w-3 h-3 text-muted-foreground/60 animate-spin" />}
        </div>
        <WorkspaceExplorerDiagnosticsBadges diagnostics={row.diagnostics} />
        <button
            onClick={e => {
                e.stopPropagation();
                onRemoveMount(row.mount.id);
            }}
            className="p-1 rounded opacity-0 group-hover/mount:opacity-100 hover:text-destructive transition-all"
        >
            <X className="w-3 h-3" />
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
            zIndex: 100,
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
                'flex w-full min-w-0 items-center gap-1.5 py-1 px-2 rounded-sm cursor-pointer overflow-hidden transition-all select-none group border border-transparent outline-none',
                isSelected
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'hover:bg-muted/20 text-muted-foreground/80 hover:text-foreground',
                isFocused && 'ring-1 ring-primary/30 bg-primary/5',
                isOver && 'bg-primary/20 border-dashed border-primary ring-2 ring-primary/20',
                isDragging && 'opacity-20 cursor-grabbing bg-muted/40',
                getIgnoredEntryClassName(row.entry.isGitIgnored)
            )}
            style={{ ...style, paddingLeft: `${row.depth * 14 + 10}px` }}
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
            {row.entry.isDirectory ? (
                <span className="opacity-70 group-hover:opacity-100">
                    {row.loading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                    ) : row.expanded ? (
                        <ChevronDown className="w-3 h-3" />
                    ) : (
                        <ChevronRight className="w-3 h-3" />
                    )}
                </span>
            ) : (
                <span className="w-3" />
            )}
            {row.entry.isDirectory ? (
                <FolderIcon folderName={row.entry.name} isOpen={row.expanded} className="w-3.5 h-3.5" />
            ) : (
                <FileIcon fileName={row.entry.name} className="w-3.5 h-3.5" />
            )}
            <span className="flex-1 min-w-0 truncate text-xs font-normal">
                {row.entry.name}
            </span>
            <WorkspaceExplorerDiagnosticsBadges diagnostics={row.diagnostics} />
            {row.gitStatus && (
                <span
                    className={cn('ml-1 tw-text-10 font-bold leading-none', getGitBadgeClass(row.gitStatus))}
                    title={`Git: ${row.gitRawStatus ?? row.gitStatus}`}
                >
                    {row.gitStatus}
                </span>
            )}
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
