/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { SSHFile } from '@/types';

import { SetupCreatingStep } from './SetupCreatingStep';
import { SetupDetailsStep } from './SetupDetailsStep';
import { SetupSelectionStep } from './SetupSelectionStep';
import { SetupSSHBrowserStep } from './SetupSSHBrowserStep';
import { SetupSSHConnectStep } from './SetupSSHConnectStep';

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

interface SetupStepRendererProps {
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
    showCustomPathInput?: boolean;
}

export const SetupStepRenderer: React.FC<SetupStepRendererProps> = ({
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
                return <SetupDetailsStep formData={formData} setFormData={setFormData} categories={categories} error={error} />;
            case 'selection':
                return <SetupSelectionStep onImportLocal={onImportLocal} onSSHConnect={onSSHConnect} onCreateNew={onCreateNew} />;
            case 'ssh-connection':
                return <SetupSSHConnectStep sshForm={sshForm} setSshForm={setSshForm} />;
            case 'ssh-browser':
                return <SetupSSHBrowserStep sshPath={sshPath} setSshPath={setSshPath} sshFiles={sshFiles} sshConnectionId={sshConnectionId} loadRemoteDirectory={loadRemoteDirectory} />;
            case 'creating':
                return <SetupCreatingStep />;
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
