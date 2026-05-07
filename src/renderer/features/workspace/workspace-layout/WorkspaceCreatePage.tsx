/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconArrowLeft, IconBrandTabler, IconFolderOpen, IconPlugConnected, IconPlus } from '@tabler/icons-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Language, useTranslation } from '@/i18n';
import { WorkspaceMount } from '@/types';
import { normalizeDirectorySelectionResult } from '@/utils/directory-selection.util';

type CreateMode = 'create' | 'import' | 'ssh';

interface WorkspaceCreatePageProps {
    language: Language;
    onBack: () => void;
    onWorkspaceCreated: (
        path: string,
        name: string,
        description: string,
        mounts?: WorkspaceMount[]
    ) => Promise<boolean>;
}

interface CreateFormState {
    name: string;
    description: string;
    basePath: string;
}

interface ImportFormState {
    name: string;
    description: string;
    selectedPath: string;
}

interface SshFormState {
    name: string;
    description: string;
    host: string;
    port: string;
    username: string;
    rootPath: string;
    authType: 'password' | 'key';
    password: string;
    privateKey: string;
    passphrase: string;
}

const MODE_CARD_CLASS_NAME =
    'rounded-2xl border border-border/50 bg-card/80 p-4 text-left transition-colors hover:border-primary/30 hover:bg-card';

