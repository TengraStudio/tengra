import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SSHManager } from '@/features/ssh/SSHManager';
import { SSHConfig } from '@/types';
import { webElectronMock } from '@/web-bridge';

type MockProfile = SSHConfig & { id: string };

function installManagerMocks(profiles: MockProfile[]) {
    const connect = vi.fn().mockResolvedValue({ success: true, id: '11111111-1111-1111-1111-111111111111' });
    const saveProfile = vi.fn().mockResolvedValue(true);
    const getProfiles = vi.fn().mockResolvedValue(profiles);
    const getConnections = vi.fn().mockResolvedValue([]);
    const isConnected = vi.fn().mockResolvedValue(false);
    const deleteProfile = vi.fn().mockResolvedValue(true);

    const base = window.electron ?? webElectronMock;
    window.electron = {
        ...base,
        ssh: {
            ...base.ssh,
            connect,
            saveProfile,
            getProfiles,
            getConnections,
            isConnected,
            deleteProfile,
            onConnected: vi.fn(),
            onDisconnected: vi.fn(),
            onStdout: vi.fn(),
            onStderr: vi.fn(),
            onShellData: vi.fn(),
            removeAllListeners: vi.fn(),
            shellStart: vi.fn().mockResolvedValue({ success: true }),
        },
    };

    return {
        connect,
        saveProfile,
        getProfiles,
        getConnections,
        isConnected,
        deleteProfile,
    };
}

describe('SSHManager integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('blocks connect when required auth data is missing', async () => {
        const mocks = installManagerMocks([]);
        render(<SSHManager isOpen onClose={vi.fn()} language="en" />);

        fireEvent.click(screen.getByRole('button', { name: 'New Connection' }));

        fireEvent.change(screen.getByPlaceholderText('192.168.1.1'), {
            target: { value: '10.0.0.5' },
        });
        fireEvent.change(screen.getByPlaceholderText('root'), {
            target: { value: 'agnes' },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

        await waitFor(() => {
            expect(mocks.connect).toHaveBeenCalledTimes(0);
        });
    });

    it('shows inline delete confirmation and deletes selected profile', async () => {
        const mocks = installManagerMocks([
            {
                id: 'profile-1',
                name: 'Production',
                host: '10.0.0.5',
                port: 22,
                username: 'agnes',
            },
        ]);

        render(<SSHManager isOpen onClose={vi.fn()} language="en" />);

        await waitFor(() => {
            expect(screen.getByText('Production')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTitle('Delete Profile'));
        expect(screen.getByText('Are you sure you want to delete this profile?')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            expect(mocks.deleteProfile).toHaveBeenCalledWith('profile-1');
        });
    });
});
