import { Code, Database, Globe, Smartphone, Terminal } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';

import { WizardProgress } from '@/components/shared/wizard';
import { Modal } from '@/components/ui/modal';
import { Language, useTranslation } from '@/i18n';
import { WorkspaceMount } from '@/types';

import { useProjectWizardState } from '../hooks/useProjectWizardState';
import { useCreateProjectHandler, useSSHBrowserNextHandler, useSSHConnectHandler } from '../hooks/useWizardHandlers';

import { WizardFooter } from './WizardFooter';
import { WizardLoadingOverlay } from './WizardLoadingOverlay';
import { WizardStepRenderer } from './WizardStepRenderer';

interface ProjectWizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProjectCreated: (path: string, name: string, description: string, mounts?: WorkspaceMount[]) => void;
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
    { id: 'web', nameKey: 'projectWizard.categories.web', icon: Globe, color: 'text-primary', bg: 'bg-primary/10' },
    { id: 'backend', nameKey: 'projectWizard.categories.backend', icon: Database, color: 'text-success', bg: 'bg-success/10' },
    { id: 'cli', nameKey: 'projectWizard.categories.cli', icon: Terminal, color: 'text-warning', bg: 'bg-warning/10' },
    { id: 'mobile', nameKey: 'projectWizard.categories.mobile', icon: Smartphone, color: 'text-purple', bg: 'bg-purple/10' },
    { id: 'other', nameKey: 'projectWizard.categories.other', icon: Code, color: 'text-muted-foreground', bg: 'bg-muted/10' },
];

export const ProjectWizardModal: React.FC<ProjectWizardModalProps> = ({ isOpen, onClose, onProjectCreated, language }) => {
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
    } = useProjectWizardState(isOpen);

    const isSSHFlow = !!sshConnectionId || step === 'ssh-connection' || step === 'ssh-browser';

    const progressSteps = useMemo(() => {
        const allSteps = [
            { id: 'selection', label: t('projectWizard.title') },
            { id: 'ssh-connection', label: t('projectWizard.connect') },
            { id: 'ssh-browser', label: t('projectWizard.selectFolder') },
            { id: 'details', label: t('projectWizard.projectName') },
            { id: 'creating', label: t('projectWizard.creating') },
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
                setError(result.error ?? 'Failed to list directory');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to list directory');
        } finally {
            setIsLoading(false);
        }
    }, [setIsLoading, setSshFiles, setSshPath, setError]);

    const handleSSHConnect = useSSHConnectHandler({
        sshForm,
        setIsLoading,
        setError,
        setStep,
        setSshConnectionId,
        loadRemoteDirectory
    });

    const handleImportLocalSelection = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await window.electron.selectDirectory();
            if (result.success && result.path) {
                const dirName = result.path.split(/[/\\]/).pop() ?? 'Project';
                setFormData(p => ({ ...p, name: p.name || dirName }));
                setSshConnectionId(null);
                setSshPath(result.path); // Use as local path
                setStep('details');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to select directory');
        } finally {
            setIsLoading(false);
        }
    }, [setIsLoading, setError, setFormData, setStep, setSshPath, setSshConnectionId]);

    const handleCreateFinal = useCreateProjectHandler({
        formData,
        setIsLoading,
        setError,
        setStep,
        onProjectCreated,
        onClose
    });

    const handleImportFinal = useCallback(() => {
        const mounts: WorkspaceMount[] = [{
            id: `local-${Date.now()}`,
            name: formData.name,
            type: 'local',
            rootPath: sshPath
        }];
        onProjectCreated(sshPath, formData.name, formData.description, mounts);
        onClose();
    }, [formData, sshPath, onProjectCreated, onClose]);

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
        onProjectCreated,
        onClose
    });

    const handleNext = useCallback(() => {
        if (step === 'details') {
            if (!formData.name) {
                return;
            }

            if (sshConnectionId) {
                handleSSHBrowserNext();
            } else if (sshPath && !sshConnectionId) {
                handleImportFinal();
            } else {
                void handleCreateFinal();
            }
        } else if (step === 'ssh-connection') {
            void handleSSHConnect();
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
            />
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="3xl" className="!p-0 overflow-hidden">
            <div className="relative min-h-[620px] flex flex-col p-8 pt-5 bg-gradient-to-b from-background to-muted/10">
                <div className="mb-7 space-y-3">
                    <h2 className="text-3xl font-black tracking-tight text-foreground">{t('projectWizard.title')}</h2>
                    <WizardProgress
                        steps={progressSteps}
                        currentStepIndex={progressSteps.findIndex(s => s.id === step)}
                    />
                </div>

                <WizardLoadingOverlay
                    isLoading={isLoading}
                    step={step}
                    creatingLabel={t('projectWizard.creating')}
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
                    onNext={handleNext}
                    backLabel={t('projectWizard.back')}
                    nextLabel={t('projectWizard.next')}
                    selectFolderLabel={t('projectWizard.selectFolder')}
                    connectLabel={t('common.connect')}
                />
            </div>
        </Modal>
    );
};

// Workspace alias for the new naming convention
export const WorkspaceWizardModal = ProjectWizardModal;
