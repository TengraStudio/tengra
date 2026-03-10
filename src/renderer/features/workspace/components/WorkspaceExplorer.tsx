import { useWorkspaceExplorerLogic } from '@renderer/features/workspace/hooks/useWorkspaceExplorerLogic';
import {
    getWorkspaceExplorerStorageKey,
    getWorkspaceTreeStorageKey,
    loadExpandedTreeState,
    saveExpandedTreeState,
} from '@renderer/features/workspace/utils/workspaceUtils';
import { Folder, Plus } from 'lucide-react';
import React from 'react';

import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { WorkspaceEntry, WorkspaceMount } from '@/types';

import { ContextMenuAction } from './workspace/types';
import { WorkspaceContextMenu } from './workspace/WorkspaceContextMenu';
import { WorkspaceMountItem } from './workspace/WorkspaceMountItem';

interface WorkspaceExplorerProps {
    workspaceId: string;
    mounts: WorkspaceMount[];
    refreshSignal: number;
    onOpenFile: (entry: WorkspaceEntry) => void;
    onSelectEntry: (entry: WorkspaceEntry, e?: React.MouseEvent) => void;
    selectedEntries?: WorkspaceEntry[] | null;
    onAddMount: () => void;
    onRemoveMount: (mountId: string) => void;
    onEnsureMount?: (mount: WorkspaceMount) => Promise<boolean> | boolean;
    onContextAction?: (action: ContextMenuAction) => void;
    variant?: 'panel' | 'embedded';
    language: Language;
    onMove?: (entry: WorkspaceEntry, targetDirPath: string) => void;
}

export const WorkspaceExplorer: React.FC<WorkspaceExplorerProps> = ({
    workspaceId,
    mounts,
    refreshSignal,
    onOpenFile,
    onSelectEntry,
    onAddMount,
    onRemoveMount,
    selectedEntries,
    onEnsureMount,
    onContextAction,
    variant = 'panel',
    language,
    onMove,
}) => {
    const { t } = useTranslation(language);
    const storageKey = React.useMemo(
        () => getWorkspaceExplorerStorageKey(workspaceId, mounts),
        [mounts, workspaceId]
    );
    const treeStorageKey = React.useMemo(() => getWorkspaceTreeStorageKey(workspaceId), [workspaceId]);
    const [expandedTreeNodes, setExpandedTreeNodes] = React.useState<Record<string, boolean>>(() =>
        loadExpandedTreeState(treeStorageKey)
    );
    const {
        expandedMounts,
        rootNodes,
        loadingMounts,
        contextMenu,
        toggleMount,
        handleContextMenu,
        handleMountContextMenu,
        handleContextAction,
        closeContextMenu,
    } = useWorkspaceExplorerLogic(mounts, refreshSignal, onEnsureMount, onContextAction, storageKey);
    React.useEffect(() => {
        setExpandedTreeNodes(loadExpandedTreeState(treeStorageKey));
    }, [treeStorageKey]);
    React.useEffect(() => {
        saveExpandedTreeState(treeStorageKey, expandedTreeNodes);
    }, [expandedTreeNodes, treeStorageKey]);

    const handleExpandedTreeNodeChange = React.useCallback((nodeKey: string, expanded: boolean) => {
        setExpandedTreeNodes(prev => ({ ...prev, [nodeKey]: expanded }));
    }, []);

    const hasMounts = mounts.length > 0;

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!selectedEntries || selectedEntries.length === 0) {
            return;
        }

        const primary = selectedEntries[selectedEntries.length - 1];
        const entryId = `item:${primary.mountId}:${primary.path}`;

        // Basic shortcuts
        if (e.key === 'F2') {
            e.preventDefault();
            onContextAction?.({ type: 'rename', entry: primary });
        } else if (e.key === 'Delete') {
            e.preventDefault();
            // If multiple selected, we should ideally handle batch. For now, trigger for primary.
            onContextAction?.({ type: 'delete', entry: primary });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (primary.isDirectory) {
                // To toggle, we'd need to emit an event or use a central registry.
                // For now, most trees toggle on Enter.
                const el = document.querySelector(`[data-entry-id="${entryId}"]`);
                (el as HTMLElement)?.click();
            } else {
                onOpenFile(primary);
            }
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const allItems = Array.from(document.querySelectorAll('[data-entry-id]'));
            const currentIndex = allItems.findIndex(el => el.getAttribute('data-entry-id') === entryId);

            if (currentIndex !== -1) {
                const nextIndex = e.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1;
                const nextEl = allItems[nextIndex] as HTMLElement;
                if (nextEl) {
                    nextEl.focus();
                    nextEl.click(); // Trigger selection
                }
            }
        }
    };

    return (
        <div
            className={cn(
                'flex flex-col h-full overflow-hidden relative transition-all duration-300 outline-none',
                variant === 'panel'
                    ? 'bg-background/40 backdrop-blur-xl border-r border-border/50 w-72'
                    : 'bg-transparent border-0 w-full'
            )}
            tabIndex={0}
            onKeyDown={handleKeyDown}
        >
            <div
                className={cn(
                    'p-4 pb-2 flex items-center justify-between',
                    variant === 'panel'
                        ? 'border-b border-border/50 bg-transparent'
                        : 'border-b border-border/50 bg-transparent'
                )}
            >
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/50">
                    {t('workspace.files')}
                </span>
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

            <div
                className={cn(
                    'flex-1 py-1 space-y-0.5 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent px-0',
                    mounts.length > 1 ? 'overflow-y-auto' : 'overflow-hidden flex flex-col'
                )}
            >
                {mounts.map(mount => (
                    <WorkspaceMountItem
                        key={mount.id}
                        mount={mount}
                        mountsCount={mounts.length}
                        isExpanded={!!expandedMounts[mount.id]}
                        onToggle={toggleMount}
                        onRemove={onRemoveMount}
                        onContextMenu={handleMountContextMenu}
                        rootNodes={rootNodes[mount.id] ?? []}
                        loading={!!loadingMounts[mount.id]}
                        refreshSignal={refreshSignal}
                        onOpenFile={onOpenFile}
                        onSelectEntry={onSelectEntry}
                        selectedEntries={selectedEntries}
                        onEnsureMount={onEnsureMount}
                        onTreeItemContextMenu={handleContextMenu}
                        onMove={onMove}
                        expandedTreeNodes={expandedTreeNodes}
                        onExpandedTreeNodeChange={handleExpandedTreeNodeChange}
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
