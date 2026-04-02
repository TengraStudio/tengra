import { SSHProfileTestResult } from '@shared/types/ssh';
import { useCallback, useState } from 'react';

import { recordWorkspacesPageHealthEvent } from '@/store/workspaces-page-health.store';
import { MountForm, WorkspaceMount } from '@/types';
import { normalizeDirectorySelectionResult } from '@/utils/directory-selection.util';
import { appLogger } from '@/utils/renderer-logger';

import {
    validateWorkspaceMountForm,
    workspaceMountErrorCodes,
} from '../utils/workspace-mount-validation';

/**
 * Props for the mount management hook.
 */
interface UseMountManagementProps {
    workspaceId: string;
    mounts: WorkspaceMount[];
    setMounts: (mounts: WorkspaceMount[]) => void;
    notify: (type: 'success' | 'error' | 'info', message: string) => void;
    t: (key: string) => string;
}

/** Default mount form state. */
const DEFAULT_MOUNT_FORM: MountForm = {
    type: 'local',
    name: '',
    rootPath: '',
    host: '',
    port: '22',
    username: '',
    authType: 'password',
    password: '',
    privateKey: '',
    passphrase: '',
    saveProfile: false,
};

/**
 * Persist mounts to the database and record health events.
 */
function usePersistMounts(
    workspaceId: string,
    setMounts: (mounts: WorkspaceMount[]) => void,
    notify: (type: 'success' | 'error' | 'info', message: string) => void,
    t: (key: string) => string
): (nextMounts: WorkspaceMount[]) => Promise<boolean> {
    return useCallback(
        async (nextMounts: WorkspaceMount[]): Promise<boolean> => {
            const startedAt = Date.now();
            setMounts(nextMounts);
            try {
                await window.electron.db.updateWorkspace(workspaceId, { mounts: nextMounts });
                recordWorkspacesPageHealthEvent({
                    channel: 'workspace.persistMounts',
                    status: 'success',
                    durationMs: Date.now() - startedAt,
                });
                return true;
            } catch (error) {
                appLogger.error('useMountManagement', 'Failed to save mounts', error as Error);
                notify('error', t('errors.unexpected'));
                recordWorkspacesPageHealthEvent({
                    channel: 'workspace.persistMounts',
                    status: 'failure',
                    durationMs: Date.now() - startedAt,
                    errorCode: workspaceMountErrorCodes.persistFailed,
                });
                return false;
            }
        },
        [workspaceId, notify, setMounts, t]
    );
}

/**
 * Save an SSH profile if the form requests it. Returns void.
 */
async function saveSSHProfileIfNeeded(
    mountForm: MountForm,
    parsedPort: number,
    notify: (type: 'success' | 'error' | 'info', message: string) => void,
    t: (key: string) => string,
    startedAt: number
): Promise<void> {
    if (mountForm.type !== 'ssh' || !mountForm.saveProfile) {
        return;
    }
    try {
        await window.electron.ssh.saveProfile({
            name: mountForm.name || mountForm.host || t('workspaces.sshMountName'),
            host: mountForm.host || '',
            port: parsedPort,
            username: mountForm.username || '',
            authType: mountForm.authType,
            password: mountForm.password,
            privateKey: mountForm.privateKey,
            passphrase: mountForm.passphrase,
        });
        notify('success', t('workspaceModals.profileSaved'));
    } catch (error) {
        appLogger.error('useMountManagement', 'Failed to save SSH profile', error as Error);
        notify('error', t('errors.unexpected'));
        recordWorkspacesPageHealthEvent({
            channel: 'workspace.addMount',
            status: 'failure',
            errorCode: workspaceMountErrorCodes.profileSaveFailed,
            durationMs: Date.now() - startedAt,
        });
    }
}

/**
 * Manages mount form state, add/remove mounts, SSH test connection, and folder picking.
 * Extracted from useWorkspaceManager to keep function sizes under the NASA 60-line limit.
 */
