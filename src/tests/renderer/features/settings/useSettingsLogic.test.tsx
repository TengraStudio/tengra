import { useSettingsLogic } from '@renderer/features/settings/hooks/useSettingsLogic';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { settingsPageErrorCodes } from '@/features/settings/utils/settings-page-validation';
import { AppSettings } from '@/types/settings';

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

const updateSettingsMock = vi.fn<(
    newSettings: AppSettings,
    saveImmediately?: boolean
) => Promise<void>>();
const settingsLoadingRef = { current: false };

vi.mock('@/context/SettingsContext', () => ({
    useSettings: () => ({
        settings: settingsFixture,
        isLoading: settingsLoadingRef.current,
        updateSettings: updateSettingsMock,
    }),
}));

vi.mock('@renderer/features/settings/hooks/useLinkedAccounts', () => ({
    useLinkedAccounts: () => ({
        accounts: [],
        loading: false,
        getAccountsByProvider: () => [],
        getActiveAccount: () => undefined,
        hasAccount: () => false,
        refreshAccounts: async () => { },
        unlinkAccount: async () => { },
        setActiveAccount: async () => { },
    }),
}));

vi.mock('@renderer/features/settings/hooks/useSettingsAuth', () => ({
    useSettingsAuth: () => ({
        statusMessage: '',
        setStatusMessage: vi.fn(),
        authMessage: '',
        authBusy: null,
        isOllamaRunning: false,
        authStatus: { codex: false, claude: false, antigravity: false, copilot: false },
        startOllama: async () => { },
        checkOllama: async () => { },
        refreshAuthStatus: async () => { },
        connectGitHubProfile: async () => { },
        connectCopilot: async () => { },
        connectBrowserProvider: async () => { },
        disconnectProvider: async () => { },
        cancelBrowserAuthForAccount: async () => { },
        handleSaveClaudeSession: async () => ({ success: true }),
        deviceCodeModal: {
            isOpen: false,
            userCode: '',
            verificationUri: '',
            provider: 'github' as const,
            status: 'pending' as const,
        },
        closeDeviceCodeModal: vi.fn(),
        manualSessionModal: {
            isOpen: false,
            accountId: '',
        },
        setManualSessionModal: vi.fn(),
    }),
}));

vi.mock('@renderer/features/settings/hooks/useSettingsStats', () => ({
    useSettingsStats: () => ({
        statsLoading: false,
        statsPeriod: 'daily' as const,
        setStatsPeriod: vi.fn(),
        statsData: null,
        quotaData: null,
        copilotQuota: null,
        codexUsage: null,
        claudeQuota: null,
        setReloadTrigger: vi.fn(),
    }),
}));

vi.mock('@renderer/features/settings/hooks/useSettingsPersonas', () => ({
    useSettingsPersonas: () => ({
        editingPersonaId: null,
        setEditingPersonaId: vi.fn(),
        personaDraft: { name: '', description: '', prompt: '' },
        setPersonaDraft: vi.fn(),
        handleSavePersona: async () => { },
        handleDeletePersona: async () => { },
    }),
}));

describe('useSettingsLogic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        settingsLoadingRef.current = false;
        updateSettingsMock.mockResolvedValue(undefined);
    });

    it('rejects invalid save payload and exposes validation error code', async () => {
        const { result } = renderHook(() => useSettingsLogic());
        const { embeddings: _embeddings, ...invalidPayload } = settingsFixture;

        await act(async () => {
            await result.current.handleSave(invalidPayload as AppSettings);
        });

        expect(updateSettingsMock).not.toHaveBeenCalled();
        expect(result.current.settingsUiState).toBe('failure');
        expect(result.current.lastErrorCode).toBe(settingsPageErrorCodes.validation);
    });

    it('retries save once and eventually succeeds', async () => {
        updateSettingsMock
            .mockRejectedValueOnce(new Error('transient'))
            .mockResolvedValueOnce(undefined);

        const { result } = renderHook(() => useSettingsLogic());

        await act(async () => {
            await result.current.handleSave(settingsFixture);
        });

        expect(updateSettingsMock).toHaveBeenCalledTimes(2);
        expect(result.current.settingsUiState).toBe('ready');
        expect(result.current.lastErrorCode).toBeNull();
        expect(result.current.statusMessage).toBe('common.success');
    });

    it('blocks invalid updateGeneral patch and records validation failure', async () => {
        const { result } = renderHook(() => useSettingsLogic());

        await act(async () => {
            await result.current.updateGeneral({ fontSize: 2 });
        });

        expect(updateSettingsMock).not.toHaveBeenCalled();
        expect(result.current.settingsUiState).toBe('failure');
        expect(result.current.lastErrorCode).toBe(settingsPageErrorCodes.validation);
    });

    it('surfaces context loading state so settings page shows loading instead of empty state', () => {
        settingsLoadingRef.current = true;

        const { result } = renderHook(() => useSettingsLogic());

        expect(result.current.isLoading).toBe(true);
    });
});
