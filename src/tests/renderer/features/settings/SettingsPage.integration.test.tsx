import { useSettingsLogic } from '@renderer/features/settings/hooks/useSettingsLogic';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SettingsPage } from '@/features/settings/SettingsPage';
import { AppSettings } from '@/types/settings';

vi.mock('@renderer/features/settings/hooks/useSettingsLogic', () => ({
    useSettingsLogic: vi.fn(),
}));

vi.mock('@/features/settings/components', () => ({
    SettingsTabContent: () => <div data-testid="settings-tab-content">tab-content</div>,
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

function createLogicMock(overrides: Partial<ReturnType<typeof useSettingsLogic>> = {}) {
    const base: ReturnType<typeof useSettingsLogic> = {
        settings: settingsFixture,
        setSettings: vi.fn().mockResolvedValue(undefined),
        isLoading: false,
        settingsUiState: 'ready' as const,
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
        handleSave: vi.fn().mockResolvedValue(undefined),
        reloadSettings: vi.fn().mockResolvedValue(undefined),
        startOllama: vi.fn().mockResolvedValue(undefined),
        checkOllama: vi.fn().mockResolvedValue(undefined),
        refreshAuthStatus: vi.fn().mockResolvedValue(undefined),
        connectGitHubProfile: vi.fn().mockResolvedValue(undefined),
        connectCopilot: vi.fn().mockResolvedValue(undefined),
        connectBrowserProvider: vi.fn().mockResolvedValue(undefined),
        cancelAuthFlow: vi.fn(),
        disconnectProvider: vi.fn().mockResolvedValue(undefined),
        statsLoading: false,
        statsPeriod: 'daily' as const,
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
        editingPersonaId: null,
        setEditingPersonaId: vi.fn(),
        personaDraft: { name: '', description: '', prompt: '' },
        setPersonaDraft: vi.fn(),
        handleSavePersona: vi.fn().mockResolvedValue(undefined),
        handleDeletePersona: vi.fn().mockResolvedValue(undefined),
        linkedAccounts: {
            accounts: [],
            loading: false,
            getAccountsByProvider: vi.fn().mockReturnValue([]),
            getActiveAccount: vi.fn(),
            hasAccount: vi.fn().mockReturnValue(false),
            refreshAccounts: vi.fn().mockResolvedValue(undefined),
            unlinkAccount: vi.fn().mockResolvedValue(undefined),
            setActiveAccount: vi.fn().mockResolvedValue(undefined),
        },
        deviceCodeModal: {
            isOpen: false,
            userCode: '',
            verificationUri: '',
            provider: 'github' as const,
            status: 'pending' as const,
        },
        closeDeviceCodeModal: vi.fn(),
        manualSessionModal: { isOpen: false, accountId: '' },
        setManualSessionModal: vi.fn(),
        handleSaveClaudeSession: vi.fn().mockResolvedValue({ success: true }),
        isDirty: false,
    };
    return {
        ...base,
        ...overrides,
    };
}

describe('SettingsPage integration', () => {
    it('renders failure state when settings logic reports failure', () => {
        vi.mocked(useSettingsLogic).mockReturnValue(
            createLogicMock({
                settingsUiState: 'failure',
                lastErrorCode: 'SETTINGS_PAGE_SAVE_FAILED',
            })
        );

        render(
            <SettingsPage
                installedModels={[]}
                onRefreshModels={vi.fn()}
                activeTab="general"
            />
        );

        expect(screen.getByText(/SETTINGS_PAGE_SAVE_FAILED/)).toBeInTheDocument();
    });

    it('shows no-results panel for invalid search query', () => {
        vi.mocked(useSettingsLogic).mockReturnValue(createLogicMock());

        render(
            <SettingsPage
                installedModels={[]}
                onRefreshModels={vi.fn()}
                activeTab="general"
                searchQuery={'x'.repeat(500)}
            />
        );

        expect(screen.getByText('No settings found')).toBeInTheDocument();
        expect(screen.queryByTestId('settings-tab-content')).not.toBeInTheDocument();
    });
});
