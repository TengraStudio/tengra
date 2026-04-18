/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { Workspace } from '@shared/types/workspace';
import React, { useEffect, useMemo, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';

import {
    WorkspaceCard,
    WorkspaceCardSurfaceProvider,
} from '@/features/workspace/components/WorkspaceCard';
import { appLogger } from '@/utils/renderer-logger';

interface VirtualizedWorkspaceGridProps {
    workspaces: Workspace[];
    onSelectWorkspace?: (workspace: Workspace) => void;
    showWorkspaceMenu: string | null;
    setShowWorkspaceMenu: (id: string | null) => void;
    workspaceStateMachine: {
        startEdit: (workspace: Workspace, event?: React.MouseEvent) => void;
        startDelete: (workspace: Workspace, event?: React.MouseEvent) => void;
        startArchive: (workspace: Workspace) => void;
        toggleSelection: (id: string) => void;
        state: {
            selectedWorkspaceIds: Set<string>;
        };
    };
    itemsPerRow?: number;
    itemHeight?: number;
    t?: (key: string) => string;
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
    t = (key: string) => key,
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
            isThresholdReached,
        });
    }, [itemsPerRow, workspaces.length]);

    const workspaceRows = useMemo(() => {
        const rows: Workspace[][] = [];
        for (let index = 0; index < workspaces.length; index += itemsPerRow) {
            rows.push(workspaces.slice(index, index + itemsPerRow));
        }
        return rows;
    }, [workspaces, itemsPerRow]);

    const renderRow = (index: number) => {
        const row = workspaceRows[index];
        return (
            <div
                className="grid grid-cols-1 gap-4 px-4 md:grid-cols-2 lg:grid-cols-3"
                style={{ height: itemHeight }}
            >
                {row.map((workspace, itemIndex) => (
                    <WorkspaceCard
                        key={workspace.id}
                        workspace={workspace}
                        index={index * itemsPerRow + itemIndex}
                        isSelected={sm.state.selectedWorkspaceIds.has(workspace.id)}
                        onToggleSelection={() => sm.toggleSelection(workspace.id)}
                    />
                ))}
                {row.length < itemsPerRow &&
                    Array.from({ length: itemsPerRow - row.length }).map((_, emptyIndex) => (
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
