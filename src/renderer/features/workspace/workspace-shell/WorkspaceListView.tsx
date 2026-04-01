import { Archive, ArrowDownUp, Edit, FolderOpen, Monitor, Trash2 } from 'lucide-react';
import React, { memo } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { Workspace } from '@/types';

interface WorkspaceListViewProps {
    workspaces: Workspace[];
    selectedWorkspaceIds: Set<string>;
    toggleSelection: (id: string) => void;
    handleSelectWorkspace: (workspace: Workspace) => void;
    startEdit: (workspace: Workspace) => void;
    startArchive: (workspace: Workspace) => void;
    startDelete: (workspace: Workspace) => void;
    toggleSort: (sortBy: 'title' | 'updatedAt' | 'createdAt') => void;
    t: (key: string) => string;
}

export const WorkspaceListView: React.FC<WorkspaceListViewProps> = memo(({
    workspaces,
    selectedWorkspaceIds,
    toggleSelection,
    handleSelectWorkspace,
    startEdit,
    startArchive,
    startDelete,
    toggleSort,
    t
}) => {
    return (
        <div className="rounded-xl border border-border/40 overflow-hidden">
            <div className="grid tw-grid-cols-todo gap-3 px-4 py-3 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <div />
                <button onClick={() => toggleSort('title')} className="flex items-center gap-1 text-left hover:text-foreground transition-colors">
                    {t('workspaces.tableName')} <ArrowDownUp className="w-3 h-3" />
                </button>
                <div>{t('workspaces.tablePath')}</div>
                <button onClick={() => toggleSort('updatedAt')} className="flex items-center gap-1 text-left hover:text-foreground transition-colors">
                    {t('workspaces.tableUpdated')} <ArrowDownUp className="w-3 h-3" />
                </button>
                <div className="text-right">{t('workspaces.tableActions')}</div>
            </div>
            <Virtuoso
                style={{ height: 520 }}
                data={workspaces}
                itemContent={(_index, workspace) => (
                    <div className="grid tw-grid-cols-todo gap-3 px-4 py-3 border-t border-border/20 items-center text-sm">
                        <div>
                            <input
                                type="checkbox"
                                checked={selectedWorkspaceIds.has(workspace.id)}
                                onChange={() => toggleSelection(workspace.id)}
                                className="w-4 h-4 rounded border-border/40 bg-muted/30 text-foreground focus:ring-foreground/20 cursor-pointer"
                            />
                        </div>
                        <button
                            onClick={() => {
                                void handleSelectWorkspace(workspace);
                            }}
                            className="text-left min-w-0"
                            title={workspace.description || t('workspaces.noDescription')}
                        >
                            <div className="font-medium truncate">{workspace.title}</div>
                            <div className="text-xs text-muted-foreground truncate">{workspace.description || t('workspaces.noDescription')}</div>
                        </button>
                        <div className="text-xs text-muted-foreground truncate font-mono">{workspace.path}</div>
                        <div className="text-xs text-muted-foreground">
                            {new Date(workspace.updatedAt).toLocaleDateString()}
                        </div>
                        <div className="flex items-center justify-end gap-1">
                            <button
                                onClick={() => {
                                    void handleSelectWorkspace(workspace);
                                }}
                                className="p-2 rounded-md hover:bg-muted/30"
                                title={t('workspace.openTitle')}
                            >
                                <FolderOpen className="w-4 h-4" />
                            </button>
                            <button onClick={() => startEdit(workspace)} className="p-2 rounded-md hover:bg-muted/30" title={t('common.edit')}>
                                <Edit className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => startArchive(workspace)}
                                className="p-2 rounded-md hover:bg-muted/30"
                                title={
                                     workspace.status === 'archived'
                                        ? t('common.unarchive')
                                        : t('workspaces.archiveWorkspace')
                                 }
                            >
                                <Archive className="w-4 h-4" />
                            </button>
                            <button onClick={() => startDelete(workspace)} className="p-2 rounded-md hover:bg-destructive/10 text-destructive" title={t('common.delete')}>
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            />
            {workspaces.length === 0 && (
                <div className="py-12 text-center border-t border-border/20">
                    <Monitor className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">{t('workspaces.noWorkspaces')}</p>
                    <p className="text-xs text-muted-foreground/50 mt-1">{t('workspaces.startNewWorkspace')}</p>
                </div>
            )}
        </div>
    );
});
