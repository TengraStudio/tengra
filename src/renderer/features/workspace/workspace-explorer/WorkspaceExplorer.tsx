/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    IconArrowLeft,
    IconFilePlus,
    IconFilter,
    IconFolderPlus,
    IconPlus,
    IconRefresh,
    IconSearch,
    IconX,
} from '@tabler/icons-react';
import React from 'react';
import { List, ListRowProps as RowComponentProps } from 'react-virtualized';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import {
    clearWorkspaceExplorerFilterQuery,
    setWorkspaceExplorerFilterQuery,
    setWorkspaceExplorerFocusedRowKey,
    setWorkspaceInlineDraftName,
    useWorkspaceExplorerStore,
} from '@/store/workspace-explorer.store';
import {
    WorkspaceEntry,
    WorkspaceExplorerProps,
    WorkspaceMount,
} from '@/types';

import { useWorkspaceExplorerDiagnostics } from '../hooks/useWorkspaceExplorerDiagnostics';
import { useWorkspaceExplorerFallback } from '../hooks/useWorkspaceExplorerFallback';
import {
    useWorkspaceBulkActionControls,
    useWorkspaceExplorerKeyboard,
    useWorkspaceInlineActionControls,
} from '../hooks/useWorkspaceExplorerLogic';
import { 
    useWorkspaceExplorerTree,
    type WorkspaceEntryRow,
    type WorkspaceExplorerRow,
    type WorkspaceMountRow,
} from '../hooks/useWorkspaceExplorerTree';
import {
    applyExplorerDiagnostics,
    applyExplorerFilter,
    buildInlineRow,
    EXPLORER_MULTI_MOUNT_MAX_HEIGHT,
    EXPLORER_ROW_HEIGHT,
    EXPLORER_VIRTUALIZATION_THRESHOLD,
    type ExplorerDisplayRow,
    getEntryParentDirectoryPath,
    getWorkspaceEntryKey,
    getWorkspaceEntryRange,
    getWorkspaceExplorerStorageKey,
    insertInlineRow,
    toggleWorkspaceEntrySelection,
} from '../utils/workspace-explorer.util';

import { WorkspaceExplorerInlineRow } from './WorkspaceExplorerInlineRow';
import { WorkspaceExplorerRowView } from './WorkspaceExplorerRow';

type ExplorerListRef = List;

