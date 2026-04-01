import { useCallback, useMemo, useRef, useState } from 'react';

import { AppSettings } from '@/types';

import { ManualSessionModalState } from '../components/ManualSessionModal';
import { AuthBusyState } from '../types';

import { useBrowserAuth } from './useBrowserAuth';
import { useDeviceAuth } from './useDeviceAuth';
import { UseLinkedAccountsResult } from './useLinkedAccounts';
import { useOllamaManager } from './useOllamaManager';

export function useSettingsAuth(
    settings: AppSettings | null,
    updateSettings: (s: AppSettings, save: boolean) => Promise<void>,
    linkedAccounts: UseLinkedAccountsResult,
    onRefreshModels?: (bypassCache?: boolean) => void
) {
    const [authMessage, setAuthMessage] = useState('');
    const [authBusy, setAuthBusy] = useState<AuthBusyState | null>(null);
    const [manualSessionModal, setManualSessionModal] = useState<ManualSessionModalState>({ isOpen: false, accountId: '' });
    const authMessageTimer = useRef<NodeJS.Timeout | null>(null);

    const setAuthNotice = useCallback((message: string, duration = 5000) => {
        if (authMessageTimer.current) { clearTimeout(authMessageTimer.current); }
        setAuthMessage(message);
        if (message && duration > 0) {
            authMessageTimer.current = setTimeout(() => setAuthMessage(''), duration);
        }
    }, []);

    const {
        deviceCodeModal,
        connectGitHubProfile,
        connectCopilot,
        closeDeviceCodeModal,
        cancelDeviceAuth
    } = useDeviceAuth(
        settings,
        updateSettings,
        setAuthBusy,
        setAuthNotice,
        onRefreshModels
    );

    const {
        isOllamaRunning,
        statusMessage,
        setStatusMessage,
        checkOllama,
        startOllama
    } = useOllamaManager();

    const {
        authStatus,
        refreshAuthStatus,
        connectBrowserProvider,
        cancelBrowserAuth,
        cancelBrowserAuthForAccount,
        handleSaveClaudeSession,
        disconnectProvider
    } = useBrowserAuth({
        settings,
        updateSettings,
        linkedAccounts,
        authBusy,
        setAuthBusy,
        setAuthNotice,
        onRefreshModels,
        onShowManualSession: (accountId, email) => {
            setManualSessionModal({ isOpen: true, accountId, email });
        }
    });

    const cancelAuthFlow = useCallback(() => {
        if (deviceCodeModal.isOpen) {
            cancelDeviceAuth();
            return;
        }
        void cancelBrowserAuth();
    }, [cancelBrowserAuth, cancelDeviceAuth, deviceCodeModal.isOpen]);

    return useMemo(() => ({
        statusMessage,
        setStatusMessage,
        authMessage,
        authBusy,
        isOllamaRunning,
        authStatus,
        startOllama,
        checkOllama,
        refreshAuthStatus,
        connectGitHubProfile,
        connectCopilot,
        connectBrowserProvider,
        cancelAuthFlow,
        disconnectProvider,
        cancelBrowserAuthForAccount,
        handleSaveClaudeSession,
        deviceCodeModal,
        closeDeviceCodeModal,
        manualSessionModal,
        setManualSessionModal
    }), [
        statusMessage, setStatusMessage, authMessage, authBusy, isOllamaRunning, authStatus,
        startOllama, checkOllama, refreshAuthStatus, connectGitHubProfile, connectCopilot,
        connectBrowserProvider, cancelAuthFlow, disconnectProvider, cancelBrowserAuthForAccount, handleSaveClaudeSession,
        deviceCodeModal, closeDeviceCodeModal, manualSessionModal, setManualSessionModal
    ]);
}
