/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { WorkspaceEntry, WorkspaceMount } from '@shared/types/workspace/workspace';
import { describe, expect, it } from 'vitest';

import { WorkspaceEntryRow } from '@/features/workspace/hooks/useWorkspaceExplorerTree';
import {
    findTypeToSelectMatch,
    getWorkspaceEntryRange,
    toggleWorkspaceEntrySelection,
} from '@/features/workspace/utils/workspace-explorer-navigation';

const mount: WorkspaceMount = {
    id: 'mount-1',
    name: 'repo',
    type: 'local',
    rootPath: '/repo',
};

function createEntryRow(name: string, path: string, depth = 0): WorkspaceEntryRow {
    return {
        type: 'entry',
        key: `${mount.id}:${path}`,
        mount,
        entry: {
            mountId: mount.id,
            name,
            path,
            isDirectory: false,
        },
        depth,
        expanded: false,
        loading: false,
    };
}

const rows = [
    createEntryRow('alpha.ts', '/repo/alpha.ts'),
    createEntryRow('beta.ts', '/repo/beta.ts'),
    createEntryRow('config.json', '/repo/config.json'),
    createEntryRow('zeta.ts', '/repo/zeta.ts'),
];

describe('workspace explorer navigation helpers', () => {
    it('builds a visible selection range from anchor to target', () => {
        const range = getWorkspaceEntryRange(rows, rows[1].entry, rows[3].entry);
        expect(range).toEqual([rows[1].entry, rows[2].entry, rows[3].entry]);
    });

    it('toggles entries in the explorer selection set', () => {
        const firstSelection = toggleWorkspaceEntrySelection([], rows[0].entry);
        expect(firstSelection).toEqual([rows[0].entry]);

        const nextSelection = toggleWorkspaceEntrySelection(firstSelection, rows[0].entry);
        expect(nextSelection).toEqual([]);
    });

    it('finds the next type-to-select match with wraparound', () => {
        const match = findTypeToSelectMatch(rows, 'co', rows[3].entry);
        expect(match?.entry).toEqual(rows[2].entry);
    });

    it('falls back to the target entry when anchor is not visible', () => {
        const hiddenEntry: WorkspaceEntry = {
            mountId: mount.id,
            name: 'hidden.ts',
            path: '/repo/hidden.ts',
            isDirectory: false,
        };

        const range = getWorkspaceEntryRange(rows, hiddenEntry, rows[0].entry);
        expect(range).toEqual([rows[0].entry]);
    });
});