export function useMountManagement({
    workspaceId,
    mounts,
    setMounts,
    notify,
    t,
}: UseMountManagementProps) {
    const persistMounts = usePersistMounts(workspaceId, setMounts, notify, t);
    const [mountForm, setMountForm] = useState<MountForm>(DEFAULT_MOUNT_FORM);

    const addMount = useCallback(async () => {
        const startedAt = Date.now();
        const validation = validateWorkspaceMountForm(mountForm);
        if (!validation.success) {
            notify('error', t(validation.messageKey ?? 'errors.unexpected'));
            recordWorkspacesPageHealthEvent({
                channel: 'workspace.addMount',
                status: 'validation-failure',
                errorCode: validation.errorCode,
            });
            return;
        }

        const newMount: WorkspaceMount = {
            id: `mount-${Date.now()}`,
            name: mountForm.name || (mountForm.type === 'local' ? t('workspaces.localMountName') : mountForm.host || t('workspaces.sshMountName')),
            type: mountForm.type,
            rootPath: mountForm.rootPath,
            ssh:
                mountForm.type === 'ssh'
                    ? {
                        host: mountForm.host || '',
                        port: validation.parsedPort,
                        username: mountForm.username || '',
                        authType: mountForm.authType,
                        password: mountForm.password,
                        privateKey: mountForm.privateKey,
                        passphrase: mountForm.passphrase,
                    }
                    : undefined,
        };

        await saveSSHProfileIfNeeded(mountForm, validation.parsedPort, notify, t, startedAt);

        const nextMounts = [...mounts, newMount];
        const persisted = await persistMounts(nextMounts);
        if (!persisted) {
            recordWorkspacesPageHealthEvent({
                channel: 'workspace.addMount',
                status: 'failure',
                errorCode: workspaceMountErrorCodes.persistFailed,
                durationMs: Date.now() - startedAt,
            });
            return;
        }

        setMountForm({ ...DEFAULT_MOUNT_FORM });
        recordWorkspacesPageHealthEvent({
            channel: 'workspace.addMount',
            status: 'success',
            durationMs: Date.now() - startedAt,
        });
    }, [mountForm, mounts, notify, persistMounts, t]);

    const testConnection = useCallback(async (form: MountForm): Promise<SSHProfileTestResult> => {
        const validation = validateWorkspaceMountForm({ ...form, type: 'ssh' });
        if (!validation.success) {
            recordWorkspacesPageHealthEvent({
                channel: 'workspace.testConnection',
                status: 'validation-failure',
                errorCode: validation.errorCode,
            });
            return {
                success: false,
                latencyMs: 0,
                authMethod: form.authType,
                message: t(validation.messageKey ?? 'errors.unexpected'),
                errorCode: validation.errorCode,
                uiState: 'failure',
            };
        }
        const startedAt = Date.now();
        const maxAttempts = 2;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                const result = await window.electron.ssh.testProfile({
                    host: form.host,
                    port: validation.parsedPort,
                    username: form.username,
                    authType: form.authType,
                    password: form.password,
                    privateKey: form.privateKey,
                    passphrase: form.passphrase,
                });

                if (result.success) {
                    recordWorkspacesPageHealthEvent({
                        channel: 'workspace.testConnection',
                        status: 'success',
                        durationMs: Date.now() - startedAt,
                    });
                    return { ...result, uiState: 'ready' };
                }
                if (attempt === maxAttempts) {
                    recordWorkspacesPageHealthEvent({
                        channel: 'workspace.testConnection',
                        status: 'failure',
                        durationMs: Date.now() - startedAt,
                        errorCode: workspaceMountErrorCodes.testFailed,
                    });
                    return {
                        ...result,
                        errorCode: workspaceMountErrorCodes.testFailed,
                        uiState: 'failure',
                    };
                }
            } catch (error) {
                if (attempt === maxAttempts) {
                    const message = error instanceof Error ? error.message : String(error);
                    recordWorkspacesPageHealthEvent({
                        channel: 'workspace.testConnection',
                        status: 'failure',
                        durationMs: Date.now() - startedAt,
                        errorCode: workspaceMountErrorCodes.testFailed,
                    });
                    return {
                        success: false,
                        latencyMs: 0,
                        authMethod: form.authType,
                        message: t('errors.unexpected'),
                        error: message,
                        errorCode: workspaceMountErrorCodes.testFailed,
                        uiState: 'failure',
                    };
                }
            }
        }

        return {
            success: false,
            latencyMs: 0,
            authMethod: form.authType,
            message: t('errors.unexpected'),
            errorCode: workspaceMountErrorCodes.testFailed,
            uiState: 'failure',
        };
    }, [t]);

    const pickLocalFolder = useCallback(async () => {
        const result = normalizeDirectorySelectionResult(await window.electron.selectDirectory());
        if (result.success && result.path) {
            setMountForm(prev => ({ ...prev, rootPath: result.path || '' }));
        }
    }, []);

    return {
        persistMounts,
        mountForm,
        setMountForm,
        addMount,
        testConnection,
        pickLocalFolder,
    };
}
