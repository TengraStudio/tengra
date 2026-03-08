import {
    WORKSPACE_COMPAT_ALIAS_VALUES,
    WORKSPACE_COMPAT_TARGET_VALUES
} from '@shared/constants';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceContentHub } from '@/features/workspace/components/workspace/WorkspaceContentHub';
import { Workspace } from '@/types';
import { webElectronMock } from '@/web-bridge';

vi.mock('@/data/workspace-content-packs', () => ({
    autocompleteMasteryGuide: {
        triggerModes: ['Use inline completions']
    },
    editorPowerWorkflows: ['Use command palette shortcuts'],
    onboardingChecklist: [
        {
            id: 'check-1',
            title: 'Verify SSH access',
            description: 'Make sure remote access is ready.'
        }
    ],
    remoteTeamStandardsTemplates: [
        {
            id: 'template-1',
            name: 'Standard Template',
            updates: {}
        }
    ],
    troubleshootKnowledgeBase: [
        {
            id: 'kb-1',
            signature: 'ssh timeout',
            fixCommand: 'ssh reconnect',
            docsLink: 'https://example.com/docs'
        }
    ],
    walkthroughScripts: ['Run onboarding walkthrough'],
    workspaceSshPlaybook: {
        scenarios: ['Connect to the remote host'],
        failureSignatures: ['SSH timeout']
    }
}));

vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

const workspaceFixture = {
    id: 'workspace-1',
    title: 'Workspace One',
    description: 'Primary workspace',
    path: 'C:\\workspace\\one',
    mounts: [],
    createdAt: 1,
    updatedAt: 1,
    chatIds: [],
    councilConfig: {
        enabled: false,
        members: [],
        consensusThreshold: 0.7
    },
    status: 'active'
} satisfies Workspace;

const memoryStorageKey = 'workspace.memory.sync:v1:workspace-1';
const legacyScopeCases = [
    [
        WORKSPACE_COMPAT_ALIAS_VALUES.SINGULAR,
        WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE
    ],
    [
        WORKSPACE_COMPAT_ALIAS_VALUES.RELATED_PLURAL,
        WORKSPACE_COMPAT_TARGET_VALUES.RELATED_WORKSPACES
    ]
] as const;

function renderWorkspaceContentHub() {
    return render(
        <WorkspaceContentHub
            workspace={workspaceFixture}
            onApplyTemplate={vi.fn(async () => undefined)}
        />
    );
}

describe('WorkspaceContentHub memory scope compatibility', () => {
    beforeEach(() => {
        localStorage.clear();
        window.electron = {
            ...webElectronMock,
            clipboard: {
                ...webElectronMock.clipboard,
                writeText: vi.fn(async () => ({ success: true }))
            }
        };
    });

    it.each(legacyScopeCases)(
        'normalizes legacy "%s" scope from localStorage to "%s"',
        async (legacyScope, expectedScope) => {
            localStorage.setItem(
                memoryStorageKey,
                JSON.stringify({ enabled: true, scope: legacyScope })
            );

            renderWorkspaceContentHub();

            const syncToggle = screen.getByLabelText('Sync related-workspace memory') as HTMLInputElement;
            const scopeSelect = screen.getByRole('combobox') as HTMLSelectElement;

            await waitFor(() => {
                expect(syncToggle.checked).toBe(true);
                expect(scopeSelect.value).toBe(expectedScope);
            });
        }
    );

    it('writes canonical workspace scope after legacy settings are updated', async () => {
        localStorage.setItem(
            memoryStorageKey,
            JSON.stringify({ enabled: true, scope: WORKSPACE_COMPAT_ALIAS_VALUES.SINGULAR })
        );

        renderWorkspaceContentHub();

        const syncToggle = screen.getByLabelText('Sync related-workspace memory') as HTMLInputElement;
        const scopeSelect = screen.getByRole('combobox') as HTMLSelectElement;

        await waitFor(() => {
            expect(scopeSelect.value).toBe(WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE);
        });

        fireEvent.click(syncToggle);
        expect(JSON.parse(localStorage.getItem(memoryStorageKey) ?? '{}')).toEqual({
            enabled: false,
            scope: WORKSPACE_COMPAT_TARGET_VALUES.WORKSPACE
        });

        fireEvent.change(scopeSelect, { target: { value: WORKSPACE_COMPAT_TARGET_VALUES.RELATED_WORKSPACES } });
        expect(JSON.parse(localStorage.getItem(memoryStorageKey) ?? '{}')).toEqual({
            enabled: false,
            scope: WORKSPACE_COMPAT_TARGET_VALUES.RELATED_WORKSPACES
        });
    });
});
