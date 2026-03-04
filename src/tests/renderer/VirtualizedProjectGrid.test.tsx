import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VirtualizedProjectGrid } from '@/features/workspace/components/VirtualizedProjectGrid';
import { Project } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

vi.mock('react-virtuoso', () => ({
    Virtuoso: ({ totalCount, itemContent }: { totalCount: number; itemContent: (index: number) => React.ReactNode }) => (
        <div data-testid="virtuoso">
            {Array.from({ length: totalCount }).map((_, index) => (
                <div key={index}>{itemContent(index)}</div>
            ))}
        </div>
    )
}));

function createProject(index: number): Project {
    return {
        id: `project-${index}`,
        title: `Project ${index}`,
        description: `Project ${index} description`,
        path: `C:/workspace/project-${index}`,
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

describe('VirtualizedProjectGrid telemetry', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('logs threshold state changes for virtualization', async () => {
        const debugSpy = vi.spyOn(appLogger, 'debug').mockImplementation(() => {});
        vi.spyOn(performance, 'now').mockReturnValue(0);
        const projectStateMachine = {
            startEdit: vi.fn(),
            startDelete: vi.fn(),
            startArchive: vi.fn(),
            toggleSelection: vi.fn(),
            state: {
                selectedProjectIds: new Set<string>()
            }
        };
        const t = (key: string): string => key;
        const { rerender } = render(
            <VirtualizedProjectGrid
                projects={Array.from({ length: 11 }, (_, index) => createProject(index))}
                onSelectProject={vi.fn()}
                showProjectMenu={null}
                setShowProjectMenu={vi.fn()}
                projectStateMachine={projectStateMachine}
                itemsPerRow={3}
                t={t}
            />
        );

        rerender(
            <VirtualizedProjectGrid
                projects={Array.from({ length: 12 }, (_, index) => createProject(index))}
                onSelectProject={vi.fn()}
                showProjectMenu={null}
                setShowProjectMenu={vi.fn()}
                projectStateMachine={projectStateMachine}
                itemsPerRow={3}
                t={t}
            />
        );

        await waitFor(() => {
            expect(debugSpy).toHaveBeenCalledWith(
                'VirtualizedProjectGrid',
                'Virtualization threshold state changed',
                expect.objectContaining({
                    projectCount: 11,
                    virtualizationThreshold: 12,
                    itemsPerRow: 3,
                    isThresholdReached: false
                })
            );
            expect(debugSpy).toHaveBeenCalledWith(
                'VirtualizedProjectGrid',
                'Virtualization threshold state changed',
                expect.objectContaining({
                    projectCount: 12,
                    virtualizationThreshold: 12,
                    itemsPerRow: 3,
                    isThresholdReached: true
                })
            );
        });
    });
});
