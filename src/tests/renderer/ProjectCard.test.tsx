import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectCard as WorkspaceCard, ProjectCardSurfaceProvider as WorkspaceCardSurfaceProvider } from '@/features/workspace/components/WorkspaceCard';
import { Project } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

describe('WorkspaceCard', () => {
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
            <WorkspaceCardSurfaceProvider
                onSelect={onSelect}
                activeMenuId={null}
                setActiveMenuId={vi.fn()}
                onEdit={vi.fn()}
                onDelete={vi.fn()}
                onArchive={vi.fn()}
                t={t}
            >
                <WorkspaceCard
                    project={project}
                    index={0}
                />
            </WorkspaceCardSurfaceProvider>
        );

        const card = screen.getByRole('button', { name: 'Orbit Project' });
        fireEvent.keyDown(card, { key: 'Enter' });
        expect(onSelect).toHaveBeenCalledWith(project);
    });

    it('opens actions and triggers archive', () => {
        const onArchive = vi.fn();
        const setShowMenu = vi.fn();

        render(
            <WorkspaceCardSurfaceProvider
                onSelect={vi.fn()}
                activeMenuId={project.id}
                setActiveMenuId={setShowMenu}
                onEdit={vi.fn()}
                onDelete={vi.fn()}
                onArchive={onArchive}
                t={t}
            >
                <WorkspaceCard
                    project={project}
                    index={0}
                />
            </WorkspaceCardSurfaceProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'projects.archiveWorkspace' }));
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
            <WorkspaceCardSurfaceProvider
                onSelect={vi.fn()}
                activeMenuId={null}
                setActiveMenuId={vi.fn()}
                onEdit={vi.fn()}
                onDelete={vi.fn()}
                onArchive={vi.fn()}
                t={t}
            >
                <WorkspaceCard
                    project={project}
                    index={2}
                />
            </WorkspaceCardSurfaceProvider>
        );

        await waitFor(() => {
            expect(debugSpy).toHaveBeenCalledWith(
                'WorkspaceCard',
                'Slow project card render detected',
                expect.objectContaining({
                    projectId: project.id,
                    cardIndex: 2,
                    renderDurationMs: expect.any(Number),
                    thresholdMs: 10
                })
            );
        });
        const telemetryCall = debugSpy.mock.calls.find((call) => call[0] === 'WorkspaceCard');
        expect(telemetryCall).toBeDefined();
        const telemetryPayload = telemetryCall?.[2] as { renderDurationMs: number };
        expect(telemetryPayload.renderDurationMs).toBeGreaterThanOrEqual(10);

        nowSpy.mockRestore();
        requestAnimationFrameSpy.mockRestore();
        cancelAnimationFrameSpy.mockRestore();
    });
});
