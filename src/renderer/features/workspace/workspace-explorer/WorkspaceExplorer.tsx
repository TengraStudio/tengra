/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconFilePlus, IconFolder, IconFolderPlus, IconMinimize, IconRefresh, IconSearch } from '@tabler/icons-react';
import React from 'react';
import { List, RowComponentProps } from 'react-window';

import { useWorkspaceExplorerDiagnostics } from '@/features/workspace/hooks/useWorkspaceExplorerDiagnostics';
import {
    useWorkspaceExplorerTree,
    WorkspaceEntryRow,
    WorkspaceExplorerRow,
    WorkspaceMountRow,
} from '@/features/workspace/hooks/useWorkspaceExplorerTree';
import { canUseSharedTargetDirectory } from '@/features/workspace/utils/workspace-bulk-actions';
import { normalizeWorkspaceExplorerDiagnosticPath } from '@/features/workspace/utils/workspace-explorer-diagnostics';
import {
    findTypeToSelectMatch,
    getWorkspaceEntryKey,
    getWorkspaceEntryRange,
    toggleWorkspaceEntrySelection,
} from '@/features/workspace/utils/workspace-explorer-navigation';
import { getWorkspaceExplorerStorageKey } from '@/features/workspace/utils/workspaceUtils';
import { ContextMenuAction } from '@/features/workspace/workspace-explorer/types';
import { WorkspaceContextMenu } from '@/features/workspace/workspace-explorer/WorkspaceContextMenu';
import { WorkspaceExplorerBulkActions } from '@/features/workspace/workspace-explorer/WorkspaceExplorerBulkActions';
import { WorkspaceExplorerInlineRow } from '@/features/workspace/workspace-explorer/WorkspaceExplorerInlineRow';
import { WorkspaceExplorerRowView } from '@/features/workspace/workspace-explorer/WorkspaceExplorerRow';
import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import {
    clearWorkspaceBulkAction,
    clearWorkspaceInlineAction,
    setWorkspaceBulkActionDraftValue,
    setWorkspaceExplorerFilterQuery,
    setWorkspaceExplorerFocusedRowKey,
    setWorkspaceInlineDraftName,
    startWorkspaceBulkAction,
    useWorkspaceExplorerStore,
    WorkspaceBulkAction,
    WorkspaceInlineAction,
} from '@/store/workspace-explorer.store';
import { WorkspaceEntry, WorkspaceMount } from '@/types';

/* Batch-02: Extracted Long Classes */
const C_WORKSPACEEXPLORER_1 = "h-7 w-full rounded border border-border/40 bg-zinc-900/50 pl-7 pr-2 typo-overline text-foreground outline-none transition-all focus:border-primary/50 placeholder:text-muted-foreground/40";


interface WorkspaceExplorerProps {
    workspaceId: string;
    mounts: WorkspaceMount[];
    refreshSignal: number;
    onOpenFile: (entry: WorkspaceEntry) => void;
    selectedEntries?: WorkspaceEntry[] | null;
    lastSelectedEntry?: WorkspaceEntry | null;
    onSelectedEntriesChange?: (entries: WorkspaceEntry[]) => void;
    onLastSelectedEntryChange?: (entry: WorkspaceEntry | null) => void;
    onAddMount: () => void;
    onRemoveMount: (mountId: string) => void;
    onEnsureMount?: (mount: WorkspaceMount) => Promise<boolean> | boolean;
    onContextAction?: (action: ContextMenuAction) => void;
    onSubmitInlineAction?: (action: WorkspaceInlineAction) => Promise<boolean>;
    onCancelInlineAction?: () => void;
    onSubmitBulkAction?: (
        type: 'rename' | 'move' | 'copy',
        entries: WorkspaceEntry[],
        draftValue: string
    ) => Promise<boolean>;
    onRequestBulkDelete?: (entries: WorkspaceEntry[]) => void;
    variant?: 'panel' | 'embedded';
    language: Language;
    activeFilePath?: string;
    workspacePath?: string;
}

const EXPLORER_ROW_HEIGHT = 22;
const EXPLORER_VIRTUALIZATION_THRESHOLD = 80;
const EXPLORER_MULTI_MOUNT_MAX_HEIGHT = 500;

interface ExplorerRowProps {
    rows: ExplorerDisplayRow[];
    selectedEntries?: WorkspaceEntry[] | null;
    focusedRowKey: string | null;
    onOpenFile: (entry: WorkspaceEntry) => void;
    onSelectEntry: (entry: WorkspaceEntry, e?: React.MouseEvent) => void;
    onToggleMount: (row: WorkspaceMountRow) => void;
    onToggleNode: (row: WorkspaceEntryRow) => void;
    onRemoveMount: (mountId: string) => void;
    onMountContextMenu: (e: React.MouseEvent, mountId: string) => void;
    onEntryContextMenu: (e: React.MouseEvent, row: WorkspaceEntryRow) => void;
    setRowRef: (rowKey: string, element: HTMLDivElement | null) => void;
    inlinePlaceholder: string;
    onInlineDraftNameChange: (value: string) => void;
    onInlineSubmit: () => void;
    onInlineCancel: () => void;
}

