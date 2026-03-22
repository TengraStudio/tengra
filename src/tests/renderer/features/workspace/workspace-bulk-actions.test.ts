import { describe, expect, it } from 'vitest';

import {
    buildWorkspaceBulkRenamePlan,
    buildWorkspaceBulkTransferPlan,
    canUseSharedTargetDirectory,
} from '@/features/workspace/utils/workspace-bulk-actions';
import type { WorkspaceEntry } from '@/types';

function createEntry(overrides: Partial<WorkspaceEntry>): WorkspaceEntry {
    return {
        name: overrides.name ?? 'file.txt',
        path: overrides.path ?? 'C:\\workspace\\file.txt',
        isDirectory: overrides.isDirectory ?? false,
        mountId: overrides.mountId ?? 'mount-1',
        initialLine: overrides.initialLine,
    };
}

describe('workspace bulk action helpers', () => {
    it('builds deterministic rename plans and preserves file extensions', () => {
        const plan = buildWorkspaceBulkRenamePlan(
            [
                createEntry({ name: 'beta.ts', path: 'C:\\workspace\\beta.ts' }),
                createEntry({ name: 'alpha.js', path: 'C:\\workspace\\alpha.js' }),
            ],
            'component'
        );

        expect(plan).toEqual([
            expect.objectContaining({
                newName: 'component-1.js',
                newPath: 'C:\\workspace\\component-1.js',
            }),
            expect.objectContaining({
                newName: 'component-2.ts',
                newPath: 'C:\\workspace\\component-2.ts',
            }),
        ]);
    });

    it('builds transfer plans with trimmed target directories', () => {
        const plan = buildWorkspaceBulkTransferPlan(
            [createEntry({ name: 'notes.md', path: 'C:\\workspace\\notes.md' })],
            'C:\\archive\\'
        );

        expect(plan).toEqual([
            expect.objectContaining({
                targetPath: 'C:\\archive\\notes.md',
            }),
        ]);
    });

    it('requires a shared mount for shared target directory actions', () => {
        expect(
            canUseSharedTargetDirectory([
                createEntry({ mountId: 'mount-1' }),
                createEntry({ mountId: 'mount-2', path: 'C:\\workspace\\other.txt' }),
            ])
        ).toBe(false);
    });
});
