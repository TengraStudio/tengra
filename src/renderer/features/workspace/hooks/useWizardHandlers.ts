import { WorkspaceMount } from '@/types';

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

interface SSHConnectOptions {
    sshForm: SSHForm;
    setIsLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setStep: (step: 'selection' | 'details' | 'ssh-connection' | 'ssh-browser' | 'creating') => void;
    setSshConnectionId: (id: string | null) => void;
    loadRemoteDirectory: (connId: string, path: string) => Promise<void>;
}

interface CreateWorkspaceOptions {
    formData: FormData;
    setIsLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setStep: (step: 'selection' | 'details' | 'ssh-connection' | 'ssh-browser' | 'creating') => void;
    onWorkspaceCreated: (path: string, name: string, description: string, mounts?: WorkspaceMount[]) => Promise<boolean>;
    onClose: () => void;
}

interface SSHBrowserNextOptions {
    sshConnectionId: string | null;
    formData: FormData;
    sshForm: SSHForm;
    sshPath: string;
    setError: (error: string | null) => void;
    setIsLoading: (loading: boolean) => void;
    onWorkspaceCreated: (path: string, name: string, description: string, mounts?: WorkspaceMount[]) => Promise<boolean>;
    onClose: () => void;
}

export const useSSHConnectHandler = (options: SSHConnectOptions) => {
    const { sshForm, setIsLoading, setError, setStep, setSshConnectionId, loadRemoteDirectory } = options;
    const handleSSHConnect = async () => {
        if (!sshForm.host.trim() || !sshForm.username.trim()) {
            setError('Invalid input');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const testResult = await window.electron.ssh.testProfile({
                host: sshForm.host,
                port: parseInt(sshForm.port, 10) || 22,
                username: sshForm.username,
                authType: sshForm.authType,
                password: sshForm.authType === 'password' ? sshForm.password : undefined,
                privateKey: sshForm.authType === 'key' ? sshForm.privateKey : undefined,
                passphrase: sshForm.authType === 'key' ? sshForm.passphrase : undefined
            });
            if (!testResult.success) {
                setError(testResult.error ?? 'Connection failed');
                return;
            }

            const result = await window.electron.ssh.connect({
                host: sshForm.host,
                port: parseInt(sshForm.port, 10) || 22,
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
                setError(result.error ?? 'Failed to connect');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Connection failed');
        } finally {
            setIsLoading(false);
        }
    };

    return handleSSHConnect;
};

export const useCreateWorkspaceHandler = (options: CreateWorkspaceOptions) => {
    const { formData, setIsLoading, setError, setStep, onWorkspaceCreated, onClose } = options;
    const handleCreate = async () => {
        if (!formData.name) {
            return;
        }
        setIsLoading(true);
        setError(null);
        setStep('creating');

        try {
            const userData = await window.electron.getUserDataPath();
            const settings = await window.electron.getSettings();
            const configuredBasePath = settings.general.workspacesBasePath?.trim() ?? '';
            const workspacesDir = formData.customPath.trim() || configuredBasePath || `${userData}\\workspaces`;
            const safeWorkspaceName = formData.name.replace(/[^a-zA-Z0-9-_]/g, '-');
            const workspacePath = `${workspacesDir}\\${safeWorkspaceName}`;

            await window.electron.files.createDirectory(workspacesDir);
            await window.electron.files.createDirectory(workspacePath);

            const readmeContent = `# ${formData.name}\n\n${formData.description}\n`;
            await window.electron.files.writeFile(`${workspacePath}\\README.md`, readmeContent);

            const success = await onWorkspaceCreated(workspacePath, formData.name, formData.description);
            if (success) {
                onClose();
                return;
            }
            setError('Failed to create workspace');
            setStep('details');

        } catch (err) {
            const errorToReport = err instanceof Error ? err : new Error('Failed to create workspace');
            window.electron.log.error('Workspace Creation Failed:', errorToReport);
            setError(errorToReport.message);
            setStep('details');
        } finally {
            setIsLoading(false);
        }
    };

    return handleCreate;
};

export const useImportLocalHandler = (
    formData: FormData,
    setIsLoading: (loading: boolean) => void,
    setError: (error: string | null) => void,
    onWorkspaceCreated: (path: string, name: string, description: string, mounts?: WorkspaceMount[]) => Promise<boolean>,
    onClose: () => void
) => {
    const handleImportLocal = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await window.electron.selectDirectory();
            if (result.success && result.path) {
                const normalizedPath = result.path.replace(/[/\\]+$/, '');
                const dirName = normalizedPath.split(/[/\\]/).pop() || 'Workspace';
                const mounts: WorkspaceMount[] = [{
                    id: `local-${Date.now()}`,
                    name: formData.name || dirName,
                    type: 'local',
                    rootPath: result.path
                }];
                const success = await onWorkspaceCreated(result.path, formData.name || mounts[0]?.name || '', formData.description, mounts);
                if (success) {
                    onClose();
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to select directory');
        } finally {
            setIsLoading(false);
        }
    };

    return handleImportLocal;
};

export const useSSHBrowserNextHandler = (options: SSHBrowserNextOptions) => {
    const { sshConnectionId, formData, sshForm, sshPath, setError, setIsLoading, onWorkspaceCreated, onClose } = options;
    const handleSSHBrowserNext = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const sshMount: WorkspaceMount = {
                id: sshConnectionId ?? `ssh-${Date.now()}`,
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
            const remoteWorkspacePath = `ssh://${sshForm.username}@${sshForm.host}:${parseInt(sshForm.port, 10) || 22}${sshPath}`;
            const success = await onWorkspaceCreated(remoteWorkspacePath, formData.name || sshMount.name, formData.description, [sshMount]);
            if (success) {
                onClose();
                return;
            }
            setError('Failed to create workspace');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create workspace');
        } finally {
            setIsLoading(false);
        }
    };

    return handleSSHBrowserNext;
};

