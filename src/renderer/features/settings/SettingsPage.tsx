import { useSettingsLogic } from '@renderer/features/settings/hooks/useSettingsLogic';
import { SettingsCategory } from '@renderer/features/settings/types';
import { memo, useCallback, useMemo, useState } from 'react';

// Tab Components
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import type { ModelInfo } from '@/features/models/utils/model-fetcher';
import { GroupedModels } from '@/features/models/utils/model-fetcher';
import { SettingsSearch, SettingsTabContent } from '@/features/settings/components';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { ManualSessionModal } from './components/ManualSessionModal';

import '@renderer/features/settings/SettingsPage.css';

export interface SettingsPageProps {
    installedModels: ModelInfo[]
    proxyModels?: ModelInfo[]
    onRefreshModels: () => void
    activeTab?: SettingsCategory
    groupedModels?: GroupedModels | null
}

export function SettingsPage({
    installedModels,
    proxyModels,
    onRefreshModels,
    activeTab = 'general',
    groupedModels
}: SettingsPageProps) {
    const {
        settings, setSettings, isLoading, statusMessage, setStatusMessage, authBusy, authMessage, isOllamaRunning, authStatus,
        updateGeneral, updateSpeech, handleSave, startOllama, checkOllama, refreshAuthStatus,
        connectGitHubProfile, connectCopilot, connectBrowserProvider, disconnectProvider,
        statsLoading, statsPeriod, setStatsPeriod, statsData, quotaData, copilotQuota, codexUsage, claudeQuota, setReloadTrigger,
        benchmarkResult, isBenchmarking, handleRunBenchmark,
        editingPersonaId, setEditingPersonaId, personaDraft, setPersonaDraft, handleSavePersona, handleDeletePersona,
        linkedAccounts, deviceCodeModal, closeDeviceCodeModal,
        manualSessionModal, setManualSessionModal, handleSaveClaudeSession
    } = useSettingsLogic(onRefreshModels);

    const { t } = useTranslation(settings?.general.language ?? 'tr');

    // Search state for settings
    const [searchQuery, setSearchQuery] = useState('');

    // Define tabs for filtering
    const allTabs = useMemo(() => [
        { id: 'general', label: t('settings.tabs.general') },
        { id: 'accounts', label: t('settings.tabs.accounts') },
        { id: 'appearance', label: t('settings.tabs.appearance') },
        { id: 'models', label: t('settings.tabs.models') },
        { id: 'statistics', label: t('settings.tabs.statistics') },
        { id: 'personas', label: t('settings.tabs.personas') },
        { id: 'speech', label: t('settings.tabs.speech') },
        { id: 'developer', label: t('settings.tabs.developer') },
        { id: 'advanced', label: t('settings.tabs.advanced') },
        { id: 'about', label: t('settings.tabs.about') }
    ], [t]);

    const filteredTabs = useMemo(() => {
        if (!searchQuery) { return allTabs; }
        return allTabs.filter(tab =>
            tab.label.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery, allTabs]);

    const [showResetConfirm, setShowResetConfirm] = useState(false);

    const handleFactoryReset = useCallback(async () => {
        await window.electron.saveSettings({
            ollama: { url: 'http://localhost:11434' },
            general: { language: 'tr', theme: 'dark', resolution: '1920x1080', fontSize: 14 },
            proxy: { enabled: true, url: 'http://127.0.0.1:8317', key: '' }
        });
        window.location.reload();
    }, []);

    const onResetClick = useCallback(() => {
        setShowResetConfirm(true);
    }, []);

    const loadSettings = useCallback(async () => {
        const data = await window.electron.getSettings();
        void setSettings(data);
    }, [setSettings]);

    const sharedProps = useMemo(() => ({
        settings, setSettings, isLoading, statusMessage, setStatusMessage, authBusy, authMessage, isOllamaRunning, authStatus,
        updateGeneral, updateSpeech, handleSave, startOllama, checkOllama, refreshAuthStatus,
        connectGitHubProfile, connectCopilot, connectBrowserProvider, disconnectProvider,
        statsLoading, statsPeriod, setStatsPeriod, statsData, quotaData, copilotQuota, codexUsage, claudeQuota, setReloadTrigger,
        benchmarkResult, isBenchmarking, handleRunBenchmark,
        editingPersonaId, setEditingPersonaId, personaDraft, setPersonaDraft, handleSavePersona, handleDeletePersona,
        linkedAccounts, deviceCodeModal, closeDeviceCodeModal,
        manualSessionModal, setManualSessionModal, handleSaveClaudeSession,
        t, onRefreshModels, loadSettings, setIsLoading: (_v: boolean) => { }, onReset: handleFactoryReset
    }), [
        settings, setSettings, isLoading, statusMessage, setStatusMessage, authBusy, authMessage, isOllamaRunning, authStatus,
        updateGeneral, updateSpeech, handleSave, startOllama, checkOllama, refreshAuthStatus,
        connectGitHubProfile, connectCopilot, connectBrowserProvider, disconnectProvider,
        statsLoading, statsPeriod, setStatsPeriod, statsData, quotaData, copilotQuota, codexUsage, claudeQuota, setReloadTrigger,
        benchmarkResult, isBenchmarking, handleRunBenchmark,
        editingPersonaId, setEditingPersonaId, personaDraft, setPersonaDraft, handleSavePersona, handleDeletePersona,
        linkedAccounts, deviceCodeModal, closeDeviceCodeModal,
        manualSessionModal, setManualSessionModal, handleSaveClaudeSession,
        t, onRefreshModels, loadSettings, handleFactoryReset
    ]);

    return (
        <div className="settings-container">
            <div className="settings-content flex h-full gap-6">
                <main className="settings-main flex-1 overflow-y-auto">
                    <SettingsSearch
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        t={t}
                        filteredTabsCount={filteredTabs.length}
                    />

                    <div className={cn("settings-section h-full pr-4", (activeTab === 'models' || activeTab === 'gallery') && "max-w-none")}>
                        {statusMessage && (
                            <div className="mb-6 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                {statusMessage}
                            </div>
                        )}
                        <div className="hidden">[DEBUG: BUILD VERSION 2026-01-19-01]</div>

                        <SettingsTabContent
                            activeTab={activeTab}
                            sharedProps={sharedProps}
                            installedModels={installedModels}
                            proxyModels={proxyModels}
                            onRefreshModels={onRefreshModels}
                            handleFactoryReset={onResetClick}
                            groupedModels={groupedModels ?? undefined}
                        />
                    </div>
                </main>
            </div>
            <ConfirmationModal
                isOpen={showResetConfirm}
                onClose={() => setShowResetConfirm(false)}
                onConfirm={() => { void handleFactoryReset(); }}
                title={t('settings.factoryReset')}
                message={t('settings.factoryResetConfirm')}
                confirmLabel={t('common.reset')}
                variant="danger"
            />
            <ManualSessionModal
                {...manualSessionModal}
                onClose={() => { setManualSessionModal({ ...manualSessionModal, isOpen: false }); }}
                onSave={handleSaveClaudeSession}
            />
        </div>
    );
}

export const MemoizedSettingsPage = memo(SettingsPage);

export default MemoizedSettingsPage;
