/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { WorkspaceEntryRow } from '@/features/workspace/hooks/useWorkspaceExplorerTree';
import { WorkspaceEntry } from '@/types';

export function getWorkspaceEntryKey(entry: WorkspaceEntry): string {
    return `${entry.mountId}:${entry.path}`;
}

export function isSameWorkspaceEntry(left: WorkspaceEntry, right: WorkspaceEntry): boolean {
    return left.mountId === right.mountId && left.path === right.path;
}

function getEntryRowIndex(rows: WorkspaceEntryRow[], entry: WorkspaceEntry): number {
    const entryKey = getWorkspaceEntryKey(entry);
    return rows.findIndex(row => row.key === entryKey);
}

export function getWorkspaceEntryRange(
    rows: WorkspaceEntryRow[],
    anchorEntry: WorkspaceEntry,
    targetEntry: WorkspaceEntry
): WorkspaceEntry[] {
    if (anchorEntry.mountId !== targetEntry.mountId) {
        return [targetEntry];
    }

    const anchorIndex = getEntryRowIndex(rows, anchorEntry);
    const targetIndex = getEntryRowIndex(rows, targetEntry);
    if (anchorIndex < 0 || targetIndex < 0) {
        return [targetEntry];
    }

    const startIndex = Math.min(anchorIndex, targetIndex);
    const endIndex = Math.max(anchorIndex, targetIndex);
    return rows.slice(startIndex, endIndex + 1).map(row => row.entry);
}

export function toggleWorkspaceEntrySelection(
    selectedEntries: WorkspaceEntry[],
    entry: WorkspaceEntry
): WorkspaceEntry[] {
    const exists = selectedEntries.some(selectedEntry => isSameWorkspaceEntry(selectedEntry, entry));
    if (!exists) {
        return [...selectedEntries, entry];
    }

    return selectedEntries.filter(selectedEntry => !isSameWorkspaceEntry(selectedEntry, entry));
}

function getWrappedRows(rows: WorkspaceEntryRow[], startIndex: number): WorkspaceEntryRow[] {
    if (rows.length === 0) {
        return [];
    }

    if (startIndex < 0 || startIndex >= rows.length - 1) {
        return rows;
    }

    return [...rows.slice(startIndex + 1), ...rows.slice(0, startIndex + 1)];
}

function findMatchByName(
    rows: WorkspaceEntryRow[],
    query: string,
    matcher: (name: string, value: string) => boolean
): WorkspaceEntryRow | null {
    for (const row of rows) {
        if (matcher(row.entry.name.toLowerCase(), query)) {
            return row;
        }
    }
    return null;
}

export function findTypeToSelectMatch(
    rows: WorkspaceEntryRow[],
    query: string,
    activeEntry: WorkspaceEntry | null
): WorkspaceEntryRow | null {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return null;
    }

    const startIndex = activeEntry ? getEntryRowIndex(rows, activeEntry) : -1;
    const orderedRows = getWrappedRows(rows, startIndex);
    const prefixMatch = findMatchByName(
        orderedRows,
        normalizedQuery,
        (name, value) => name.startsWith(value)
    );
    if (prefixMatch) {
        return prefixMatch;
    }

    return findMatchByName(
        orderedRows,
        normalizedQuery,
        (name, value) => name.includes(value)
    );
}

