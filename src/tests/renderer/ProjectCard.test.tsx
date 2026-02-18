import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProjectCard, ProjectCardSurfaceProvider } from '@/features/projects/components/ProjectCard';

describe('ProjectCard', () => {
    const t = (key: string) => key;

    const project = {
        id: 'proj-1',
        title: 'Orbit Project',
        path: 'C:/workspace/orbit',
        createdAt: Date.now(),
        status: 'active',
        logo: null,
    } as any;

    it('supports keyboard selection via Enter', () => {
        const onSelect = vi.fn();

        render(
            <ProjectCardSurfaceProvider
                onSelect={onSelect}
                activeMenuId={null}
                setActiveMenuId={vi.fn()}
                onEdit={vi.fn()}
                onDelete={vi.fn()}
                onArchive={vi.fn()}
                t={t}
            >
                <ProjectCard
                    project={project}
                    index={0}
                />
            </ProjectCardSurfaceProvider>
        );

        const card = screen.getByRole('button', { name: 'Orbit Project' });
        fireEvent.keyDown(card, { key: 'Enter' });
        expect(onSelect).toHaveBeenCalledWith(project);
    });

    it('opens actions and triggers archive', () => {
        const onArchive = vi.fn();
        const setShowMenu = vi.fn();

        render(
            <ProjectCardSurfaceProvider
                onSelect={vi.fn()}
                activeMenuId={project.id}
                setActiveMenuId={setShowMenu}
                onEdit={vi.fn()}
                onDelete={vi.fn()}
                onArchive={onArchive}
                t={t}
            >
                <ProjectCard
                    project={project}
                    index={0}
                />
            </ProjectCardSurfaceProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'projects.archiveProject' }));
        expect(onArchive).toHaveBeenCalledWith(project);
        expect(setShowMenu).toHaveBeenCalledWith(null);
    });
});
