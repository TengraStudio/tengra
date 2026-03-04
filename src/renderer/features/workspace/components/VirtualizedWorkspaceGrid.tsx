/**
 * Virtualized Project Grid Component
 * Uses react-virtuoso for efficient rendering of large project lists
 */

import { Project, Workspace } from '@shared/types/workspace';
import React, { useEffect, useMemo, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { appLogger } from '@/utils/renderer-logger';

import { ProjectCard, ProjectCardSurfaceProvider } from './ProjectCard';

interface VirtualizedProjectGridProps {
    projects: Project[]
    onSelectProject?: (project: Project) => void
    showProjectMenu: string | null
    setShowProjectMenu: (id: string | null) => void
    projectStateMachine: {
        startEdit: (project: Project, event?: React.MouseEvent) => void
        startDelete: (project: Project, event?: React.MouseEvent) => void
        startArchive: (project: Project) => void
        toggleSelection: (id: string) => void
        state: {
            selectedProjectIds: Set<string>
        }
    }
    itemsPerRow?: number
    itemHeight?: number
    t?: (key: string) => string
}

const VIRTUALIZATION_THRESHOLD_ROW_MULTIPLIER = 4;

export const VirtualizedProjectGrid: React.FC<VirtualizedProjectGridProps> = ({
    projects,
    onSelectProject,
    showProjectMenu,
    setShowProjectMenu,
    projectStateMachine: sm,
    itemsPerRow = 3,
    itemHeight = 280,
    t = (key: string) => key
}) => {
    const lastThresholdStateRef = useRef<boolean | null>(null);

    useEffect(() => {
        const virtualizationThreshold = itemsPerRow * VIRTUALIZATION_THRESHOLD_ROW_MULTIPLIER;
        const isThresholdReached = projects.length >= virtualizationThreshold;
        if (lastThresholdStateRef.current === isThresholdReached) {
            return;
        }

        lastThresholdStateRef.current = isThresholdReached;
        appLogger.debug('VirtualizedProjectGrid', 'Virtualization threshold state changed', {
            projectCount: projects.length,
            virtualizationThreshold,
            itemsPerRow,
            isThresholdReached
        });
    }, [itemsPerRow, projects.length]);

    // Create rows of projects for virtualization
    const projectRows = useMemo(() => {
        const rows = [];
        for (let i = 0; i < projects.length; i += itemsPerRow) {
            rows.push(projects.slice(i, i + itemsPerRow));
        }
        return rows;
    }, [projects, itemsPerRow]);

    const renderRow = (index: number) => {
        const row = projectRows[index];

        return (
            <div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-4"
                style={{ height: itemHeight }}
            >
                {row.map((project, i) => (
                    <ProjectCard
                        key={project.id}
                        project={project}
                        index={index * itemsPerRow + i}
                        isSelected={sm.state.selectedProjectIds.has(project.id)}
                        onToggleSelection={() => sm.toggleSelection(project.id)}
                    />
                ))}
                {/* Fill empty slots in the last row */}
                {row.length < itemsPerRow && Array.from({ length: itemsPerRow - row.length }).map((_, emptyIndex) => (
                    <div key={`empty-${emptyIndex}`} />
                ))}
            </div>
        );
    };

    if (projects.length === 0) {
        return null;
    }

    return (
        <ProjectCardSurfaceProvider
            onSelect={(project) => onSelectProject?.(project)}
            activeMenuId={showProjectMenu}
            setActiveMenuId={setShowProjectMenu}
            onEdit={(project, event) => {
                setShowProjectMenu(null);
                sm.startEdit(project, event);
            }}
            onDelete={(project, event) => {
                setShowProjectMenu(null);
                sm.startDelete(project, event);
            }}
            onArchive={(project) => sm.startArchive(project)}
            t={t}
        >
            <Virtuoso
                style={{ height: '70vh' }}
                totalCount={projectRows.length}
                itemContent={renderRow}
                overscan={2}
                data={projectRows}
            />
        </ProjectCardSurfaceProvider>
    );
};

interface VirtualizedWorkspaceGridProps {
    workspaces: Workspace[]
    onSelectWorkspace?: (workspace: Workspace) => void
    showWorkspaceMenu: string | null
    setShowWorkspaceMenu: (id: string | null) => void
    projectStateMachine: VirtualizedProjectGridProps['projectStateMachine']
    itemsPerRow?: number
    itemHeight?: number
    t?: (key: string) => string
}

export const VirtualizedWorkspaceGrid: React.FC<VirtualizedWorkspaceGridProps> = ({
    workspaces,
    onSelectWorkspace,
    showWorkspaceMenu,
    setShowWorkspaceMenu,
    projectStateMachine,
    itemsPerRow,
    itemHeight,
    t
}) => (
    <VirtualizedProjectGrid
        projects={workspaces}
        onSelectProject={onSelectWorkspace}
        showProjectMenu={showWorkspaceMenu}
        setShowProjectMenu={setShowWorkspaceMenu}
        projectStateMachine={projectStateMachine}
        itemsPerRow={itemsPerRow}
        itemHeight={itemHeight}
        t={t}
    />
);

export default VirtualizedProjectGrid;
