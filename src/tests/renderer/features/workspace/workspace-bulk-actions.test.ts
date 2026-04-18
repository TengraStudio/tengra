/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it } from 'vitest';

import {
    buildWorkspaceBulkRenamePlan,
    buildWorkspaceBulkTransferPlan,
    canUseSharedTargetDirectory,
} from '@/features/workspace/utils/workspace-bulk-actions';
import type { WorkspaceEntry } from '@/types';

const basePath = '/workspace';
const archivePath = '/archive';

function createEntry(overrides: Partial<WorkspaceEntry>): WorkspaceEntry {
    return {
        name: overrides.name ?? 'file.txt',
        path: overrides.path ?? `${basePath}/file.txt`,
        isDirectory: overrides.isDirectory ?? false,
        mountId: overrides.mountId ?? 'mount-1',
        initialLine: overrides.initialLine,
    };
}

describe('workspace bulk action helpers', () => {
    it('builds deterministic rename plans and preserves file extensions', () => {
        const plan = buildWorkspaceBulkRenamePlan(
            [
                createEntry({ name: 'beta.ts', path: `${basePath}/beta.ts` }),
                createEntry({ name: 'alpha.js', path: `${basePath}/alpha.js` }),
            ],
            'component'
        );

        expect(plan).toEqual([
            expect.objectContaining({
                newName: 'component-1.js',
                newPath: `${basePath}/component-1.js`,
            }),
            expect.objectContaining({
                newName: 'component-2.ts',
                newPath: `${basePath}/component-2.ts`,
            }),
        ]);
    });

    it('builds transfer plans with trimmed target directories', () => {
        const plan = buildWorkspaceBulkTransferPlan(
            [createEntry({ name: 'notes.md', path: `${basePath}/notes.md` })],
            `${archivePath}/`
        );

        expect(plan).toEqual([
            expect.objectContaining({
                targetPath: `${archivePath}/notes.md`,
            }),
        ]);
    });

    it('retains original separator style for windows-shaped paths', () => {
        const plan = buildWorkspaceBulkRenamePlan(
            [createEntry({ name: 'alpha.js', path: 'C:\\workspace\\alpha.js' })],
            'component'
        );

        expect(plan[0]?.newPath).toBe('C:\\workspace\\component-1.js');
    });

    it('requires a shared mount for shared target directory actions', () => {
        expect(
            canUseSharedTargetDirectory([
                createEntry({ mountId: 'mount-1' }),
                createEntry({ mountId: 'mount-2', path: `${basePath}/other.txt` }),
            ])
        ).toBe(false);
    });
});
