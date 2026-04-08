import { ClaudeQuota, CodexUsage, CopilotQuota, QuotaResponse } from '@shared/types/quota';
import { Dispatch, SetStateAction } from 'react';

import { AppSettings } from '@/types/settings';

import { DeviceCodeModalState } from '../components/DeviceCodeModal';
import { ManualSessionModalState } from '../components/ManualSessionModal';
import { UseLinkedAccountsResult } from '../hooks/useLinkedAccounts';
import { AccountWrapper } from '../types';
import { AuthBusyState, AuthStatusState, DetailedStats, PersonaDraft } from '../types';

export interface SettingsSharedProps {
    settings: AppSettings | null
    setSettings: (s: AppSettings | null) => Promise<void>
    isLoading: boolean
    settingsUiState: 'ready' | 'failure'
    lastErrorCode: string | null
    statusMessage: string
    setStatusMessage: (m: string) => void
    authBusy: AuthBusyState | null
    authMessage: string
    isOllamaRunning: boolean
    authStatus: AuthStatusState
    updateGeneral: (patch: Partial<AppSettings['general']>) => Promise<void>
    updateEditor: (patch: Partial<NonNullable<AppSettings['editor']>>) => Promise<void>
    updateSpeech: (patch: Partial<NonNullable<AppSettings['speech']>>) => Promise<void>
    updateRemoteAccounts: (patch: Partial<NonNullable<AppSettings['remoteAccounts']>>) => Promise<void>
    handleSave: (ns?: AppSettings) => Promise<void>
    startOllama: () => Promise<void>
    checkOllama: () => Promise<void>
    refreshAuthStatus: () => Promise<void>
    connectGitHubProfile: () => Promise<void>
    connectCopilot: () => Promise<void>
    connectBrowserProvider: (provider: 'codex' | 'claude' | 'antigravity' | 'ollama') => Promise<void>
    cancelAuthFlow: () => void
    disconnectProvider: (provider: 'copilot' | 'codex' | 'claude' | 'antigravity' | 'ollama') => Promise<void>
    statsLoading: boolean
    statsPeriod: 'daily' | 'weekly' | 'monthly' | 'yearly'
    setStatsPeriod: (p: 'daily' | 'weekly' | 'monthly' | 'yearly') => void
    statsData: DetailedStats | null
    quotaData: AccountWrapper<QuotaResponse> | null
    copilotQuota: AccountWrapper<CopilotQuota> | null
    codexUsage: AccountWrapper<{ usage: CodexUsage }> | null
    claudeQuota: AccountWrapper<ClaudeQuota> | null
    setReloadTrigger: (trigger: number | ((prev: number) => number)) => void
    benchmarkResult: { tokensPerSec: number; latency: number } | null
    isBenchmarking: boolean
    handleRunBenchmark: (modelId: string) => Promise<void>
    editingPersonaId: string | null
    setEditingPersonaId: (id: string | null) => void
    personaDraft: PersonaDraft
    setPersonaDraft: Dispatch<SetStateAction<PersonaDraft>>
    handleSavePersona: () => Promise<void>
    handleDeletePersona: (id: string) => Promise<void>
    linkedAccounts: UseLinkedAccountsResult
    deviceCodeModal: DeviceCodeModalState
    closeDeviceCodeModal: () => void
    manualSessionModal: ManualSessionModalState
    setManualSessionModal: (m: ManualSessionModalState) => void
    handleSaveClaudeSession: (sessionKey: string, accountId?: string) => Promise<{ success: boolean; error?: string }>
    t: (key: string, options?: Record<string, string | number>) => string
    onRefreshModels: (bypassCache?: boolean) => void
    loadSettings: () => Promise<void>
    setIsLoading: (v: boolean) => void
    onReset: () => void | Promise<void>
}
