import { useCallback, useRef, useState } from 'react';

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
    const activeRequestRef = useRef(0);

    const resetDeviceAuth = useCallback((message?: string) => {
        activeRequestRef.current += 1;
        setDeviceCodeModal(INITIAL_MODAL_STATE);
        setAuthBusy(null);
        if (message) {
            setAuthNotice(message, 2000);
        }
    }, [setAuthBusy, setAuthNotice]);

    const connectGitHubProfile = useCallback(async () => {
        if (!settings) {
            return;
        }
        const requestId = activeRequestRef.current + 1;
        activeRequestRef.current = requestId;
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
            if (requestId !== activeRequestRef.current) {
                return;
            }
            if (pollResult.success) {
                const updated: AppSettings = {
                    ...settings,
                    github: {
                        username:
                            (settings.github as { username?: string }).username ??
                            pollResult.account?.displayName ??
                            'GitHub User',
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
            if (requestId !== activeRequestRef.current) {
                return;
            }
            setDeviceCodeModal(prev => ({
                ...prev,
                status: 'error',
                errorMessage: 'GitHub bağlanamadı.',
            }));
        } finally {
            if (requestId === activeRequestRef.current) {
                setAuthBusy(null);
            }
        }
    }, [settings, updateSettings, setAuthBusy, setAuthNotice, onRefreshModels]);

    const connectCopilot = useCallback(async () => {
        if (!settings) {
            return;
        }
        const requestId = activeRequestRef.current + 1;
        activeRequestRef.current = requestId;
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
            if (requestId !== activeRequestRef.current) {
                return;
            }
            if (pollResult.success) {
                const updated: AppSettings = {
                    ...settings,
                    copilot: {
                        ...(settings.copilot ?? { connected: false }),
                        connected: true,
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
            if (requestId !== activeRequestRef.current) {
                return;
            }
            setDeviceCodeModal(prev => ({
                ...prev,
                status: 'error',
                errorMessage: 'Copilot bağlanamadı.',
            }));
        } finally {
            if (requestId === activeRequestRef.current) {
                setAuthBusy(null);
            }
        }
    }, [settings, updateSettings, setAuthBusy, setAuthNotice, onRefreshModels]);

    const closeDeviceCodeModal = useCallback(() => {
        resetDeviceAuth('Connection cancelled.');
    }, [resetDeviceAuth]);

    return {
        deviceCodeModal,
        connectGitHubProfile,
        connectCopilot,
        closeDeviceCodeModal,
        cancelDeviceAuth: resetDeviceAuth,
    };
}
