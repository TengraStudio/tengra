import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WizardStepRenderer } from '@/features/workspace/components/WizardStepRenderer';
import { SSHFile } from '@/types';

const baseFormData = {
    name: 'Demo',
    description: 'Demo workspace',
    category: 'web',
    goal: '',
    customPath: '',
};

const baseSshForm = {
    host: '127.0.0.1',
    port: '22',
    username: 'root',
    authType: 'password' as const,
    password: '',
    privateKey: '',
    passphrase: '',
};

describe('Workspace wizard SSH integration flow', () => {
    it('renders ssh connection fields and updates host input', () => {
        const setSshForm = vi.fn();
        render(
            <WizardStepRenderer
                step="ssh-connection"
                formData={baseFormData}
                setFormData={vi.fn()}
                categories={[]}
                error={null}
                sshForm={baseSshForm}
                setSshForm={setSshForm}
                sshPath="/"
                setSshPath={vi.fn()}
                sshFiles={[]}
                sshConnectionId="conn-1"
                loadRemoteDirectory={vi.fn()}
                onImportLocal={vi.fn()}
                onSSHConnect={vi.fn()}
                onCreateNew={vi.fn()}
            />
        );

        const hostInput = screen.getByPlaceholderText('workspaceWizard.placeholder.example');
        fireEvent.change(hostInput, { target: { value: '10.0.0.5' } });
        expect(setSshForm).toHaveBeenCalled();
    });

    it('browses remote directory on enter and folder click', () => {
        const loadRemoteDirectory = vi.fn().mockResolvedValue(undefined);
        const files: SSHFile[] = [
            { name: 'src', isDirectory: true, size: 0 },
            { name: 'README.md', isDirectory: false, size: 10 },
        ];
        render(
            <WizardStepRenderer
                step="ssh-browser"
                formData={baseFormData}
                setFormData={vi.fn()}
                categories={[]}
                error={null}
                sshForm={baseSshForm}
                setSshForm={vi.fn()}
                sshPath="/"
                setSshPath={vi.fn()}
                sshFiles={files}
                sshConnectionId="conn-1"
                loadRemoteDirectory={loadRemoteDirectory}
                onImportLocal={vi.fn()}
                onSSHConnect={vi.fn()}
                onCreateNew={vi.fn()}
            />
        );

        const pathInput = screen.getByDisplayValue('/');
        fireEvent.keyDown(pathInput, { key: 'Enter' });
        fireEvent.click(screen.getByText('src'));

        expect(loadRemoteDirectory).toHaveBeenNthCalledWith(1, 'conn-1', '/');
        expect(loadRemoteDirectory).toHaveBeenNthCalledWith(2, 'conn-1', '/src');
    });
});
