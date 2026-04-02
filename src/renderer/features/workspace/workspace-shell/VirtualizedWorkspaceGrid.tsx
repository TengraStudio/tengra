/**
 * Virtualized Workspace Grid Component
 * Uses react-virtuoso for efficient rendering of large workspace lists
 */

import { Workspace } from '@shared/types/workspace';
import React, { useEffect, useMemo, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { appLogger } from '@/utils/renderer-logger';

import { WorkspaceCard, WorkspaceCardSurfaceProvider } from './WorkspaceCard';

interface VirtualizedWorkspaceGridProps {
    workspaces: Workspace[]
    onSelectWorkspace?: (workspace: Workspace) => void
    showWorkspaceMenu: string | null
    setShowWorkspaceMenu: (id: string | null) => void
    workspaceStateMachine: {
        startEdit: (workspace: Workspace) => void
        startDelete: (workspace: Workspace) => void
        startArchive: (workspace: Workspace) => void
        toggleSelection: (id: string) => void
        state: {
            selectedWorkspaceIds: Set<string>
        }
    }
    itemsPerRow?: number
    itemHeight?: number
    t?: (key: string) => string
}

const VIRTUALIZATION_THRESHOLD_ROW_MULTIPLIER = 4;

export const VirtualizedWorkspaceGrid: React.FC<VirtualizedWorkspaceGridProps> = ({
    workspaces,
    onSelectWorkspace,
    showWorkspaceMenu,
    setShowWorkspaceMenu,
    workspaceStateMachine: sm,
    itemsPerRow = 3,
    itemHeight = 280,
    t = (key: string) => key
}) => {
    const lastThresholdStateRef = useRef<boolean | null>(null);

    useEffect(() => {
        const virtualizationThreshold = itemsPerRow * VIRTUALIZATION_THRESHOLD_ROW_MULTIPLIER;
        const isThresholdReached = workspaces.length >= virtualizationThreshold;
        if (lastThresholdStateRef.current === isThresholdReached) {
            return;
        }

        lastThresholdStateRef.current = isThresholdReached;
        appLogger.debug('VirtualizedWorkspaceGrid', 'Virtualization threshold state changed', {
            workspaceCount: workspaces.length,
            virtualizationThreshold,
            itemsPerRow,
            isThresholdReached
        });
    }, [itemsPerRow, workspaces.length]);

    // Create rows of workspaces for virtualization
    const workspaceRows = useMemo(() => {
        const rows = [];
        for (let i = 0; i < workspaces.length; i += itemsPerRow) {
            rows.push(workspaces.slice(i, i + itemsPerRow));
        }
        return rows;
    }, [workspaces, itemsPerRow]);

    const renderRow = (index: number) => {
        const row = workspaceRows[index];

        return (
            <div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-4"
                style={{ height: itemHeight }}
            >
                {row.map((workspace, i) => (
                    <WorkspaceCard
                        key={workspace.id}
                        workspace={workspace}
                        index={index * itemsPerRow + i}
                        isSelected={sm.state.selectedWorkspaceIds.has(workspace.id)}
                        onToggleSelection={() => sm.toggleSelection(workspace.id)}
                    />
                ))}
                {/* Fill empty slots in the last row */}
                {row.length < itemsPerRow && Array.from({ length: itemsPerRow - row.length }).map((_, emptyIndex) => (
                    <div key={`empty-${emptyIndex}`} />
                ))}
            </div>
        );
    };

    if (workspaces.length === 0) {
        return null;
    }

    return (
        <WorkspaceCardSurfaceProvider
            onSelect={(workspace) => onSelectWorkspace?.(workspace)}
            activeMenuId={showWorkspaceMenu}
            setActiveMenuId={setShowWorkspaceMenu}
            onEdit={(workspace) => {
                setShowWorkspaceMenu(null);
                sm.startEdit(workspace);
            }}
            onDelete={(workspace) => {
                setShowWorkspaceMenu(null);
                sm.startDelete(workspace);
            }}
            onArchive={(workspace) => sm.startArchive(workspace)}
            t={t}
        >
            <Virtuoso
                style={{ height: '70vh' }}
                totalCount={workspaceRows.length}
                itemContent={renderRow}
                overscan={2}
                data={workspaceRows}
            />
        </WorkspaceCardSurfaceProvider>
    );
};

export default VirtualizedWorkspaceGrid;
