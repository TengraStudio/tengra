/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconCode, IconDatabase, IconDeviceMobile, IconGlobe, IconTerminal } from '@tabler/icons-react';
import React, { useCallback, useMemo } from 'react';

import { WizardProgress } from '@/components/shared/wizard';
import { Modal } from '@/components/ui/modal';
import {
    useCreateWorkspaceHandler,
    useSSHBrowserNextHandler,
    useSSHConnectHandler
} from '@/features/workspace/hooks/useWizardHandlers';
import { useWorkspaceWizardState } from '@/features/workspace/hooks/useWorkspaceWizardState';
import { Language, useTranslation } from '@/i18n';
import { WorkspaceMount } from '@/types';
import { normalizeDirectorySelectionResult } from '@/utils/directory-selection.util';

import { SetupFooter } from './SetupFooter';
import { SetupLoadingOverlay } from './SetupLoadingOverlay';
import { SetupStepRenderer } from './SetupStepRenderer';

interface WorkspaceSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onWorkspaceCreated: (path: string, name: string, description: string, mounts?: WorkspaceMount[]) => Promise<boolean>;
    language: Language;
}

interface CategoryConfig {
    id: string;
    nameKey: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
}

const CATEGORIES: CategoryConfig[] = [
    { id: 'web', nameKey: 'workspaceWizard.categories.web', icon: IconGlobe, color: 'text-primary', bg: 'bg-primary/10' },
    { id: 'backend', nameKey: 'workspaceWizard.categories.backend', icon: IconDatabase, color: 'text-success', bg: 'bg-success/10' },
    { id: 'cli', nameKey: 'workspaceWizard.categories.cli', icon: IconTerminal, color: 'text-warning', bg: 'bg-warning/10' },
    { id: 'mobile', nameKey: 'workspaceWizard.categories.mobile', icon: IconDeviceMobile, color: 'text-primary', bg: 'bg-primary/10' },
    { id: 'other', nameKey: 'workspaceWizard.categories.other', icon: IconCode, color: 'text-muted-foreground', bg: 'bg-muted/10' },
];

