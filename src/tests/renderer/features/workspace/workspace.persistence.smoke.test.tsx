import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkspaceManager } from '@/features/workspace/hooks/useWorkspaceManager';
import { Workspace } from '@/types';
import { webElectronMock } from '@/web-bridge';

const workspaceFixture: Workspace = {
    id: 'workspace-1',
    title: 'Workspace Demo',
    description: 'Test workspace',
    path: 'C:\\workspaces\\demo-workspace',
    mounts: [
        {
            id: 'mount-local',
            name: 'Local',
            type: 'local',
            rootPath: 'C:\\workspaces\\demo-workspace',
        },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    chatIds: [],
    councilConfig: {
        enabled: false,
        members: [],
        consensusThreshold: 0.7,
    },
    status: 'active',
};

const mountElectronMock = () => {
    const updateWorkspace = vi.fn().mockResolvedValue({ success: true });
    const base = window.electron ?? webElectronMock;

    window.electron = {
        ...base,
        db: {
            ...base.db,
            updateWorkspace,
        },
        ssh: {
            ...base.ssh,
            isConnected: vi.fn().mockResolvedValue(false),
        },
        selectDirectory: vi.fn().mockResolvedValue({ success: false }),
        clipboard: {
            ...base.clipboard,
            writeText: vi.fn().mockResolvedValue({ success: true }),
        },
        openExternal: vi.fn().mockResolvedValue(undefined),
        log: {
            ...base.log,
            error: vi.fn() as typeof base.log.error,
            warn: vi.fn() as typeof base.log.warn,
        },
    };
    return { updateWorkspace };
};

const WorkspaceHarness: React.FC<{ workspace: Workspace }> = ({ workspace }) => {
    const manager = useWorkspaceManager({
        workspace,
        notify: vi.fn(),
        logActivity: vi.fn(),
        t: (key: string) => key,
    });
    return (
        <div>
            <div data-testid="open-tabs">{manager.openTabs.length}</div>
            <div data-testid="active-tab">{manager.activeTabId ?? 'none'}</div>
            <div data-testid="mount-count">{manager.mounts.length}</div>
            <button
                onClick={() => {
                    void manager.persistMounts([]);
                }}
            >
                remove-mounts
            </button>
        </div>
    );
};

describe('Workspace mount/tab persistence smoke tests', () => {
    let updateWorkspaceMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        const mockBundle = mountElectronMock();
        updateWorkspaceMock = mockBundle.updateWorkspace;
    });

    it('restores tab state after remount', () => {
        localStorage.setItem(
            'workspace.tabs.state.v1:workspace-1',
            JSON.stringify({
                openTabs: [
                    {
                        id: 'mount-local:C:\\workspaces\\demo-workspace\\README.md',
                        mountId: 'mount-local',
                        path: 'C:\\workspaces\\demo-workspace\\README.md',
                        name: 'README.md',
                        content: '# readme',
                        savedContent: '# readme',
                        isDirty: false,
                        isPinned: false,
                        type: 'code',
                    },
                ],
                activeTabId: 'mount-local:C:\\workspaces\\demo-workspace\\README.md',
            })
        );

        const { unmount } = render(<WorkspaceHarness workspace={workspaceFixture} />);
        expect(screen.getByTestId('open-tabs').textContent).toBe('1');
        expect(screen.getByTestId('active-tab').textContent).toContain('README.md');

        unmount();
        render(<WorkspaceHarness workspace={workspaceFixture} />);
        expect(screen.getByTestId('open-tabs').textContent).toBe('1');
        expect(screen.getByTestId('active-tab').textContent).toContain('README.md');
    });

    it('updates mount state and persists workspace mounts on unmount flow', async () => {
        render(<WorkspaceHarness workspace={workspaceFixture} />);

        fireEvent.click(screen.getByRole('button', { name: 'remove-mounts' }));

        expect(updateWorkspaceMock).toHaveBeenCalledWith(
            'workspace-1',
            { mounts: [] }
        );
    });
});
