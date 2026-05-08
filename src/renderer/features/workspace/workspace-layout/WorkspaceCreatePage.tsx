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

// --- Sub-components to satisfy max-lines-per-function ---

interface LocalCreateFormProps {
    form: CreateFormState;
    onChange: (form: CreateFormState) => void;
    onPickPath: () => void;
    onSubmit: () => void;
    isLoading: boolean;
    t: (key: string) => string;
}

const LocalCreateForm: React.FC<LocalCreateFormProps> = ({
    form,
    onChange,
    onPickPath,
    onSubmit,
    isLoading,
    t,
}) => (
    <div className="space-y-5">
        <div className="space-y-2">
            <Label>{t('frontend.workspaces.nameLabel')}</Label>
            <Input
                value={form.name}
                onChange={event => onChange({ ...form, name: event.target.value })}
                placeholder={t('frontend.workspaces.namePlaceholder')}
            />
        </div>
        <div className="space-y-2">
            <Label>{t('frontend.workspaces.description')}</Label>
            <Textarea
                value={form.description}
                onChange={event => onChange({ ...form, description: event.target.value })}
                placeholder={t('frontend.workspaces.workspaceDescPlaceholder')}
                rows={4}
            />
        </div>
        <div className="space-y-2">
            <Label>{t('frontend.settings.workspacesBasePath')}</Label>
            <div className="flex gap-3">
                <Input
                    value={form.basePath}
                    onChange={event => onChange({ ...form, basePath: event.target.value })}
                    placeholder={t('frontend.workspaceWizard.createPage.localBasePathPlaceholder')}
                />
                <Button
                    type="button"
                    variant="outline"
                    onClick={onPickPath}
                    disabled={isLoading}
                >
                    {t('frontend.workspaceWizard.selectFolder')}
                </Button>
            </div>
        </div>
        <Button onClick={onSubmit} disabled={isLoading}>
            {t('frontend.workspaces.createNew')}
        </Button>
    </div>
);

interface LocalImportFormProps {
    form: ImportFormState;
    onChange: (form: ImportFormState) => void;
    onPickPath: () => void;
    onSubmit: () => void;
    isLoading: boolean;
    t: (key: string) => string;
}

const LocalImportForm: React.FC<LocalImportFormProps> = ({
    form,
    onChange,
    onPickPath,
    onSubmit,
    isLoading,
    t,
}) => (
    <div className="space-y-5">
        <div className="space-y-2">
            <Label>{t('frontend.workspaceWizard.createPage.directoryLabel')}</Label>
            <div className="flex gap-3">
                <Input
                    value={form.selectedPath}
                    readOnly
                    placeholder={t('frontend.workspaceWizard.createPage.importPathPlaceholder')}
                />
                <Button
                    type="button"
                    variant="outline"
                    onClick={onPickPath}
                    disabled={isLoading}
                >
                    {t('frontend.workspaceWizard.selectFolder')}
                </Button>
            </div>
        </div>
        <div className="space-y-2">
            <Label>{t('frontend.workspaces.nameLabel')}</Label>
            <Input
                value={form.name}
                onChange={event => onChange({ ...form, name: event.target.value })}
                placeholder={t('frontend.workspaces.namePlaceholder')}
            />
        </div>
        <div className="space-y-2">
            <Label>{t('frontend.workspaces.description')}</Label>
            <Textarea
                value={form.description}
                onChange={event => onChange({ ...form, description: event.target.value })}
                placeholder={t('frontend.workspaces.workspaceDescPlaceholder')}
                rows={4}
            />
        </div>
        <Button onClick={onSubmit} disabled={isLoading}>
            {t('frontend.workspaceWizard.createPage.importAction')}
        </Button>
    </div>
);

interface SshConnectFormProps {
    form: SshFormState;
    onChange: (form: SshFormState) => void;
    onSubmit: () => void;
    isLoading: boolean;
    t: (key: string) => string;
}

