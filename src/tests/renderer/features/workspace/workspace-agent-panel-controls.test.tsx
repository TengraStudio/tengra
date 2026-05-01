/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type {
    CouncilRunConfig,
    WorkspaceAgentPermissionPolicy,
    WorkspaceAgentSessionModes,
    WorkspaceAgentSessionSummary,
} from '@shared/types/workspace-agent-session';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WorkspaceAgentComposer } from '@/features/workspace/components/workspace/WorkspaceAgentComposer';
import { WorkspaceAgentPanelHeader } from '@/features/workspace/components/workspace/WorkspaceAgentPanelHeader';
import { WorkspaceAgentSessionModal } from '@/features/workspace/components/workspace/WorkspaceAgentSessionModal';

vi.mock('@/components/shared/ModelSelector', () => ({
    ModelSelector: () => <div data-testid="model-selector" />,
}));

vi.mock('@/components/ui/modal', () => ({
    Modal: ({
        children,
        isOpen,
        title,
    }: {
        children: ReactNode;
        isOpen: boolean;
        title: string;
    }) => (isOpen ? <div aria-label={title}>{children}</div> : null),
}));

vi.mock('@/components/ui/scroll-area', () => ({
    ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/AnimatedProgressBar', () => ({
    AnimatedProgressBar: () => <div data-testid="animated-progress-bar" />,
}));

function createPermissionPolicy(): WorkspaceAgentPermissionPolicy {
    return {
        commandPolicy: 'ask-every-time',
        pathPolicy: 'workspace-root-only',
        allowedCommands: [],
        disallowedCommands: [],
        allowedPaths: ['c:/workspace'],
    };
}

function createModes(overrides?: Partial<WorkspaceAgentSessionModes>): WorkspaceAgentSessionModes {
    return {
        ask: true,
        plan: false,
        agent: false,
        council: false,
        ...overrides,
    };
}

function createSessionSummary(
    overrides?: Partial<WorkspaceAgentSessionSummary>
): WorkspaceAgentSessionSummary {
    return {
        id: overrides?.id ?? 'session-1',
        workspaceId: overrides?.workspaceId ?? 'workspace-1',
        title: overrides?.title ?? 'Session One',
        status: overrides?.status ?? 'active',
        updatedAt: overrides?.updatedAt ?? 100,
        createdAt: overrides?.createdAt ?? 50,
        messageCount: overrides?.messageCount ?? 3,
        lastMessagePreview: overrides?.lastMessagePreview ?? 'preview',
        modes: overrides?.modes ?? createModes(),
        strategy: overrides?.strategy ?? 'reasoning-first',
        permissionPolicy: overrides?.permissionPolicy ?? createPermissionPolicy(),
        contextTelemetry: overrides?.contextTelemetry,
        councilConfig: overrides?.councilConfig,
        background: overrides?.background ?? false,
        archived: overrides?.archived ?? false,
    };
}

function createCouncilSetup(): CouncilRunConfig {
    return {
        enabled: false,
        chairman: { mode: 'auto' },
        strategy: 'reasoning-first',
        requestedSubagentCount: 'auto',
        activeView: 'board',
    };
}

