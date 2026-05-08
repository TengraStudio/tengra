/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @fileoverview Consolidated workspace explorer utility barrel.
 * Re-exports from specialised modules and provides additional helpers
 * used by WorkspaceExplorer.tsx, useWorkspaceExplorerLogic.ts, and
 * useWorkspaceExplorerFallback.ts.
 */

import type { WorkspaceExplorerDiagnosticsSnapshot } from '@/features/workspace/utils/workspace-explorer-diagnostics';
import { normalizeWorkspaceExplorerDiagnosticPath } from '@/features/workspace/utils/workspace-explorer-diagnostics';
import type { WorkspaceInlineAction } from '@/store/workspace-explorer.store';
import type { WorkspaceMount } from '@/types';

import type {
    WorkspaceEntryRow,
    WorkspaceExplorerRow,
    WorkspaceMountRow,
} from '../hooks/useWorkspaceExplorerTree';

/* ------------------------------------------------------------------ */
/*  Re-exports from workspace-explorer-navigation                     */
/* ------------------------------------------------------------------ */
export {
    findTypeToSelectMatch,
    getWorkspaceEntryKey,
    getWorkspaceEntryRange,
    toggleWorkspaceEntrySelection,
} from './workspace-explorer-navigation';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Height (in px) of a single explorer row. */
export const EXPLORER_ROW_HEIGHT = 22;

/** Threshold above which virtualised rendering kicks in. */
export const EXPLORER_VIRTUALIZATION_THRESHOLD = 200;

/** Max height (px) of the list when multiple mounts are open. */
export const EXPLORER_MULTI_MOUNT_MAX_HEIGHT = 500;

/* ------------------------------------------------------------------ */
/*  Storage helpers                                                    */
/* ------------------------------------------------------------------ */

export function getWorkspaceExplorerStorageKey(
    workspaceId: string,
    mounts: WorkspaceMount[]
): string {
    const mountSuffix = mounts
        .map(mount => `${mount.id}:${mount.type}:${mount.rootPath}`)
        .sort()
        .join('|');
    return `workspace.explorer.v1:${workspaceId}:${mountSuffix}`;
}

/* ------------------------------------------------------------------ */
/*  Path helpers                                                       */
/* ------------------------------------------------------------------ */

export function getEntryParentDirectoryPath(entryPath: string): string {
    const normalised = entryPath.replace(/\\/g, '/');
    const lastSeparator = normalised.lastIndexOf('/');
    if (lastSeparator <= 0) {
        return '';
    }
    return entryPath.substring(0, lastSeparator);
}

/* ------------------------------------------------------------------ */
/*  Inline row types and builder                                       */
/* ------------------------------------------------------------------ */

export interface ExplorerInlineRow {
    type: 'inline';
    key: string;
    depth: number;
    draftName: string;
    actionType: 'rename' | 'createFile' | 'createFolder';
}

export type ExplorerDisplayRow = WorkspaceExplorerRow | ExplorerInlineRow;

export function buildInlineRow(
    inlineAction: WorkspaceInlineAction | null,
    _rows: WorkspaceExplorerRow[]
): ExplorerInlineRow | null {
    if (!inlineAction) {
        return null;
    }

    const parentKey = `${inlineAction.entry.mountId}:${inlineAction.entry.path}`;
    const parentRow = _rows.find(row => row.key === parentKey);
    const depth = parentRow?.type === 'entry' ? parentRow.depth + 1 : 0;

    return {
        type: 'inline',
        key: `inline:${inlineAction.entry.mountId}:${inlineAction.entry.path}`,
        depth,
        draftName: inlineAction.draftName,
        actionType: inlineAction.type,
    };
}

export function insertInlineRow(
    rows: WorkspaceExplorerRow[],
    inlineRow: ExplorerInlineRow | null,
    inlineAction: WorkspaceInlineAction | null
): ExplorerDisplayRow[] {
    if (!inlineRow || !inlineAction) {
        return rows;
    }

    if (inlineAction.type === 'rename') {
        const renameKey = `${inlineAction.entry.mountId}:${inlineAction.entry.path}`;
        const result: ExplorerDisplayRow[] = [];
        for (const row of rows) {
            if (row.key === renameKey) {
                result.push(inlineRow);
            } else {
                result.push(row);
            }
        }
        return result;
    }

    const parentKey = `${inlineAction.entry.mountId}:${inlineAction.entry.path}`;
    const parentIndex = rows.findIndex(row => row.key === parentKey);

    if (parentIndex < 0) {
        return [inlineRow, ...rows];
    }

    const result: ExplorerDisplayRow[] = [...rows];
    result.splice(parentIndex + 1, 0, inlineRow);
    return result;
}

/* ------------------------------------------------------------------ */
/*  Diagnostics decoration                                             */
/* ------------------------------------------------------------------ */