const SshConnectForm: React.FC<SshConnectFormProps> = ({
    form,
    onChange,
    onSubmit,
    isLoading,
    t,
}) => (
    <div className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
                <Label>{t('frontend.workspaces.nameLabel')}</Label>
                <Input
                    value={form.name}
                    onChange={event => onChange({ ...form, name: event.target.value })}
                    placeholder={t('frontend.workspaces.namePlaceholder')}
                />
            </div>
            <div className="space-y-2">
                <Label>{t('common.host')}</Label>
                <Input
                    value={form.host}
                    onChange={event => onChange({ ...form, host: event.target.value })}
                    placeholder={t('frontend.workspaceWizard.createPage.sshHostPlaceholder')}
                />
            </div>
            <div className="space-y-2">
                <Label>{t('common.port')}</Label>
                <Input
                    value={form.port}
                    onChange={event => onChange({ ...form, port: event.target.value })}
                />
            </div>
            <div className="space-y-2">
                <Label>{t('common.username')}</Label>
                <Input
                    value={form.username}
                    onChange={event => onChange({ ...form, username: event.target.value })}
                    placeholder={t('frontend.workspaceWizard.createPage.sshUsernamePlaceholder')}
                />
            </div>
        </div>
        <div className="space-y-2">
            <Label>{t('frontend.workspaceWizard.selectFolder')}</Label>
            <Input
                value={form.rootPath}
                onChange={event => onChange({ ...form, rootPath: event.target.value })}
                placeholder={t('frontend.workspaceWizard.createPage.sshRootPathPlaceholder')}
            />
        </div>
        <div className="space-y-2">
            <Label>{t('frontend.workspaces.description')}</Label>
            <Textarea
                value={form.description}
                onChange={event => onChange({ ...form, description: event.target.value })}
                placeholder={t('frontend.workspaces.workspaceDescPlaceholder')}
                rows={4}
            />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
                <Label>{t('frontend.accounts.authType')}</Label>
                <select
                    value={form.authType}
                    onChange={event => onChange({ ...form, authType: event.target.value as 'password' | 'key' })}
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                >
                    <option value="password">{t('frontend.accounts.password')}</option>
                    <option value="key">{t('frontend.accounts.privateKey')}</option>
                </select>
            </div>
            {form.authType === 'password' ? (
                <div className="space-y-2">
                    <Label>{t('frontend.accounts.password')}</Label>
                    <Input
                        type="password"
                        value={form.password}
                        onChange={event => onChange({ ...form, password: event.target.value })}
                    />
                </div>
            ) : (
                <div className="space-y-2">
                    <Label>{t('frontend.accounts.passphrase')}</Label>
                    <Input
                        type="password"
                        value={form.passphrase}
                        onChange={event => onChange({ ...form, passphrase: event.target.value })}
                    />
                </div>
            )}
        </div>
        {form.authType === 'key' && (
            <div className="space-y-2">
                <Label>{t('frontend.accounts.privateKey')}</Label>
                <Textarea
                    value={form.privateKey}
                    onChange={event => onChange({ ...form, privateKey: event.target.value })}
                    rows={6}
                />
            </div>
        )}
        <Button onClick={onSubmit} disabled={isLoading}>
            {t('frontend.workspaceWizard.connect')}
        </Button>
    </div>
);

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
            basePath: result.path as string,
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
                <LocalCreateForm
                    form={createForm}
                    onChange={setCreateForm}
                    onPickPath={() => void handlePickCreateBasePath()}
                    onSubmit={() => void handleCreateLocalWorkspace()}
                    isLoading={isLoading}
                    t={t}
                />
            );
        }

        if (mode === 'import') {
            return (
                <LocalImportForm
                    form={importForm}
                    onChange={setImportForm}
                    onPickPath={() => void handlePickImportDirectory()}
                    onSubmit={() => void handleImportWorkspace()}
                    isLoading={isLoading}
                    t={t}
                />
            );
        }

        return (
            <SshConnectForm
                form={sshForm}
                onChange={setSshForm}
                onSubmit={() => void handleCreateSshWorkspace()}
                isLoading={isLoading}
                t={t}
            />
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
