import {
    __resetWorkspaceExplorerStoreForTests,
    clearWorkspaceInlineAction,
    getWorkspaceExplorerSnapshot,
    setWorkspaceExplorerFilterQuery,
    setWorkspaceExplorerFocusedRowKey,
    setWorkspaceExplorerLastSelectedEntry,
    setWorkspaceExplorerSelectedEntries,
    setWorkspaceInlineDraftName,
    startWorkspaceInlineCreate,
    startWorkspaceInlineRename,
} from '@renderer/store/workspace-explorer.store';
import { WorkspaceEntry } from '@shared/types/workspace';
import { beforeEach, describe, expect, it } from 'vitest';

const WORKSPACE_ID = 'workspace-1';

const sampleEntry: WorkspaceEntry = {
    mountId: 'mount-1',
    name: 'src',
    path: 'C:\\repo\\src',
    isDirectory: true,
};

describe('workspace explorer store', () => {
    beforeEach(() => {
        __resetWorkspaceExplorerStoreForTests();
    });

    it('tracks explorer selection and focus per workspace', () => {
        setWorkspaceExplorerSelectedEntries(WORKSPACE_ID, [sampleEntry]);
        setWorkspaceExplorerLastSelectedEntry(WORKSPACE_ID, sampleEntry);
        setWorkspaceExplorerFocusedRowKey(WORKSPACE_ID, `${sampleEntry.mountId}:${sampleEntry.path}`);

        const snapshot = getWorkspaceExplorerSnapshot(WORKSPACE_ID);
        expect(snapshot.selectedEntries).toEqual([sampleEntry]);
        expect(snapshot.lastSelectedEntry).toEqual(sampleEntry);
        expect(snapshot.focusedRowKey).toBe(`${sampleEntry.mountId}:${sampleEntry.path}`);
    });

    it('stores inline rename and create drafts independently of filter query', () => {
        startWorkspaceInlineRename(WORKSPACE_ID, sampleEntry);
        setWorkspaceInlineDraftName(WORKSPACE_ID, 'renamed-src');
        setWorkspaceExplorerFilterQuery(WORKSPACE_ID, 'src');

        let snapshot = getWorkspaceExplorerSnapshot(WORKSPACE_ID);
        expect(snapshot.inlineAction).toMatchObject({
            type: 'rename',
            draftName: 'renamed-src',
        });
        expect(snapshot.filterQuery).toBe('src');

        startWorkspaceInlineCreate(WORKSPACE_ID, 'createFile', sampleEntry);
        snapshot = getWorkspaceExplorerSnapshot(WORKSPACE_ID);
        expect(snapshot.inlineAction).toMatchObject({
            type: 'createFile',
            draftName: '',
        });

        clearWorkspaceInlineAction(WORKSPACE_ID);
        expect(getWorkspaceExplorerSnapshot(WORKSPACE_ID).inlineAction).toBeNull();
    });
});
