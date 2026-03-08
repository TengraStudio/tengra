import React, { useCallback, useState } from 'react';

import { SSHFile } from '@/types';

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

interface UseWorkspaceWizardStateReturn {
    step: 'selection' | 'details' | 'ssh-connection' | 'ssh-browser' | 'creating';
    setStep: (step: 'selection' | 'details' | 'ssh-connection' | 'ssh-browser' | 'creating') => void;
    formData: FormData;
    setFormData: React.Dispatch<React.SetStateAction<FormData>>;
    sshForm: SSHForm;
    setSshForm: React.Dispatch<React.SetStateAction<SSHForm>>;
    sshConnectionId: string | null;
    setSshConnectionId: (id: string | null) => void;
    sshPath: string;
    setSshPath: (path: string) => void;
    sshFiles: SSHFile[];
    setSshFiles: (files: SSHFile[]) => void;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
    error: string | null;
    setError: (error: string | null) => void;
    resetWizardState: () => void;
}

export const useWorkspaceWizardState = (isOpen: boolean): UseWorkspaceWizardStateReturn => {
    const [step, setStep] = useState<'selection' | 'details' | 'ssh-connection' | 'ssh-browser' | 'creating'>('selection');
    const [formData, setFormData] = useState<FormData>({ name: '', description: '', category: 'web', goal: '', customPath: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sshForm, setSshForm] = useState<SSHForm>({
        host: '',
        port: '22',
        username: '',
        authType: 'password',
        password: '',
        privateKey: '',
        passphrase: ''
    });
    const [sshConnectionId, setSshConnectionId] = useState<string | null>(null);
    const [sshPath, setSshPath] = useState<string>('/');
    const [sshFiles, setSshFiles] = useState<SSHFile[]>([]);

    const resetWizardState = useCallback(() => {
        setStep('selection');
        setFormData({ name: '', description: '', category: 'web', goal: '', customPath: '' });
        setSshForm({ host: '', port: '22', username: '', authType: 'password', password: '', privateKey: '', passphrase: '' });
        setSshConnectionId(null);
        setSshPath('/');
        setSshFiles([]);
        setIsLoading(false);
        setError(null);
    }, []);

    React.useEffect(() => {
        if (isOpen) {
            resetWizardState();
        }
    }, [isOpen, resetWizardState]);

    return {
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
        setError,
        resetWizardState
    };
};
