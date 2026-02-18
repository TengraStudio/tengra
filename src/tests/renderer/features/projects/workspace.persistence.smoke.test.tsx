import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkspaceManager } from '@/features/projects/hooks/useWorkspaceManager';
import { Project } from '@/types';
import { webElectronMock } from '@/web-bridge';

const projectFixture: Project = {
    id: 'project-1',
    title: 'Workspace Project',
    description: 'Workspace test project',
    path: 'C:\\workspace\\project',
    mounts: [
        {
            id: 'mount-local',
            name: 'Local',
            type: 'local',
            rootPath: 'C:\\workspace\\project',
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
    const updateProject = vi.fn().mockResolvedValue({ success: true });
    const base = window.electron ?? webElectronMock;

    window.electron = {
        ...base,
        db: {
            ...base.db,
            updateProject,
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
    return { updateProject };
};

const WorkspaceHarness: React.FC<{ project: Project }> = ({ project }) => {
    const manager = useWorkspaceManager({
        project,
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
    let updateProjectMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        const mockBundle = mountElectronMock();
        updateProjectMock = mockBundle.updateProject;
    });

    it('restores tab state after remount', () => {
        localStorage.setItem(
            'workspace.tabs.state.v1:project-1',
            JSON.stringify({
                openTabs: [
                    {
                        id: 'mount-local:C:\\workspace\\project\\README.md',
                        mountId: 'mount-local',
                        path: 'C:\\workspace\\project\\README.md',
                        name: 'README.md',
                        content: '# readme',
                        savedContent: '# readme',
                        isDirty: false,
                        isPinned: false,
                        type: 'code',
                    },
                ],
                activeTabId: 'mount-local:C:\\workspace\\project\\README.md',
            })
        );

        const { unmount } = render(<WorkspaceHarness project={projectFixture} />);
        expect(screen.getByTestId('open-tabs').textContent).toBe('1');
        expect(screen.getByTestId('active-tab').textContent).toContain('README.md');

        unmount();
        render(<WorkspaceHarness project={projectFixture} />);
        expect(screen.getByTestId('open-tabs').textContent).toBe('1');
        expect(screen.getByTestId('active-tab').textContent).toContain('README.md');
    });

    it('updates mount state and persists project mounts on unmount flow', async () => {
        render(<WorkspaceHarness project={projectFixture} />);

        fireEvent.click(screen.getByRole('button', { name: 'remove-mounts' }));

        expect(updateProjectMock).toHaveBeenCalledWith(
            'project-1',
            { mounts: [] }
        );
    });
});
