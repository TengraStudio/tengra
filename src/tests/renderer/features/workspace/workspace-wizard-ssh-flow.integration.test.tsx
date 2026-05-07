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

import { SetupStepRenderer } from '@/features/workspace/workspace-setup';
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

describe('Workspace setup SSH integration flow', () => {
    it('renders ssh connection fields and updates host input', () => {
        const setSshForm = vi.fn();
        render(
            <SetupStepRenderer
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

        const hostInput = screen.getByPlaceholderText('workspaceSetup.placeholder.example');
        fireEvent.change(hostInput, { target: { value: '127.0.0.1' } });
        expect(setSshForm).toHaveBeenCalled();
    });

    it('browses remote directory on enter and folder click', () => {
        const loadRemoteDirectory = vi.fn().mockResolvedValue(undefined);
        const files: SSHFile[] = [
            { name: 'src', isDirectory: true, size: 0 },
            { name: 'README.md', isDirectory: false, size: 10 },
        ];
        render(
            <SetupStepRenderer
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

