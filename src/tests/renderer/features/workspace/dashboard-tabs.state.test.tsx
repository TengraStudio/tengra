import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DashboardTabs } from '@/features/workspace/components/workspace/DashboardTabs';
import { WorkspaceDashboardTab } from '@/types';

const renderDashboardTabs = (
    dashboardTab: WorkspaceDashboardTab,
    onDashboardTabChange: (tab: WorkspaceDashboardTab) => void
) => {
    render(
        <DashboardTabs
            dashboardTab={dashboardTab}
            onDashboardTabChange={onDashboardTabChange}
            handleRunWorkspace={vi.fn()}
            t={(key: string) => key}
        />
    );
};

describe('DashboardTabs state transitions', () => {
    it('emits tab transition when a non-active tab is clicked', () => {
        const onDashboardTabChange = vi.fn();
        renderDashboardTabs('overview', onDashboardTabChange);

        fireEvent.click(screen.getByTitle('workspaceDashboard.search'));

        expect(onDashboardTabChange).toHaveBeenCalledWith('search');
    });

    it('keeps active state when rerendered with new tab', () => {
        const onDashboardTabChange = vi.fn();
        const { rerender } = render(
            <DashboardTabs
                dashboardTab="overview"
                onDashboardTabChange={onDashboardTabChange}
                handleRunWorkspace={vi.fn()}
                t={(key: string) => key}
            />
        );

        fireEvent.click(screen.getByTitle('workspaceDashboard.git'));
        rerender(
            <DashboardTabs
                dashboardTab="git"
                onDashboardTabChange={onDashboardTabChange}
                handleRunWorkspace={vi.fn()}
                t={(key: string) => key}
            />
        );

        const gitButton = screen.getByTitle('workspaceDashboard.git');
        expect(gitButton.className).toContain('bg-primary');
    });
});
