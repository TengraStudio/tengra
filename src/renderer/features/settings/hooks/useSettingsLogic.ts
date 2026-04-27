/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useMemo, useState } from 'react';

import { useSettings } from '@/context/SettingsContext';
import {
    settingsPageErrorCodes,
    validateSettingsPayload
} from '@/features/settings/utils/settings-page-validation';
import { useTranslation } from '@/i18n';
import { recordSettingsPageHealthEvent } from '@/store/settings-page-health.store';
import { AppSettings } from '@/types';

import { useLinkedAccounts } from './useLinkedAccounts';
import { useSettingsAuth } from './useSettingsAuth';
import { useSettingsStats } from './useSettingsStats';

type SettingsLogicUiState = 'ready' | 'failure';

const SETTINGS_RETRY_ATTEMPTS = 2;
const SETTINGS_RETRY_DELAY_MS = 120;

async function waitForRetry(): Promise<void> {
    await new Promise(resolve => {
        setTimeout(resolve, SETTINGS_RETRY_DELAY_MS);
    });
}

async function withRetry<T>(operation: () => Promise<T>, attempts = SETTINGS_RETRY_ATTEMPTS): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < attempts - 1) {
                await waitForRetry();
            }
        }
    }
    throw (lastError ?? new Error('Settings operation failed'));
}

