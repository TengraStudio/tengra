/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SettingsTabContent } from '@/features/settings/components/SettingsTabContent';
import type { SettingsSharedProps } from '@/features/settings/types/props';
import type { AppSettings } from '@/types/settings';

vi.mock('@/features/settings/components/GeneralTab', () => ({
    GeneralTab: () => <div>general-tab</div>,
}));

vi.mock('@/features/settings/components/AppearanceTab', () => ({
    AppearanceTab: () => <div>appearance-tab</div>,
}));

const settingsFixture: AppSettings = {
    ollama: { url: 'http://localhost:11434' },
    embeddings: { provider: 'none' },
    general: {
        language: 'en',
        theme: 'dark',
        resolution: '1920x1080',
        fontSize: 14,

    },
    proxy: { enabled: true, url: 'http://127.0.0.1:8317', key: '' },
};

const sharedProps = {
    settings: settingsFixture,
    setSettings: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
    settingsUiState: 'ready',
    lastErrorCode: null,
    statusMessage: '',
    setStatusMessage: vi.fn(),
    authBusy: null,
    authMessage: '',
    isOllamaRunning: false,
    authStatus: { codex: false, claude: false, antigravity: false, ollama: false, copilot: false },
    updateGeneral: vi.fn().mockResolvedValue(undefined),
    updateEditor: vi.fn().mockResolvedValue(undefined),
    updateSpeech: vi.fn().mockResolvedValue(undefined),
    updateRemoteAccounts: vi.fn().mockResolvedValue(undefined),
    updateWindow: vi.fn().mockResolvedValue(undefined),
    updateTerminal: vi.fn().mockResolvedValue(undefined),
    handleSave: vi.fn().mockResolvedValue(undefined),
    startOllama: vi.fn().mockResolvedValue(undefined),
    checkOllama: vi.fn().mockResolvedValue(undefined),
    refreshAuthStatus: vi.fn().mockResolvedValue(undefined),
    connectGitHubProfile: vi.fn().mockResolvedValue(undefined),
    connectCopilot: vi.fn().mockResolvedValue(undefined),
    connectBrowserProvider: vi.fn().mockResolvedValue(undefined),
    cancelAuthFlow: vi.fn(),
    disconnectProvider: vi.fn().mockResolvedValue(undefined),
    statsLoading: false,
    statsPeriod: 'daily',
    setStatsPeriod: vi.fn(),
    statsData: null,
    quotaData: null,
    copilotQuota: null,
    codexUsage: null,
    claudeQuota: null,
    setReloadTrigger: vi.fn(),
    benchmarkResult: null,
    isBenchmarking: false,
    handleRunBenchmark: vi.fn().mockResolvedValue(undefined),
    linkedAccounts: {
        accounts: [],
        loading: false,
        getAccountsByProvider: vi.fn().mockReturnValue([]),
        getActiveAccount: vi.fn(),
        hasAccount: vi.fn().mockReturnValue(false),
        refreshAccounts: vi.fn().mockResolvedValue(undefined),
        unlinkAccount: vi.fn().mockResolvedValue(undefined),
        setActiveAccount: vi.fn().mockResolvedValue(undefined),
        linkAccount: vi.fn().mockResolvedValue(undefined),
    },
    deviceCodeModal: {
        isOpen: false,
        userCode: '',
        verificationUri: '',
        provider: 'copilot',
        status: 'pending',
    },
    closeDeviceCodeModal: vi.fn(),
    manualSessionModal: { isOpen: false, accountId: '' },
    setManualSessionModal: vi.fn(),
    handleSaveClaudeSession: vi.fn().mockResolvedValue({ success: true }),
    t: (key: string) => key,
    onRefreshModels: vi.fn(),
    loadSettings: vi.fn().mockResolvedValue(undefined),
    setIsLoading: vi.fn(),
    onReset: vi.fn(),
} as SettingsSharedProps;

describe('SettingsTabContent', () => {
    it('renders only the active tab content', async () => {
        render(
            <SettingsTabContent
                activeTab="general"
                sharedProps={sharedProps}
                installedModels={[]}
                onRefreshModels={vi.fn()}
                handleFactoryReset={vi.fn()}
            />
        );

        expect(await screen.findByText('general-tab')).toBeInTheDocument();
        expect(screen.queryByText('appearance-tab')).not.toBeInTheDocument();
    });
});

