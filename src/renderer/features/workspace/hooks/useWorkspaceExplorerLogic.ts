/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import {
    clearWorkspaceBulkAction,
    clearWorkspaceInlineAction,
    setWorkspaceExplorerFilterQuery,
    setWorkspaceExplorerFocusedRowKey,
    startWorkspaceBulkAction,
    type WorkspaceBulkAction,
    type WorkspaceInlineAction,
} from '@/store/workspace-explorer.store';
import type { WorkspaceEntry } from '@/types';

import type { WorkspaceEntryRow, WorkspaceExplorerRow } from '../hooks/useWorkspaceExplorerTree';
import { canUseSharedTargetDirectory } from '../utils/workspace-bulk-actions'; 
import { findParentEntryRow, findTypeToSelectMatch } from '../utils/workspace-explorer.util';

export function useWorkspaceBulkActionControls(args: {
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

export function useWorkspaceInlineActionControls(args: {
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

interface WorkspaceExplorerKeyboardOptions {
    workspaceId: string;
    entryRows: WorkspaceEntryRow[];
    effectiveDisplayRows: WorkspaceExplorerRow[];
    selectedEntries: WorkspaceEntry[] | null;
    focusedRowKey: string | null;
    filterQuery: string;
    onContextAction?: (action: { type: string; entry: WorkspaceEntry }) => void;
    toggleNode: (row: WorkspaceEntryRow) => void;
    onOpenFile: (entry: WorkspaceEntry) => void;
    updateSelection: (row: WorkspaceEntryRow, mode: 'replace' | 'range' | 'toggle') => void;
}

export function useWorkspaceExplorerKeyboard({
    workspaceId,
    entryRows,
    effectiveDisplayRows,
    selectedEntries,
    focusedRowKey,
    filterQuery,
    onContextAction,
    toggleNode,
    onOpenFile,
    updateSelection,
}: WorkspaceExplorerKeyboardOptions) {
    const typeaheadStateRef = React.useRef({ query: '', timestamp: 0 });

    const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
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
            const currentVisibleIndex = effectiveDisplayRows.findIndex(row => row.key === selectedRow.key);
            const nextVisibleRow = effectiveDisplayRows[currentVisibleIndex + 1];
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
            const parentRow = findParentEntryRow(effectiveDisplayRows.filter((row): row is WorkspaceExplorerRow => row.type === 'entry' || row.type === 'mount'), selectedRow);
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
    }, [entryRows, selectedEntries, focusedRowKey, filterQuery, workspaceId, onContextAction, toggleNode, onOpenFile, updateSelection, effectiveDisplayRows]);

    return { handleKeyDown };
}
