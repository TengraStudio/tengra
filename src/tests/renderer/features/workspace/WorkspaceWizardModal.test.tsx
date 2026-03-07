import { WorkspaceWizardModal } from '@renderer/features/workspace/components/WorkspaceWizardModal';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const renderWizard = (onProjectCreated = vi.fn().mockResolvedValue(true)) => {
    const onClose = vi.fn();

    render(
        <WorkspaceWizardModal
            isOpen={true}
            onClose={onClose}
            onProjectCreated={onProjectCreated}
            language="en"
        />
    );

    return { onClose, onProjectCreated };
};

describe('WorkspaceWizardModal', () => {
    beforeEach(() => {
        mountElectronMock('C:\\workspaces\\Demo Workspace\\');
    });

    it('derives a workspace name from a Windows path with a trailing slash', async () => {
        const { onClose, onProjectCreated } = renderWizard();

        fireEvent.click(screen.getByText('workspaceWizard.alreadyExists'));

        await waitFor(() => {
            expect(screen.getByDisplayValue('Demo Workspace')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));

        await waitFor(() => {
            expect(onProjectCreated).toHaveBeenCalledWith(
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
        const { onProjectCreated } = renderWizard();

        fireEvent.click(screen.getByText('workspaceWizard.alreadyExists'));

        await waitFor(() => {
            expect(screen.getByDisplayValue('demo-workspace')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));

        await waitFor(() => {
            expect(onProjectCreated).toHaveBeenCalledWith(
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
});
