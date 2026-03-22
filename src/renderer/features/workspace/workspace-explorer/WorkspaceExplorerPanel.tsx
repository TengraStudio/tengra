import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { GitFileHistoryItem } from '@renderer/features/workspace/components/git/types';
import type { ContextMenuAction } from '@renderer/features/workspace/workspace-explorer/types';
import { WorkspaceExplorer } from '@renderer/features/workspace/workspace-explorer/WorkspaceExplorer';
import { WorkspaceExplorerGitHistory } from '@renderer/features/workspace/workspace-explorer/WorkspaceExplorerGitHistory';
import React from 'react';

import { useWorkspaceManager } from '@/features/workspace/hooks/useWorkspaceManager';
import { useWorkspaceState } from '@/features/workspace/hooks/useWorkspaceState';
import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import {
    clearWorkspaceInlineAction,
    startWorkspaceInlineCreate,
    startWorkspaceInlineRename,
} from '@/store/workspace-explorer.store';
import type { WorkspaceEntry } from '@/types';

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
        if (source.mountId !== target.mountId) {
            return;
        }

        void onMove?.(source, target.path);
    }, [onMove]);


    const handleGitContextAction = React.useCallback(async (action: ContextMenuAction) => {
        const mount = wm.mounts.find(item => item.id === action.entry.mountId);
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
                ps.notify('info', historyResult.error ?? t('agent.history'));
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
            ps.notify('error', result.error ?? t('errors.unexpected'));
            return false;
        }

        wm.setRefreshSignal(previousValue => previousValue + 1);
        ps.notify(
            'success',
            action.type === 'stage'
                ? t('workspaceDashboard.stage')
                : t('workspaceDashboard.unstage')
        );
        return true;
    }, [ps, t, wm]);

    return (
        <div
            className={cn(
                'flex flex-col border-r border-border/40 bg-background/80 backdrop-blur-xl shrink-0 transition-all duration-300 ease-smooth z-20',
                ps.sidebarCollapsed ? 'w-0 overflow-hidden opacity-0' : 'w-72 opacity-100'
            )}
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
                            mounts={wm.mounts}
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
                                void wm.persistMounts(wm.mounts.filter(m => m.id !== id));
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
                            variant="panel"
                            language={language}
                            activeFilePath={activeFilePath}
                            onSubmitInlineAction={async inlineAction => {
                                if (!inlineAction.draftName.trim()) {
                                    ps.notify('error', t('workspace.errors.explorer.validationError'));
                                    return false;
                                }

                                if (inlineAction.type === 'rename') {
                                    await wm.renameEntry(inlineAction.entry, inlineAction.draftName.trim());
                                    clearWorkspaceInlineAction(workspaceId);
                                    return true;
                                }

                                const parentPath = inlineAction.entry.path;
                                const separator = parentPath.includes('\\') ? '\\' : '/';
                                const nextPath = `${parentPath}${separator}${inlineAction.draftName.trim()}`;

                                if (inlineAction.type === 'createFile') {
                                    await wm.createFile(nextPath);
                                } else {
                                    await wm.createFolder(nextPath);
                                }
                                clearWorkspaceInlineAction(workspaceId);
                                return true;
                            }}
                            onCancelInlineAction={() => {
                                clearWorkspaceInlineAction(workspaceId);
                            }}
                            onSubmitBulkAction={async (type, entries, draftValue) => {
                                const trimmedDraftValue = draftValue.trim();
                                if (!trimmedDraftValue) {
                                    ps.notify('error', t('workspace.errors.explorer.validationError'));
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
