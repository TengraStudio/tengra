import { describe, expect, it } from 'vitest';

import {
    getWorkspaceExplorerStorageKey,
    getWorkspaceTreeStorageKey,
    loadExpandedTreeState,
    saveExpandedTreeState,
} from '@/features/workspace/utils/workspaceUtils';
import { WorkspaceMount } from '@/types';

const mounts: WorkspaceMount[] = [
    {
        id: 'mount-local',
        name: 'Local',
        type: 'local',
        rootPath: '/workspaces/demo-workspace',
    },
];

describe('workspaceUtils', () => {
    it('builds workspace-scoped explorer storage keys', () => {
        const keyA = getWorkspaceExplorerStorageKey('workspace-a', mounts);
        const keyB = getWorkspaceExplorerStorageKey('workspace-b', mounts);

        expect(keyA).not.toBe(keyB);
        expect(keyA).toContain('workspace-a');
    });

    it('persists and restores expanded tree state', () => {
        const key = getWorkspaceTreeStorageKey('workspace-a');
        localStorage.removeItem(key);

        saveExpandedTreeState(key, {
            'mount-local:/workspaces/demo-workspace/src': true,
            'mount-local:/workspaces/demo-workspace/README.md': false,
        });

        expect(loadExpandedTreeState(key)).toEqual({
            'mount-local:/workspaces/demo-workspace/src': true,
            'mount-local:/workspaces/demo-workspace/README.md': false,
        });
    });
});
