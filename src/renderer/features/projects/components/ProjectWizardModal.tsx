import { ArrowRight, Check, ChevronLeft, Code, Database, Globe, Loader2, Smartphone, Terminal } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Modal } from '@/components/ui/modal';
import { Language, useTranslation } from '@/i18n';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { SSHFile, WorkspaceMount } from '@/types';

import { WizardCreatingStep } from './WizardCreatingStep';
import { WizardDetailsStep } from './WizardDetailsStep';
import { WizardSelectionStep } from './WizardSelectionStep';
import { WizardSSHBrowserStep } from './WizardSSHBrowserStep';
import { WizardSSHConnectStep } from './WizardSSHConnectStep';

interface ProjectWizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProjectCreated: (path: string, name: string, description: string, mounts?: WorkspaceMount[]) => void;
    language: Language;
}

type Step = 'selection' | 'details' | 'ssh-connection' | 'ssh-browser' | 'creating';

const CATEGORIES = [
    { id: 'web', nameKey: 'projectWizard.categories.web', icon: Globe, color: 'text-primary', bg: 'bg-primary/10' },
    { id: 'backend', nameKey: 'projectWizard.categories.backend', icon: Database, color: 'text-success', bg: 'bg-success/10' },
    { id: 'cli', nameKey: 'projectWizard.categories.cli', icon: Terminal, color: 'text-warning', bg: 'bg-warning/10' },
    { id: 'mobile', nameKey: 'projectWizard.categories.mobile', icon: Smartphone, color: 'text-purple', bg: 'bg-purple/10' },
    { id: 'other', nameKey: 'projectWizard.categories.other', icon: Code, color: 'text-muted-foreground', bg: 'bg-muted/10' },
];

export const ProjectWizardModal: React.FC<ProjectWizardModalProps> = ({ isOpen, onClose, onProjectCreated, language }) => {
    const { t } = useTranslation(language);
    const [step, setStep] = useState<Step>('selection');
    const [formData, setFormData] = useState({ name: '', description: '', category: 'web', goal: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [sshForm, setSshForm] = useState({
        host: '',
        port: '22',
        username: '',
        authType: 'password' as 'password' | 'key',
        password: '',
        privateKey: '',
        passphrase: ''
    });

    const [sshConnectionId, setSshConnectionId] = useState<string | null>(null);
    const [sshPath, setSshPath] = useState<string>('/');
    const [sshFiles, setSshFiles] = useState<SSHFile[]>([]);

    useEffect(() => {
        if (isOpen) {
            setStep('details');
            setFormData({ name: '', description: '', category: 'web', goal: '' });
            setSshForm({ host: '', port: '22', username: '', authType: 'password', password: '', privateKey: '', passphrase: '' });
            setSshConnectionId(null);
            setSshPath('/');
            setSshFiles([]);
            setIsLoading(false);
            setError(null);
        }
    }, [isOpen]);

    const loadRemoteDirectory = useCallback(async (connId: string, path: string) => {
        setIsLoading(true);
        try {
            const result = await window.electron.ssh.listDir(connId, path);
            if (result.success && result.files) {
                setSshFiles(result.files);
                setSshPath(path);
            } else {
                setError(result.error || 'Failed to list directory');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to list directory');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleImportLocal = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await window.electron.selectDirectory();
            if (result.success && result.path) {
                const mounts: WorkspaceMount[] = [{
                    id: `local-${Date.now()}`,
                    name: formData.name || result.path.split(/[/\\]/).pop() || 'Project',
                    type: 'local',
                    rootPath: result.path
                }];
                onProjectCreated(result.path, formData.name || mounts[0]?.name || '', formData.description, mounts);
                onClose();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to select directory');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSSHConnect = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await window.electron.ssh.connect({
                host: sshForm.host,
                port: parseInt(sshForm.port),
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
                setError(result.error || 'Failed to connect');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Connection failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!formData.name) { return; }
        setIsLoading(true);
        setError(null);
        setStep('creating');

        try {
            const userData = await window.electron.getUserDataPath();
            const projectsDir = `${userData}\\projects`;
            const projectPath = `${projectsDir}\\${formData.name.replace(/[^a-zA-Z0-9-_]/g, '-')}`;

            await window.electron.createDirectory(projectsDir);
            await window.electron.createDirectory(projectPath);

            const readmeContent = `# ${formData.name}\n\n${formData.description}\n`;
            await window.electron.writeFile(`${projectPath}\\README.md`, readmeContent);

            onProjectCreated(projectPath, formData.name, formData.description);
            onClose();

        } catch (err) {
            console.error('Project Creation Failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to create project');
            setStep('selection');
        } finally {
            setIsLoading(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 'details':
                return <WizardDetailsStep formData={formData} setFormData={setFormData} categories={CATEGORIES} error={error} />;
            case 'selection':
                return <WizardSelectionStep onImportLocal={handleImportLocal} onSSHConnect={() => setStep('ssh-connection')} onCreateNew={handleCreate} />;
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

    const handleNext = () => {
        if (step === 'details') {
            if (!formData.name) { return; }
            setStep('selection');
        } else if (step === 'ssh-connection') {
            void handleSSHConnect();
        } else if (step === 'ssh-browser') {
            const sshMount: WorkspaceMount = {
                id: sshConnectionId || `ssh-${Date.now()}`,
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
            onProjectCreated(sshPath, formData.name || sshMount.name, formData.description, [sshMount]);
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('projectWizard.title')} size="3xl">
            <div className="relative min-h-[500px] flex flex-col">
                {isLoading && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center rounded-2xl">
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-10 h-10 animate-spin text-primary" />
                            <span className="text-sm font-medium text-foreground animate-pulse tracking-widest uppercase">
                                {step === 'creating' ? t('projectWizard.creating') : t('common.loading')}
                            </span>
                        </div>
                    </div>
                )}

                <AnimatePresence mode="wait">
                    <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
                        {renderStep()}
                    </motion.div>
                </AnimatePresence>

                {step !== 'creating' && (
                    <div className="flex justify-between items-center pt-6 border-t border-border/20 mt-auto">
                        <button
                            onClick={() => {
                                if (step === 'selection') { setStep('details'); }
                                else if (step === 'ssh-connection') { setStep('selection'); }
                                else if (step === 'ssh-browser') { setStep('ssh-connection'); }
                                else { onClose(); }
                            }}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
                        >
                            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            {t('projectWizard.back')}
                        </button>

                        <div className="flex gap-3">
                            {step !== 'selection' && (
                                <button
                                    onClick={handleNext}
                                    disabled={isLoading || (step === 'details' && !formData.name) || (step === 'ssh-connection' && (!sshForm.host || !sshForm.username))}
                                    className={cn(
                                        "px-6 py-2.5 rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2 shadow-lg",
                                        step === 'ssh-connection' ? "bg-purple text-foreground shadow-purple-500/20" : "bg-primary text-primary-foreground shadow-primary/20"
                                    )}
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (step === 'ssh-browser' ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />)}
                                    {step === 'ssh-connection' ? t('common.connect') : (step === 'ssh-browser' ? t('projectWizard.selectFolder') : t('projectWizard.next'))}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
