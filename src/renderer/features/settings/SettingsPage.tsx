import { useSettingsLogic } from '@renderer/features/settings/hooks/useSettingsLogic';
import { SettingsCategory } from '@renderer/features/settings/types';
import { BarChart, Code, Mic, Palette, Rocket, Server, Settings, Shield, Sparkles, User, Users } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';

// Tab Components
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { SettingsTabContent } from '@/features/settings/components';
import {
    normalizeSettingsSearchQuery,
    settingsPageErrorCodes,
    validateSettingsPayload
} from '@/features/settings/utils/settings-page-validation';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { recordSettingsPageHealthEvent } from '@/store/settings-page-health.store';
import type { GroupedModels, ModelInfo } from '@/types';

import { ManualSessionModal } from './components/ManualSessionModal';

import '@renderer/features/settings/SettingsPage.css';

export interface SettingsPageProps {
    installedModels: ModelInfo[]
    proxyModels?: ModelInfo[]
    onRefreshModels: (bypassCache?: boolean) => void
    activeTab?: SettingsCategory
    groupedModels?: GroupedModels | null
    searchQuery?: string
}

const SETTINGS_PAGE_RETRY_ATTEMPTS = 2;
const SETTINGS_PAGE_RETRY_DELAY_MS = 120;

async function waitForSettingsPageRetry(): Promise<void> {
    await new Promise(resolve => {
        setTimeout(resolve, SETTINGS_PAGE_RETRY_DELAY_MS);
    });
}

async function withSettingsPageRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < SETTINGS_PAGE_RETRY_ATTEMPTS; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < SETTINGS_PAGE_RETRY_ATTEMPTS - 1) {
                await waitForSettingsPageRetry();
            }
        }
    }
    throw (lastError ?? new Error('Settings page operation failed'));
}

