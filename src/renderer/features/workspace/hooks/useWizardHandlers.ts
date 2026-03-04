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

interface CreateProjectOptions {
    formData: FormData;
    setIsLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setStep: (step: 'selection' | 'details' | 'ssh-connection' | 'ssh-browser' | 'creating') => void;
    onProjectCreated: (path: string, name: string, description: string, mounts?: WorkspaceMount[]) => void;
    onClose: () => void;
}

interface SSHBrowserNextOptions {
    sshConnectionId: string | null;
    formData: FormData;
    sshForm: SSHForm;
    sshPath: string;
    onProjectCreated: (path: string, name: string, description: string, mounts?: WorkspaceMount[]) => void;
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

export const useCreateProjectHandler = (options: CreateProjectOptions) => {
    const { formData, setIsLoading, setError, setStep, onProjectCreated, onClose } = options;
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
            const configuredBasePath = settings.general.projectsBasePath?.trim() ?? '';
            const projectsDir = formData.customPath.trim() || configuredBasePath || `${userData}\\projects`;
            const safeProjectName = formData.name.replace(/[^a-zA-Z0-9-_]/g, '-');
            const projectPath = `${projectsDir}\\${safeProjectName}`;

            await window.electron.createDirectory(projectsDir);
            await window.electron.createDirectory(projectPath);

            const readmeContent = `# ${formData.name}\n\n${formData.description}\n`;
            await window.electron.writeFile(`${projectPath}\\README.md`, readmeContent);

            onProjectCreated(projectPath, formData.name, formData.description);
            onClose();

        } catch (err) {
            window.electron.log.error('Project Creation Failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to create project');
            setStep('selection');
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
    onProjectCreated: (path: string, name: string, description: string, mounts?: WorkspaceMount[]) => void,
    onClose: () => void
) => {
    const handleImportLocal = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await window.electron.selectDirectory();
            if (result.success && result.path) {
                const dirName = result.path.split(/[/\\]/).pop() ?? 'Project';
                const mounts: WorkspaceMount[] = [{
                    id: `local-${Date.now()}`,
                    name: formData.name || dirName,
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

    return handleImportLocal;
};

export const useSSHBrowserNextHandler = (options: SSHBrowserNextOptions) => {
    const { sshConnectionId, formData, sshForm, sshPath, onProjectCreated, onClose } = options;
    const handleSSHBrowserNext = () => {
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
        const remoteProjectPath = `ssh://${sshForm.username}@${sshForm.host}:${parseInt(sshForm.port, 10) || 22}${sshPath}`;
        onProjectCreated(remoteProjectPath, formData.name || sshMount.name, formData.description, [sshMount]);
        onClose();
    };

    return handleSSHBrowserNext;
};

