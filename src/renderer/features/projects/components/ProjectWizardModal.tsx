import { Code, Database, Globe, Smartphone, Terminal } from 'lucide-react';
import React, { useCallback } from 'react';

import { Modal } from '@/components/ui/modal';
import { Language, useTranslation } from '@/i18n';
import { WorkspaceMount } from '@/types';

import { useProjectWizardState } from '../hooks/useProjectWizardState';
import { useCreateProjectHandler, useImportLocalHandler, useSSHBrowserNextHandler,useSSHConnectHandler } from '../hooks/useWizardHandlers';

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

    const handleImportLocal = useImportLocalHandler(
        formData,
        setIsLoading,
        setError,
        onProjectCreated,
        onClose
    );

    const handleCreate = useCreateProjectHandler({
        formData,
        setIsLoading,
        setError,
        setStep,
        onProjectCreated,
        onClose
    });

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
            setStep('selection');
        } else if (step === 'ssh-connection') {
            void handleSSHConnect();
        } else if (step === 'ssh-browser') {
            handleSSHBrowserNext();
        }
    }, [step, formData.name, handleSSHConnect, handleSSHBrowserNext, setStep]);

    const handleBack = useCallback(() => {
        if (step === 'selection') {
            setStep('details');
        } else if (step === 'ssh-connection') {
            setStep('selection');
        } else if (step === 'ssh-browser') {
            setStep('ssh-connection');
        } else {
            onClose();
        }
    }, [step, setStep, onClose]);

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
                onImportLocal={() => void handleImportLocal()}
                onSSHConnect={() => setStep('ssh-connection')}
                onCreateNew={() => void handleCreate()}
            />
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('projectWizard.title')} size="3xl">
            <div className="relative min-h-[500px] flex flex-col">
                <WizardLoadingOverlay
                    isLoading={isLoading}
                    step={step}
                    creatingLabel={t('projectWizard.creating')}
                    loadingLabel={t('common.loading')}
                />

                {renderStep()}

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
