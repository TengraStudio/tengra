/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { WorkspaceMount } from '@/types';
import { normalizeDirectorySelectionResult } from '@/utils/directory-selection.util';
import { appLogger } from '@/utils/renderer-logger';

interface SSHForm {
    host: string;
    port: string;
    username: string;
    authType: 'password' | 'key';
    password: string;
    privateKey: string;
    passphrase: string;
}

interface FormData {
    name: string;
    description: string;
    category: string;
    goal: string;
    customPath: string;
}

interface SSHConnectOptions {
    sshForm: SSHForm;
    setIsLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setStep: (step: 'selection' | 'details' | 'ssh-connection' | 'ssh-browser' | 'creating') => void;
    setSshConnectionId: (id: string | null) => void;
    loadRemoteDirectory: (connId: string, path: string) => Promise<void>;
    t: (key: string) => string;
}

interface CreateWorkspaceOptions {
    formData: FormData;
    setIsLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setStep: (step: 'selection' | 'details' | 'ssh-connection' | 'ssh-browser' | 'creating') => void;
    onWorkspaceCreated: (path: string, name: string, description: string, mounts?: WorkspaceMount[]) => Promise<boolean>;
    onClose: () => void;
    t: (key: string) => string;
}

interface SSHBrowserNextOptions {
    sshConnectionId: string | null;
    formData: FormData;
    sshForm: SSHForm;
    sshPath: string;
    setError: (error: string | null) => void;
    setIsLoading: (loading: boolean) => void;
    onWorkspaceCreated: (path: string, name: string, description: string, mounts?: WorkspaceMount[]) => Promise<boolean>;
    onClose: () => void;
    t: (key: string) => string;
}

interface ImportLocalOptions {
    formData: FormData;
    setIsLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    onWorkspaceCreated: (path: string, name: string, description: string, mounts?: WorkspaceMount[]) => Promise<boolean>;
    onClose: () => void;
    t: (key: string) => string;
}