interface InlineDraftRow {
    type: 'inline';
    key: string;
    depth: number;
    draftName: string;
    actionType: WorkspaceInlineAction['type'];
}

type ExplorerDisplayRow = WorkspaceExplorerRow | InlineDraftRow;
type ExplorerListRef = {
    element: HTMLDivElement | null;
    scrollToRow: (config: {
        align?: 'auto' | 'center' | 'end' | 'smart' | 'start';
        behavior?: 'auto' | 'instant' | 'smooth';
        index: number;
    }) => void;
};

function WorkspaceExplorerEmptyState({ label }: { label: string }): React.ReactElement {
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground gap-2 opacity-60">
            <IconFolder className="w-8 h-8 opacity-20" />
            <span className="typo-caption font-medium">{label}</span>
        </div>
    );
}

function useSyncedActiveFilePathReset(
    activeFilePath: string | undefined,
    syncedActiveFilePathRef: React.MutableRefObject<string | null>
): void {
    React.useEffect(() => {
        if (!activeFilePath) {
            syncedActiveFilePathRef.current = null;
            return;
        }
        if (syncedActiveFilePathRef.current !== activeFilePath) {
            syncedActiveFilePathRef.current = null;
        }
    }, [activeFilePath, syncedActiveFilePathRef]);
}

function applyExplorerFilter(
    rows: WorkspaceExplorerRow[],
    filterQuery: string
): WorkspaceExplorerRow[] {
    const trimmedQuery = filterQuery.trim().toLowerCase();
    if (!trimmedQuery) {
        return rows;
    }

    const matchingMountIds = new Set<string>();
    rows.forEach(row => {
        if (row.type === 'mount') {
            return;
        }

        const searchText = `${row.entry.name} ${row.entry.path}`.toLowerCase();
        if (searchText.includes(trimmedQuery)) {
            matchingMountIds.add(row.entry.mountId);
        }
    });

    return rows.filter(row => {
        if (row.type === 'mount') {
            return matchingMountIds.has(row.mount.id);
        }
        return `${row.entry.name} ${row.entry.path}`.toLowerCase().includes(trimmedQuery);
    });
}

function buildInlineRow(
    inlineAction: WorkspaceInlineAction | null,
    rows: WorkspaceExplorerRow[]
): InlineDraftRow | null {
    if (!inlineAction) {
        return null;
    }

    const targetRow = rows.find(
        (row): row is WorkspaceEntryRow =>
            row.type === 'entry' &&
            row.key === `${inlineAction.entry.mountId}:${inlineAction.entry.path}`
    );
    if (!targetRow) {
        if (inlineAction.type === 'rename') {
            return null;
        }
        return {
            type: 'inline',
            key: `inline:${inlineAction.entry.mountId}:${inlineAction.entry.path}`,
            depth: 0,
            draftName: inlineAction.draftName,
            actionType: inlineAction.type,
        };
    }

    return {
        type: 'inline',
        key: `inline:${targetRow.key}`,
        depth: inlineAction.type === 'rename' ? targetRow.depth : targetRow.depth + 1,
        draftName: inlineAction.draftName,
        actionType: inlineAction.type,
    };
}

function insertInlineRow(
    rows: WorkspaceExplorerRow[],
    inlineRow: InlineDraftRow | null,
    inlineAction: WorkspaceInlineAction | null
): ExplorerDisplayRow[] {
    if (!inlineRow || !inlineAction) {
        return rows;
    }

    const targetKey = `${inlineAction.entry.mountId}:${inlineAction.entry.path}`;
    const targetIndex = rows.findIndex(row => row.type === 'entry' && row.key === targetKey);
    if (targetIndex < 0) {
        if (inlineAction.type === 'rename') {
            return rows;
        }
        const mountRowIndex = rows.findIndex(
            row => row.type === 'mount' && row.mount.id === inlineAction.entry.mountId
        );
        const insertionIndex = mountRowIndex >= 0 ? mountRowIndex + 1 : 0;
        const nextRows: ExplorerDisplayRow[] = [...rows];
        nextRows.splice(insertionIndex, 0, inlineRow);
        return nextRows;
    }

    const nextRows: ExplorerDisplayRow[] = [...rows];
    const insertionIndex = inlineAction.type === 'rename' ? targetIndex : targetIndex + 1;
    nextRows.splice(insertionIndex, 0, inlineRow);
    return nextRows;
}

