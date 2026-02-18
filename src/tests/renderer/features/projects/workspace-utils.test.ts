import { describe, expect, it } from 'vitest';

import {
    getWorkspaceExplorerStorageKey,
    getWorkspaceTreeStorageKey,
    loadExpandedTreeState,
    saveExpandedTreeState,
} from '@/features/projects/utils/workspaceUtils';
import { WorkspaceMount } from '@/types';

const mounts: WorkspaceMount[] = [
    {
        id: 'mount-local',
        name: 'Local',
        type: 'local',
        rootPath: 'C:\\workspace\\project',
    },
];

describe('workspaceUtils', () => {
    it('builds project-scoped explorer storage keys', () => {
        const keyA = getWorkspaceExplorerStorageKey('project-a', mounts);
        const keyB = getWorkspaceExplorerStorageKey('project-b', mounts);

        expect(keyA).not.toBe(keyB);
        expect(keyA).toContain('project-a');
    });

    it('persists and restores expanded tree state', () => {
        const key = getWorkspaceTreeStorageKey('project-a');
        localStorage.removeItem(key);

        saveExpandedTreeState(key, {
            'mount-local:C:\\workspace\\project\\src': true,
            'mount-local:C:\\workspace\\project\\README.md': false,
        });

        expect(loadExpandedTreeState(key)).toEqual({
            'mount-local:C:\\workspace\\project\\src': true,
            'mount-local:C:\\workspace\\project\\README.md': false,
        });
    });
});
