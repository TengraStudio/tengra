import { useWorkspaceExplorerLogic } from '@renderer/features/projects/hooks/useWorkspaceExplorerLogic';
import { Folder, Plus } from 'lucide-react';
import React from 'react';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { WorkspaceEntry, WorkspaceMount } from '@/types';

import { ContextMenuAction } from './workspace/types';
import { WorkspaceContextMenu } from './workspace/WorkspaceContextMenu';
import { WorkspaceMountItem } from './workspace/WorkspaceMountItem';

interface WorkspaceExplorerProps {
    mounts: WorkspaceMount[]
    mountStatus: Record<string, 'connected' | 'disconnected' | 'connecting'>
    refreshSignal: number
    onOpenFile: (entry: WorkspaceEntry) => void
    onSelectEntry: (entry: WorkspaceEntry) => void
    selectedEntry?: WorkspaceEntry | null
    onAddMount: () => void
    onRemoveMount: (mountId: string) => void
    onEnsureMount?: (mount: WorkspaceMount) => Promise<boolean> | boolean
    onContextAction?: (action: ContextMenuAction) => void
    variant?: 'panel' | 'embedded'
    language: Language
}

export const WorkspaceExplorer: React.FC<WorkspaceExplorerProps> = ({
    mounts,
    mountStatus,
    refreshSignal,
    onOpenFile,
    onSelectEntry,
    onAddMount,
    onRemoveMount,
    selectedEntry,
    onEnsureMount,
    onContextAction,
    variant = 'panel',
    language
}) => {
    const { t } = useTranslation(language);
    const {
        expandedMounts,
        rootNodes,
        loadingMounts,
        contextMenu,
        toggleMount,
        handleContextMenu,
        handleMountContextMenu,
        handleContextAction,
        closeContextMenu
    } = useWorkspaceExplorerLogic(mounts, refreshSignal, onEnsureMount, onContextAction);

    const hasMounts = mounts.length > 0;

    return (
        <div className={cn(
            "flex flex-col h-full overflow-hidden relative transition-all duration-300",
            variant === 'panel' ? "bg-background/40 backdrop-blur-xl border-r border-border/50 w-72" : "bg-transparent border-0 w-full"
        )}>
            <div className={cn(
                "p-4 pb-2 flex items-center justify-between",
                variant === 'panel' ? "border-b border-border/50 bg-transparent" : "border-b border-border/50 bg-transparent"
            )}>
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/50">{t('workspace.files')}</span>
                <button
                    onClick={onAddMount}
                    className="p-1.5 hover:bg-muted/30 rounded-md transition-colors group"
                    title={t('workspace.addConnection')}
                >
                    <Plus className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
            </div>

            {!hasMounts && (
                <div className="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground gap-2 opacity-60">
                    <Folder className="w-8 h-8 opacity-20" />
                    <span className="text-xs font-medium">{t('workspace.noMounts')}</span>
                </div>
            )}

            <div className="flex-1 overflow-y-auto py-1 space-y-0.5 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent px-0">
                {mounts.map((mount) => (
                    <WorkspaceMountItem
                        key={mount.id}
                        mount={mount}
                        mountsCount={mounts.length}
                        mountStatus={mountStatus}
                        isExpanded={!!expandedMounts[mount.id]}
                        onToggle={toggleMount}
                        onRemove={onRemoveMount}
                        onContextMenu={handleMountContextMenu}
                        rootNodes={rootNodes[mount.id] ?? []}
                        loading={!!loadingMounts[mount.id]}
                        refreshSignal={refreshSignal}
                        onOpenFile={onOpenFile}
                        onSelectEntry={onSelectEntry}
                        selectedEntry={selectedEntry}
                        onEnsureMount={onEnsureMount}
                        onTreeItemContextMenu={handleContextMenu}
                        t={t}
                    />
                ))}
            </div>

            {contextMenu && (
                <WorkspaceContextMenu
                    contextMenu={contextMenu}
                    onClose={closeContextMenu}
                    onRemoveMount={onRemoveMount}
                    onContextAction={handleContextAction}
                    t={t}
                />
            )}
        </div>
    );
};