function getEntryParentDirectoryPath(entryPath: string): string {
    const normalizedPath = entryPath.replace(/[/\\]+$/, '');
    const lastSeparatorIndex = Math.max(
        normalizedPath.lastIndexOf('/'),
        normalizedPath.lastIndexOf('\\')
    );
    if (lastSeparatorIndex <= 0) {
        return normalizedPath;
    }
    return normalizedPath.slice(0, lastSeparatorIndex);
}

function applyExplorerDiagnostics(
    rows: WorkspaceExplorerRow[],
    diagnosticsSnapshot: ReturnType<typeof useWorkspaceExplorerDiagnostics>
): WorkspaceExplorerRow[] {
    return rows.map(row => {
        if (row.type === 'mount') {
            const nextDiagnostics = diagnosticsSnapshot.mountSummary[row.mount.id];
            return nextDiagnostics ? { ...row, diagnostics: nextDiagnostics } : row;
        }

        const nextDiagnostics =
            diagnosticsSnapshot.byPath[
            normalizeWorkspaceExplorerDiagnosticPath(row.entry.path)
            ];
        return nextDiagnostics ? { ...row, diagnostics: nextDiagnostics } : row;
    });
}

function findParentEntryRow(
    rows: WorkspaceExplorerRow[],
    currentRow: WorkspaceEntryRow
): WorkspaceEntryRow | null {
    const currentIndex = rows.findIndex(row => row.key === currentRow.key);
    if (currentIndex <= 0) {
        return null;
    }

    for (let index = currentIndex - 1; index >= 0; index -= 1) {
        const candidate = rows[index];
        if (candidate?.type === 'entry' && candidate.depth < currentRow.depth) {
            return candidate;
        }
    }

    return null;
}

function StaticExplorerRows(args: {
    displayRows: ExplorerDisplayRow[];
    focusedRowKey: string | null;
    handleContextMenu: (e: React.MouseEvent, row: WorkspaceEntryRow) => void;
    handleEntrySelect: (entry: WorkspaceEntry, event?: React.MouseEvent) => void;
    handleInlineCancel: () => void;
    handleInlineSubmit: () => void;
    onOpenFile: (entry: WorkspaceEntry) => void;
    onRemoveMount: (mountId: string) => void;
    selectedEntries?: WorkspaceEntry[] | null;
    setRowRef: (rowKey: string, element: HTMLDivElement | null) => void;
    t: (key: string) => string;
    toggleMount: (row: WorkspaceMountRow) => void;
    toggleNode: (row: WorkspaceEntryRow) => void;
    workspaceId: string;
    handleMountContextMenu: (e: React.MouseEvent, mountId: string) => void;
}): React.ReactElement {
    return (
        <>
            {args.displayRows.map(row => {
                if (row.type === 'inline') {
                    return (
                        <WorkspaceExplorerInlineRow
                            key={row.key}
                            rowKey={row.key}
                            depth={row.depth}
                            draftName={row.draftName}
                            actionType={row.actionType}
                            placeholder={args.t('workspace.placeholders.name')}
                            isFocused={args.focusedRowKey === row.key}
                            setRowRef={args.setRowRef}
                            onDraftNameChange={value =>
                                setWorkspaceInlineDraftName(args.workspaceId, value)
                            }
                            onSubmit={args.handleInlineSubmit}
                            onCancel={args.handleInlineCancel}
                        />
                    );
                }

                const isSelected =
                    row.type === 'entry'
                        ? Boolean(
                            args.selectedEntries?.some(
                                entry =>
                                    entry.mountId === row.entry.mountId &&
                                    entry.path === row.entry.path
                            )
                        )
                        : false;

                return (
                    <WorkspaceExplorerRowView
                        key={row.key}
                        row={row}
                        isSelected={isSelected}
                        isFocused={args.focusedRowKey === row.key}
                        onOpenFile={args.onOpenFile}
                        onSelectEntry={args.handleEntrySelect}
                        onToggleMount={args.toggleMount}
                        onToggleNode={args.toggleNode}
                        onRemoveMount={args.onRemoveMount}
                        onMountContextMenu={args.handleMountContextMenu}
                        onEntryContextMenu={args.handleContextMenu}
                        setRowRef={args.setRowRef}
                    />
                );
            })}
        </>
    );
}

