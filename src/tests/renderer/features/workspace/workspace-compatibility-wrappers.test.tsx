import { Workspace } from '@shared/types/workspace';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VirtualizedWorkspaceGrid } from '@/features/workspace/components/VirtualizedWorkspaceGrid';
import { WorkspaceHeader } from '@/features/workspace/components/WorkspaceHeader';
import { WorkspaceModals } from '@/features/workspace/components/WorkspaceModals';
import { Project } from '@/types';

interface MockSurfaceProps {
    activeMenuId: string | null
    setActiveMenuId: (id: string | null) => void
    onSelect: (project: Project) => void
    onEdit: (project: Project, event?: React.MouseEvent) => void
    onDelete: (project: Project, event?: React.MouseEvent) => void
    onArchive: (project: Project) => void
    t: (key: string) => string
    children: React.ReactNode
}

interface MockProjectCardProps {
    project: Project
    index: number
    isSelected?: boolean
    onToggleSelection?: () => void
}

interface MockVirtuosoProps {
    totalCount: number
    itemContent: (index: number) => React.ReactNode
}

const projectCardSurfaceProviderSpy = vi.fn(
    ({
        children,
    }: MockSurfaceProps) => <div data-testid="project-card-surface">{children}</div>
);

const projectCardSpy = vi.fn(
    ({
        project,
        isSelected,
        onToggleSelection,
    }: MockProjectCardProps) => (
        <button
            type="button"
            data-testid={`project-card-${project.id}`}
            data-selected={String(Boolean(isSelected))}
            onClick={() => onToggleSelection?.()}
        >
            {project.title}
        </button>
    )
);

vi.mock('@/features/workspace/components/ProjectsPageHealthIndicator', () => ({
    ProjectsPageHealthIndicator: () => <div data-testid="projects-health-indicator" />,
}));

vi.mock('@/components/ui/modal', () => ({
    Modal: ({
        isOpen,
        title,
        children,
    }: {
        isOpen: boolean
        title?: string
        children: React.ReactNode
    }) => (
        isOpen ? (
            <div data-testid="modal">
                {title ? <div>{title}</div> : null}
                {children}
            </div>
        ) : null
    ),
}));

vi.mock('@/lib/framer-motion-compat', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-virtuoso', () => ({
    Virtuoso: ({ totalCount, itemContent }: MockVirtuosoProps) => (
        <div data-testid="virtuoso-root" data-total-count={String(totalCount)}>
            {totalCount > 0 ? itemContent(0) : null}
        </div>
    ),
}));

vi.mock('@/features/workspace/components/ProjectCard', () => ({
    ProjectCardSurfaceProvider: (props: MockSurfaceProps) => projectCardSurfaceProviderSpy(props),
    ProjectCard: (props: MockProjectCardProps) => projectCardSpy(props),
}));

const workspaceFixture = {
    id: 'workspace-1',
    title: 'Workspace One',
    description: 'Primary workspace',
    path: 'C:\\workspace\\one',
    mounts: [],
    createdAt: 1,
    updatedAt: 1,
    chatIds: [],
    councilConfig: {
        enabled: false,
        members: [],
        consensusThreshold: 0.7,
    },
    status: 'active',
} satisfies Workspace;

const translate = (key: string) => key;