export const useSSHConnectHandler = (options: SSHConnectOptions): () => Promise<void> => {
    const { sshForm, setIsLoading, setError, setStep, setSshConnectionId, loadRemoteDirectory, t } = options;
    const handleSSHConnect = async () => {
        if (!sshForm.host.trim() || !sshForm.username.trim()) {
            setError(t('workspace.errors.wizard.invalidInput'));
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const testResult = await window.electron.ssh.testProfile({
                host: sshForm.host,
                port: parseInt(sshForm.port, 10) || 22,
                username: sshForm.username,
                authType: sshForm.authType,
                password: sshForm.authType === 'password' ? sshForm.password : undefined,
                privateKey: sshForm.authType === 'key' ? sshForm.privateKey : undefined,
                passphrase: sshForm.authType === 'key' ? sshForm.passphrase : undefined
            });
            if (!testResult.success) {
                setError(testResult.error ?? t('workspace.errors.wizard.connectionFailed'));
                return;
            }

            const result = await window.electron.ssh.connect({
                host: sshForm.host,
                port: parseInt(sshForm.port, 10) || 22,
                username: sshForm.username,
                password: sshForm.password,
                privateKey: sshForm.privateKey,
                passphrase: sshForm.passphrase
            });

            if (result.success && result.id) {
                setSshConnectionId(result.id);
                setStep('ssh-browser');
                void loadRemoteDirectory(result.id, '/');
            } else {
                setError(result.error ?? t('workspace.errors.wizard.connectFailed'));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('workspace.errors.wizard.connectionFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    return handleSSHConnect;
};

export const useCreateWorkspaceHandler = (options: CreateWorkspaceOptions): () => Promise<void> => {
    const { formData, setIsLoading, setError, setStep, onWorkspaceCreated, onClose, t } = options;
    const handleCreate = async () => {
        if (!formData.name) {
            return;
        }
        setIsLoading(true);
        setError(null);
        setStep('creating');

        try {
            const userData = await window.electron.getUserDataPath();
            const settings = await window.electron.getSettings();
            const configuredBasePath = settings.general.workspacesBasePath?.trim() ?? '';
            const workspacesDir = formData.customPath.trim() || configuredBasePath || `${userData}\\workspaces`;
            const safeWorkspaceName = formData.name.replace(/[^a-zA-Z0-9-_]/g, '-');
            const workspacePath = `${workspacesDir}\\${safeWorkspaceName}`;

            await window.electron.files.createDirectory(workspacesDir);
            await window.electron.files.createDirectory(workspacePath);

            const readmeContent = `# ${formData.name}\n\n${formData.description}\n`;
            await window.electron.files.writeFile(`${workspacePath}\\README.md`, readmeContent);

            const success = await onWorkspaceCreated(workspacePath, formData.name, formData.description);
            if (success) {
                onClose();
                return;
            }
            setError(t('workspace.errors.wizard.createWorkspaceFailed'));
            setStep('details');

        } catch (err) {
            const errorToReport = err instanceof Error ? err : new Error(t('workspace.errors.wizard.createWorkspaceFailed'));
            appLogger.error('useWizardHandlers', 'Workspace Creation Failed', errorToReport);
            setError(errorToReport.message);
            setStep('details');
        } finally {
            setIsLoading(false);
        }
    };

    return handleCreate;
};

export const useImportLocalHandler = (options: ImportLocalOptions): () => Promise<void> => {
    const { formData, setIsLoading, setError, onWorkspaceCreated, onClose, t } = options;
    const handleImportLocal = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = normalizeDirectorySelectionResult(await window.electron.selectDirectory());
            if (result.success && result.path) {
                const normalizedPath = result.path.replace(/[/\\]+$/, '');
                const dirName = normalizedPath.split(/[/\\]/).pop() || t('workspaceWizard.defaultWorkspaceName');
                const mounts: WorkspaceMount[] = [{
                    id: `local-${Date.now()}`,
                    name: formData.name || dirName,
                    type: 'local',
                    rootPath: result.path
                }];
                const success = await onWorkspaceCreated(result.path, formData.name || mounts[0]?.name || '', formData.description, mounts);
                if (success) {
                    onClose();
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('workspace.errors.wizard.selectDirectoryFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    return handleImportLocal;
};

export const useSSHBrowserNextHandler = (options: SSHBrowserNextOptions): () => Promise<void> => {
    const { sshConnectionId, formData, sshForm, sshPath, setError, setIsLoading, onWorkspaceCreated, onClose, t } = options;
    const handleSSHBrowserNext = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const sshMount: WorkspaceMount = {
                id: sshConnectionId ?? `ssh-${Date.now()}`,
                name: formData.name || `${sshForm.username}@${sshForm.host}`,
                type: 'ssh',
                rootPath: sshPath,
                ssh: {
                    host: sshForm.host,
                    port: parseInt(sshForm.port) || 22,
                    username: sshForm.username,
                    authType: sshForm.authType,
                    password: sshForm.authType === 'password' ? sshForm.password : undefined,
                    privateKey: sshForm.authType === 'key' ? sshForm.privateKey : undefined,
                    passphrase: sshForm.authType === 'key' ? sshForm.passphrase : undefined
                }
            };
            const remoteWorkspacePath = `ssh://${sshForm.username}@${sshForm.host}:${parseInt(sshForm.port, 10) || 22}${sshPath}`;
            const success = await onWorkspaceCreated(remoteWorkspacePath, formData.name || sshMount.name, formData.description, [sshMount]);
            if (success) {
                onClose();
                return;
            }
            setError(t('workspace.errors.wizard.createWorkspaceFailed'));
        } catch (err) {
            setError(err instanceof Error ? err.message : t('workspace.errors.wizard.createWorkspaceFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    return handleSSHBrowserNext;
};

