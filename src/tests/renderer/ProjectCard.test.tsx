import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectCard, ProjectCardSurfaceProvider } from '@/features/projects/components/ProjectCard';
import { Project } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

describe('ProjectCard', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const t = (key: string) => key;

    const project: Project = {
        id: 'proj-1',
        title: 'Orbit Project',
        description: 'Test project',
        path: 'C:/workspace/orbit',
        mounts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        chatIds: [],
        councilConfig: {
            enabled: false,
            members: [],
            consensusThreshold: 0.7
        },
        status: 'active',
    };

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

    it('logs telemetry for slow render duration', async () => {
        const debugSpy = vi.spyOn(appLogger, 'debug').mockImplementation(() => {});
        let currentNow = 0;
        const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => {
            currentNow += 15;
            return currentNow;
        });
        const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback): number => {
            callback(0);
            return 1;
        });
        const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

        render(
            <ProjectCardSurfaceProvider
                onSelect={vi.fn()}
                activeMenuId={null}
                setActiveMenuId={vi.fn()}
                onEdit={vi.fn()}
                onDelete={vi.fn()}
                onArchive={vi.fn()}
                t={t}
            >
                <ProjectCard
                    project={project}
                    index={2}
                />
            </ProjectCardSurfaceProvider>
        );

        await waitFor(() => {
            expect(debugSpy).toHaveBeenCalledWith(
                'ProjectCard',
                'Slow project card render detected',
                expect.objectContaining({
                    projectId: project.id,
                    cardIndex: 2,
                    renderDurationMs: expect.any(Number),
                    thresholdMs: 10
                })
            );
        });
        const telemetryCall = debugSpy.mock.calls.find((call) => call[0] === 'ProjectCard');
        expect(telemetryCall).toBeDefined();
        const telemetryPayload = telemetryCall?.[2] as { renderDurationMs: number };
        expect(telemetryPayload.renderDurationMs).toBeGreaterThanOrEqual(10);

        nowSpy.mockRestore();
        requestAnimationFrameSpy.mockRestore();
        cancelAnimationFrameSpy.mockRestore();
    });
});
