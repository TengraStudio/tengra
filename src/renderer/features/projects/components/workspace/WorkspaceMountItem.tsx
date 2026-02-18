import { WorkspaceTreeItem } from '@renderer/features/projects/components/WorkspaceTreeItem';
import { FileNode } from '@renderer/features/projects/components/WorkspaceTreeItem';
import { ChevronDown, ChevronRight, Folder, Server, X } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import { List, RowComponentProps } from 'react-window';

import { cn } from '@/lib/utils';
import { WorkspaceEntry, WorkspaceMount } from '@/types';

// PERF-001-3: Virtualization threshold and constants
const VIRTUALIZATION_THRESHOLD = 50;
const ITEM_HEIGHT = 28; // Height of each tree item in pixels
const MAX_VISIBLE_HEIGHT = 400; // Maximum height for virtualized list

interface WorkspaceMountItemProps {
    mount: WorkspaceMount;
    mountsCount: number;
    mountStatus: Record<string, string>;
    isExpanded: boolean;
    onToggle: (mount: WorkspaceMount) => void;
    onRemove: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, mountId: string) => void;
    rootNodes: FileNode[];
    loading: boolean;
    refreshSignal: number;
    onOpenFile: (entry: WorkspaceEntry) => void;
    onSelectEntry: (entry: WorkspaceEntry, e?: React.MouseEvent) => void;
    selectedEntries?: WorkspaceEntry[] | null;
    onEnsureMount?: (mount: WorkspaceMount) => Promise<boolean> | boolean;
    onTreeItemContextMenu: (e: React.MouseEvent, entry: WorkspaceEntry) => void;
    onMove?: (entry: WorkspaceEntry, targetDirPath: string) => void;
    expandedTreeNodes?: Record<string, boolean>;
    onExpandedTreeNodeChange?: (nodeKey: string, expanded: boolean) => void;
    t: (key: string) => string;
}

// Status color lookup table to reduce complexity
const STATUS_COLOR_MAP: Record<string, string> = {
    connected: 'bg-success',
    connecting: 'bg-warning animate-pulse',
};

interface MountIconProps {
    mountType: WorkspaceMount['type'];
}

const MountIcon: React.FC<MountIconProps> = ({ mountType }) => {
    return mountType === 'ssh' ? (
        <Server className="w-3.5 h-3.5 text-indigo" />
    ) : (
        <Folder className="w-3.5 h-3.5 text-success" />
    );
};

interface MountStatusIndicatorProps {
    mountId: string;
    mountType: WorkspaceMount['type'];
    status: string;
}

const MountStatusIndicator: React.FC<MountStatusIndicatorProps> = ({ mountType, status }) => {
    if (mountType === 'local') {
        return null;
    }

    const statusColor = STATUS_COLOR_MAP[status] || 'bg-destructive/50';

    return <div className={cn('w-1.5 h-1.5 rounded-full', statusColor)} title={status} />;
};

interface MountHeaderProps {
    mount: WorkspaceMount;
    isExpanded: boolean;
    status: string;
    onToggle: (mount: WorkspaceMount) => void;
    onRemove: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, mountId: string) => void;
    t: (key: string) => string;
}

const MountHeader: React.FC<MountHeaderProps> = ({
    mount,
    isExpanded,
    status,
    onToggle,
    onRemove,
    onContextMenu,
    t,
}) => {
    return (
        <div
            className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition-all duration-200 border-l-2 border-transparent',
                'hover:bg-muted/30 text-muted-foreground hover:text-foreground group-hover/mount:bg-muted/10',
                isExpanded ? 'text-foreground' : ''
            )}
            onClick={() => onToggle(mount)}
            onContextMenu={e => onContextMenu(e, mount.id)}
        >
            <span className="opacity-50 group-hover/mount:opacity-100 transition-opacity">
                {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                ) : (
                    <ChevronRight className="w-3 h-3" />
                )}
            </span>
            <MountIcon mountType={mount.type} />
            <div className="flex-1 min-w-0 flex items-center gap-2">
                <div className="text-xs font-bold uppercase tracking-wider truncate text-muted-foreground/70">
                    {mount.name}
                </div>
                {mount.type === 'ssh' && (
                    <span className="px-1 py-0.5 rounded-[3px] bg-indigo/20 text-primary text-xxxs font-bold border border-indigo/30">
                        SSH
                    </span>
                )}
                <MountStatusIndicator mountId={mount.id} mountType={mount.type} status={status} />
            </div>

            <button
                onClick={e => {
                    e.stopPropagation();
                    onRemove(mount.id);
                }}
                className="p-1 rounded opacity-0 group-hover/mount:opacity-100 hover:text-destructive transition-all"
                title={t('workspace.removeMount')}
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
};

// PERF-001-3: Props for virtualized row rendering
interface VirtualizedRowProps {
    nodes: FileNode[];
    mount: WorkspaceMount;
    refreshSignal: number;
    onOpenFile: (entry: WorkspaceEntry) => void;
    onSelectEntry: (entry: WorkspaceEntry, e?: React.MouseEvent) => void;
    selectedEntries?: WorkspaceEntry[] | null;
    onEnsureMount?: (mount: WorkspaceMount) => Promise<boolean> | boolean;
    onContextMenu: (e: React.MouseEvent, entry: WorkspaceEntry) => void;
    onMove?: (entry: WorkspaceEntry, targetDirPath: string) => void;
    expandedTreeNodes?: Record<string, boolean>;
    onExpandedTreeNodeChange?: (nodeKey: string, expanded: boolean) => void;
    t: (key: string) => string;
}

