/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Button } from '@renderer/components/ui/button';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { useWorkspaceListStateMachine } from '@renderer/features/workspace/hooks/useWorkspaceListStateMachine';
import { VirtualizedWorkspaceGrid } from '@renderer/features/workspace/workspace-shell/VirtualizedWorkspaceGrid';
import { Archive, ArrowDownUp, Edit, FolderOpen, Monitor, Trash2 } from 'lucide-react';
import React from 'react';
import { Virtuoso } from 'react-virtuoso';

import { Workspace } from '@/types';

/* Batch-02: Extracted Long Classes */
const C_WORKSPACELISTCONTENT_1 = "grid grid-cols-todo gap-3 px-4 py-3 border-t border-border/20 items-center text-sm hover:bg-muted/10 transition-colors sm:gap-4";


interface WorkspaceListContentProps {
    viewMode: 'grid' | 'list';
    workspaces: Workspace[];
    onSelectWorkspace: (w: Workspace) => void;
    showWorkspaceMenu: string | null;
    setShowWorkspaceMenu: (id: string | null) => void;
    workspaceStateMachine: ReturnType<typeof useWorkspaceListStateMachine>;
    toggleSort: (sortBy: 'title' | 'updatedAt' | 'createdAt') => void;
    t: (key: string) => string;
}


export const WorkspaceListContent: React.FC<WorkspaceListContentProps> = ({
    viewMode, workspaces, onSelectWorkspace, showWorkspaceMenu,
    setShowWorkspaceMenu, workspaceStateMachine, toggleSort, t
}) => {
    if (viewMode === 'grid') {
        return (
            <div>
                <VirtualizedWorkspaceGrid
                    workspaces={workspaces}
                    onSelectWorkspace={onSelectWorkspace}
                    showWorkspaceMenu={showWorkspaceMenu}
                    setShowWorkspaceMenu={setShowWorkspaceMenu}
                    workspaceStateMachine={workspaceStateMachine}
                    t={t}
                />
                {workspaces.length === 0 && (
                    <div className="py-12 text-center border-2 border-dashed border-border/30 rounded-xl">
                        <Monitor className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                        <p className="text-muted-foreground font-medium">{t('workspaces.noWorkspaces')}</p>
                        <p className="typo-caption text-muted-foreground/50 mt-1">{t('workspaces.startNewWorkspace')}</p>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-border/40 overflow-hidden">
            <div className="grid grid-cols-todo gap-3 px-4 py-3 bg-muted/20 typo-caption font-semibold text-muted-foreground">
                <div />
                <button 
                    onClick={() => toggleSort('title')} 
                    className="flex items-center gap-1 text-left hover:text-foreground transition-colors group"
                >
                    {t('workspaces.tableName')} 
                    <ArrowDownUp className="w-3 h-3 transition-transform group-hover:scale-110" />
                </button>
                <div>{t('workspaces.tablePath')}</div>
                <button 
                    onClick={() => toggleSort('updatedAt')} 
                    className="flex items-center gap-1 text-left hover:text-foreground transition-colors group"
                >
                    {t('workspaces.tableUpdated')} 
                    <ArrowDownUp className="w-3 h-3 transition-transform group-hover:scale-110" />
                </button>
                <div className="text-right">{t('workspaces.tableActions')}</div>
            </div>
            <Virtuoso
                style={{ height: 'calc(100vh - 350px)', minHeight: 400 }}
                data={workspaces}
                itemContent={(_index, workspace) => (
                    <div className={C_WORKSPACELISTCONTENT_1}>
                        <div>
                            <Checkbox
                                checked={workspaceStateMachine.state.selectedWorkspaceIds.has(workspace.id)}
                                onCheckedChange={() => workspaceStateMachine.toggleSelection(workspace.id)}
                                aria-label={t('common.select')}
                                className="w-4 h-4"
                            />
                        </div>
                        <button
                            onClick={() => onSelectWorkspace(workspace)}
                            className="text-left min-w-0 group"
                            title={workspace.description || t('workspaces.noDescription')}
                        >
                            <div className="font-medium truncate group-hover:text-primary transition-colors">{workspace.title}</div>
                            <div className="typo-caption text-muted-foreground truncate">{workspace.description || t('workspaces.noDescription')}</div>
                        </button>
                        <div className="typo-caption text-muted-foreground truncate font-mono">{workspace.path}</div>
                        <div className="typo-caption text-muted-foreground">
                            {new Date(workspace.updatedAt).toLocaleDateString()}
                        </div>
                        <div className="flex items-center justify-end gap-1">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => onSelectWorkspace(workspace)} 
                                title={t('workspace.openTitle')}
                                className="h-8 w-8"
                            >
                                <FolderOpen className="w-4 h-4" />
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => workspaceStateMachine.startEdit(workspace)} 
                                title={t('common.edit')}
                                className="h-8 w-8"
                            >
                                <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => workspaceStateMachine.startArchive(workspace)}
                                title={workspace.status === 'archived' ? t('common.unarchive') : t('workspaces.archiveWorkspace')}
                                className="h-8 w-8"
                            >
                                <Archive className="w-4 h-4" />
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => workspaceStateMachine.startDelete(workspace)} 
                                title={t('common.delete')}
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            />
            {workspaces.length === 0 && (
                <div className="py-12 text-center border-t border-border/20">
                    <Monitor className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">{t('workspaces.noWorkspaces')}</p>
                    <p className="typo-caption text-muted-foreground/50 mt-1">{t('workspaces.startNewWorkspace')}</p>
                </div>
            )}
        </div>
    );
};
