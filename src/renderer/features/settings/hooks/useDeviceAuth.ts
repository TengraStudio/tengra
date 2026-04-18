/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useRef, useState } from 'react';

import { AppSettings } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { DeviceCodeModalState } from '../components/DeviceCodeModal';
import { AuthBusyState } from '../types';

const INITIAL_MODAL_STATE: DeviceCodeModalState = {
    isOpen: false,
    userCode: '',
    verificationUri: '',
    provider: 'github',
    status: 'pending',
    errorMessage: undefined,
};

interface DeviceAuthOptions {
    settings: AppSettings | null;
    updateSettings: (s: AppSettings, save: boolean) => Promise<void>;
    setAuthBusy: (busy: AuthBusyState | null) => void;
    setAuthNotice: (msg: string, duration?: number) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
    onRefreshModels?: (bypassCache?: boolean) => void;
}

export function useDeviceAuth(options: DeviceAuthOptions) {
    const {
        settings,
        updateSettings,
        setAuthBusy,
        setAuthNotice,
        t,
        onRefreshModels
    } = options;
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
        setAuthBusy({ provider: 'github', startedAt: Date.now() });
        setAuthNotice('');
        try {
            const data = await window.electron.githubLogin('profile');

            // Open the modal with device code
            if (data.user_code && data.verification_uri) {
                // Automatically copy the code to clipboard
                try {
                    void window.electron.clipboard.writeText(data.user_code);
                    appLogger.info('DeviceAuth', 'Automatically copied user code to clipboard');
                } catch (err) {
                    appLogger.warn('DeviceAuth', 'Failed to auto-copy code to clipboard', err as Error);
                }

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

            appLogger.debug('DeviceAuth', `Step 3: Initializing poll loop for ${data.user_code} (interval=${data.interval})`);
            const pollResult = await window.electron.pollToken(
                data.device_code,
                data.interval,
                'profile'
            );
            appLogger.debug('DeviceAuth', `Step 4: Poll result for profile: success=${pollResult.success}`);
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
                            t('auth.githubUser'),
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
                    errorMessage: pollResult.error || t('auth.githubConnectionFailed'),
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
                errorMessage: t('auth.githubConnectionFailed'),
            }));
        } finally {
            if (requestId === activeRequestRef.current) {
                setAuthBusy(null);
            }
        }
    }, [onRefreshModels, setAuthBusy, setAuthNotice, settings, t, updateSettings]);

    const connectCopilot = useCallback(async () => {
        if (!settings) {
            return;
        }
        const requestId = activeRequestRef.current + 1;
        activeRequestRef.current = requestId;
        setAuthBusy({ provider: 'copilot', startedAt: Date.now() });
        setAuthNotice('');
        try {
            const data = await window.electron.githubLogin('copilot');

            // Open the modal with device code
            if (data.user_code && data.verification_uri) {
                // Automatically copy the code to clipboard
                try {
                    void window.electron.clipboard.writeText(data.user_code);
                    appLogger.info('DeviceAuth', 'Automatically copied user code to clipboard');
                } catch (err) {
                    appLogger.warn('DeviceAuth', 'Failed to auto-copy code to clipboard', err as Error);
                }
                
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

            appLogger.debug('DeviceAuth', `Step 3: Initializing Copilot poll loop for ${data.user_code} (interval=${data.interval})`);
            const pollResult = await window.electron.pollToken(
                data.device_code,
                data.interval,
                'copilot'
            );
            appLogger.debug('DeviceAuth', `Step 4: Copilot poll result: success=${pollResult.success}`);
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
                    errorMessage: pollResult.error || t('auth.copilotConnectionFailed'),
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
                errorMessage: t('auth.copilotConnectionFailed'),
            }));
        } finally {
            if (requestId === activeRequestRef.current) {
                setAuthBusy(null);
            }
        }
    }, [onRefreshModels, setAuthBusy, setAuthNotice, settings, t, updateSettings]);

    const closeDeviceCodeModal = useCallback(() => {
        resetDeviceAuth(t('auth.connectionCancelled'));
    }, [resetDeviceAuth, t]);

    return {
        deviceCodeModal,
        connectGitHubProfile,
        connectCopilot,
        closeDeviceCodeModal,
        cancelDeviceAuth: resetDeviceAuth,
    };
}