export const WorkspaceCreatePage: React.FC<WorkspaceCreatePageProps> = ({
    language,
    onBack,
    onWorkspaceCreated,
}) => {
    const { t } = useTranslation(language);
    const [mode, setMode] = React.useState<CreateMode>('create');
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [createForm, setCreateForm] = React.useState<CreateFormState>({
        name: '',
        description: '',
        basePath: '',
    });
    const [importForm, setImportForm] = React.useState<ImportFormState>({
        name: '',
        description: '',
        selectedPath: '',
    });
    const [sshForm, setSshForm] = React.useState<SshFormState>({
        name: '',
        description: '',
        host: '',
        port: '22',
        username: '',
        rootPath: '/',
        authType: 'password',
        password: '',
        privateKey: '',
        passphrase: '',
    });

    const selectDirectory = React.useCallback(
        async () => normalizeDirectorySelectionResult(await window.electron.dialog.selectDirectory()),
        []
    );

    const handlePickImportDirectory = React.useCallback(async () => {
        setError(null);
        const result = await selectDirectory();
        if (!result.success || !result.path) {
            setError(t('frontend.workspace.errors.wizard.selectDirectoryFailed'));
            return;
        }

        const selectedPath = result.path;
        const normalizedPath = selectedPath.replace(/[/\\]+$/, '');
        const dirName =
            normalizedPath.split(/[/\\]/).pop() ??
            t('frontend.workspaceWizard.defaultWorkspaceName');

        setImportForm(prev => ({
            ...prev,
            selectedPath,
            name: prev.name || dirName,
        }));
    }, [selectDirectory, t]);

    const handlePickCreateBasePath = React.useCallback(async () => {
        setError(null);
        const result = await selectDirectory();
        if (!result.success || !result.path) {
            setError(t('frontend.workspace.errors.wizard.selectDirectoryFailed'));
            return;
        }

        setCreateForm(prev => ({
            ...prev,
            basePath: result.path!,
        }));
    }, [selectDirectory, t]);

    const handleCreateLocalWorkspace = React.useCallback(async () => {
        if (!createForm.name.trim()) {
            setError(t('frontend.workspace.errors.wizard.invalidInput'));
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const userData = await window.electron.getUserDataPath();
            const settings = await window.electron.getSettings();
            const configuredBasePath = settings.general.workspacesBasePath?.trim() ?? '';
            const basePath =
                createForm.basePath.trim() ||
                configuredBasePath ||
                `${userData}\\workspaces`;
            const safeWorkspaceName = createForm.name.replace(/[^a-zA-Z0-9-_]/g, '-');
            const workspacePath = `${basePath}\\${safeWorkspaceName}`;

            await window.electron.files.createDirectory(basePath);
            await window.electron.files.createDirectory(workspacePath);

            const success = await onWorkspaceCreated(
                workspacePath,
                createForm.name.trim(),
                createForm.description.trim()
            );
            if (!success) {
                setError(t('frontend.workspace.errors.wizard.createWorkspaceFailed'));
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : t('frontend.workspace.errors.wizard.createWorkspaceFailed')
            );
        } finally {
            setIsLoading(false);
        }
    }, [createForm, onWorkspaceCreated, t]);

    const handleImportWorkspace = React.useCallback(async () => {
        if (!importForm.selectedPath.trim() || !importForm.name.trim()) {
            setError(t('frontend.workspace.errors.wizard.invalidInput'));
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const mounts: WorkspaceMount[] = [{
                id: `local-${Date.now()}`,
                name: importForm.name.trim(),
                type: 'local',
                rootPath: importForm.selectedPath,
            }];

            const success = await onWorkspaceCreated(
                importForm.selectedPath,
                importForm.name.trim(),
                importForm.description.trim(),
                mounts
            );
            if (!success) {
                setError(t('frontend.workspace.errors.wizard.createWorkspaceFailed'));
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : t('frontend.workspace.errors.wizard.createWorkspaceFailed')
            );
        } finally {
            setIsLoading(false);
        }
    }, [importForm, onWorkspaceCreated, t]);

    const handleCreateSshWorkspace = React.useCallback(async () => {
        if (
            !sshForm.name.trim() ||
            !sshForm.host.trim() ||
            !sshForm.username.trim() ||
            !sshForm.rootPath.trim()
        ) {
            setError(t('frontend.workspace.errors.wizard.invalidInput'));
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const connectResult = await window.electron.ssh.connect({
                host: sshForm.host,
                port: parseInt(sshForm.port, 10) || 22,
                username: sshForm.username,
                password: sshForm.authType === 'password' ? sshForm.password : undefined,
                privateKey:
                    sshForm.authType === 'key' ? sshForm.privateKey : undefined,
                passphrase:
                    sshForm.authType === 'key' ? sshForm.passphrase : undefined,
            });

            if (!connectResult.success || !connectResult.id) {
                setError(connectResult.error ?? t('frontend.workspace.errors.wizard.connectFailed'));
                return;
            }

            const mount: WorkspaceMount = {
                id: connectResult.id,
                name: sshForm.name.trim(),
                type: 'ssh',
                rootPath: sshForm.rootPath.trim(),
                ssh: {
                    host: sshForm.host.trim(),
                    port: parseInt(sshForm.port, 10) || 22,
                    username: sshForm.username.trim(),
                    authType: sshForm.authType,
                    password:
                        sshForm.authType === 'password' ? sshForm.password : undefined,
                    privateKey:
                        sshForm.authType === 'key' ? sshForm.privateKey : undefined,
                    passphrase:
                        sshForm.authType === 'key' ? sshForm.passphrase : undefined,
                },
            };

            const workspacePath = `ssh://${sshForm.username.trim()}@${sshForm.host.trim()}:${parseInt(sshForm.port, 10) || 22}${sshForm.rootPath.trim()}`;
            const success = await onWorkspaceCreated(
                workspacePath,
                sshForm.name.trim(),
                sshForm.description.trim(),
                [mount]
            );
            if (!success) {
                setError(t('frontend.workspace.errors.wizard.createWorkspaceFailed'));
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : t('frontend.workspace.errors.wizard.createWorkspaceFailed')
            );
        } finally {
            setIsLoading(false);
        }
    }, [onWorkspaceCreated, sshForm, t]);

    const renderModeForm = () => {
        if (mode === 'create') {
            return (
                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label>{t('frontend.workspaces.nameLabel')}</Label>
                        <Input
                            value={createForm.name}
                            onChange={event =>
                                setCreateForm(prev => ({ ...prev, name: event.target.value }))
                            }
                            placeholder={t('frontend.workspaces.namePlaceholder')}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{t('frontend.workspaces.description')}</Label>
                        <Textarea
                            value={createForm.description}
                            onChange={event =>
                                setCreateForm(prev => ({
                                    ...prev,
                                    description: event.target.value,
                                }))
                            }
                            placeholder={t('frontend.workspaces.workspaceDescPlaceholder')}
                            rows={4}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{t('frontend.settings.workspacesBasePath')}</Label>
                        <div className="flex gap-3">
                            <Input
                                value={createForm.basePath}
                                onChange={event =>
                                    setCreateForm(prev => ({
                                        ...prev,
                                        basePath: event.target.value,
                                    }))
                                }
                                placeholder={t('frontend.workspaceWizard.createPage.localBasePathPlaceholder')}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void handlePickCreateBasePath()}
                                disabled={isLoading}
                            >
                                {t('frontend.workspaceWizard.selectFolder')}
                            </Button>
                        </div>
                    </div>
                    <Button onClick={() => void handleCreateLocalWorkspace()} disabled={isLoading}>
                        {t('frontend.workspaces.createNew')}
                    </Button>
                </div>
            );
        }

        if (mode === 'import') {
            return (
                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label>{t('frontend.workspaceWizard.createPage.directoryLabel')}</Label>
                        <div className="flex gap-3">
                            <Input
                                value={importForm.selectedPath}
                                readOnly
                                placeholder={t('frontend.workspaceWizard.createPage.importPathPlaceholder')}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void handlePickImportDirectory()}
                                disabled={isLoading}
                            >
                                {t('frontend.workspaceWizard.selectFolder')}
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>{t('frontend.workspaces.nameLabel')}</Label>
                        <Input
                            value={importForm.name}
                            onChange={event =>
                                setImportForm(prev => ({ ...prev, name: event.target.value }))
                            }
                            placeholder={t('frontend.workspaces.namePlaceholder')}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{t('frontend.workspaces.description')}</Label>
                        <Textarea
                            value={importForm.description}
                            onChange={event =>
                                setImportForm(prev => ({
                                    ...prev,
                                    description: event.target.value,
                                }))
                            }
                            placeholder={t('frontend.workspaces.workspaceDescPlaceholder')}
                            rows={4}
                        />
                    </div>
                    <Button onClick={() => void handleImportWorkspace()} disabled={isLoading}>
                        {t('frontend.workspaceWizard.createPage.importAction')}
                    </Button>
                </div>
            );
        }

        return (
            <div className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>{t('frontend.workspaces.nameLabel')}</Label>
                        <Input
                            value={sshForm.name}
                            onChange={event =>
                                setSshForm(prev => ({ ...prev, name: event.target.value }))
                            }
                            placeholder={t('frontend.workspaces.namePlaceholder')}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{t('common.host')}</Label>
                        <Input
                            value={sshForm.host}
                            onChange={event =>
                                setSshForm(prev => ({ ...prev, host: event.target.value }))
                            }
                            placeholder={t('frontend.workspaceWizard.createPage.sshHostPlaceholder')}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{t('common.port')}</Label>
                        <Input
                            value={sshForm.port}
                            onChange={event =>
                                setSshForm(prev => ({ ...prev, port: event.target.value }))
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{t('common.username')}</Label>
                        <Input
                            value={sshForm.username}
                            onChange={event =>
                                setSshForm(prev => ({
                                    ...prev,
                                    username: event.target.value,
                                }))
                            }
                            placeholder={t('frontend.workspaceWizard.createPage.sshUsernamePlaceholder')}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>{t('frontend.workspaceWizard.selectFolder')}</Label>
                    <Input
                        value={sshForm.rootPath}
                        onChange={event =>
                            setSshForm(prev => ({ ...prev, rootPath: event.target.value }))
                        }
                        placeholder={t('frontend.workspaceWizard.createPage.sshRootPathPlaceholder')}
                    />
                </div>
                <div className="space-y-2">
                    <Label>{t('frontend.workspaces.description')}</Label>
                    <Textarea
                        value={sshForm.description}
                        onChange={event =>
                            setSshForm(prev => ({
                                ...prev,
                                description: event.target.value,
                            }))
                        }
                        placeholder={t('frontend.workspaces.workspaceDescPlaceholder')}
                        rows={4}
                    />
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>{t('frontend.accounts.authType')}</Label>
                        <select
                            value={sshForm.authType}
                            onChange={event =>
                                setSshForm(prev => ({
                                    ...prev,
                                    authType: event.target.value as 'password' | 'key',
                                }))
                            }
                            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="password">{t('frontend.accounts.password')}</option>
                            <option value="key">{t('frontend.accounts.privateKey')}</option>
                        </select>
                    </div>
                    {sshForm.authType === 'password' ? (
                        <div className="space-y-2">
                            <Label>{t('frontend.accounts.password')}</Label>
                            <Input
                                type="password"
                                value={sshForm.password}
                                onChange={event =>
                                    setSshForm(prev => ({
                                        ...prev,
                                        password: event.target.value,
                                    }))
                                }
                            />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label>{t('frontend.accounts.passphrase')}</Label>
                            <Input
                                type="password"
                                value={sshForm.passphrase}
                                onChange={event =>
                                    setSshForm(prev => ({
                                        ...prev,
                                        passphrase: event.target.value,
                                    }))
                                }
                            />
                        </div>
                    )}
                </div>
                {sshForm.authType === 'key' && (
                    <div className="space-y-2">
                        <Label>{t('frontend.accounts.privateKey')}</Label>
                        <Textarea
                            value={sshForm.privateKey}
                            onChange={event =>
                                setSshForm(prev => ({
                                    ...prev,
                                    privateKey: event.target.value,
                                }))
                            }
                            rows={6}
                        />
                    </div>
                )}
                <Button onClick={() => void handleCreateSshWorkspace()} disabled={isLoading}>
                    {t('frontend.workspaceWizard.connect')}
                </Button>
            </div>
        );
    };

    return (
        <div className="h-full overflow-y-auto bg-background px-8 py-8">
            <div className="mx-auto flex max-w-4xl flex-col gap-8">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" onClick={onBack}>
                        <IconArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {t('frontend.workspaces.createNew')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t('frontend.workspaces.subtitle')}
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <button
                        type="button"
                        className={MODE_CARD_CLASS_NAME}
                        onClick={() => setMode('create')}
                    >
                        <div className="mb-3 inline-flex rounded-xl border border-border/50 bg-background/80 p-2">
                            <IconPlus className="h-4 w-4" />
                        </div>
                        <div className="text-sm font-medium">{t('frontend.workspaces.createNew')}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                            {t('frontend.workspaceWizard.createPage.createDescription')}
                        </div>
                    </button>
                    <button
                        type="button"
                        className={MODE_CARD_CLASS_NAME}
                        onClick={() => setMode('import')}
                    >
                        <div className="mb-3 inline-flex rounded-xl border border-border/50 bg-background/80 p-2">
                            <IconFolderOpen className="h-4 w-4" />
                        </div>
                        <div className="text-sm font-medium">{t('frontend.workspaceWizard.createPage.importTitle')}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                            {t('frontend.workspaceWizard.createPage.importDescription')}
                        </div>
                    </button>
                    <button
                        type="button"
                        className={MODE_CARD_CLASS_NAME}
                        onClick={() => setMode('ssh')}
                    >
                        <div className="mb-3 inline-flex rounded-xl border border-border/50 bg-background/80 p-2">
                            <IconPlugConnected className="h-4 w-4" />
                        </div>
                        <div className="text-sm font-medium">
                            {t('frontend.workspaceWizard.connect')}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                            {t('frontend.workspaceWizard.createPage.sshDescription')}
                        </div>
                    </button>
                </div>

                <section className="rounded-3xl border border-border/50 bg-card/70 p-6">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="inline-flex rounded-xl border border-border/50 bg-background/80 p-2">
                            <IconBrandTabler className="h-4 w-4" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold">
                                {mode === 'create'
                                    ? t('frontend.workspaces.createNew')
                                    : mode === 'import'
                                        ? t('frontend.workspaceWizard.createPage.importTitle')
                                        : t('frontend.workspaceWizard.connect')}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {t('frontend.workspaceWizard.createPage.basicSetupNote')}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    {renderModeForm()}
                </section>
            </div>
        </div>
    );
};

