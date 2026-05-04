/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WorkspaceSettingsPanel } from '@/features/workspace/workspace-dashboard/WorkspaceSettingsPanel';
import type { Workspace } from '@/types';

vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('@/context/SettingsContext', () => ({
    useSettings: () => ({
        settings: { general: { language: 'en' } },
        updateSettings: vi.fn(),
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
        setActiveSection: (section: 'general' | 'intelligence' | 'council' | 'git' | 'workspace' | 'pipelines') => void
    }) => (
        <button type="button" onClick={() => setActiveSection('intelligence')}>
            open intelligence
        </button>
    ),
}));

vi.mock('@/features/workspace/components/settings/GeneralSection', () => ({
    GeneralSection: () => <div>general-section</div>,
}));

vi.mock('@/features/workspace/components/settings/IntelligenceSection', () => ({
    IntelligenceSection: () => <div>intelligence-section</div>,
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

vi.mock('@/features/workspace/components/settings/EditorSection', () => ({
    EditorSection: () => null,
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
                onAddMount={vi.fn()}
                onRemoveMount={vi.fn()}
            />
        );

        expect(screen.getByLabelText('frontend.aria.workspaceSettingsPanel')).toBeInTheDocument();
        expect(screen.getByText('general-section')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'open intelligence' }));
        expect(screen.getByText('intelligence-section')).toBeInTheDocument();
    });
});