function VirtualizedExplorerRow({
    index,
    style,
    rows,
    selectedEntries,
    focusedRowKey,
    onOpenFile,
    onSelectEntry,
    onToggleMount,
    onToggleNode,
    onRemoveMount,
    onMountContextMenu,
    onEntryContextMenu,
    setRowRef,
    inlinePlaceholder,
    onInlineDraftNameChange,
    onInlineSubmit,
    onInlineCancel,
}: RowComponentProps<ExplorerRowProps>): React.ReactElement | null {
    const row = rows[index];
    if (!row) {
        return null;
    }

    if (row.type === 'inline') {
        return (
            <div style={style}>
                <WorkspaceExplorerInlineRow
                    rowKey={row.key}
                    depth={row.depth}
                    draftName={row.draftName}
                    actionType={row.actionType}
                    placeholder={inlinePlaceholder}
                    isFocused={focusedRowKey === row.key}
                    setRowRef={setRowRef}
                    onDraftNameChange={onInlineDraftNameChange}
                    onSubmit={onInlineSubmit}
                    onCancel={onInlineCancel}
                />
            </div>
        );
    }

    const isSelected =
        row.type === 'entry'
            ? Boolean(
                selectedEntries?.some(
                    entry => entry.mountId === row.entry.mountId && entry.path === row.entry.path
                )
            )
            : false;

    return (
        <div style={style}>
            <WorkspaceExplorerRowView
                row={row}
                isSelected={isSelected}
                isFocused={focusedRowKey === row.key}
                onOpenFile={onOpenFile}
                onSelectEntry={onSelectEntry}
                onToggleMount={onToggleMount}
                onToggleNode={onToggleNode}
                onRemoveMount={onRemoveMount}
                onMountContextMenu={onMountContextMenu}
                onEntryContextMenu={onEntryContextMenu}
                setRowRef={setRowRef}
            />
        </div>
    );
}

function useWorkspaceBulkActionControls(args: {
    bulkAction: WorkspaceBulkAction | null;
    onRequestBulkDelete?: (entries: WorkspaceEntry[]) => void;
    onSubmitBulkAction?: (
        type: 'rename' | 'move' | 'copy',
        entries: WorkspaceEntry[],
        draftValue: string
    ) => Promise<boolean>;
    selectedEntries?: WorkspaceEntry[] | null;
    workspaceId: string;
}) {
    const {
        bulkAction,
        onRequestBulkDelete,
        onSubmitBulkAction,
        selectedEntries,
        workspaceId,
    } = args;
    const canUsePathBulkAction = React.useMemo(
        () => canUseSharedTargetDirectory(selectedEntries ?? []),
        [selectedEntries]
    );

    React.useEffect(() => {
        if ((selectedEntries?.length ?? 0) > 1 || !bulkAction) {
            return;
        }
        clearWorkspaceBulkAction(workspaceId);
    }, [bulkAction, selectedEntries, workspaceId]);

    const handleBulkActionStart = React.useCallback(
        (type: 'rename' | 'move' | 'copy') => {
            startWorkspaceBulkAction(workspaceId, type);
        },
        [workspaceId]
    );
    const handleBulkActionCancel = React.useCallback(() => {
        clearWorkspaceBulkAction(workspaceId);
    }, [workspaceId]);
    const handleBulkActionSubmit = React.useCallback(() => {
        if (
            !bulkAction ||
            !onSubmitBulkAction ||
            !selectedEntries ||
            selectedEntries.length <= 1
        ) {
            return;
        }
        void onSubmitBulkAction(
            bulkAction.type,
            selectedEntries,
            bulkAction.draftValue
        ).then(success => {
            if (success) {
                clearWorkspaceBulkAction(workspaceId);
            }
        });
    }, [bulkAction, onSubmitBulkAction, selectedEntries, workspaceId]);
    const handleBulkDelete = React.useCallback(() => {
        if (!selectedEntries || selectedEntries.length <= 1) {
            return;
        }
        onRequestBulkDelete?.(selectedEntries);
    }, [onRequestBulkDelete, selectedEntries]);

    return {
        canUsePathBulkAction,
        handleBulkActionStart,
        handleBulkActionCancel,
        handleBulkActionSubmit,
        handleBulkDelete,
    };
}

function useWorkspaceInlineActionControls(args: {
    inlineAction: WorkspaceInlineAction | null;
    onCancelInlineAction?: () => void;
    onSubmitInlineAction?: (action: WorkspaceInlineAction) => Promise<boolean>;
    workspaceId: string;
}) {
    const {
        inlineAction,
        onCancelInlineAction,
        onSubmitInlineAction,
        workspaceId,
    } = args;
    const handleInlineSubmit = React.useCallback(() => {
        if (!inlineAction || !onSubmitInlineAction) {
            return;
        }

        void onSubmitInlineAction(inlineAction).then(success => {
            if (!success) {
                return;
            }
            setWorkspaceExplorerFocusedRowKey(
                workspaceId,
                inlineAction.type === 'rename'
                    ? `${inlineAction.entry.mountId}:${inlineAction.entry.path}`
                    : null
            );
        });
    }, [inlineAction, onSubmitInlineAction, workspaceId]);

    const handleInlineCancel = React.useCallback(() => {
        clearWorkspaceInlineAction(workspaceId);
        onCancelInlineAction?.();
    }, [onCancelInlineAction, workspaceId]);

    return {
        handleInlineSubmit,
        handleInlineCancel,
    };
}

