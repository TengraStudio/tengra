/**
 * Virtualized Project Grid Component
 * Uses react-virtuoso for efficient rendering of large project lists
 */

import { Project } from '@shared/types/project';
import React, { useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { ProjectCard } from './ProjectCard';

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
}

export const VirtualizedProjectGrid: React.FC<VirtualizedProjectGridProps> = ({
    projects,
    onSelectProject,
    showProjectMenu,
    setShowProjectMenu,
    projectStateMachine: sm,
    itemsPerRow = 3,
    itemHeight = 280
}) => {
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
                        onSelect={(p) => onSelectProject?.(p)}
                        showMenu={showProjectMenu === project.id}
                        setShowMenu={setShowProjectMenu}
                        onEdit={(p, e) => { 
                            setShowProjectMenu(null);
                            sm.startEdit(p, e); 
                        }}
                        onDelete={(p, e) => { 
                            setShowProjectMenu(null);
                            sm.startDelete(p, e); 
                        }}
                        onArchive={(p) => sm.startArchive(p)}
                        isSelected={sm.state.selectedProjectIds.has(project.id)}
                        onToggleSelection={() => sm.toggleSelection(project.id)}
                        t={(key: string) => key} // Add required t prop
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
        <Virtuoso
            style={{ height: '70vh' }}
            totalCount={projectRows.length}
            itemContent={renderRow}
            overscan={2}
            data={projectRows}
        />
    );
};

export default VirtualizedProjectGrid;
