import { useCallback, useState } from 'react';

import { AppSettings } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { DeviceCodeModalState } from '../components/DeviceCodeModal';

const INITIAL_MODAL_STATE: DeviceCodeModalState = {
    isOpen: false,
    userCode: '',
    verificationUri: '',
    provider: 'github',
    status: 'pending',
    errorMessage: undefined,
};

export function useDeviceAuth(
    settings: AppSettings | null,
    updateSettings: (s: AppSettings, save: boolean) => Promise<void>,
    setAuthBusy: (busy: string | null) => void,
    setAuthNotice: (msg: string, duration?: number) => void,
    onRefreshModels?: (bypassCache?: boolean) => void
) {
    const [deviceCodeModal, setDeviceCodeModal] =
        useState<DeviceCodeModalState>(INITIAL_MODAL_STATE);

    const connectGitHubProfile = useCallback(async () => {
        if (!settings) {
            return;
        }
        setAuthBusy('github');
        setAuthNotice('');
        try {
            const data = await window.electron.githubLogin('profile');

            // Open the modal with device code
            if (data.user_code && data.verification_uri) {
                setDeviceCodeModal({
                    isOpen: true,
                    userCode: data.user_code,
                    verificationUri: data.verification_uri,
                    provider: 'github',
                    status: 'pending',
                    errorMessage: undefined,
                });
                window.electron.openExternal(data.verification_uri);
            }

            const pollResult = await window.electron.pollToken(
                data.device_code,
                data.interval,
                'profile'
            );
            if (pollResult.success && pollResult.token) {
                const updated: AppSettings = {
                    ...settings,
                    github: {
                        username:
                            (settings.github as { username?: string }).username ?? 'GitHub User',
                        token: pollResult.token,
                    },
                };
                await updateSettings(updated, true);
                onRefreshModels?.(true);
                setDeviceCodeModal(prev => ({ ...prev, status: 'success' }));
                setTimeout(() => setDeviceCodeModal(INITIAL_MODAL_STATE), 2000);
            } else {
                setDeviceCodeModal(prev => ({
                    ...prev,
                    status: 'error',
                    errorMessage: 'GitHub bağlanamadı.',
                }));
            }
        } catch (error) {
            appLogger.error('DeviceAuth', 'GitHub auth failed', error as Error);
            setDeviceCodeModal(prev => ({
                ...prev,
                status: 'error',
                errorMessage: 'GitHub bağlanamadı.',
            }));
        } finally {
            setAuthBusy(null);
        }
    }, [settings, updateSettings, setAuthBusy, setAuthNotice, onRefreshModels]);

    const connectCopilot = useCallback(async () => {
        if (!settings) {
            return;
        }
        setAuthBusy('copilot');
        setAuthNotice('');
        try {
            const data = await window.electron.githubLogin('copilot');

            // Open the modal with device code
            if (data.user_code && data.verification_uri) {
                setDeviceCodeModal({
                    isOpen: true,
                    userCode: data.user_code,
                    verificationUri: data.verification_uri,
                    provider: 'copilot',
                    status: 'pending',
                    errorMessage: undefined,
                });
                window.electron.openExternal(data.verification_uri);
            }

            const pollResult = await window.electron.pollToken(
                data.device_code,
                data.interval,
                'copilot'
            );
            if (pollResult.success && pollResult.token) {
                const updated: AppSettings = {
                    ...settings,
                    copilot: {
                        ...(settings.copilot ?? { connected: false }),
                        connected: true,
                        token: pollResult.token,
                    },
                };
                await updateSettings(updated, true);
                onRefreshModels?.(true);
                setDeviceCodeModal(prev => ({ ...prev, status: 'success' }));
                setTimeout(() => setDeviceCodeModal(INITIAL_MODAL_STATE), 2000);
            } else {
                setDeviceCodeModal(prev => ({
                    ...prev,
                    status: 'error',
                    errorMessage: 'Copilot bağlanamadı.',
                }));
            }
        } catch (error) {
            appLogger.error('DeviceAuth', 'Copilot auth failed', error as Error);
            setDeviceCodeModal(prev => ({
                ...prev,
                status: 'error',
                errorMessage: 'Copilot bağlanamadı.',
            }));
        } finally {
            setAuthBusy(null);
        }
    }, [settings, updateSettings, setAuthBusy, setAuthNotice, onRefreshModels]);

    const closeDeviceCodeModal = useCallback(() => {
        setDeviceCodeModal(INITIAL_MODAL_STATE);
    }, []);

    return {
        deviceCodeModal,
        connectGitHubProfile,
        connectCopilot,
        closeDeviceCodeModal,
    };
}
