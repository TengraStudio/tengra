/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceCard, WorkspaceCardSurfaceProvider } from '@/features/workspace/workspace-layout/WorkspaceCard';
import { Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

describe('WorkspaceCard', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const t = (key: string) => key;

    const workspace: Workspace = {
        id: 'workspace-1',
        title: 'Orbit Workspace',
        description: 'Test workspace',
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
                    workspace={workspace}
                    index={0}
                />
            </WorkspaceCardSurfaceProvider>
        );

        const card = screen.getByRole('button', { name: 'Orbit Workspace' });
        fireEvent.keyDown(card, { key: 'Enter' });
        expect(onSelect).toHaveBeenCalledWith(workspace);
    });

    it('opens actions and triggers archive', () => {
        const onArchive = vi.fn();
        const setShowMenu = vi.fn();

        render(
            <WorkspaceCardSurfaceProvider
                onSelect={vi.fn()}
                activeMenuId={workspace.id}
                setActiveMenuId={setShowMenu}
                onEdit={vi.fn()}
                onDelete={vi.fn()}
                onArchive={onArchive}
                t={t}
            >
                <WorkspaceCard
                    workspace={workspace}
                    index={0}
                />
            </WorkspaceCardSurfaceProvider>
        );

        fireEvent.click(screen.getByRole('menuitem', { name: 'workspaces.archiveWorkspace' }));
        expect(onArchive).toHaveBeenCalledWith(workspace);
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
                    workspace={workspace}
                    index={2}
                />
            </WorkspaceCardSurfaceProvider>
        );

        await waitFor(() => {
            expect(debugSpy).toHaveBeenCalledWith(
                'WorkspaceCard',
                'Slow workspace card render detected',
                expect.objectContaining({
                    workspaceId: workspace.id,
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
