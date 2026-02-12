import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProjectCard } from '@/features/projects/components/ProjectCard';

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
            <ProjectCard
                project={project}
                index={0}
                onSelect={onSelect}
                showMenu={false}
                setShowMenu={vi.fn()}
                onEdit={vi.fn()}
                onDelete={vi.fn()}
                onArchive={vi.fn()}
                t={t}
            />
        );

        const card = screen.getByRole('button', { name: 'Orbit Project' });
        fireEvent.keyDown(card, { key: 'Enter' });
        expect(onSelect).toHaveBeenCalledWith(project);
    });

    it('opens actions and triggers archive', () => {
        const onArchive = vi.fn();
        const setShowMenu = vi.fn();

        render(
            <ProjectCard
                project={project}
                index={0}
                onSelect={vi.fn()}
                showMenu={true}
                setShowMenu={setShowMenu}
                onEdit={vi.fn()}
                onDelete={vi.fn()}
                onArchive={onArchive}
                t={t}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'projects.archiveProject' }));
        expect(onArchive).toHaveBeenCalledWith(project);
        expect(setShowMenu).toHaveBeenCalledWith(null);
    });
});