export const WorkspaceExplorer: React.FC<WorkspaceExplorerProps> = ({
    workspaceId,
    mounts,
    refreshSignal,
    onOpenFile,
    onRemoveMount,
    selectedEntries,
    lastSelectedEntry,
    onSelectedEntriesChange,
    onLastSelectedEntryChange,
    onEnsureMount,
    onContextAction,
    onSubmitInlineAction,
    onCancelInlineAction,
    onSubmitBulkAction,
    onRequestBulkDelete,
    variant = 'panel',
    language,
    activeFilePath,
    workspacePath,
}) => {
    const { t } = useTranslation(language);
    const storageKey = React.useMemo(
        () => getWorkspaceExplorerStorageKey(workspaceId, mounts),
        [mounts, workspaceId]
    );
    const {
        contextMenu,
        visibleRows,
        toggleMount,
        toggleNode,
        revealPath,
        collapseAll,
        handleContextMenu,
        handleMountContextMenu,
        handleContextAction,
        closeContextMenu,
    } = useWorkspaceExplorerTree({
        workspaceId,
        mounts,
        refreshSignal,
        onEnsureMount,
        onContextAction,
        storageKey,
    });
    const [viewportHeight, setViewportHeight] = React.useState(() => window.innerHeight);
    const diagnosticsSnapshot = useWorkspaceExplorerDiagnostics({
        workspaceId,
        workspaceRootPath: workspacePath,
        mounts,
        refreshSignal,
    });
    const focusedRowKey = useWorkspaceExplorerStore(
        workspaceId,
        snapshot => snapshot.focusedRowKey
    );
    const filterQuery = useWorkspaceExplorerStore(
        workspaceId,
        snapshot => snapshot.filterQuery
    );
    const inlineAction = useWorkspaceExplorerStore(
        workspaceId,
        snapshot => snapshot.inlineAction
    );
    const bulkAction = useWorkspaceExplorerStore(
        workspaceId,
        snapshot => snapshot.bulkAction
    );
    const rowRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
    const listRef = React.useRef<ExplorerListRef | null>(null);
    const typeaheadStateRef = React.useRef({ query: '', timestamp: 0 });
    const syncedActiveFilePathRef = React.useRef<string | null>(null);
    const hasMounts = mounts.length > 0;
    const decoratedRows = React.useMemo(
        () => applyExplorerDiagnostics(visibleRows, diagnosticsSnapshot),
        [diagnosticsSnapshot, visibleRows]
    );
    const filteredRows = React.useMemo(
        () => applyExplorerFilter(decoratedRows, filterQuery),
        [decoratedRows, filterQuery]
    );
    const inlineRow = React.useMemo(
        () => buildInlineRow(inlineAction, filteredRows),
        [filteredRows, inlineAction]
    );
    const displayRows = React.useMemo(
        () => insertInlineRow(filteredRows, inlineRow, inlineAction),
        [filteredRows, inlineAction, inlineRow]
    );
    const entryRows = React.useMemo(
        () => displayRows.filter((row): row is WorkspaceEntryRow => row.type === 'entry'),
        [displayRows]
    );
    const shouldVirtualize = displayRows.length > EXPLORER_VIRTUALIZATION_THRESHOLD;
    const listHeight = React.useMemo(() => {
        const contentHeight = displayRows.length * EXPLORER_ROW_HEIGHT;
        const maxHeight =
            mounts.length <= 1
                ? Math.max(800, viewportHeight - 220)
                : EXPLORER_MULTI_MOUNT_MAX_HEIGHT;
        return Math.min(contentHeight, maxHeight);
    }, [displayRows.length, mounts.length, viewportHeight]);
    React.useEffect(() => {
        const handleResize = () => setViewportHeight(window.innerHeight);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    React.useEffect(() => {
        const primary = selectedEntries?.[selectedEntries.length - 1];
        if (!primary) {
            return;
        }
        const nextFocusKey = `${primary.mountId}:${primary.path}`;
        setWorkspaceExplorerFocusedRowKey(workspaceId, nextFocusKey);
        window.requestAnimationFrame(() => {
            rowRefs.current[nextFocusKey]?.focus();
        });
    }, [selectedEntries, workspaceId]);
    useSyncedActiveFilePathReset(activeFilePath, syncedActiveFilePathRef);
    const {
        canUsePathBulkAction,
        handleBulkActionStart,
        handleBulkActionCancel,
        handleBulkActionSubmit,
        handleBulkDelete,
    } = useWorkspaceBulkActionControls({
        bulkAction,
        onRequestBulkDelete,
        onSubmitBulkAction,
        selectedEntries,
        workspaceId,
    });
    const {
        handleInlineSubmit,
        handleInlineCancel,
    } = useWorkspaceInlineActionControls({
        inlineAction,
        onCancelInlineAction,
        onSubmitInlineAction,
        workspaceId,
    });
    const setRowRef = React.useCallback((rowKey: string, element: HTMLDivElement | null) => {
        rowRefs.current[rowKey] = element;
    }, []);
    const focusRowKey = React.useCallback(
        (rowKey: string) => {
            setWorkspaceExplorerFocusedRowKey(workspaceId, rowKey);
            const rowIndex = displayRows.findIndex(row => row.key === rowKey);
            if (rowIndex >= 0) {
                listRef.current?.scrollToRow({
                    index: rowIndex,
                    align: 'smart',
                    behavior: 'auto',
                });
            }
            window.requestAnimationFrame(() => {
                rowRefs.current[rowKey]?.focus();
            });
        },
        [displayRows, workspaceId]
    );

    const findEntryRow = React.useCallback(
        (entry: WorkspaceEntry): WorkspaceEntryRow | null =>
            entryRows.find(row => row.key === getWorkspaceEntryKey(entry)) ?? null,
        [entryRows]
    );

    const updateSelection = React.useCallback(
        (
            row: WorkspaceEntryRow,
            mode: 'replace' | 'range' | 'toggle'
        ) => {
            focusRowKey(row.key);
            if (!onSelectedEntriesChange) {
                return;
            }

            const currentSelection = selectedEntries ?? [];
            if (mode === 'toggle') {
                onSelectedEntriesChange(
                    toggleWorkspaceEntrySelection(currentSelection, row.entry)
                );
                onLastSelectedEntryChange?.(row.entry);
                return;
            }

            if (mode === 'range') {
                const anchorEntry = lastSelectedEntry ?? currentSelection.at(-1) ?? row.entry;
                const range = getWorkspaceEntryRange(entryRows, anchorEntry, row.entry);
                onSelectedEntriesChange(range);
                onLastSelectedEntryChange?.(range.length > 1 ? anchorEntry : row.entry);
                return;
            }

            onSelectedEntriesChange([row.entry]);
            onLastSelectedEntryChange?.(row.entry);
        },
        [
            entryRows,
            focusRowKey,
            lastSelectedEntry,
            onLastSelectedEntryChange,
            onSelectedEntriesChange,
            selectedEntries,
        ]
    );
    const handleEntrySelect = React.useCallback(
        (entry: WorkspaceEntry, event?: React.MouseEvent) => {
            const row = findEntryRow(entry);
            if (!row) {
                return;
            }

            if (event?.shiftKey) {
                updateSelection(row, 'range');
                return;
            }

            if (event && (event.ctrlKey || event.metaKey)) {
                updateSelection(row, 'toggle');
                return;
            }

            updateSelection(row, 'replace');
        },
        [findEntryRow, updateSelection]
    );

    const triggerHeaderCreateAction = React.useCallback(
        (type: 'createFile' | 'createFolder') => {
            if (mounts.length === 0) {
                return;
            }

            const selectedEntry = selectedEntries?.[selectedEntries.length - 1];
            if (selectedEntry?.isDirectory) {
                const selectedRow = entryRows.find(
                    row => row.key === `${selectedEntry.mountId}:${selectedEntry.path}`
                );
                if (selectedRow && !selectedRow.expanded) {
                    toggleNode(selectedRow);
                }
            }
            const selectedMount = selectedEntry
                ? mounts.find(mount => mount.id === selectedEntry.mountId)
                : null;
            const mount = selectedMount ?? mounts[0];
            if (!mount) {
                return;
            }

            const targetDirectoryPath = (() => {
                if (!selectedEntry) {
                    return mount.rootPath;
                }
                if (selectedEntry.isDirectory) {
                    return selectedEntry.path;
                }
                const parentDirectoryPath = getEntryParentDirectoryPath(selectedEntry.path);
                return parentDirectoryPath || mount.rootPath;
            })();

            onContextAction?.({
                type,
                entry: {
                    mountId: mount.id,
                    path: targetDirectoryPath,
                    name: '',
                    isDirectory: true,
                },
            });
        },
        [entryRows, mounts, onContextAction, selectedEntries, toggleNode]
    );

    React.useEffect(() => {
        if (!activeFilePath) {
            return;
        }
        if (syncedActiveFilePathRef.current === activeFilePath) {
            return;
        }
        void revealPath(activeFilePath).then(revealedKey => {
            if (!revealedKey) {
                return;
            }
            setWorkspaceExplorerFocusedRowKey(workspaceId, revealedKey);
            const revealedRow = entryRows.find(row => row.key === revealedKey);
            if (!revealedRow && filterQuery.trim()) {
                setWorkspaceExplorerFilterQuery(workspaceId, '');
                return;
            }
            if (!revealedRow) {
                return;
            }
            syncedActiveFilePathRef.current = activeFilePath;
            onSelectedEntriesChange?.([revealedRow.entry]);
            onLastSelectedEntryChange?.(revealedRow.entry);
            focusRowKey(revealedKey);
        });
    }, [
        activeFilePath,
        entryRows,
        filterQuery,
        focusRowKey,
        onLastSelectedEntryChange,
        onSelectedEntriesChange,
        revealPath,
        workspaceId,
    ]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (
            target &&
            (target.tagName === 'INPUT'
                || target.tagName === 'TEXTAREA'
                || target.isContentEditable)
        ) {
            return;
        }

        if (entryRows.length === 0) {
            return;
        }

        const primary = selectedEntries?.[selectedEntries.length - 1];
        const activeRowKey = primary ? `${primary.mountId}:${primary.path}` : focusedRowKey;
        const currentIndex = entryRows.findIndex(row => row.key === activeRowKey);
        const selectedRow = currentIndex >= 0 ? entryRows[currentIndex] : entryRows[0];
        if (!selectedRow) {
            return;
        }

        if (e.key === 'Escape') {
            if (filterQuery.trim()) {
                e.preventDefault();
                setWorkspaceExplorerFilterQuery(workspaceId, '');
            }
            return;
        }

        if (e.key === 'F2') {
            e.preventDefault();
            onContextAction?.({ type: 'rename', entry: selectedRow.entry });
            return;
        }

        if (e.key === 'Delete') {
            e.preventDefault();
            onContextAction?.({ type: 'delete', entry: selectedRow.entry });
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedRow.entry.isDirectory) {
                toggleNode(selectedRow);
                return;
            }
            onOpenFile(selectedRow.entry);
            return;
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
            const nextIndex = e.key === 'ArrowDown' ? fallbackIndex + 1 : fallbackIndex - 1;
            const nextRow = entryRows[nextIndex];
            if (nextRow) {
                updateSelection(nextRow, e.shiftKey ? 'range' : 'replace');
            }
            return;
        }

        if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            const nextRow = e.key === 'Home' ? entryRows[0] : entryRows.at(-1);
            if (nextRow) {
                updateSelection(nextRow, e.shiftKey ? 'range' : 'replace');
            }
            return;
        }

        if (e.key === 'ArrowRight' && selectedRow.entry.isDirectory) {
            e.preventDefault();
            if (!selectedRow.expanded) {
                toggleNode(selectedRow);
                return;
            }
            const currentVisibleIndex = displayRows.findIndex(row => row.key === selectedRow.key);
            const nextVisibleRow = displayRows[currentVisibleIndex + 1];
            if (nextVisibleRow?.type === 'entry') {
                updateSelection(nextVisibleRow, e.shiftKey ? 'range' : 'replace');
            }
            return;
        }

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (selectedRow.entry.isDirectory && selectedRow.expanded) {
                toggleNode(selectedRow);
                return;
            }
            const parentRow = findParentEntryRow(displayRows.filter((row): row is WorkspaceExplorerRow => row.type !== 'inline'), selectedRow);
            if (parentRow) {
                updateSelection(parentRow, e.shiftKey ? 'range' : 'replace');
            }
            return;
        }

        if (e.key.length === 1 && e.key.trim() && !e.altKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            const currentTimestamp = Date.now();
            const shouldResetBuffer = currentTimestamp - typeaheadStateRef.current.timestamp > 700;
            const nextQuery = `${shouldResetBuffer ? '' : typeaheadStateRef.current.query}${e.key}`;
            typeaheadStateRef.current = {
                query: nextQuery,
                timestamp: currentTimestamp,
            };

            const match = findTypeToSelectMatch(entryRows, nextQuery, selectedRow.entry);
            if (match) {
                updateSelection(match, 'replace');
            }
        }
    };

    const rowProps = React.useMemo<ExplorerRowProps>(
        () => ({
            rows: displayRows,
            selectedEntries,
            focusedRowKey,
            onOpenFile,
            onSelectEntry: handleEntrySelect,
            onToggleMount: toggleMount,
            onToggleNode: toggleNode,
            onRemoveMount,
            onMountContextMenu: handleMountContextMenu,
            onEntryContextMenu: handleContextMenu,
            setRowRef,
            inlinePlaceholder: t('workspace.placeholders.name'),
            onInlineDraftNameChange: value => setWorkspaceInlineDraftName(workspaceId, value),
            onInlineSubmit: handleInlineSubmit,
            onInlineCancel: handleInlineCancel,
        }),
        [
            displayRows,
            focusedRowKey,
            handleInlineCancel,
            handleInlineSubmit,
            handleContextMenu,
            handleMountContextMenu,
            handleEntrySelect,
            onOpenFile,
            onRemoveMount,
            selectedEntries,
            setRowRef,
            t,
            toggleMount,
            toggleNode,
            workspaceId,
        ]
    );

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
                    'p-2 pb-1.5 flex items-center justify-between',
                    variant === 'panel'
                        ? 'bg-transparent'
                        : 'bg-transparent'
                )}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <span className="typo-overline font-bold uppercase text-muted-foreground/50 truncate pl-1">
                        {t('workspace.files')}
                    </span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                    <button
                        onClick={() => {
                            triggerHeaderCreateAction('createFile');
                        }}
                        className="p-1 hover:bg-muted/40 rounded transition-colors"
                        title={t('workspace.explorer.newFile')}
                    >
                        <IconFilePlus className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-foreground" />
                    </button>
                    <button
                        onClick={() => {
                            triggerHeaderCreateAction('createFolder');
                        }}
                        className="p-1 hover:bg-muted/40 rounded transition-colors"
                        title={t('workspace.explorer.newFolder')}
                    >
                        <IconFolderPlus className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-foreground" />
                    </button>
                    <button
                        onClick={() => {
                            // TODO: Implement refresh if needed, usually handled by file watchers
                        }}
                        className="p-1 hover:bg-muted/40 rounded transition-colors"
                        title={t('common.refresh')}
                    >
                        <IconRefresh className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-foreground" />
                    </button>
                    <button
                        onClick={collapseAll}
                        className="p-1 hover:bg-muted/40 rounded transition-colors"
                        title={t('workspace.explorer.collapseAll')}
                    >
                        <IconMinimize className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-foreground" />
                    </button>
                </div>
            </div>
            <div className="px-2 pb-2">
                <label className="relative flex items-center">
                    <IconSearch className="pointer-events-none absolute left-2 h-3 w-3 text-muted-foreground/30" />
                    <input
                        type="text"
                        value={filterQuery}
                        onChange={event =>
                            setWorkspaceExplorerFilterQuery(workspaceId, event.target.value)
                        }
                        placeholder={t('common.search')}
                        className={C_WORKSPACEEXPLORER_1}
                    />
                </label>
            </div>
            <WorkspaceExplorerBulkActions
                bulkAction={bulkAction}
                canUsePathAction={canUsePathBulkAction}
                selectedEntries={selectedEntries ?? []}
                onStartAction={handleBulkActionStart}
                onDraftValueChange={value =>
                    setWorkspaceBulkActionDraftValue(workspaceId, value)
                }
                onSubmit={handleBulkActionSubmit}
                onCancel={handleBulkActionCancel}
                onDelete={handleBulkDelete}
                t={t}
            />

            {!hasMounts && <WorkspaceExplorerEmptyState label={t('workspace.noMounts')} />}

            <div
                className={cn(
                    'flex-1 space-y-0 scrollbar-thin scrollbar-thumb-muted-foreground/10 scrollbar-track-transparent',
                    shouldVirtualize ? 'overflow-hidden' : 'overflow-y-auto'
                )}
            >
                {shouldVirtualize ? (
                    <List
                        listRef={listRef}
                        style={{ height: listHeight }}
                        rowCount={displayRows.length}
                        rowHeight={EXPLORER_ROW_HEIGHT}
                        rowComponent={VirtualizedExplorerRow}
                        rowProps={rowProps}
                        overscanCount={6}
                    />
                ) : (
                    <StaticExplorerRows
                        displayRows={displayRows}
                        focusedRowKey={focusedRowKey}
                        handleContextMenu={handleContextMenu}
                        handleEntrySelect={handleEntrySelect}
                        handleInlineCancel={handleInlineCancel}
                        handleInlineSubmit={handleInlineSubmit}
                        handleMountContextMenu={handleMountContextMenu}
                        onOpenFile={onOpenFile}
                        onRemoveMount={onRemoveMount}
                        selectedEntries={selectedEntries}
                        setRowRef={setRowRef}
                        t={t}
                        toggleMount={toggleMount}
                        toggleNode={toggleNode}
                        workspaceId={workspaceId}
                    />
                )}
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
