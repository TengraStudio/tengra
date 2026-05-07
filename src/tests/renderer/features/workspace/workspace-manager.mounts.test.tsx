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
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ElectronAPI } from '@/electron.d';
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
    const deleteFile = vi.fn().mockResolvedValue({ success: true });
    const base = webElectronMock;

    const nextElectron: ElectronAPI = {
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
        files: {
            ...base.files,
            deleteFile,
        },
        log: {
            ...base.log,
            error: vi.fn() as typeof base.log.error,
            warn: vi.fn() as typeof base.log.warn,
        },
    };

    window.electron = nextElectron;

    return { updateWorkspace, saveProfile, testProfile, deleteFile };
}

interface WorkspaceMountHarnessProps {
    workspace: Workspace;
}

interface WorkspaceOpenFileHarnessProps {
    workspace: Workspace;
}

const WorkspaceMountHarness: React.FC<WorkspaceMountHarnessProps> = ({ workspace }) => {
    const manager = useWorkspaceManager({
        workspace,
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
                        host: '127.0.0.1',
                        port: '22',
                        username: 'mockuser',
                        authType: 'password',
                        password: 'mock-pw',
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

const WorkspaceOpenFileHarness: React.FC<WorkspaceOpenFileHarnessProps> = ({ workspace }) => {
    const t = React.useCallback(
        (key: string) => (key === 'workspace.editorOpenFailed' ? 'Failed to open file' : key),
        []
    );
    const manager = useWorkspaceManager({
        workspace,
        logActivity: () => undefined,
        t,
    });

    return (
        <div>
            <div data-testid="open-tab-count">{manager.openTabs.length}</div>
            <div data-testid="active-tab-name">{manager.activeTab?.name ?? ''}</div>
            <div data-testid="active-tab-content">{manager.activeTab?.content ?? ''}</div>
            <div data-testid="active-tab-readonly">{String(Boolean(manager.activeTab?.readOnly))}</div>
            <button
                onClick={() =>
                    void manager.openFile({
                        mountId: 'mount-local',
                        path: 'C:\\workspaces\\demo-workspace\\huge.txt',
                        name: 'huge.txt',
                        isDirectory: false,
                    })
                }
            >
                open-large-file
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

        render(<WorkspaceMountHarness workspace={workspaceFixture} />);
        expect(screen.getByTestId('mount-count').textContent).toBe('1');

        fireEvent.click(screen.getByRole('button', { name: 'set-invalid-ssh' }));
        fireEvent.click(screen.getByRole('button', { name: 'add-mount' }));

        await waitFor(() => {
            expect(screen.getByTestId('mount-count').textContent).toBe('1');
        });
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

        render(<WorkspaceMountHarness workspace={workspaceFixture} />);

        fireEvent.click(screen.getByRole('button', { name: 'set-valid-ssh' }));
        fireEvent.click(screen.getByRole('button', { name: 'test-connection' }));

        await waitFor(() => {
            expect(screen.getByTestId('test-success').textContent).toBe('true');
        });
        expect(testProfile).toHaveBeenCalledTimes(2);
    });

    it('does not emit render-phase update warnings when workspace props change', () => {
        mountElectronMock();
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const { rerender } = renderHook(
            ({ workspace }) =>
                useWorkspaceManager({
                    workspace, 
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
                            host: '127.0.0.1',
                            port: 22,
                            username: 'mockuser',
                            authType: 'password',
                            password: 'mock-pw',
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

    it('opens a visible read-only error tab when file reading fails', async () => {
        mountElectronMock();
        const base = webElectronMock;
        const readFile = vi.fn().mockResolvedValue({
            success: false,
            error: 'File too large (max 50MB): C:\\workspaces\\demo-workspace\\huge.txt',
        });
        window.electron = {
            ...base,
            files: {
                ...(base.files ?? {}),
                readFile,
                readImage: vi.fn(),
            },
        };

        render(<WorkspaceOpenFileHarness workspace={workspaceFixture} />);
        fireEvent.click(screen.getByRole('button', { name: 'open-large-file' }));

        await waitFor(() => {
            expect(screen.getByTestId('open-tab-count').textContent).toBe('1');
            expect(screen.getByTestId('active-tab-name').textContent).toBe('huge.txt');
            expect(screen.getByTestId('active-tab-readonly').textContent).toBe('true');
            expect(screen.getByTestId('active-tab-content').textContent).toContain('Failed to open file');
            expect(screen.getByTestId('active-tab-content').textContent).toContain('File too large');
        });
    });

    it('keeps local delete operations from forcing a full refresh', async () => {
        const { deleteFile } = mountElectronMock();

        const { result } = renderHook(() =>
            useWorkspaceManager({
                workspace: workspaceFixture,
                logActivity: () => undefined,
                t: key => key,
            })
        );

        await act(async () => {
            await result.current.deleteEntry({
                mountId: 'mount-local',
                path: 'C:\\workspaces\\demo-workspace\\delete-me.txt',
                name: 'delete-me.txt',
                isDirectory: false,
            });
        });

        expect(deleteFile).toHaveBeenCalledWith('C:\\workspaces\\demo-workspace\\delete-me.txt');
        expect(result.current.refreshSignal).toBe(0);
    });
});