// PERF-001-3: Virtualized row component for large file lists
const VirtualizedTreeRow: React.FC<RowComponentProps<VirtualizedRowProps>> = ({
    index,
    style,
    nodes,
    mount,
    refreshSignal,
    onOpenFile,
    onSelectEntry,
    selectedEntries,
    onEnsureMount,
    onContextMenu,
    onMove,
    expandedTreeNodes,
    onExpandedTreeNodeChange,
    t,
}) => {
    const node = nodes[index];
    if (!node) {
        return null;
    }
    return (
        <div style={style}>
            <WorkspaceTreeItem
                node={node}
                mount={mount}
                level={0}
                refreshSignal={refreshSignal}
                onOpenFile={onOpenFile}
                onSelectEntry={onSelectEntry}
                selectedEntries={selectedEntries}
                onEnsureMount={onEnsureMount}
                onContextMenu={onContextMenu}
                onMove={onMove}
                expandedTreeNodes={expandedTreeNodes}
                onExpandedTreeNodeChange={onExpandedTreeNodeChange}
                t={t}
            />
        </div>
    );
};

export const WorkspaceMountItem: React.FC<WorkspaceMountItemProps> = ({
    mount,
    mountsCount,
    mountStatus,
    isExpanded,
    onToggle,
    onRemove,
    onContextMenu,
    rootNodes,
    loading,
    refreshSignal,
    onOpenFile,
    onSelectEntry,
    selectedEntries,
    onEnsureMount,
    onTreeItemContextMenu,
    onMove,
    expandedTreeNodes,
    onExpandedTreeNodeChange,
    t,
}) => {
    const showHeader = mountsCount > 1 || mount.type !== 'local';

    // PERF-001-3: Use virtualization for large root node lists
    const shouldVirtualize = rootNodes.length > VIRTUALIZATION_THRESHOLD;

    // PERF-001-3: Memoize row props to prevent re-renders
    const rowProps = useMemo<VirtualizedRowProps>(
        () => ({
            nodes: rootNodes,
            mount,
            refreshSignal,
            onOpenFile,
            onSelectEntry,
            selectedEntries,
            onEnsureMount,
            onContextMenu: onTreeItemContextMenu,
            onMove,
            expandedTreeNodes,
            onExpandedTreeNodeChange,
            t,
        }),
        [
            rootNodes,
            mount,
            refreshSignal,
            onOpenFile,
            onSelectEntry,
            selectedEntries,
            onEnsureMount,
            onTreeItemContextMenu,
            onMove,
            expandedTreeNodes,
            onExpandedTreeNodeChange,
            t,
        ]
    );

    // PERF-001-3: Memoized row component that combines base props with rowProps
    const RowComponent = useCallback(
        (props: RowComponentProps<VirtualizedRowProps>) => <VirtualizedTreeRow {...props} />,
        []
    );

    // PERF-001-3: Calculate list height based on item count
    const listHeight = useMemo(() => {
        return Math.min(rootNodes.length * ITEM_HEIGHT, MAX_VISIBLE_HEIGHT);
    }, [rootNodes.length]);

    return (
        <div className="group/mount">
            {showHeader && (
                <MountHeader
                    mount={mount}
                    isExpanded={isExpanded}
                    status={mountStatus[mount.id]}
                    onToggle={onToggle}
                    onRemove={onRemove}
                    onContextMenu={onContextMenu}
                    t={t}
                />
            )}

            <div
                className={cn(
                    showHeader && !isExpanded ? 'hidden' : 'block',
                    showHeader ? 'ml-0' : ''
                )}
            >
                <div className="space-y-0 relative">
                    {/* PERF-001-3: Use virtualized list for large datasets */}
                    {shouldVirtualize ? (
                        <List
                            style={{ height: listHeight }}
                            rowCount={rootNodes.length}
                            rowHeight={ITEM_HEIGHT}
                            rowComponent={RowComponent}
                            rowProps={rowProps}
                            overscanCount={5}
                        />
                    ) : (
                        rootNodes.map(node => (
                            <WorkspaceTreeItem
                                key={`${mount.id}:${node.path}`}
                                node={node}
                                mount={mount}
                                level={0}
                                refreshSignal={refreshSignal}
                                onOpenFile={onOpenFile}
                                onSelectEntry={onSelectEntry}
                                selectedEntries={selectedEntries}
                                onEnsureMount={onEnsureMount}
                                onContextMenu={onTreeItemContextMenu}
                                onMove={onMove}
                                expandedTreeNodes={expandedTreeNodes}
                                onExpandedTreeNodeChange={onExpandedTreeNodeChange}
                                t={t}
                            />
                        ))
                    )}
                    {rootNodes.length === 0 && !loading && (
                        <div className="text-xxs text-muted-foreground/40 pl-4 py-2 italic flex items-center gap-2">
                            {t('workspace.emptyFolder')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
