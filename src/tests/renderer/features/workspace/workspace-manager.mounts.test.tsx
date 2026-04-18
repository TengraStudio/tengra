/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { SSHProfileTestResult } from '@shared/types/ssh';
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkspaceManager } from '@/features/workspace/hooks/useWorkspaceManager';
import { Workspace } from '@/types';
import { webElectronMock } from '@/web-bridge';

const workspaceFixture: Workspace = {
    id: 'workspace-mounts',
    title: 'Workspace Demo',
    description: 'Test workspace',
    path: 'C:\\workspaces\\demo-workspace',
    mounts: [
        {
            id: 'mount-local',
            name: 'Local',
            type: 'local',
            rootPath: 'C:\\workspaces\\demo-workspace',
        },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    chatIds: [],
    councilConfig: {
        enabled: false,
        members: [],
        consensusThreshold: 0.7,
    },
    status: 'active',
};

function mountElectronMock() {
    const updateWorkspace = vi.fn().mockResolvedValue({ success: true });
    const saveProfile = vi.fn().mockResolvedValue(true);
    const testProfile = vi.fn().mockResolvedValue({
        success: true,
        latencyMs: 30,
        authMethod: 'password',
        message: 'ok',
    } satisfies SSHProfileTestResult);
    const base = window.electron ?? webElectronMock;

    window.electron = {
        ...base,
        db: {
            ...base.db,
            updateWorkspace,
        },
        ssh: {
            ...base.ssh,
            isConnected: vi.fn().mockResolvedValue(false),
            saveProfile,
            testProfile,
        },
        log: {
            ...base.log,
            error: vi.fn() as typeof base.log.error,
            warn: vi.fn() as typeof base.log.warn,
        },
    };

    return { updateWorkspace, saveProfile, testProfile };
}

interface WorkspaceMountHarnessProps {
    workspace: Workspace;
    notify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const WorkspaceMountHarness: React.FC<WorkspaceMountHarnessProps> = ({ workspace, notify }) => {
    const manager = useWorkspaceManager({
        workspace,
        notify,
        logActivity: () => undefined,
        t: key => key,
    });
    const [testResult, setTestResult] = useState<SSHProfileTestResult | null>(null);

    return (
        <div>
            <div data-testid="mount-count">{manager.mounts.length}</div>
            <div data-testid="test-success">{String(Boolean(testResult?.success))}</div>
            <button
                onClick={() =>
                    manager.setMountForm({
                        type: 'ssh',
                        name: 'Prod',
                        rootPath: '',
                        host: '',
                        port: '22',
                        username: '',
                        authType: 'password',
                        password: '',
                        privateKey: '',
                        passphrase: '',
                        saveProfile: false,
                    })
                }
            >
                set-invalid-ssh
            </button>
            <button
                onClick={() =>
                    manager.setMountForm({
                        type: 'ssh',
                        name: 'Prod',
                        rootPath: '',
                        host: '10.0.0.2',
                        port: '22',
                        username: 'agnes',
                        authType: 'password',
                        password: 'pw',
                        privateKey: '',
                        passphrase: '',
                        saveProfile: true,
                    })
                }
            >
                set-valid-ssh
            </button>
            <button
                onClick={() => {
                    void manager.addMount();
                }}
            >
                add-mount
            </button>
            <button
                onClick={() => {
                    void manager.testConnection(manager.mountForm).then(result => {
                        setTestResult(result);
                    });
                }}
            >
                test-connection
            </button>
        </div>
    );
};

describe('useWorkspaceManager mount flows', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('blocks invalid SSH mount and keeps mount list unchanged', async () => {
        mountElectronMock();
        const notify = vi.fn<(type: 'success' | 'error' | 'info', message: string) => void>();

        render(<WorkspaceMountHarness workspace={workspaceFixture} notify={notify} />);
        expect(screen.getByTestId('mount-count').textContent).toBe('1');

        fireEvent.click(screen.getByRole('button', { name: 'set-invalid-ssh' }));
        fireEvent.click(screen.getByRole('button', { name: 'add-mount' }));

        await waitFor(() => {
            expect(screen.getByTestId('mount-count').textContent).toBe('1');
        });
        expect(notify).toHaveBeenCalledWith('error', 'errors.unexpected');
    });

    it('retries test connection and succeeds on second attempt', async () => {
        const { testProfile } = mountElectronMock();
        testProfile
            .mockRejectedValueOnce(new Error('network'))
            .mockResolvedValueOnce({
                success: true,
                latencyMs: 41,
                authMethod: 'password',
                message: 'ok',
            } satisfies SSHProfileTestResult);

        const notify = vi.fn<(type: 'success' | 'error' | 'info', message: string) => void>();
        render(<WorkspaceMountHarness workspace={workspaceFixture} notify={notify} />);

        fireEvent.click(screen.getByRole('button', { name: 'set-valid-ssh' }));
        fireEvent.click(screen.getByRole('button', { name: 'test-connection' }));

        await waitFor(() => {
            expect(screen.getByTestId('test-success').textContent).toBe('true');
        });
        expect(testProfile).toHaveBeenCalledTimes(2);
    });

    it('does not emit render-phase update warnings when workspace props change', () => {
        mountElectronMock();
        const notify = vi.fn<(type: 'success' | 'error' | 'info', message: string) => void>();
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const { rerender } = renderHook(
            ({ workspace }) =>
                useWorkspaceManager({
                    workspace,
                    notify,
                    logActivity: () => undefined,
                    t: key => key,
                }),
            {
                initialProps: {
                    workspace: workspaceFixture,
                },
            }
        );

        rerender({
            workspace: {
                ...workspaceFixture,
                mounts: [
                    ...workspaceFixture.mounts,
                    {
                        id: 'mount-ssh',
                        name: 'Remote',
                        type: 'ssh',
                        rootPath: '/srv/app',
                        ssh: {
                            host: '10.0.0.2',
                            port: 22,
                            username: 'agnes',
                            authType: 'password',
                            password: 'pw',
                            privateKey: '',
                            passphrase: '',
                        },
                    },
                ],
            },
        });

        const errorOutput = consoleErrorSpy.mock.calls
            .flatMap(call => call.map(value => String(value)))
            .join(' ');

        expect(errorOutput).not.toContain('Cannot update a component');
        expect(errorOutput).not.toContain('Too many re-renders');

        consoleErrorSpy.mockRestore();
    });
});
