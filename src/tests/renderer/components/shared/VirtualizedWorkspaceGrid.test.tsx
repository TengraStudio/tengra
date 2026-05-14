/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@system/utils/renderer-logger';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VirtualizedWorkspaceGrid } from '@/features/workspace/workspace-layout/VirtualizedWorkspaceGrid';
import { Workspace } from '@/types';

vi.mock('react-virtuoso', () => ({
    Virtuoso: ({ totalCount, itemContent }: { totalCount: number; itemContent: (index: number) => React.ReactNode }) => (
        <div data-testid="virtuoso">
            {Array.from({ length: totalCount }).map((_, index) => (
                <div key={index}>{itemContent(index)}</div>
            ))}
        </div>
    )
}));

function createWorkspace(index: number): Workspace {
    return {
        id: `workspace-${index}`,
        title: `Workspace ${index}`,
        description: `Workspace ${index} description`,
        path: `/workspaces/demo-workspace-${index}`,
        mounts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        chatIds: [],
        councilConfig: {
            enabled: false,
            members: [],
            consensusThreshold: 0.7
        },
        status: 'active'
    };
}

describe('VirtualizedWorkspaceGrid Stats', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('logs threshold state changes for virtualization', async () => {
        const debugSpy = vi.spyOn(appLogger, 'debug').mockImplementation(() => { });
        vi.spyOn(performance, 'now').mockReturnValue(0);
        const workspaceStateMachine = {
            startEdit: vi.fn(),
            startDelete: vi.fn(),
            startArchive: vi.fn(),
            toggleSelection: vi.fn(),
            state: {
                selectedWorkspaceIds: new Set<string>()
            }
        };
        const t = (key: string): string => key;
        const { rerender } = render(
            <VirtualizedWorkspaceGrid
                workspaces={Array.from({ length: 11 }, (_, index) => createWorkspace(index))}
                onSelectWorkspace={vi.fn()}
                showWorkspaceMenu={null}
                setShowWorkspaceMenu={vi.fn()}
                workspaceStateMachine={workspaceStateMachine}
                itemsPerRow={3}
                t={t}
            />
        );

        rerender(
            <VirtualizedWorkspaceGrid
                workspaces={Array.from({ length: 12 }, (_, index) => createWorkspace(index))}
                onSelectWorkspace={vi.fn()}
                showWorkspaceMenu={null}
                setShowWorkspaceMenu={vi.fn()}
                workspaceStateMachine={workspaceStateMachine}
                itemsPerRow={3}
                t={t}
            />
        );

        await waitFor(() => {
            expect(debugSpy).toHaveBeenCalledWith(
                'VirtualizedWorkspaceGrid',
                'Virtualization threshold state changed',
                expect.objectContaining({
                    workspaceCount: 11,
                    virtualizationThreshold: 12,
                    itemsPerRow: 3,
                    isThresholdReached: false
                })
            );
            expect(debugSpy).toHaveBeenCalledWith(
                'VirtualizedWorkspaceGrid',
                'Virtualization threshold state changed',
                expect.objectContaining({
                    workspaceCount: 12,
                    virtualizationThreshold: 12,
                    itemsPerRow: 3,
                    isThresholdReached: true
                })
            );
        });
    });
});