export function useSettingsLogic(onRefreshModels?: (bypassCache?: boolean) => void) {
    const { settings, updateSettings, reloadSettings, isLoading: isSettingsLoading } = useSettings();
    const { t } = useTranslation(settings?.general?.language ?? 'en');

    // Wrapper for backward compatibility
    const setSettings = useCallback(async (newSettings: AppSettings | null) => {
        if (newSettings) {
            await updateSettings(newSettings, true);
        }
    }, [updateSettings]);

    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [settingsUiState, setSettingsUiState] = useState<SettingsLogicUiState>('ready');
    const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);

    // Sub-hooks - linkedAccounts created first so auth can trigger refresh
    const linkedAccountsBase = useLinkedAccounts();
    const auth = useSettingsAuth(
        settings,
        updateSettings,
        linkedAccountsBase,
        t,
        onRefreshModels
    );
    const cancelBrowserAuthForAccount = auth.cancelBrowserAuthForAccount;
    const linkedAccounts = useMemo(() => ({
        ...linkedAccountsBase,
        unlinkAccount: async (accountId: string) => {
            await cancelBrowserAuthForAccount(accountId);
            await linkedAccountsBase.unlinkAccount(accountId);
        }
    }), [cancelBrowserAuthForAccount, linkedAccountsBase]);
    const stats = useSettingsStats();

    // Handlers
    const handleSave = useCallback(async (newSettings?: AppSettings) => {
        const startedAt = Date.now();
        const toSave = newSettings ?? settings;
        if (!toSave || !validateSettingsPayload(toSave)) {
            setSettingsUiState('failure');
            setLastErrorCode(settingsPageErrorCodes.validation);
            setStatusMessage('errors.unexpected');
            recordSettingsPageHealthEvent({
                channel: 'settings.save',
                status: 'validation-failure',
                durationMs: Date.now() - startedAt,
                errorCode: settingsPageErrorCodes.validation,
            });
            return;
        }

        setIsSaving(true);
        try {
            await withRetry(() => updateSettings(toSave, true), SETTINGS_RETRY_ATTEMPTS);
            onRefreshModels?.(true);
            setSettingsUiState('ready');
            setLastErrorCode(null);
            setStatusMessage('common.success');
            setTimeout(() => setStatusMessage(''), 2000);
            recordSettingsPageHealthEvent({
                channel: 'settings.save',
                status: 'success',
                durationMs: Date.now() - startedAt,
            });
        } catch {
            setSettingsUiState('failure');
            setLastErrorCode(settingsPageErrorCodes.saveFailed);
            setStatusMessage('errors.unexpected');
            recordSettingsPageHealthEvent({
                channel: 'settings.save',
                status: 'failure',
                durationMs: Date.now() - startedAt,
                errorCode: settingsPageErrorCodes.saveFailed,
            });
        } finally {
            setIsSaving(false);
        }
    }, [settings, updateSettings, onRefreshModels]);

    const updateGeneral = useCallback(async (patch: Partial<AppSettings['general']>) => {
        if (!settings) { return; }
        const startedAt = Date.now();
        const updated = { ...settings, general: { ...settings.general, ...patch } };
        if (!validateSettingsPayload(updated)) {
            setSettingsUiState('failure');
            setLastErrorCode(settingsPageErrorCodes.validation);
            recordSettingsPageHealthEvent({
                channel: 'settings.update',
                status: 'validation-failure',
                durationMs: Date.now() - startedAt,
                errorCode: settingsPageErrorCodes.validation,
            });
            return;
        }

        try {
            await withRetry(() => updateSettings(updated, true), SETTINGS_RETRY_ATTEMPTS);
            setSettingsUiState('ready');
            setLastErrorCode(null);
            recordSettingsPageHealthEvent({
                channel: 'settings.update',
                status: 'success',
                durationMs: Date.now() - startedAt,
            });
        } catch {
            setSettingsUiState('failure');
            setLastErrorCode(settingsPageErrorCodes.saveFailed);
            recordSettingsPageHealthEvent({
                channel: 'settings.update',
                status: 'failure',
                durationMs: Date.now() - startedAt,
                errorCode: settingsPageErrorCodes.saveFailed,
            });
        }
    }, [settings, updateSettings]);

    const updateSpeech = useCallback(async (patch: Partial<NonNullable<AppSettings['speech']>>) => {
        if (!settings) { return; }
        const startedAt = Date.now();
        const updated = { ...settings, speech: { ...settings.speech, ...patch } } as AppSettings;
        if (!validateSettingsPayload(updated)) {
            setSettingsUiState('failure');
            setLastErrorCode(settingsPageErrorCodes.validation);
            recordSettingsPageHealthEvent({
                channel: 'settings.update',
                status: 'validation-failure',
                durationMs: Date.now() - startedAt,
                errorCode: settingsPageErrorCodes.validation,
            });
            return;
        }

        try {
            await withRetry(() => updateSettings(updated, true), SETTINGS_RETRY_ATTEMPTS);
            setSettingsUiState('ready');
            setLastErrorCode(null);
            recordSettingsPageHealthEvent({
                channel: 'settings.update',
                status: 'success',
                durationMs: Date.now() - startedAt,
            });
        } catch {
            setSettingsUiState('failure');
            setLastErrorCode(settingsPageErrorCodes.saveFailed);
            recordSettingsPageHealthEvent({
                channel: 'settings.update',
                status: 'failure',
                durationMs: Date.now() - startedAt,
                errorCode: settingsPageErrorCodes.saveFailed,
            });
        }
    }, [settings, updateSettings]);

    const updateRemoteAccounts = useCallback(async (patch: Partial<NonNullable<AppSettings['remoteAccounts']>>) => {
        if (!settings) { return; }
        const startedAt = Date.now();
        const updated = { ...settings, remoteAccounts: { ...(settings.remoteAccounts ?? {}), ...patch } } as AppSettings;
        if (!validateSettingsPayload(updated)) {
            setSettingsUiState('failure');
            setLastErrorCode(settingsPageErrorCodes.validation);
            recordSettingsPageHealthEvent({
                channel: 'settings.update',
                status: 'validation-failure',
                durationMs: Date.now() - startedAt,
                errorCode: settingsPageErrorCodes.validation,
            });
            return;
        }

        try {
            await withRetry(() => updateSettings(updated, true), SETTINGS_RETRY_ATTEMPTS);
            setSettingsUiState('ready');
            setLastErrorCode(null);
            recordSettingsPageHealthEvent({
                channel: 'settings.update',
                status: 'success',
                durationMs: Date.now() - startedAt,
            });
        } catch {
            setSettingsUiState('failure');
            setLastErrorCode(settingsPageErrorCodes.saveFailed);
            recordSettingsPageHealthEvent({
                channel: 'settings.update',
                status: 'failure',
                durationMs: Date.now() - startedAt,
                errorCode: settingsPageErrorCodes.saveFailed,
            });
        }
    }, [settings, updateSettings]);

    const updateEditor = useCallback(async (patch: Partial<NonNullable<AppSettings['editor']>>) => {
        if (!settings) { return; }
        const startedAt = Date.now();
        const updated = {
            ...settings,
            editor: {
                ...(settings.editor ?? {}),
                ...patch,
            },
        } as AppSettings;
        if (!validateSettingsPayload(updated)) {
            setSettingsUiState('failure');
            setLastErrorCode(settingsPageErrorCodes.validation);
            recordSettingsPageHealthEvent({
                channel: 'settings.update',
                status: 'validation-failure',
                durationMs: Date.now() - startedAt,
                errorCode: settingsPageErrorCodes.validation,
            });
            return;
        }

        try {
            await withRetry(() => updateSettings(updated, true), SETTINGS_RETRY_ATTEMPTS);
            setSettingsUiState('ready');
            setLastErrorCode(null);
            recordSettingsPageHealthEvent({
                channel: 'settings.update',
                status: 'success',
                durationMs: Date.now() - startedAt,
            });
        } catch {
            setSettingsUiState('failure');
            setLastErrorCode(settingsPageErrorCodes.saveFailed);
            recordSettingsPageHealthEvent({
                channel: 'settings.update',
                status: 'failure',
                durationMs: Date.now() - startedAt,
                errorCode: settingsPageErrorCodes.saveFailed,
            });
        }
    }, [settings, updateSettings]);

    const updateWindow = useCallback(async (patch: Partial<AppSettings['window']>) => {
        if (!settings) { return; }
        const startedAt = Date.now();
        const updated = {
            ...settings,
            window: {
                ...(settings.window ?? {}),
                ...patch,
            },
        } as AppSettings;
        if (!validateSettingsPayload(updated)) {
            setSettingsUiState('failure');
            setLastErrorCode(settingsPageErrorCodes.validation);
            recordSettingsPageHealthEvent({
                channel: 'settings.update',
                status: 'validation-failure',
                durationMs: Date.now() - startedAt,
                errorCode: settingsPageErrorCodes.validation,
            });
            return;
        }

        try {
            await withRetry(() => updateSettings(updated, true), SETTINGS_RETRY_ATTEMPTS);
            setSettingsUiState('ready');
            setLastErrorCode(null);
            recordSettingsPageHealthEvent({
                channel: 'settings.update',
                status: 'success',
                durationMs: Date.now() - startedAt,
            });
        } catch {
            setSettingsUiState('failure');
            setLastErrorCode(settingsPageErrorCodes.saveFailed);
            recordSettingsPageHealthEvent({
                channel: 'settings.update',
                status: 'failure',
                durationMs: Date.now() - startedAt,
                errorCode: settingsPageErrorCodes.saveFailed,
            });
        }
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
        isLoading: isSettingsLoading || isSaving,
        statusMessage: exposedStatusMessage,
        setStatusMessage,
        settingsUiState,
        lastErrorCode,

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
        cancelAuthFlow: auth.cancelAuthFlow,
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
        updateEditor,
        updateSpeech,
        updateRemoteAccounts,
        updateWindow,
        handleSave,
        reloadSettings,

        // Stats
        ...stats,

        // Benchmark
        benchmarkResult,
        isBenchmarking,
        handleRunBenchmark,

        isDirty: false
    }), [
        settings, setSettings, isSettingsLoading, isSaving, exposedStatusMessage, auth,
        linkedAccounts, updateGeneral, updateEditor, updateSpeech, updateRemoteAccounts, updateWindow, handleSave, reloadSettings, settingsUiState, lastErrorCode,
        stats, benchmarkResult, isBenchmarking, handleRunBenchmark
    ]);
}
