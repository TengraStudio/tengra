import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WorkspaceSettingsPanel as WorkspaceSettingsPanel } from '@/features/workspace/components/WorkspaceSettingsPanel';
import type { Workspace } from '@/types';

vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('@/features/workspace/hooks/useWorkspaceSettingsForm', () => ({
    useWorkspaceSettingsForm: () => ({
        formData: {},
        setFormData: vi.fn(),
        isDirty: false,
        handleSave: vi.fn(async () => {}),
        handleReset: vi.fn(),
        toggleMember: vi.fn(),
    }),
}));

vi.mock('@/features/workspace/components/settings/SettingsHeader', () => ({
    SettingsHeader: () => <div data-testid="settings-header" />,
}));

vi.mock('@/features/workspace/components/settings/SettingsSidebar', () => ({
    SettingsSidebar: ({
        setActiveSection,
    }: {
        setActiveSection: (section: 'general' | 'advanced') => void
    }) => (
        <button type="button" onClick={() => setActiveSection('advanced')}>
            open advanced
        </button>
    ),
}));

vi.mock('@/features/workspace/components/settings/GeneralSection', () => ({
    GeneralSection: () => <div>general-section</div>,
}));

vi.mock('@/features/workspace/components/settings/AdvancedSection', () => ({
    AdvancedSection: () => <div>advanced-section</div>,
}));

vi.mock('@/features/workspace/components/settings/CouncilSection', () => ({
    CouncilSection: () => null,
}));

vi.mock('@/features/workspace/components/settings/BuildSection', () => ({
    BuildSection: () => null,
}));

vi.mock('@/features/workspace/components/settings/DevServerSection', () => ({
    DevServerSection: () => null,
}));

vi.mock('@/features/workspace/components/settings/WorkspaceSection', () => ({
    WorkspaceSection: () => null,
}));

describe('WorkspaceSettingsPanel', () => {
    const workspace: Workspace = {
        id: 'workspace-1',
        title: 'Demo Workspace',
        description: '',
        path: 'C:\\workspace\\demo',
        mounts: [],
        createdAt: 1,
        updatedAt: 1,
        chatIds: [],
        councilConfig: {
            enabled: false,
            members: [],
            consensusThreshold: 0.7,
        },
        status: 'active',
    };

    it('renders landmark and switches sections', () => {
        render(
            <WorkspaceSettingsPanel
                workspace={workspace}
                onUpdate={vi.fn(async () => {})}
                language={'en'}
                availableAgents={[]}
                onAddMount={vi.fn()}
                onRemoveMount={vi.fn()}
            />
        );

        expect(screen.getByLabelText('aria.workspaceSettingsPanel')).toBeInTheDocument();
        expect(screen.getByText('general-section')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'open advanced' }));
        expect(screen.getByText('advanced-section')).toBeInTheDocument();
    });
});
