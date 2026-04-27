/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceSetupModal } from '@/features/workspace/workspace-setup';
import { webElectronMock } from '@/web-bridge';

vi.mock('react-dom', async () => {
    const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
    return {
        ...actual,
        createPortal: (children: React.ReactNode) => children,
    };
});

const mountElectronMock = (selectedPath: string) => {
    const base = window.electron ?? webElectronMock;

    window.electron = {
        ...base,
        selectDirectory: vi.fn().mockResolvedValue({
            success: true,
            path: selectedPath,
        }),
        ssh: {
            ...base.ssh,
            listDir: vi.fn(),
            testProfile: vi.fn(),
            connect: vi.fn(),
        },
        ipcRenderer: {
            ...base.ipcRenderer,
            invoke: vi.fn(),
            on: vi.fn(() => vi.fn()),
            off: vi.fn(),
        },
        log: {
            ...base.log,
            error: vi.fn() as typeof base.log.error,
            warn: vi.fn() as typeof base.log.warn,
        },
    };
};

const renderSetup = (onWorkspaceCreated = vi.fn().mockResolvedValue(true)) => {
    const onClose = vi.fn();

    render(
        <WorkspaceSetupModal
            isOpen={true}
            onClose={onClose}
            onWorkspaceCreated={onWorkspaceCreated}
            language="en"
        />
    );

    return { onClose, onWorkspaceCreated };
};

describe('WorkspaceSetupModal', () => {
    beforeEach(() => {
        mountElectronMock('C:\\workspaces\\Demo Workspace\\');
    });

    it('derives a workspace name from a Windows path with a trailing slash', async () => {
        const { onClose, onWorkspaceCreated } = renderSetup();

        fireEvent.click(screen.getByText('workspaceSetup.alreadyExists'));

        await waitFor(() => {
            expect(screen.getByDisplayValue('Demo Workspace')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));

        await waitFor(() => {
            expect(onWorkspaceCreated).toHaveBeenCalledWith(
                'C:\\workspaces\\Demo Workspace\\',
                'Demo Workspace',
                '',
                [
                    {
                        id: expect.stringMatching(/^local-/),
                        name: 'Demo Workspace',
                        type: 'local',
                        rootPath: 'C:\\workspaces\\Demo Workspace\\',
                    },
                ]
            );
        });

        expect(onClose).toHaveBeenCalled();
    });

    it('derives a workspace name from a POSIX path with a trailing slash', async () => {
        mountElectronMock('/var/tmp/demo-workspace/');
        const { onWorkspaceCreated } = renderSetup();

        fireEvent.click(screen.getByText('workspaceSetup.alreadyExists'));

        await waitFor(() => {
            expect(screen.getByDisplayValue('demo-workspace')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));

        await waitFor(() => {
            expect(onWorkspaceCreated).toHaveBeenCalledWith(
                '/var/tmp/demo-workspace/',
                'demo-workspace',
                '',
                [
                    {
                        id: expect.stringMatching(/^local-/),
                        name: 'demo-workspace',
                        type: 'local',
                        rootPath: '/var/tmp/demo-workspace/',
                    },
                ]
            );
        });
    });

    it('keeps the modal open and shows an error when registering the imported folder fails', async () => {
        const onWorkspaceCreated = vi.fn().mockRejectedValue(
            new Error('A workspace already exists for this local directory.')
        );
        const { onClose } = renderSetup(onWorkspaceCreated);

        fireEvent.click(screen.getByText('workspaceSetup.alreadyExists'));

        await waitFor(() => {
            expect(screen.getByDisplayValue('Demo Workspace')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));

        await waitFor(() => {
            expect(screen.getByText('A workspace already exists for this local directory.')).toBeInTheDocument();
        });

        expect(onClose).not.toHaveBeenCalled();
    });
});