export function applyExplorerDiagnostics(
    rows: WorkspaceExplorerRow[],
    snapshot: WorkspaceExplorerDiagnosticsSnapshot
): WorkspaceExplorerRow[] {
    if (!snapshot || Object.keys(snapshot.byPath).length === 0) {
        return rows;
    }

    return rows.map(row => {
        if (row.type === 'mount') {
            const mountDiag = snapshot.mountSummary[row.mount.id];
            if (mountDiag) {
                return { ...row, diagnostics: mountDiag } satisfies WorkspaceMountRow;
            }
            return row;
        }

        const normalizedPath = normalizeWorkspaceExplorerDiagnosticPath(row.entry.path);
        const pathDiag = snapshot.byPath[normalizedPath];
        if (pathDiag) {
            return { ...row, diagnostics: pathDiag } satisfies WorkspaceEntryRow;
        }
        return row;
    });
}

/* ------------------------------------------------------------------ */
/*  Filter                                                             */
/* ------------------------------------------------------------------ */

export function applyExplorerFilter(
    rows: WorkspaceExplorerRow[],
    filterQuery: string
): WorkspaceExplorerRow[] {
    const trimmedQuery = filterQuery.trim().toLowerCase();
    if (!trimmedQuery) {
        return rows;
    }

    const matchingMountIds = new Set<string>();
    const matchingDirectoryKeys = new Set<string>();

    for (const row of rows) {
        if (row.type !== 'entry') {
            continue;
        }
        if (row.entry.name.toLowerCase().includes(trimmedQuery)) {
            matchingMountIds.add(row.mount.id);
            // Include all parent directories
            const normalised = row.entry.path.replace(/\\/g, '/');
            const segments = normalised.split('/');
            let pathSoFar = '';
            for (let i = 0; i < segments.length - 1; i++) {
                pathSoFar = pathSoFar ? `${pathSoFar}/${segments[i]}` : segments[i] ?? '';
                matchingDirectoryKeys.add(`${row.mount.id}:${pathSoFar}`);
            }
        }
    }

    return rows.filter(row => {
        if (row.type === 'mount') {
            return matchingMountIds.has(row.mount.id);
        }
        if (row.entry.name.toLowerCase().includes(trimmedQuery)) {
            return true;
        }
        if (row.entry.isDirectory && matchingDirectoryKeys.has(row.key)) {
            return true;
        }
        return false;
    });
}

/* ------------------------------------------------------------------ */
/*  Navigation: find parent entry row                                  */
/* ------------------------------------------------------------------ */

export function findParentEntryRow(
    rows: WorkspaceExplorerRow[],
    childRow: WorkspaceEntryRow
): WorkspaceEntryRow | null {
    if (childRow.depth === 0) {
        return null;
    }

    const childIndex = rows.findIndex(row => row.key === childRow.key);
    if (childIndex < 0) {
        return null;
    }

    for (let i = childIndex - 1; i >= 0; i--) {
        const candidate = rows[i];
        if (
            candidate?.type === 'entry' &&
            candidate.depth < childRow.depth &&
            candidate.entry.isDirectory
        ) {
            return candidate;
        }
    }

    return null;
}

/* ------------------------------------------------------------------ */
/*  Fallback helpers                                                   */
/* ------------------------------------------------------------------ */

export function extractFallbackDirectoryEntries(
    result: { success?: boolean; data?: Array<{ name: string; isDirectory: boolean }>; files?: Array<{ name: string; isDirectory: boolean }> }
): Array<{ name: string; isDirectory: boolean }> {
    if (!result.success) {
        return [];
    }
    const entries = result.data ?? result.files;
    if (!Array.isArray(entries)) {
        return [];
    }
    return entries.filter(
        (item): item is { name: string; isDirectory: boolean } =>
            typeof item === 'object' &&
            item !== null &&
            typeof item.name === 'string' &&
            typeof item.isDirectory === 'boolean'
    );
}

export function buildFallbackExplorerRows(
    mounts: WorkspaceMount[],
    entriesByMount: Map<string, Array<{ name: string; isDirectory: boolean }>>
): WorkspaceExplorerRow[] {
    const rows: WorkspaceExplorerRow[] = [];

    for (const mount of mounts) {
        const entries = entriesByMount.get(mount.id);
        if (!entries || entries.length === 0) {
            continue;
        }

        for (const entry of entries) {
            const entryPath = `${mount.rootPath.replace(/\\/g, '/')}/${entry.name}`;
            const row: WorkspaceEntryRow = {
                type: 'entry',
                key: `${mount.id}:${entryPath}`,
                mount,
                entry: {
                    mountId: mount.id,
                    name: entry.name,
                    path: entryPath,
                    isDirectory: entry.isDirectory,
                },
                depth: 0,
                expanded: false,
                loading: false,
            };
            rows.push(row);
        }
    }

    return rows;
}
