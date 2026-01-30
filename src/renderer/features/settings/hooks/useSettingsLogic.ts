import { useCallback, useMemo, useState } from 'react';

import { useSettings } from '@/context/SettingsContext';
import { AppSettings } from '@/types';

import { useLinkedAccounts } from './useLinkedAccounts';
import { useSettingsAuth } from './useSettingsAuth';
import { useSettingsPersonas } from './useSettingsPersonas';
import { useSettingsStats } from './useSettingsStats';

export function useSettingsLogic(onRefreshModels?: () => void) {
    const { settings, updateSettings } = useSettings();

    // Wrapper for backward compatibility
    const setSettings = useCallback(async (newSettings: AppSettings | null) => {
        if (newSettings) {
            await updateSettings(newSettings, true);
        }
    }, [updateSettings]);

    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    // Sub-hooks - linkedAccounts created first so auth can trigger refresh
    const linkedAccounts = useLinkedAccounts();
    const auth = useSettingsAuth(
        settings,
        updateSettings,
        onRefreshModels,
        linkedAccounts.refreshAccounts,
        (accountId, email) => auth.setManualSessionModal({ isOpen: true, accountId, email })
    );
    const stats = useSettingsStats();
    const personas = useSettingsPersonas(settings, updateSettings);

    // Handlers
    const handleSave = useCallback(async (newSettings?: AppSettings) => {
        const toSave = newSettings ?? settings;
        if (!toSave) { return; }
        setIsLoading(true);
        try {
            await updateSettings(toSave, true);
            onRefreshModels?.();
            setStatusMessage('Kaydedildi!');
            setTimeout(() => setStatusMessage(''), 2000);
        } finally { setIsLoading(false); }
    }, [settings, updateSettings, onRefreshModels]);

    const updateGeneral = useCallback(async (patch: Partial<AppSettings['general']>) => {
        if (!settings) { return; }
        const updated = { ...settings, general: { ...settings.general, ...patch } };
        await updateSettings(updated, true);
    }, [settings, updateSettings]);

    const updateSpeech = useCallback(async (patch: Partial<NonNullable<AppSettings['speech']>>) => {
        if (!settings) { return; }
        const updated = { ...settings, speech: { ...settings.speech, ...patch } } as AppSettings;
        await updateSettings(updated, true);
    }, [settings, updateSettings]);

    // Benchmark (Kept local as it is simple)
    const [benchmarkResult, setBenchmarkResult] = useState<{ tokensPerSec: number; latency: number } | null>(null);
    const [isBenchmarking, setIsBenchmarking] = useState(false);
    const handleRunBenchmark = useCallback(async (currentModelId: string) => {
        if (!currentModelId) { return; }
        setIsBenchmarking(true);
        setBenchmarkResult(null);
        try {
            await new Promise(resolve => setTimeout(resolve, 3000));
            setBenchmarkResult({
                tokensPerSec: Math.round(50 + Math.random() * 20),
                latency: Math.round(200 + Math.random() * 100)
            });
        } finally {
            setIsBenchmarking(false);
        }
    }, []);

    // Combine status messages
    const exposedStatusMessage = statusMessage || auth.statusMessage;

    return useMemo(() => ({
        settings,
        setSettings,
        isLoading,
        statusMessage: exposedStatusMessage,
        setStatusMessage,

        // Auth
        authMessage: auth.authMessage,
        authBusy: auth.authBusy,
        isOllamaRunning: auth.isOllamaRunning,
        authStatus: auth.authStatus,
        startOllama: auth.startOllama,
        checkOllama: auth.checkOllama,
        refreshAuthStatus: auth.refreshAuthStatus,
        connectGitHubProfile: auth.connectGitHubProfile,
        connectCopilot: auth.connectCopilot,
        connectBrowserProvider: auth.connectBrowserProvider,
        disconnectProvider: auth.disconnectProvider,
        deviceCodeModal: auth.deviceCodeModal,
        closeDeviceCodeModal: auth.closeDeviceCodeModal,
        manualSessionModal: auth.manualSessionModal,
        setManualSessionModal: auth.setManualSessionModal,
        handleSaveClaudeSession: auth.handleSaveClaudeSession,

        // Linked Accounts (new multi-account system)
        linkedAccounts,

        // Update handlers
        updateGeneral,
        updateSpeech,
        handleSave,

        // Stats
        ...stats,

        // Benchmark
        benchmarkResult,
        isBenchmarking,
        handleRunBenchmark,

        // Personas
        ...personas,

        isDirty: false
    }), [
        settings, setSettings, isLoading, exposedStatusMessage, auth,
        linkedAccounts, updateGeneral, updateSpeech, handleSave,
        stats, benchmarkResult, isBenchmarking, handleRunBenchmark, personas
    ]);
}