describe('WorkspaceAgentSessionModal', () => {
    const t = (key: string) => key;

    it('selects a session and closes the picker', () => {
        const onClose = vi.fn();
        const onSelectSession = vi.fn();

        render(
            <WorkspaceAgentSessionModal
                isOpen
                sessions={[createSessionSummary(), createSessionSummary({ id: 'session-2', title: 'Session Two' })]}
                currentSessionId="session-2"
                onClose={onClose}
                onSelectSession={onSelectSession}
                onArchiveSession={vi.fn()}
                onDeleteSession={vi.fn()}
                onRenameSession={vi.fn(async () => undefined)}
                t={t}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Session One preview' }));

        expect(onSelectSession).toHaveBeenCalledWith('session-1');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renames a session from inline edit controls', async () => {
        const onRenameSession = vi.fn(async () => undefined);

        render(
            <WorkspaceAgentSessionModal
                isOpen
                sessions={[createSessionSummary()]}
                currentSessionId="session-1"
                onClose={vi.fn()}
                onSelectSession={vi.fn()}
                onArchiveSession={vi.fn()}
                onDeleteSession={vi.fn()}
                onRenameSession={onRenameSession}
                t={t}
            />
        );

        fireEvent.click(screen.getByTitle('common.edit'));
        fireEvent.change(screen.getByDisplayValue('Session One'), {
            target: { value: 'Renamed Session' },
        });
        await act(async () => {
            fireEvent.keyDown(screen.getByDisplayValue('Renamed Session'), { key: 'Enter' });
        });

        expect(onRenameSession).toHaveBeenCalledWith('session-1', 'Renamed Session');
    });

    it('archives a session from the action row', () => {
        const onArchiveSession = vi.fn();

        render(
            <WorkspaceAgentSessionModal
                isOpen
                sessions={[createSessionSummary()]}
                currentSessionId="session-1"
                onClose={vi.fn()}
                onSelectSession={vi.fn()}
                onArchiveSession={onArchiveSession}
                onDeleteSession={vi.fn()}
                onRenameSession={vi.fn(async () => undefined)}
                t={t}
            />
        );

        fireEvent.click(screen.getByTitle('common.delete'));

        expect(onArchiveSession).toHaveBeenCalledWith('session-1', true);
    });
});

describe('WorkspaceAgentPanelHeader', () => {
    const t = (key: string) => key;

    it('archives from the recent session rail', () => {
        const onArchiveSession = vi.fn();

        render(
            <WorkspaceAgentPanelHeader
                recentSessions={[createSessionSummary()]}
                currentSession={null}
                onSelectSession={vi.fn()}
                onArchiveSession={onArchiveSession}
                onDeleteSession={vi.fn()}
                onOpenSessionPicker={vi.fn()}
                onCreateSession={vi.fn()}
                t={t}
            />
        );

        fireEvent.click(screen.getByTitle('frontend.memory.archive'));

        expect(onArchiveSession).toHaveBeenCalledWith('session-1', true);
    });
});

describe('WorkspaceAgentComposer', () => {
    const t = (key: string) => key;

    function renderComposer(overrides?: {
        councilSetup?: CouncilRunConfig;
        currentModes?: WorkspaceAgentSessionModes;
        currentSession?: WorkspaceAgentSessionSummary | null;
        showCouncilSetup?: boolean;
        isLoading?: boolean;
        composerValue?: string;
    }) {
        const onSend = vi.fn();
        const onStop = vi.fn();
        const onToggleMode = vi.fn();
        const onSelectMode = vi.fn();
        const onApplyCouncilSetup = vi.fn();
        const onUpdatePermissions = vi.fn(async () => undefined);
        const setComposerValue = vi.fn();

        render(
            <WorkspaceAgentComposer
                currentSession={overrides?.currentSession ?? createSessionSummary()}
                currentModes={overrides?.currentModes ?? createModes()}
                currentPermissionPolicy={
                    overrides?.currentSession?.permissionPolicy ?? createPermissionPolicy()
                }
                composerValue={overrides?.composerValue ?? 'Investigate auth flow'}
                setComposerValue={setComposerValue}
                deliveryMode="send"
                setDeliveryMode={vi.fn()}
                queuedMessageCount={0}
                onSend={onSend}
                onStop={onStop}
                onToggleCouncil={onToggleMode}
                onSelectPreset={onSelectMode}
                showCouncilSetup={overrides?.showCouncilSetup ?? false}
                councilSetup={overrides?.councilSetup ?? createCouncilSetup()}
                setCouncilSetup={vi.fn()}
                onApplyCouncilSetup={onApplyCouncilSetup}
                onUpdatePermissionPolicy={onUpdatePermissions}
                isLoading={overrides?.isLoading ?? false}
                selectedProvider="claude"
                selectedModel="sonnet"
                groupedModels={null}
                setSelectedProvider={vi.fn()}
                setSelectedModel={vi.fn()}
                persistLastSelection={vi.fn()}
                t={t}
            />
        );

        return {
            onSend,
            onStop,
            onToggleMode,
            onSelectMode,
            onApplyCouncilSetup,
            onUpdatePermissions,
        };
    }

    it('routes preset selection and council toggle through the shared control surface', () => {
        const { onSelectMode, onToggleMode } = renderComposer();

        fireEvent.click(screen.getByTitle('frontend.workspaceAgent.permissions.profile'));
        fireEvent.mouseEnter(screen.getByTitle('frontend.workspaceAgent.permissions.profile'));
        fireEvent.click(screen.getByText('frontend.workspaceAgent.executeAction'));
        fireEvent.click(screen.getByTitle('frontend.agents.council'));

        expect(onSelectMode).toHaveBeenCalledWith('agent');
        expect(onToggleMode).toHaveBeenCalledTimes(1);
    });

    it('sends on Enter and steers when already loading', () => {
        const firstRender = renderComposer({ composerValue: 'Ship the fix' });

        fireEvent.keyDown(screen.getByPlaceholderText('frontend.workspace.writeSomething'), {
            key: 'Enter',
            shiftKey: false,
        });
        expect(firstRender.onSend).toHaveBeenCalledWith('send');

        const loadingRender = renderComposer({
            composerValue: 'Ship the fix',
            isLoading: true,
        });

        fireEvent.keyDown(screen.getAllByPlaceholderText('frontend.workspace.writeSomething')[1], {
            key: 'Enter',
            shiftKey: false,
        });
        expect(loadingRender.onSend).toHaveBeenCalledWith('steer');
    });

    it('queues message on Ctrl+Enter', () => {
        const { onSend } = renderComposer({ composerValue: 'Queue this' });

        fireEvent.keyDown(screen.getByPlaceholderText('frontend.workspace.writeSomething'), {
            key: 'Enter',
            ctrlKey: true,
            shiftKey: false,
        });
        expect(onSend).toHaveBeenCalledWith('queue');
    });

    it('shows inline council setup and applies it from the composer surface', () => {
        const { onApplyCouncilSetup } = renderComposer({ showCouncilSetup: true });

        fireEvent.click(screen.getByRole('button', { name: 'frontend.agents.runCouncil' }));

        expect(onApplyCouncilSetup).toHaveBeenCalledTimes(1);
    });

    it('shows council summary chips without command and file policy badges', () => {
        renderComposer({
            showCouncilSetup: true,
            councilSetup: {
                ...createCouncilSetup(),
                requestedSubagentCount: 8,
            },
            currentSession: createSessionSummary({
                permissionPolicy: {
                    commandPolicy: 'allowlist',
                    pathPolicy: 'workspace-root-only',
                    allowedCommands: ['npm', 'git'],
                    disallowedCommands: [],
                    allowedPaths: ['c:/workspace'],
                },
            }),
        });

        expect(screen.queryByText('common.commands: allowlist')).not.toBeInTheDocument();
        expect(screen.queryByText('frontend.workspace.files: workspace-root-only')).not.toBeInTheDocument();
        expect(screen.getAllByText('reasoning-first').length).toBeGreaterThan(0);
        expect(screen.getAllByText('8').length).toBeGreaterThan(0);
    });

    it('edits command and path allowlists when allowlist policies are active', () => {
        const { onUpdatePermissions } = renderComposer({
            currentSession: createSessionSummary({
                permissionPolicy: {
                    commandPolicy: 'allowlist',
                    pathPolicy: 'allowlist',
                    allowedCommands: ['npm'],
                    disallowedCommands: [],
                    allowedPaths: ['c:/workspace'],
                },
            }),
        });

        const inputs = screen.getAllByPlaceholderText('common.selectEllipsis');
        fireEvent.change(inputs[0], { target: { value: 'git' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'common.add' })[0]);

        expect(onUpdatePermissions).toHaveBeenCalledWith(
            expect.objectContaining({
                allowedCommands: ['npm', 'git'],
            })
        );

        fireEvent.change(inputs[1], { target: { value: 'c:/workspace/src' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'common.add' })[1]);

        expect(onUpdatePermissions).toHaveBeenCalledWith(
            expect.objectContaining({
                allowedPaths: ['c:/workspace', 'c:/workspace/src'],
            })
        );

        fireEvent.click(screen.getByRole('button', { name: 'common.delete c:/workspace' }));

        expect(onUpdatePermissions).toHaveBeenCalledWith(
            expect.objectContaining({
                allowedPaths: [],
            })
        );
    });
});
