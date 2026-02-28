import React from 'react';

import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { SSHFile } from '@/types';

import { WizardCreatingStep } from './WizardCreatingStep';
import { WizardDetailsStep } from './WizardDetailsStep';
import { WizardSelectionStep } from './WizardSelectionStep';
import { WizardSSHBrowserStep } from './WizardSSHBrowserStep';
import { WizardSSHConnectStep } from './WizardSSHConnectStep';

interface CategoryConfig {
    id: string;
    nameKey: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
}

interface FormData {
    name: string;
    description: string;
    category: string;
    goal: string;
    customPath: string;
}

interface SshFormData {
    host: string;
    port: string;
    username: string;
    authType: 'password' | 'key';
    password: string;
    privateKey: string;
    passphrase: string;
}

interface WizardStepRendererProps {
    step: 'selection' | 'details' | 'ssh-connection' | 'ssh-browser' | 'creating';
    formData: FormData;
    setFormData: React.Dispatch<React.SetStateAction<FormData>>;
    categories: CategoryConfig[];
    error: string | null;
    sshForm: SshFormData;
    setSshForm: React.Dispatch<React.SetStateAction<SshFormData>>;
    sshPath: string;
    setSshPath: (path: string) => void;
    sshFiles: SSHFile[];
    sshConnectionId: string | null;
    loadRemoteDirectory: (connId: string, path: string) => Promise<void>;
    onImportLocal: () => void;
    onSSHConnect: () => void;
    onCreateNew: () => void;
}

export const WizardStepRenderer: React.FC<WizardStepRendererProps> = ({
    step,
    formData,
    setFormData,
    categories,
    error,
    sshForm,
    setSshForm,
    sshPath,
    setSshPath,
    sshFiles,
    sshConnectionId,
    loadRemoteDirectory,
    onImportLocal,
    onSSHConnect,
    onCreateNew
}) => {
    const renderStep = () => {
        switch (step) {
            case 'details':
                return <WizardDetailsStep formData={formData} setFormData={setFormData} categories={categories} error={error} />;
            case 'selection':
                return <WizardSelectionStep onImportLocal={onImportLocal} onSSHConnect={onSSHConnect} onCreateNew={onCreateNew} />;
            case 'ssh-connection':
                return <WizardSSHConnectStep sshForm={sshForm} setSshForm={setSshForm} />;
            case 'ssh-browser':
                return <WizardSSHBrowserStep sshPath={sshPath} setSshPath={setSshPath} sshFiles={sshFiles} sshConnectionId={sshConnectionId} loadRemoteDirectory={loadRemoteDirectory} />;
            case 'creating':
                return <WizardCreatingStep />;
            default:
                return null;
        }
    };

    return (
        <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
                {renderStep()}
            </motion.div>
        </AnimatePresence>
    );
};
