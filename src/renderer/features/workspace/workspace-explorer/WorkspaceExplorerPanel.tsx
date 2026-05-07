/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import React from 'react';

import type { GitFileHistoryItem } from '@/features/workspace/components/git/types';
import { WORKSPACE_EXPLORER_WIDTH_PX } from '@/features/workspace/hooks/useTerminalLayout';
import { useWorkspaceManager } from '@/features/workspace/hooks/useWorkspaceManager';
import { useWorkspaceState } from '@/features/workspace/hooks/useWorkspaceState';
import type { ContextMenuAction } from '@/features/workspace/workspace-explorer/types';
import { WorkspaceExplorer } from '@/features/workspace/workspace-explorer/WorkspaceExplorer';
import { WorkspaceExplorerGitHistory } from '@/features/workspace/workspace-explorer/WorkspaceExplorerGitHistory';
import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import {
    clearWorkspaceInlineAction,
    startWorkspaceInlineCreate,
    startWorkspaceInlineRename,
} from '@/store/workspace-explorer.store';
import type { WorkspaceEntry, WorkspaceMount } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

interface WorkspaceExplorerPanelProps {
    workspaceId: string;
    workspacePath: string;
    ps: ReturnType<typeof useWorkspaceState>;
    wm: ReturnType<typeof useWorkspaceManager>;
    language: Language;
    activeFilePath?: string;
    onMove?: (entry: WorkspaceEntry, targetDirPath: string) => void;
}