describe('workspace compatibility wrappers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('maps WorkspaceHeader actions to the legacy project header implementation', () => {
        const onNewWorkspace = vi.fn();
        const setSearchQuery = vi.fn();
        const onViewModeChange = vi.fn();

        render(
            <WorkspaceHeader
                title="Workspaces"
                subtitle="Manage workspaces"
                newProjectLabel="Create workspace"
                searchPlaceholder="Search workspaces"
                searchQuery=""
                setSearchQuery={setSearchQuery}
                onNewWorkspace={onNewWorkspace}
                selectedCount={0}
                totalCount={0}
                onToggleSelectAll={vi.fn()}
                onBulkDelete={vi.fn()}
                onBulkArchive={vi.fn()}
                viewMode="grid"
                onViewModeChange={onViewModeChange}
                listPreset="recent"
                onListPresetChange={vi.fn()}
                onExportList={vi.fn()}
                t={translate}
                language="tr"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
        fireEvent.change(screen.getByPlaceholderText('Search workspaces'), {
            target: { value: 'alpha' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'aria.listView' }));

        expect(onNewWorkspace).toHaveBeenCalledTimes(1);
        expect(setSearchQuery).toHaveBeenCalledWith('alpha');
        expect(onViewModeChange).toHaveBeenCalledWith('list');
        expect(screen.getByTestId('projects-health-indicator')).toBeInTheDocument();
    });

    it('maps WorkspaceModals save and delete actions to the legacy project handlers', async () => {
        const handleUpdateWorkspace = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
        const handleDeleteWorkspace = vi.fn<(deleteFiles: boolean) => Promise<void>>().mockResolvedValue(undefined);
        const handleArchiveWorkspace = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const handleBulkDelete = vi.fn<(deleteFiles: boolean) => Promise<void>>().mockResolvedValue(undefined);
        const handleBulkArchive = vi.fn<(isArchived: boolean) => Promise<void>>().mockResolvedValue(undefined);

        const { rerender } = render(
            <WorkspaceModals
                editingProject={workspaceFixture}
                setEditingProject={vi.fn()}
                deletingProject={null}
                setDeletingProject={vi.fn()}
                isArchiving={null}
                setIsArchiving={vi.fn()}
                isBulkDeleting={false}
                setIsBulkDeleting={vi.fn()}
                isBulkArchiving={false}
                setIsBulkArchiving={vi.fn()}
                selectedCount={1}
                editForm={{ title: workspaceFixture.title, description: workspaceFixture.description }}
                setEditForm={vi.fn()}
                handleUpdateWorkspace={handleUpdateWorkspace}
                handleDeleteWorkspace={handleDeleteWorkspace}
                handleArchiveWorkspace={handleArchiveWorkspace}
                handleBulkDelete={handleBulkDelete}
                handleBulkArchive={handleBulkArchive}
                t={translate}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

        await waitFor(() => {
            expect(handleUpdateWorkspace).toHaveBeenCalledTimes(1);
        });

        rerender(
            <WorkspaceModals
                editingProject={null}
                setEditingProject={vi.fn()}
                deletingProject={workspaceFixture}
                setDeletingProject={vi.fn()}
                isArchiving={null}
                setIsArchiving={vi.fn()}
                isBulkDeleting={false}
                setIsBulkDeleting={vi.fn()}
                isBulkArchiving={false}
                setIsBulkArchiving={vi.fn()}
                selectedCount={1}
                editForm={{ title: workspaceFixture.title, description: workspaceFixture.description }}
                setEditForm={vi.fn()}
                handleUpdateWorkspace={handleUpdateWorkspace}
                handleDeleteWorkspace={handleDeleteWorkspace}
                handleArchiveWorkspace={handleArchiveWorkspace}
                handleBulkDelete={handleBulkDelete}
                handleBulkArchive={handleBulkArchive}
                t={translate}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'common.delete' }));

        await waitFor(() => {
            expect(handleDeleteWorkspace).toHaveBeenCalledWith(false);
        });
    });

    it('maps VirtualizedWorkspaceGrid workspace props into the legacy project grid contract', () => {
        const setShowWorkspaceMenu = vi.fn();
        const onSelectWorkspace = vi.fn();
        const startEdit = vi.fn();
        const startDelete = vi.fn();
        const startArchive = vi.fn();
        const toggleSelection = vi.fn();

        render(
            <VirtualizedWorkspaceGrid
                workspaces={[workspaceFixture]}
                onSelectWorkspace={onSelectWorkspace}
                showWorkspaceMenu="workspace-1"
                setShowWorkspaceMenu={setShowWorkspaceMenu}
                projectStateMachine={{
                    startEdit,
                    startDelete,
                    startArchive,
                    toggleSelection,
                    state: {
                        selectedProjectIds: new Set(['workspace-1']),
                    },
                }}
                itemsPerRow={2}
                itemHeight={180}
                t={translate}
            />
        );

        expect(screen.getByTestId('virtuoso-root')).toHaveAttribute('data-total-count', '1');
        expect(screen.getByTestId('project-card-workspace-1')).toHaveAttribute('data-selected', 'true');

        fireEvent.click(screen.getByTestId('project-card-workspace-1'));
        expect(toggleSelection).toHaveBeenCalledWith('workspace-1');

        const surfaceProps = projectCardSurfaceProviderSpy.mock.calls[0][0] as MockSurfaceProps;
        surfaceProps.onSelect(workspaceFixture);
        surfaceProps.onEdit(workspaceFixture);
        surfaceProps.onDelete(workspaceFixture);
        surfaceProps.onArchive(workspaceFixture);

        expect(surfaceProps.activeMenuId).toBe('workspace-1');
        expect(surfaceProps.setActiveMenuId).toBe(setShowWorkspaceMenu);
        expect(onSelectWorkspace).toHaveBeenCalledWith(workspaceFixture);
        expect(setShowWorkspaceMenu).toHaveBeenCalledWith(null);
        expect(startEdit).toHaveBeenCalledWith(workspaceFixture, undefined);
        expect(startDelete).toHaveBeenCalledWith(workspaceFixture, undefined);
        expect(startArchive).toHaveBeenCalledWith(workspaceFixture);
    });
});
