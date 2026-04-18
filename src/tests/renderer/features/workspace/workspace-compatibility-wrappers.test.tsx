/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Workspace } from '@shared/types/workspace';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VirtualizedWorkspaceGrid } from '@/features/workspace/components/VirtualizedWorkspaceGrid';
import { WorkspaceHeader } from '@/features/workspace/components/WorkspaceHeader';
import { WorkspaceModals } from '@/features/workspace/components/WorkspaceModals';


interface MockSurfaceProps {
    activeMenuId: string | null
    setActiveMenuId: (id: string | null) => void
    onSelect: (workspace: Workspace) => void
    onEdit: (workspace: Workspace) => void
    onDelete: (workspace: Workspace) => void
    onArchive: (workspace: Workspace) => void
    t: (key: string) => string
    children: React.ReactNode
}

interface MockWorkspaceCardProps {
    workspace: Workspace
    index: number
    isSelected?: boolean
    onToggleSelection?: () => void
}

interface MockVirtuosoProps {
    totalCount: number
    itemContent: (index: number) => React.ReactNode
}

const workspaceCardSurfaceProviderSpy = vi.fn(
    ({
        children,
    }: MockSurfaceProps) => <div data-testid="workspace-card-surface">{children}</div>
);

const workspaceCardSpy = vi.fn(
    ({
        workspace,
        isSelected,
        onToggleSelection,
    }: MockWorkspaceCardProps) => (
        <button
            type="button"
            data-testid={`workspace-card-${workspace.id}`}
            data-selected={String(Boolean(isSelected))}
            onClick={() => onToggleSelection?.()}
        >
            {workspace.title}
        </button>
    )
);

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

vi.mock('@/lib/framer-motion-compat', () => {
    type MotionProps = React.HTMLAttributes<HTMLElement> & {
        children?: React.ReactNode
    };

    const motion = new Proxy<Record<string, React.FC<MotionProps>>>({}, {
        get: (_target, key) => {
            const element = typeof key === 'string' ? key : 'div';
            const MotionComponent: React.FC<MotionProps> = ({ children, ...props }) => (
                React.createElement(element, props, children)
            );
            return MotionComponent;
        },
    });

    return {
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
        motion,
    };
});

vi.mock('react-virtuoso', () => ({
    Virtuoso: ({ totalCount, itemContent }: MockVirtuosoProps) => (
        <div data-testid="virtuoso-root" data-total-count={String(totalCount)}>
            {totalCount > 0 ? itemContent(0) : null}
        </div>
    ),
}));

vi.mock('@/features/workspace/components/WorkspaceCard', () => ({
    WorkspaceCardSurfaceProvider: (props: MockSurfaceProps) => workspaceCardSurfaceProviderSpy(props),
    WorkspaceCard: (props: MockWorkspaceCardProps) => workspaceCardSpy(props),
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

    it('maps WorkspaceHeader actions to the legacy header implementation', () => {
        const onNewWorkspace = vi.fn();
        const setSearchQuery = vi.fn();
        const onViewModeChange = vi.fn();

        render(
            <WorkspaceHeader
                title="Workspaces"
                subtitle="Manage workspaces"
                newWorkspaceLabel="Create workspace"
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
    });

    it('maps WorkspaceModals save and delete actions to the legacy handlers', async () => {
        const handleUpdateWorkspace = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
        const handleDeleteWorkspace = vi.fn<(deleteFiles: boolean) => Promise<void>>().mockResolvedValue(undefined);
        const handleArchiveWorkspace = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
        const handleBulkDelete = vi.fn<(deleteFiles: boolean) => Promise<void>>().mockResolvedValue(undefined);
        const handleBulkArchive = vi.fn<(isArchived: boolean) => Promise<void>>().mockResolvedValue(undefined);

        const { rerender } = render(
            <WorkspaceModals
                editingWorkspace={workspaceFixture}
                setEditingWorkspace={vi.fn()}
                deletingWorkspace={null}
                setDeletingWorkspace={vi.fn()}
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
                editingWorkspace={null}
                setEditingWorkspace={vi.fn()}
                deletingWorkspace={workspaceFixture}
                setDeletingWorkspace={vi.fn()}
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

    it('maps VirtualizedWorkspaceGrid workspace props into the legacy grid contract', () => {
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
                workspaceStateMachine={{
                    startEdit,
                    startDelete,
                    startArchive,
                    toggleSelection,
                    state: {
                        selectedWorkspaceIds: new Set(['workspace-1']),
                    },
                }}
                itemsPerRow={2}
                itemHeight={180}
                t={translate}
            />
        );

        expect(screen.getByTestId('virtuoso-root')).toHaveAttribute('data-total-count', '1');
        expect(screen.getByTestId('workspace-card-workspace-1')).toHaveAttribute('data-selected', 'true');

        fireEvent.click(screen.getByTestId('workspace-card-workspace-1'));
        expect(toggleSelection).toHaveBeenCalledWith('workspace-1');

        const surfaceProps = workspaceCardSurfaceProviderSpy.mock.calls[0][0] as MockSurfaceProps;
        surfaceProps.onSelect(workspaceFixture);
        surfaceProps.onEdit(workspaceFixture);
        surfaceProps.onDelete(workspaceFixture);
        surfaceProps.onArchive(workspaceFixture);

        expect(surfaceProps.activeMenuId).toBe('workspace-1');
        expect(surfaceProps.setActiveMenuId).toBe(setShowWorkspaceMenu);
        expect(onSelectWorkspace).toHaveBeenCalledWith(workspaceFixture);
        expect(setShowWorkspaceMenu).toHaveBeenCalledWith(null);
        expect(startEdit).toHaveBeenCalledWith(workspaceFixture);
        expect(startDelete).toHaveBeenCalledWith(workspaceFixture);
        expect(startArchive).toHaveBeenCalledWith(workspaceFixture);
    });
});