/** Left-hand file explorer panel with drag-and-drop support. */
export const WorkspaceExplorerPanel = React.memo(({
    workspaceId,
    workspacePath,
    ps,
    wm,
    language,
    activeFilePath,
    onMove,
}: WorkspaceExplorerPanelProps) => {
    const { t } = useTranslation(language);
    const [gitHistoryState, setGitHistoryState] = React.useState<{
        fileName: string;
        commits: GitFileHistoryItem[];
        loading: boolean;
    } | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
                delay: 250,
                tolerance: 5,
            },
        })
    );
    const effectiveMounts = React.useMemo<WorkspaceMount[]>(() => {
        const usableMounts = wm.mounts.filter(mount =>
            typeof mount.rootPath === 'string' && mount.rootPath.trim().length > 0
        );
        const hasUsableMount = usableMounts.length > 0;

        appLogger.info('WorkspaceExplorerPanel', 'Calculating effective mounts', { 
            workspacePath, 
            mountsCount: wm.mounts.length,
            usableMountsCount: usableMounts.length,
            hasUsableMount 
        });

        if (hasUsableMount) {
            return usableMounts;
        }

        if (!workspacePath || workspacePath.trim().length === 0) {
            appLogger.warn('WorkspaceExplorerPanel', 'No usable mounts and no workspace path available');
            return wm.mounts;
        }

        const fallbackMount: WorkspaceMount = {
            id: `local-${workspaceId}`,
            name: 'Local',
            type: 'local',
            rootPath: workspacePath,
        };
        
        appLogger.info('WorkspaceExplorerPanel', 'Using fallback local mount', { fallbackMount });
        return [fallbackMount];
    }, [wm.mounts, workspaceId, workspacePath]);

    const handleDragEnd = React.useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) {
            return;
        }

        const source = active.data.current as WorkspaceEntry;
        const target = over.data.current as { mountId: string; path: string; isDirectory: boolean };

        if (!source || !target?.isDirectory) {
            return;
        }

        // 1. Cross-mount moves are not supported yet via DND
        if (source.mountId !== target.mountId) {
            return;
        }

        // 2. Prevent dropping onto self
        if (source.path === target.path) {
            return;
        }

        // 3. Prevent dropping into own children (circular move)
        const normalizedSource = source.path.replace(/\\/g, '/').replace(/\/+$/, '');
        const normalizedTarget = target.path.replace(/\\/g, '/').replace(/\/+$/, '');
        if (normalizedTarget.startsWith(`${normalizedSource}/`)) {
            return;
        }

        // 4. Prevent dropping into own parent (no-op)
        const parentPath = source.path.split(/[\\/]/).slice(0, -1).join(source.path.includes('\\') ? '\\' : '/');
        if (parentPath === target.path) {
            return;
        }

        void onMove?.(source, target.path);
    }, [onMove]);


    const handleGitContextAction = React.useCallback(async (action: ContextMenuAction) => {
        const mount = effectiveMounts.find(item => item.id === action.entry.mountId);
        if (mount?.type !== 'local') {
            return true;
        }

        if (action.type === 'gitHistory') {
            setGitHistoryState({
                fileName: action.entry.name,
                commits: [],
                loading: true,
            });
            const historyResult = await window.electron.git.getFileHistory(
                mount.rootPath,
                action.entry.path,
                20
            );
            if (!historyResult.success || !historyResult.commits || historyResult.commits.length === 0) {
                setGitHistoryState(null);
                return false;
            }
            setGitHistoryState({
                fileName: action.entry.name,
                commits: historyResult.commits,
                loading: false,
            });
            return true;
        }

        const result = action.type === 'stage'
            ? await window.electron.git.stageFile(mount.rootPath, action.entry.path)
            : await window.electron.git.unstageFile(mount.rootPath, action.entry.path);

        if (!result.success) {
            return false;
        }

        wm.setRefreshSignal(previousValue => previousValue + 1);
        return true;
    }, [effectiveMounts, wm]);



    return (
        <div
            className={cn(
                'flex flex-col border-r border-border/40 bg-background/80 backdrop-blur-xl shrink-0 transition-all duration-300 ease-smooth z-20',
                ps.sidebarCollapsed ? 'overflow-hidden opacity-0' : 'opacity-100'
            )}
            style={{
                width: ps.sidebarCollapsed ? 0 : WORKSPACE_EXPLORER_WIDTH_PX,
                minWidth: ps.sidebarCollapsed ? 0 : WORKSPACE_EXPLORER_WIDTH_PX,
                maxWidth: ps.sidebarCollapsed ? 0 : WORKSPACE_EXPLORER_WIDTH_PX,
            }}
        >
            <div className="flex-1 overflow-hidden">
                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                    <div className="flex h-full flex-col overflow-hidden">
                        {gitHistoryState && (
                            <WorkspaceExplorerGitHistory
                                fileName={gitHistoryState.fileName}
                                commits={gitHistoryState.commits}
                                loading={gitHistoryState.loading}
                                onClose={() => setGitHistoryState(null)}
                                t={t}
                            />
                        )}
                        <WorkspaceExplorer
                            workspaceId={workspaceId}
                            workspacePath={workspacePath}
                            mounts={effectiveMounts}
                            refreshSignal={wm.refreshSignal}
                            onOpenFile={(...args) => {
                                void wm.openFile(...args);
                            }}
                            selectedEntries={ps.selectedEntries}
                            lastSelectedEntry={ps.lastSelectedEntry}
                            onSelectedEntriesChange={ps.setSelectedEntries}
                            onLastSelectedEntryChange={ps.setLastSelectedEntry}
                            onAddMount={() => ps.setShowMountModal(true)}
                            onRemoveMount={(id: string) => {
                                void wm.persistMounts(effectiveMounts.filter(m => m.id !== id));
                            }}
                            onEnsureMount={wm.ensureMountReady}
                            onContextAction={action => {
                                if (
                                    action.type === 'stage' ||
                                    action.type === 'unstage' ||
                                    action.type === 'gitHistory'
                                ) {
                                    void handleGitContextAction(action);
                                    return;
                                }

                                if (action.type === 'rename') {
                                    startWorkspaceInlineRename(workspaceId, action.entry);
                                    return;
                                }

                                if (action.type === 'createFile' || action.type === 'createFolder') {
                                    startWorkspaceInlineCreate(workspaceId, action.type, action.entry);
                                    return;
                                }

                                clearWorkspaceInlineAction(workspaceId);
                                ps.setEntryModal({ type: action.type, entry: action.entry });
                            }}
                            variant="embedded"
                            language={language}
                            activeFilePath={activeFilePath}
                            onSubmitInlineAction={async inlineAction => {
                                if (!inlineAction.draftName.trim()) {
                                    return false;
                                }

                                if (inlineAction.type === 'rename') {
                                    await wm.renameEntry(inlineAction.entry, inlineAction.draftName.trim());
                                    clearWorkspaceInlineAction(workspaceId);
                                    return true;
                                }

                                const parentPath = inlineAction.entry.path;
                                const separator = parentPath.includes('\\') ? '\\' : '/';
                                const nextPath = parentPath
                                    ? `${parentPath}${separator}${inlineAction.draftName.trim()}`
                                    : inlineAction.draftName.trim();
                                const targetMount = wm.mounts.find(
                                    mount => mount.id === inlineAction.entry.mountId
                                );

                                if (inlineAction.type === 'createFile') {
                                    clearWorkspaceInlineAction(workspaceId);
                                    void (async () => {
                                        await wm.createFile(nextPath, targetMount);
                                        await wm.openFile({
                                            mountId: inlineAction.entry.mountId,
                                            path: nextPath,
                                            name: inlineAction.draftName.trim(),
                                            isDirectory: false,
                                        });
                                    })();
                                } else {
                                    clearWorkspaceInlineAction(workspaceId);
                                    void wm.createFolder(nextPath, targetMount);
                                }
                                return true;
                            }}
                            onCancelInlineAction={() => {
                                clearWorkspaceInlineAction(workspaceId);
                            }}
                            onSubmitBulkAction={async (type, entries, draftValue) => {
                                const trimmedDraftValue = draftValue.trim();
                                if (!trimmedDraftValue) {
                                    return false;
                                }

                                if (type === 'rename') {
                                    const success = await wm.bulkRenameEntries(
                                        entries,
                                        trimmedDraftValue
                                    );
                                    if (success) {
                                        ps.setSelectedEntries([]);
                                    }
                                    return success;
                                }

                                if (type === 'move') {
                                    const success = await wm.bulkMoveEntries(
                                        entries,
                                        trimmedDraftValue
                                    );
                                    if (success) {
                                        ps.setSelectedEntries([]);
                                    }
                                    return success;
                                }

                                return await wm.bulkCopyEntries(entries, trimmedDraftValue);
                            }}
                            onRequestBulkDelete={entries => {
                                clearWorkspaceInlineAction(workspaceId);
                                const primaryEntry = entries[0] ?? ps.selectedEntries[0];
                                if (!primaryEntry) {
                                    return;
                                }
                                ps.setEntryModal({
                                    type: 'delete',
                                    entry: primaryEntry,
                                });
                            }}
                        />
                    </div>
                </DndContext>
            </div>
        </div>
    );
});

WorkspaceExplorerPanel.displayName = 'WorkspaceExplorerPanel';
