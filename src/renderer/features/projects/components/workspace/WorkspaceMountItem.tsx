import { WorkspaceTreeItem } from '@renderer/features/projects/components/WorkspaceTreeItem';
import { FileNode } from '@renderer/features/projects/components/WorkspaceTreeItem';
import { ChevronDown, ChevronRight, Folder, Server, X } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';
import { WorkspaceEntry, WorkspaceMount } from '@/types';

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
    onSelectEntry: (entry: WorkspaceEntry) => void;
    selectedEntry?: WorkspaceEntry | null;
    onEnsureMount?: (mount: WorkspaceMount) => Promise<boolean> | boolean;
    onTreeItemContextMenu: (e: React.MouseEvent, entry: WorkspaceEntry) => void;
    t: (key: string) => string;
}

// Status color lookup table to reduce complexity
const STATUS_COLOR_MAP: Record<string, string> = {
    'connected': 'bg-success',
    'connecting': 'bg-warning animate-pulse',
};

interface MountIconProps {
    mountType: WorkspaceMount['type'];
}

const MountIcon: React.FC<MountIconProps> = ({ mountType }) => {
    return mountType === 'ssh'
        ? <Server className="w-3.5 h-3.5 text-indigo" />
        : <Folder className="w-3.5 h-3.5 text-success" />;
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

    return (
        <div
            className={cn('w-1.5 h-1.5 rounded-full', statusColor)}
            title={status}
        />
    );
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
            onContextMenu={(e) => onContextMenu(e, mount.id)}
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
                    <span className="px-1 py-0.5 rounded-[3px] bg-indigo/20 text-indigo-300 text-[9px] font-bold border border-indigo/30">
                        SSH
                    </span>
                )}
                <MountStatusIndicator
                    mountId={mount.id}
                    mountType={mount.type}
                    status={status}
                />
            </div>

            <button
                onClick={(e) => {
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
    selectedEntry,
    onEnsureMount,
    onTreeItemContextMenu,
    t
}) => {
    const showHeader = mountsCount > 1 || mount.type !== 'local';

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
                    {rootNodes.map((node) => (
                        <WorkspaceTreeItem
                            key={`${mount.id}:${node.path}`}
                            node={node}
                            mount={mount}
                            level={0}
                            refreshSignal={refreshSignal}
                            onOpenFile={onOpenFile}
                            onSelectEntry={onSelectEntry}
                            selectedEntry={selectedEntry}
                            onEnsureMount={onEnsureMount}
                            onContextMenu={onTreeItemContextMenu}
                            t={t}
                        />
                    ))}
                    {rootNodes.length === 0 && !loading && (
                        <div className="text-[11px] text-muted-foreground/40 pl-4 py-2 italic flex items-center gap-2">
                            {t('workspace.emptyFolder')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
