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
            <div className="space-y-6">
                <VirtualizedWorkspaceGrid
                    workspaces={workspaces}
                    onSelectWorkspace={onSelectWorkspace}
                    showWorkspaceMenu={showWorkspaceMenu}
                    setShowWorkspaceMenu={setShowWorkspaceMenu}
                    workspaceStateMachine={workspaceStateMachine}
                    t={t}
                />
                {workspaces.length === 0 && (
                    <div className="py-20 text-center border-2 border-dashed border-border/20 rounded-2xl bg-muted/5 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-16 h-16 rounded-full bg-muted/10 flex items-center justify-center mb-6">
                            <Monitor className="w-8 h-8 text-muted-foreground/30" />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground/80">{t('workspaces.noWorkspaces')}</h3>
                        <p className="text-muted-foreground/50 max-w-sm mt-2">{t('workspaces.startNewWorkspace')}</p>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-border/40 overflow-hidden bg-card animate-in fade-in slide-in-from-bottom-2 duration-400 shadow-sm">
            <div className="grid grid-cols-todo gap-3 px-6 py-4 bg-muted/20 border-b border-border/20 typo-overline font-bold uppercase tracking-wider text-muted-foreground">
                <div />
                <button
                    onClick={() => toggleSort('title')}
                    className="flex items-center gap-2 text-left hover:text-primary transition-colors group"
                >
                    {t('workspaces.tableName')}
                    <ArrowDownUp className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                </button>
                <div>{t('workspaces.tablePath')}</div>
                <button
                    onClick={() => toggleSort('updatedAt')}
                    className="flex items-center gap-2 text-left hover:text-primary transition-colors group"
                >
                    {t('workspaces.tableUpdated')}
                    <ArrowDownUp className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                </button>
                <div className="text-right">{t('workspaces.tableActions')}</div>
            </div>
            <Virtuoso
                style={{ height: 'calc(100vh - 350px)', minHeight: 400 }}
                data={workspaces}
                itemContent={(_index, workspace) => (
                    <div className="grid grid-cols-todo gap-3 px-6 py-4 border-b border-border/10 items-center text-sm hover:bg-muted/10 transition-colors group">
                        <div>
                            <Checkbox
                                checked={workspaceStateMachine.state.selectedWorkspaceIds.has(workspace.id)}
                                onCheckedChange={() => workspaceStateMachine.toggleSelection(workspace.id)}
                                aria-label={t('common.select')}
                                className="w-4 h-4 border-border/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                        </div>
                        <button
                            onClick={() => onSelectWorkspace(workspace)}
                            className="text-left min-w-0"
                            title={workspace.description || t('workspaces.noDescription')}
                        >
                            <div className="font-semibold truncate group-hover:text-primary transition-colors tracking-tight">{workspace.title}</div>
                            <div className="typo-overline text-muted-foreground/60 truncate mt-0.5 line-clamp-1">
                                {workspace.description || t('workspaces.noDescription')}
                            </div>
                        </button>
                        <div className="typo-overline text-muted-foreground/40 truncate font-mono bg-muted/20 px-2 py-0.5 rounded max-w-200">
                            {workspace.path}
                        </div>
                        <div className="typo-overline text-muted-foreground/60 font-medium">
                            {new Date(workspace.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 group-hover:translate-x-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onSelectWorkspace(workspace)}
                                title={t('workspace.openTitle')}
                                className="h-8 w-8 text-primary/70 hover:text-primary hover:bg-primary/10"
                            >
                                <FolderOpen className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => workspaceStateMachine.startEdit(workspace)}
                                title={t('common.edit')}
                                className="h-8 w-8 hover:bg-muted"
                            >
                                <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => workspaceStateMachine.startArchive(workspace)}
                                title={workspace.status === 'archived' ? t('common.unarchive') : t('workspaces.archiveWorkspace')}
                                className="h-8 w-8 hover:bg-success/10 hover:text-success"
                            >
                                <Archive className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => workspaceStateMachine.startDelete(workspace)}
                                title={t('common.delete')}
                                className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            />
            {workspaces.length === 0 && (
                <div className="py-20 text-center border-t border-border/20 bg-muted/5 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-muted/10 flex items-center justify-center mb-6">
                        <Monitor className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground/80">{t('workspaces.noWorkspaces')}</h3>
                    <p className="text-muted-foreground/50 max-w-sm mt-2">{t('workspaces.startNewWorkspace')}</p>
                </div>
            )}
        </div>
    );
};
