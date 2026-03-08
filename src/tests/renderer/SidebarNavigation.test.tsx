import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SidebarNavigation } from '@/components/layout/sidebar/SidebarNavigation';
import type { AppView } from '@/hooks/useAppState';

describe('SidebarNavigation', () => {
    const t = (key: string) => key;

    it('renders navigation landmark', () => {
        render(
            <SidebarNavigation
                currentView={'chat' as AppView}
                onChangeView={vi.fn()}
                isCollapsed={false}
                chatsCount={3}
                t={t}
            />
        );

        expect(screen.getByRole('navigation', { name: 'aria.sidebarNavigation' })).toBeInTheDocument();
    });

    it('triggers view change on item click', () => {
        const onChangeView = vi.fn();

        render(
            <SidebarNavigation
                currentView={'chat' as AppView}
                onChangeView={onChangeView}
                isCollapsed={false}
                chatsCount={0}
                t={t}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'sidebar.workspaces' }));
        expect(onChangeView).toHaveBeenCalledWith('workspace');
    });
});