export function SettingsPage({
    installedModels,
    proxyModels,
    onRefreshModels,
    activeTab = 'general',
    groupedModels,
    searchQuery: controlledSearchQuery
}: SettingsPageProps) {
    const {
        settings, setSettings, isLoading, settingsUiState, lastErrorCode, statusMessage, setStatusMessage, authBusy, authMessage, isOllamaRunning, authStatus,
        updateGeneral, updateSpeech, handleSave, startOllama, checkOllama, refreshAuthStatus,
        connectGitHubProfile, connectCopilot, connectBrowserProvider, disconnectProvider,
        statsLoading, statsPeriod, setStatsPeriod, statsData, quotaData, copilotQuota, codexUsage, claudeQuota, setReloadTrigger,
        benchmarkResult, isBenchmarking, handleRunBenchmark,
        editingPersonaId, setEditingPersonaId, personaDraft, setPersonaDraft, handleSavePersona, handleDeletePersona,
        linkedAccounts, deviceCodeModal, closeDeviceCodeModal,
        manualSessionModal, setManualSessionModal, handleSaveClaudeSession
    } = useSettingsLogic(onRefreshModels);

    const { t } = useTranslation(settings?.general.language ?? 'tr');

    // Search query is controlled from the global app header.
    const normalizedSearchQuery = useMemo(
        () => normalizeSettingsSearchQuery(controlledSearchQuery ?? ''),
        [controlledSearchQuery]
    );
    const hasInvalidSearchQuery = (controlledSearchQuery ?? '').trim() !== '' && normalizedSearchQuery === '';
    const searchQuery = normalizedSearchQuery;

    // Define tabs with icons for filtering and sidebar
    const allTabs = useMemo(() => [
        { id: 'general', label: t('settings.tabs.general'), icon: Settings, category: 'General' },
        { id: 'accounts', label: t('settings.tabs.accounts'), icon: User, category: 'Security' },
        { id: 'appearance', label: t('settings.tabs.appearance'), icon: Palette, category: 'Visuals' },
        { id: 'models', label: t('settings.tabs.models'), icon: Sparkles, category: 'AI' },
        { id: 'statistics', label: t('settings.tabs.statistics'), icon: BarChart, category: 'Insights' },
        { id: 'personas', label: t('settings.tabs.personas'), icon: Users, category: 'Customization' },
        { id: 'speech', label: t('settings.tabs.speech'), icon: Mic, category: 'Interaction' },
        { id: 'voice', label: t('voice.interfaceTitle'), icon: Mic, category: 'Interaction' },
        { id: 'developer', label: t('settings.tabs.developer'), icon: Code, category: 'Tools' },
        { id: 'advanced', label: t('settings.tabs.advanced'), icon: Shield, category: 'Security' },
        { id: 'mcp-servers', label: t('settings.tabs.mcpServers'), icon: Server, category: 'Infrastructure' },
        { id: 'mcp-marketplace', label: t('settings.tabs.mcpMarketplace'), icon: Server, category: 'Infrastructure' },
        { id: 'images', label: t('settings.tabs.images'), icon: Palette, category: 'Visuals' },
        { id: 'about', label: t('settings.tabs.about'), icon: Rocket, category: 'App' }
    ], [t]);

    const filteredTabs = useMemo(() => {
        if (!searchQuery) { return allTabs; }
        return allTabs.filter(tab =>
            tab.label.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery, allTabs]);
    const isActiveTabVisible = filteredTabs.some(tab => tab.id === activeTab);

    const [showResetConfirm, setShowResetConfirm] = useState(false);

    const handleFactoryReset = useCallback(async () => {
        const startedAt = Date.now();
        const resetPayload = {
            ollama: { url: 'http://localhost:11434' },
            embeddings: { provider: 'none' as const },
            general: { language: 'tr' as const, theme: 'dark', resolution: '1920x1080', fontSize: 14, onboardingCompleted: false },
            proxy: { enabled: true, url: 'http://127.0.0.1:8317', key: '' }
        };

        if (!validateSettingsPayload(resetPayload)) {
            setStatusMessage('errors.unexpected');
            recordSettingsPageHealthEvent({
                channel: 'settings.factoryReset',
                status: 'validation-failure',
                durationMs: Date.now() - startedAt,
                errorCode: settingsPageErrorCodes.validation,
            });
            return;
        }

        try {
            await withSettingsPageRetry(() => window.electron.saveSettings(resetPayload));
            recordSettingsPageHealthEvent({
                channel: 'settings.factoryReset',
                status: 'success',
                durationMs: Date.now() - startedAt,
            });
            window.location.reload();
        } catch {
            setStatusMessage('errors.unexpected');
            recordSettingsPageHealthEvent({
                channel: 'settings.factoryReset',
                status: 'failure',
                durationMs: Date.now() - startedAt,
                errorCode: settingsPageErrorCodes.factoryResetFailed,
            });
        }
    }, [setStatusMessage]);

    const onResetClick = useCallback(() => {
        setShowResetConfirm(true);
    }, []);

    const loadSettings = useCallback(async () => {
        const startedAt = Date.now();
        try {
            const data = await withSettingsPageRetry(() => window.electron.getSettings());
            if (!validateSettingsPayload(data)) {
                setStatusMessage('errors.unexpected');
                recordSettingsPageHealthEvent({
                    channel: 'settings.load',
                    status: 'validation-failure',
                    durationMs: Date.now() - startedAt,
                    errorCode: settingsPageErrorCodes.validation,
                });
                return;
            }

            await setSettings(data);
            recordSettingsPageHealthEvent({
                channel: 'settings.load',
                status: 'success',
                durationMs: Date.now() - startedAt,
            });
        } catch {
            setStatusMessage('errors.unexpected');
            recordSettingsPageHealthEvent({
                channel: 'settings.load',
                status: 'failure',
                durationMs: Date.now() - startedAt,
                errorCode: settingsPageErrorCodes.loadFailed,
            });
        }
    }, [setSettings, setStatusMessage]);

    const sharedProps = useMemo(() => ({
        settings, setSettings, isLoading, settingsUiState, lastErrorCode, statusMessage, setStatusMessage, authBusy, authMessage, isOllamaRunning, authStatus,
        updateGeneral, updateSpeech, handleSave, startOllama, checkOllama, refreshAuthStatus,
        connectGitHubProfile, connectCopilot, connectBrowserProvider, disconnectProvider,
        statsLoading, statsPeriod, setStatsPeriod, statsData, quotaData, copilotQuota, codexUsage, claudeQuota, setReloadTrigger,
        benchmarkResult, isBenchmarking, handleRunBenchmark,
        editingPersonaId, setEditingPersonaId, personaDraft, setPersonaDraft, handleSavePersona, handleDeletePersona,
        linkedAccounts, deviceCodeModal, closeDeviceCodeModal,
        manualSessionModal, setManualSessionModal, handleSaveClaudeSession,
        t, onRefreshModels, loadSettings, setIsLoading: (_value: boolean) => { }, onReset: handleFactoryReset
    }), [
        settings, setSettings, isLoading, settingsUiState, lastErrorCode, statusMessage, setStatusMessage, authBusy, authMessage, isOllamaRunning, authStatus,
        updateGeneral, updateSpeech, handleSave, startOllama, checkOllama, refreshAuthStatus,
        connectGitHubProfile, connectCopilot, connectBrowserProvider, disconnectProvider,
        statsLoading, statsPeriod, setStatsPeriod, statsData, quotaData, copilotQuota, codexUsage, claudeQuota, setReloadTrigger,
        benchmarkResult, isBenchmarking, handleRunBenchmark,
        editingPersonaId, setEditingPersonaId, personaDraft, setPersonaDraft, handleSavePersona, handleDeletePersona,
        linkedAccounts, deviceCodeModal, closeDeviceCodeModal,
        manualSessionModal, setManualSessionModal, handleSaveClaudeSession,
        t, onRefreshModels, loadSettings, handleFactoryReset
    ]);

    const renderedStatusMessage = useMemo(() => {
        if (statusMessage.trim() === '') {
            return '';
        }
        if (statusMessage.includes('.')) {
            return t(statusMessage);
        }
        return statusMessage;
    }, [statusMessage, t]);

    return (
        <div className="settings-container">
            <div className="settings-content flex h-full gap-6">
                <main className="settings-main flex-1 overflow-y-auto">
                    <div className={cn("settings-section h-full pr-4 pb-20", (activeTab === 'models' || activeTab === 'gallery') && "max-w-none")}>
                        {searchQuery && (
                            <div className="mb-4 text-xs text-muted-foreground">
                                {filteredTabs.length > 0
                                    ? t('settings.searchResults', { count: filteredTabs.length })
                                    : t('settings.noResults')}
                            </div>
                        )}
                        {renderedStatusMessage !== '' && (
                            <div className="mb-6 px-4 py-2 rounded-xl bg-success/10 border border-success/20 text-success text-xs font-bold animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                {renderedStatusMessage}
                            </div>
                        )}
                        {isLoading && settings === null ? (
                            <div className="rounded-xl border border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
                                {t('common.loading')}
                            </div>
                        ) : settingsUiState === 'failure' ? (
                            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
                                {t('errors.unexpected')} ({lastErrorCode ?? settingsPageErrorCodes.saveFailed})
                            </div>
                        ) : settings === null ? (
                            <div className="rounded-xl border border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
                                {t('settings.noResults')}
                            </div>
                        ) : (searchQuery && !isActiveTabVisible) || hasInvalidSearchQuery ? (
                            <div className="rounded-xl border border-border/60 bg-card/60 p-6 text-sm text-muted-foreground">
                                {t('settings.noResults')}
                            </div>
                        ) : (
                            <SettingsTabContent
                                activeTab={activeTab}
                                sharedProps={sharedProps}
                                installedModels={installedModels}
                                proxyModels={proxyModels}
                                onRefreshModels={onRefreshModels}
                                handleFactoryReset={onResetClick}
                                groupedModels={groupedModels ?? undefined}
                            />
                        )}
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
