import {
    useCreateWorkspaceHandler,
    useSSHBrowserNextHandler,
    useSSHConnectHandler
} from '@renderer/features/workspace/hooks/useWizardHandlers';
import { useWorkspaceWizardState } from '@renderer/features/workspace/hooks/useWorkspaceWizardState';
import { WizardFooter } from '@renderer/features/workspace/workspace-wizard/WizardFooter';
import { WizardLoadingOverlay } from '@renderer/features/workspace/workspace-wizard/WizardLoadingOverlay';
import { WizardStepRenderer } from '@renderer/features/workspace/workspace-wizard/WizardStepRenderer';
import { Code, Database, Globe, Smartphone, Terminal } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';

import { WizardProgress } from '@/components/shared/wizard';
import { Modal } from '@/components/ui/modal';
import { Language, useTranslation } from '@/i18n';
import { WorkspaceMount } from '@/types';

interface WorkspaceWizardModalProps {
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
    { id: 'web', nameKey: 'workspaceWizard.categories.web', icon: Globe, color: 'text-primary', bg: 'bg-primary/10' },
    { id: 'backend', nameKey: 'workspaceWizard.categories.backend', icon: Database, color: 'text-success', bg: 'bg-success/10' },
    { id: 'cli', nameKey: 'workspaceWizard.categories.cli', icon: Terminal, color: 'text-warning', bg: 'bg-warning/10' },
    { id: 'mobile', nameKey: 'workspaceWizard.categories.mobile', icon: Smartphone, color: 'text-primary', bg: 'bg-primary/10' },
    { id: 'other', nameKey: 'workspaceWizard.categories.other', icon: Code, color: 'text-muted-foreground', bg: 'bg-muted/10' },
];

export const WorkspaceWizardModal: React.FC<WorkspaceWizardModalProps> = ({ isOpen, onClose, onWorkspaceCreated, language }) => {
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
            { id: 'selection', label: t('workspaceWizard.title') },
            { id: 'ssh-connection', label: t('workspaceWizard.connect') },
            { id: 'ssh-browser', label: t('workspaceWizard.selectFolder') },
            { id: 'details', label: t('workspaceWizard.workspaceName') },
            { id: 'creating', label: t('workspaceWizard.creating') },
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
                setError(result.error ?? t('workspaceWizard.listFailed'));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('workspaceWizard.listFailed'));
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
            const result = await window.electron.selectDirectory();
            if (result.success && result.path) {
                const normalizedPath = result.path.replace(/[/\\]+$/, '');
                const dirName = normalizedPath.split(/[/\\]/).pop() || t('workspaceWizard.defaultWorkspaceName');
                setFormData(p => ({ ...p, name: p.name || dirName }));
                setSshConnectionId(null);
                setSshPath(result.path); // Use as local path
                setStep('details');
            } else {
                setError(t('workspaceWizard.selectFailed'));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('workspaceWizard.selectFailed'));
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
            setError(t('workspaceWizard.createFailed'));
        } catch (err) {
            setError(err instanceof Error ? err.message : t('workspaceWizard.createFailed'));
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
            <WizardStepRenderer
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
            <div className="relative tw-min-h-620 flex flex-col p-8 pt-5 bg-gradient-to-b from-background to-muted/10">
                <div className="mb-7 space-y-3">
                    <WizardProgress
                        steps={progressSteps}
                        currentStepIndex={progressSteps.findIndex(s => s.id === step)}
                    />
                </div>

                <WizardLoadingOverlay
                    isLoading={isLoading}
                    step={step}
                    creatingLabel={t('workspaceWizard.creating')}
                    loadingLabel={t('common.loading')}
                />

                <div className="flex-1 flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-6">
                    {renderStep()}
                </div>

                <WizardFooter
                    step={step}
                    isLoading={isLoading}
                    formName={formData.name}
                    sshHost={sshForm.host}
                    sshUsername={sshForm.username}
                    onBack={handleBack}
                    onNext={() => { void handleNext(); }}
                    backLabel={t('workspaceWizard.back')}
                    nextLabel={t('workspaceWizard.next')}
                    selectFolderLabel={t('workspaceWizard.selectFolder')}
                    connectLabel={t('common.connect')}
                />
            </div>
        </Modal>
    );
};

// Workspace alias for the new naming convention