interface ExplorerRowProps {
    rows: ExplorerDisplayRow[];
    selectedEntries?: WorkspaceEntry[] | null;
    focusedRowKey: string | null;
    onOpenFile: (entry: WorkspaceEntry) => void;
    onSelectEntry: (entry: WorkspaceEntry, e?: React.MouseEvent) => void;
    onToggleMount: (mountRow: WorkspaceMountRow) => void;
    onToggleNode: (entryRow: WorkspaceEntryRow) => void;
    onRemoveMount: (mountId: string) => void;
    onMountContextMenu: (e: React.MouseEvent, mountId: string) => void;
    onEntryContextMenu: (e: React.MouseEvent, row: WorkspaceEntryRow) => void;
    setRowRef: (rowKey: string, element: HTMLDivElement | null) => void;
    inlinePlaceholder: string;
    onInlineDraftNameChange: (value: string) => void;
    onInlineSubmit: () => void;
    onInlineCancel: () => void;
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
                            placeholder={args.t('frontend.workspace.placeholders.name')}
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
}: RowComponentProps & ExplorerRowProps): React.ReactElement | null {
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
                    (entry: WorkspaceEntry) => entry.mountId === row.entry.mountId && entry.path === row.entry.path
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

function useSyncedActiveFilePathReset(
    activeFilePath: string | undefined,
    syncedActiveFilePathRef: React.MutableRefObject<string | null>
) {
    React.useEffect(() => {
        if (!activeFilePath) {
            syncedActiveFilePathRef.current = null;
        }
    }, [activeFilePath, syncedActiveFilePathRef]);
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
        visibleRows,
        loadingMounts,
        toggleMount,
        toggleNode,
        revealPath,
        collapseAll,
        reloadAll,
        handleContextMenu,
        handleMountContextMenu,
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
    const focusedRowKey = useWorkspaceExplorerStore(workspaceId, snapshot => snapshot.focusedRowKey);
    const filterQuery = useWorkspaceExplorerStore(workspaceId, snapshot => snapshot.filterQuery);
    const inlineAction = useWorkspaceExplorerStore(workspaceId, snapshot => snapshot.inlineAction);
    const bulkAction = useWorkspaceExplorerStore(workspaceId, snapshot => snapshot.bulkAction);
    const rowRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
    const listRef = React.useRef<ExplorerListRef>(null);
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
    const isAnyMountLoading = mounts.some(mount => Boolean(loadingMounts[mount.id]));
    const { fallbackRows, fallbackLoading } = useWorkspaceExplorerFallback({
        mounts,
        hasMounts,
        isAnyMountLoading,
        filterQuery,
        displayRowsCount: displayRows.length,
        onEnsureMount,
    });
    const effectiveDisplayRows = React.useMemo<ExplorerDisplayRow[]>(
        () => (displayRows.length > 0 ? displayRows : fallbackRows),
        [displayRows, fallbackRows]
    );
    const entryRows = React.useMemo(
        () => effectiveDisplayRows.filter((row): row is WorkspaceEntryRow => row.type === 'entry'),
        [effectiveDisplayRows]
    );
    const shouldVirtualize = effectiveDisplayRows.length > EXPLORER_VIRTUALIZATION_THRESHOLD;
    const isExplorerBlank = hasMounts && effectiveDisplayRows.length === 0 && !isAnyMountLoading && !fallbackLoading;
    const listHeight = React.useMemo(() => {
        const contentHeight = effectiveDisplayRows.length * EXPLORER_ROW_HEIGHT;
        const maxHeight =
            mounts.length <= 1
                ? Math.max(800, viewportHeight - 220)
                : EXPLORER_MULTI_MOUNT_MAX_HEIGHT;
        return Math.min(contentHeight, maxHeight);
    }, [effectiveDisplayRows.length, mounts.length, viewportHeight]);

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
        handleBulkActionCancel,
        handleBulkActionSubmit,
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
            const rowIndex = effectiveDisplayRows.findIndex(row => row.key === rowKey);
            if (rowIndex >= 0) {
                listRef.current?.scrollToRow(rowIndex);
            }
            window.requestAnimationFrame(() => {
                rowRefs.current[rowKey]?.focus();
            });
        },
        [effectiveDisplayRows, workspaceId]
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

    const { handleKeyDown } = useWorkspaceExplorerKeyboard({
        workspaceId,
        entryRows,
        effectiveDisplayRows: effectiveDisplayRows.filter((row): row is WorkspaceExplorerRow => row.type !== 'inline'),
        selectedEntries: selectedEntries ?? null,
        focusedRowKey,
        filterQuery,
        onContextAction,
        toggleNode,
        onOpenFile,
        updateSelection,
    });

    const handleEntrySelect = React.useCallback(
        (entry: WorkspaceEntry, event?: React.MouseEvent) => {
            const row = entryRows.find(r => r.key === getWorkspaceEntryKey(entry));
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
        [entryRows, updateSelection]
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
                ? mounts.find((mount: WorkspaceMount) => mount.id === selectedEntry.mountId)
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

    return (
        <div
            className={cn(
                'flex h-full flex-col bg-background select-none outline-none',
                variant === 'panel' ? 'border-r border-border/30' : 'rounded-3xl border border-border/40 shadow-2xl'
            )}
            tabIndex={0}
            onKeyDown={handleKeyDown}
        >
            <div className="flex shrink-0 items-center justify-between gap-1 px-3 py-2 border-b border-border/10">
                <div className="flex items-center gap-2">
                    <span className="typo-overline text-muted-foreground/75 tracking-wider uppercase">
                        {t('frontend.workspace.explorer')}
                    </span>
                    {isAnyMountLoading && (
                        <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
                    )}
                </div>
                <div className="flex items-center gap-0.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md hover:bg-muted/70"
                        onClick={() => triggerHeaderCreateAction('createFile')}
                        title={t('frontend.workspace.createFile')}
                    >
                        <IconFilePlus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md hover:bg-muted/70"
                        onClick={() => triggerHeaderCreateAction('createFolder')}
                        title={t('frontend.workspace.createFolder')}
                    >
                        <IconFolderPlus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md hover:bg-muted/70"
                        onClick={reloadAll}
                        title={t('frontend.workspace.refresh')}
                    >
                        <IconRefresh className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md hover:bg-muted/70"
                        onClick={collapseAll}
                        title={t('frontend.workspace.collapseAll')}
                    >
                        <IconArrowLeft className="h-3.5 w-3.5 rotate-90" />
                    </Button>
                </div>
            </div>

            <div className="shrink-0 p-2">
                <div className="relative group">
                    <IconFilter className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary/60 transition-colors" />
                    <Input
                        value={filterQuery}
                        onChange={e => setWorkspaceExplorerFilterQuery(workspaceId, e.target.value)}
                        placeholder={t('frontend.workspace.placeholders.filter')}
                        className="h-8 pl-8 pr-8 rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-primary/20 transition-all text-xs"
                    />
                    {filterQuery && (
                        <button
                            type="button"
                            onClick={() => clearWorkspaceExplorerFilterQuery(workspaceId)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-sm hover:bg-muted/60 text-muted-foreground/50 hover:text-foreground transition-colors"
                        >
                            <IconX className="h-3 w-3" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
                {isExplorerBlank ? (
                    <div className="flex flex-col items-center justify-center h-48 px-6 text-center">
                        <div className="p-3 rounded-2xl bg-muted/30 mb-3">
                            <IconSearch className="h-6 w-6 text-muted-foreground/30" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground/70">{t('frontend.workspace.noFilesFound')}</p>
                        <p className="text-xs text-muted-foreground/40 mt-1">{t('frontend.workspace.noFilesFoundSub')}</p>
                    </div>
                ) : (
                    shouldVirtualize ? (
                                    <List
                            ref={listRef as unknown as React.Ref<List>}
                            width={280}
                            height={listHeight}
                                        rowCount={effectiveDisplayRows.length}
                                        rowHeight={EXPLORER_ROW_HEIGHT}
                            rowRenderer={props => (
                                            <VirtualizedExplorerRow
                                                {...props}
                                                rows={effectiveDisplayRows}
                                                selectedEntries={selectedEntries}
                                                focusedRowKey={focusedRowKey}
                                                onOpenFile={onOpenFile}
                                                onSelectEntry={handleEntrySelect}
                                                onToggleMount={toggleMount}
                                                onToggleNode={toggleNode}
                                                onRemoveMount={onRemoveMount}
                                                onMountContextMenu={handleMountContextMenu}
                                                onEntryContextMenu={handleContextMenu}
                                                setRowRef={setRowRef}
                                                inlinePlaceholder={t('frontend.workspace.placeholders.name')}
                                                onInlineDraftNameChange={(value: string) => setWorkspaceInlineDraftName(workspaceId, value)}
                                                onInlineSubmit={handleInlineSubmit}
                                                onInlineCancel={handleInlineCancel}
                                            />
                                        )}
                                        className="outline-none"
                                    />
                    ) : (
                        <div className="flex flex-col">
                            <StaticExplorerRows
                                workspaceId={workspaceId}
                                displayRows={effectiveDisplayRows}
                                selectedEntries={selectedEntries}
                                focusedRowKey={focusedRowKey}
                                onOpenFile={onOpenFile}
                                handleEntrySelect={handleEntrySelect}
                                toggleMount={toggleMount}
                                toggleNode={toggleNode}
                                onRemoveMount={onRemoveMount}
                                handleMountContextMenu={handleMountContextMenu}
                                handleContextMenu={handleContextMenu}
                                setRowRef={setRowRef}
                                handleInlineSubmit={handleInlineSubmit}
                                handleInlineCancel={handleInlineCancel}
                                t={t}
                            />
                        </div>
                    )
                )}

                {fallbackLoading && (
                    <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground/60 italic">
                        <div className="animate-spin h-3 w-3 border-2 border-muted-foreground/20 border-t-muted-foreground/60 rounded-full" />
                        {t('frontend.workspace.loading')}
                    </div>
                )}
            </div>

            {bulkAction && (
                <div className="shrink-0 p-3 bg-muted/20 border-t border-border/10">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="typo-overline text-primary/70">
                                {bulkAction.type === 'rename'
                                    ? t('frontend.workspace.bulkActions.rename')
                                    : bulkAction.type === 'move'
                                        ? t('frontend.workspace.bulkActions.move')
                                        : t('frontend.workspace.bulkActions.copy')}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                {selectedEntries?.length ?? 0}
                            </span>
                        </div>
                        <div className="flex gap-1.5">
                            <Input
                                value={bulkAction.draftValue}
                                onChange={e => setWorkspaceInlineDraftName(workspaceId, e.target.value)}
                                placeholder={t('frontend.workspace.placeholders.name')}
                                className="h-8 text-xs bg-background"
                                autoFocus
                            />
                            <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleBulkActionSubmit}>
                                <IconPlus className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBulkActionCancel}>
                                <IconX className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