export const WorkspaceSetupModal: React.FC<WorkspaceSetupModalProps> = ({ isOpen, onClose, onWorkspaceCreated, language }) => {
    const { t } = useTranslation(language);
    const {
        step,
        setStep,
        formData,
        setFormData,
        sshForm,
        setSshForm,
        sshConnectionId,
        setSshConnectionId,
        sshPath,
        setSshPath,
        sshFiles,
        setSshFiles,
        isLoading,
        setIsLoading,
        error,
        setError
    } = useWorkspaceWizardState(isOpen);

    const isSSHFlow = !!sshConnectionId || step === 'ssh-connection' || step === 'ssh-browser';
    const isImportedLocalFlow = step === 'details' && !sshConnectionId && sshPath.trim() !== '' && sshPath !== '/';

    const progressSteps = useMemo(() => {
        const allSteps = [
            { id: 'selection', label: t('frontend.workspaceWizard.title') },
            { id: 'ssh-connection', label: t('frontend.workspaceWizard.connect') },
            { id: 'ssh-browser', label: t('frontend.workspaceWizard.selectFolder') },
            { id: 'details', label: t('frontend.workspaceWizard.workspaceName') },
            { id: 'creating', label: t('frontend.workspaceWizard.creating') },
        ];
        if (!isSSHFlow) {
            return allSteps.filter(s => s.id !== 'ssh-connection' && s.id !== 'ssh-browser');
        }
        return allSteps;
    }, [t, isSSHFlow]);

    const loadRemoteDirectory = useCallback(async (connId: string, path: string) => {
        setIsLoading(true);
        try {
            const result = await window.electron.ssh.listDir(connId, path);
            if (result.success && result.files) {
                setSshFiles(result.files);
                setSshPath(path);
            } else {
                setError(result.error ?? t('frontend.workspaceWizard.listFailed'));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('frontend.workspaceWizard.listFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [setIsLoading, setSshFiles, setSshPath, setError, t]);

    const handleSSHConnect = useSSHConnectHandler({
        sshForm,
        setIsLoading,
        setError,
        setStep,
        setSshConnectionId,
        loadRemoteDirectory,
        t
    });

    const handleImportLocalSelection = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = normalizeDirectorySelectionResult(await window.electron.selectDirectory());
            if (result.success && result.path) {
                const normalizedPath = result.path.replace(/[/\\]+$/, '');
                const dirName = normalizedPath.split(/[/\\]/).pop() || t('frontend.workspaceWizard.defaultWorkspaceName');
                setFormData(p => ({ ...p, name: p.name || dirName }));
                setSshConnectionId(null);
                setSshPath(result.path); // Use as local path
                setStep('details');
            } else {
                setError(t('frontend.workspaceWizard.selectFailed'));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('frontend.workspaceWizard.selectFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [setIsLoading, setError, setFormData, setStep, setSshPath, setSshConnectionId, t]);

    const handleCreateFinal = useCreateWorkspaceHandler({
        formData,
        setIsLoading,
        setError,
        setStep,
        onWorkspaceCreated,
        onClose,
        t
    });

    const handleImportFinal = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const mounts: WorkspaceMount[] = [{
                id: `local-${Date.now()}`,
                name: formData.name,
                type: 'local',
                rootPath: sshPath
            }];
            const success = await onWorkspaceCreated(sshPath, formData.name, formData.description, mounts);
            if (success) {
                onClose();
                return;
            }
            setError(t('frontend.workspaceWizard.createFailed'));
        } catch (err) {
            setError(err instanceof Error ? err.message : t('frontend.workspaceWizard.createFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [formData, sshPath, onWorkspaceCreated, onClose, setError, setIsLoading, t]);

    const handleCreateNewSelection = useCallback(() => {
        setSshConnectionId(null);
        setSshPath('');
        setStep('details');
    }, [setStep, setSshConnectionId, setSshPath]);

    const handleSSHBrowserNext = useSSHBrowserNextHandler({
        sshConnectionId,
        formData,
        sshForm,
        sshPath,
        setError,
        setIsLoading,
        onWorkspaceCreated,
        onClose,
        t
    });

    const handleNext = useCallback(async () => {
        if (step === 'details') {
            if (!formData.name) {
                return;
            }

            if (sshConnectionId) {
                await handleSSHBrowserNext();
            } else if (sshPath && !sshConnectionId) {
                await handleImportFinal();
            } else {
                await handleCreateFinal();
            }
        } else if (step === 'ssh-connection') {
            await handleSSHConnect();
        } else if (step === 'ssh-browser') {
            setStep('details');
        }
    }, [step, formData.name, sshConnectionId, sshPath, handleSSHConnect, handleSSHBrowserNext, handleImportFinal, handleCreateFinal, setStep]);

    const handleBack = useCallback(() => {
        if (step === 'details') {
            if (sshConnectionId) {
                setStep('ssh-browser');
            } else {
                setStep('selection');
            }
        } else if (step === 'ssh-connection') {
            setStep('selection');
        } else if (step === 'ssh-browser') {
            setStep('ssh-connection');
        } else {
            onClose();
        }
    }, [step, sshConnectionId, setStep, onClose]);

    const renderStep = () => {
        return (
            <SetupStepRenderer
                step={step}
                formData={formData}
                setFormData={setFormData}
                categories={CATEGORIES}
                error={error}
                sshForm={sshForm}
                setSshForm={setSshForm}
                sshPath={sshPath}
                setSshPath={setSshPath}
                sshFiles={sshFiles}
                sshConnectionId={sshConnectionId}
                loadRemoteDirectory={loadRemoteDirectory}
                onImportLocal={() => void handleImportLocalSelection()}
                onSSHConnect={() => setStep('ssh-connection')}
                onCreateNew={handleCreateNewSelection}
                showCustomPathInput={!isImportedLocalFlow}
            />
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="3xl" className="!p-0 overflow-hidden">
            <div className="relative flex min-h-0 flex-col bg-background p-4 pt-4 sm:p-6 sm:pt-5 lg:p-8">
                <div className="mb-7 space-y-3">
                    <WizardProgress
                        steps={progressSteps}
                        currentStepIndex={progressSteps.findIndex(s => s.id === step)}
                    />
                </div>

                <SetupLoadingOverlay
                    isLoading={isLoading}
                    step={step}
                    creatingLabel={t('frontend.workspaceWizard.creating')}
                    loadingLabel={t('common.loading')}
                />

                <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-2xl border border-border/30 bg-card p-4 sm:p-5 lg:p-6">
                    {renderStep()}
                </div>

                <SetupFooter
                    step={step}
                    isLoading={isLoading}
                    formName={formData.name}
                    sshHost={sshForm.host}
                    sshUsername={sshForm.username}
                    onBack={handleBack}
                    onNext={() => { void handleNext(); }}
                    backLabel={t('frontend.workspaceWizard.back')}
                    nextLabel={t('frontend.workspaceWizard.next')}
                    selectFolderLabel={t('frontend.workspaceWizard.selectFolder')}
                    connectLabel={t('common.connect')}
                />
            </div>
        </Modal>
    );
};

// Workspace alias for the new naming convention

