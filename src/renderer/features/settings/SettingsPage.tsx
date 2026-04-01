import { useSettingsLogic } from '@renderer/features/settings/hooks/useSettingsLogic';
import { SettingsCategory } from '@renderer/features/settings/types';
import { ChevronRight } from 'lucide-react';
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

import { ManualSessionModal, ManualSessionModalState } from './components/ManualSessionModal';
import {
    findSettingsNavigationItem,
    getSettingsNavigationItems,
    groupSettingsNavigationItems,
} from './settings-navigation';

import '@renderer/features/settings/SettingsPage.css';
import '@renderer/features/settings/tailwind-semantic-utilities.css';

export interface SettingsPageProps {
    installedModels: ModelInfo[]
    proxyModels?: ModelInfo[]
    onRefreshModels: (bypassCache?: boolean) => void
    activeTab?: SettingsCategory
    onTabChange?: (tab: SettingsCategory) => void
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
    throw (lastError ?? new Error('SETTINGS_PAGE_OPERATION_FAILED'));
}

export function SettingsPage({
    installedModels,
    proxyModels,
    onRefreshModels,
    activeTab = 'general',
    onTabChange,
    groupedModels,
    searchQuery: controlledSearchQuery
}: SettingsPageProps) {
    const {
        settings, setSettings, isLoading, settingsUiState, lastErrorCode, statusMessage, setStatusMessage, authBusy, authMessage, isOllamaRunning, authStatus,
        updateGeneral, updateSpeech, handleSave, startOllama, checkOllama, refreshAuthStatus,
        connectGitHubProfile, connectCopilot, connectBrowserProvider, cancelAuthFlow, disconnectProvider,
        statsLoading, statsPeriod, setStatsPeriod, statsData, quotaData, copilotQuota, codexUsage, claudeQuota, setReloadTrigger,
        benchmarkResult, isBenchmarking, handleRunBenchmark,
        editingPersonaId, setEditingPersonaId, personaDraft, setPersonaDraft, handleSavePersona, handleDeletePersona,
        linkedAccounts, deviceCodeModal, closeDeviceCodeModal,
        manualSessionModal, setManualSessionModal, handleSaveClaudeSession
    } = useSettingsLogic(onRefreshModels);

    const { t } = useTranslation(settings?.general?.language ?? 'tr');

    // Search query is controlled from the global app header.
    const normalizedSearchQuery = useMemo(
        () => normalizeSettingsSearchQuery(controlledSearchQuery ?? ''),
        [controlledSearchQuery]
    );
    const hasInvalidSearchQuery = (controlledSearchQuery ?? '').trim() !== '' && normalizedSearchQuery === '';
    const searchQuery = normalizedSearchQuery;

    const allTabs = useMemo(() => getSettingsNavigationItems(t), [t]);

    const filteredTabs = useMemo(() => {
        if (!searchQuery) { return allTabs; }
        return allTabs.filter(tab =>
            tab.label.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery, allTabs]);
    const isActiveTabVisible = filteredTabs.some(tab => tab.id === activeTab);
    const groupedTabs = useMemo(() => groupSettingsNavigationItems(filteredTabs), [filteredTabs]);
    const activeNavigationItem = useMemo(
        () => findSettingsNavigationItem(allTabs, activeTab),
        [activeTab, allTabs]
    );

    const handleSelectTab = useCallback((tab: SettingsCategory) => {
        if (tab === activeTab) {
            return;
        }
        onTabChange?.(tab);
    }, [activeTab, onTabChange]);

    const [showResetConfirm, setShowResetConfirm] = useState(false);

    const handleFactoryReset = useCallback(async () => {
        const startedAt = Date.now();
        const resetPayload = {
            ollama: { url: 'http://localhost:11434' },
            embeddings: { provider: 'none' as const },
            general: { language: 'tr' as const, theme: 'dark', resolution: '1920x1080', fontSize: 14 },
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
        settings, setSettings, isLoading, settingsUiState, lastErrorCode, statusMessage, 
        setStatusMessage: (m: string) => { setStatusMessage(m); }, 
        authBusy, authMessage, isOllamaRunning, authStatus,
        updateGeneral, updateSpeech, handleSave, startOllama, checkOllama, refreshAuthStatus,
        connectGitHubProfile, connectCopilot, connectBrowserProvider, cancelAuthFlow, disconnectProvider,
        statsLoading, statsPeriod, 
        setStatsPeriod: (p: 'daily' | 'weekly' | 'monthly' | 'yearly') => { setStatsPeriod(p); }, 
        statsData, quotaData, copilotQuota, codexUsage, claudeQuota, 
        setReloadTrigger: (trigger: number | ((prev: number) => number)) => { setReloadTrigger(trigger); },
        benchmarkResult, isBenchmarking, handleRunBenchmark,
        editingPersonaId, 
        setEditingPersonaId: (id: string | null) => { setEditingPersonaId(id); }, 
        personaDraft, setPersonaDraft, handleSavePersona, handleDeletePersona,
        linkedAccounts, deviceCodeModal, closeDeviceCodeModal,
        manualSessionModal, 
        setManualSessionModal: (m: ManualSessionModalState) => { setManualSessionModal(m); }, 
        handleSaveClaudeSession,
        t, 
        onRefreshModels: (bypassCache?: boolean) => { onRefreshModels?.(bypassCache); }, 
        loadSettings, setIsLoading: (_value: boolean) => { }, onReset: handleFactoryReset
    }), [
        settings, setSettings, isLoading, settingsUiState, lastErrorCode, statusMessage, setStatusMessage, authBusy, authMessage, isOllamaRunning, authStatus,
        updateGeneral, updateSpeech, handleSave, startOllama, checkOllama, refreshAuthStatus,
        connectGitHubProfile, connectCopilot, connectBrowserProvider, cancelAuthFlow, disconnectProvider,
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
            <div className="settings-shell flex h-full flex-col gap-6 p-5 lg:flex-row lg:gap-8 lg:p-6">
                <aside className="settings-rail flex w-full shrink-0 flex-col gap-4 lg:w-[21rem]">
                    <div className="rounded-[24px] border border-border/70 bg-background/92 p-6">
                        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.32em] text-muted-foreground/70">
                            {t('nav.settings')}
                        </p>
                        <h1 className="text-[1.65rem] font-black tracking-tight text-foreground">
                            {t('settings.title')}
                        </h1>
                        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground/90">
                            {t('settings.subtitle')}
                        </p>
                    </div>

                    <div className="min-h-0 rounded-[24px] border border-border/70 bg-background/88 p-3">
                        {searchQuery && (
                            <div className="mb-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                                {filteredTabs.length > 0
                                    ? t('settings.searchResults', { count: filteredTabs.length })
                                    : t('settings.noResults')}
                            </div>
                        )}

                        <div className="flex max-h-full flex-col gap-4 overflow-y-auto pr-1" role="tablist" aria-orientation="vertical">
                            {groupedTabs.length > 0 ? groupedTabs.map(group => (
                                <div key={group.label} className="space-y-2">
                                    <p className="px-3 text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground/50">
                                        {group.label}
                                    </p>
                                    <div className="space-y-1">
                                        {group.items.map(item => {
                                            const isActive = item.id === activeTab;
                                            const Icon = item.icon;

                                            return (
                                                <button
                                                    key={item.id}
                                                    id={`settings-tab-${item.id}`}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={isActive}
                                                    aria-controls={`settings-panel-${item.id}`}
                                                    onClick={() => { handleSelectTab(item.id); }}
                                                    className={cn(
                                                        'group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors duration-150',
                                                        isActive
                                                            ? 'border-border bg-foreground/[0.045] text-foreground'
                                                            : 'border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/20 hover:text-foreground'
                                                    )}
                                                >
                                                    <span className={cn(
                                                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                                                        isActive
                                                            ? 'bg-foreground text-background'
                                                            : 'bg-muted/25 text-muted-foreground group-hover:bg-muted/40 group-hover:text-foreground'
                                                    )}>
                                                        <Icon className="h-4 w-4" />
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block truncate text-sm font-semibold">
                                                            {item.label}
                                                        </span>
                                                        <span className="block truncate text-xs text-muted-foreground/75">
                                                            {item.sectionLabel}
                                                        </span>
                                                    </span>
                                                    <ChevronRight className={cn(
                                                        'h-4 w-4 shrink-0 transition-transform',
                                                        isActive ? 'translate-x-0 text-foreground' : 'text-muted-foreground/45 group-hover:translate-x-1'
                                                    )} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )) : (
                                <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                                    {t('settings.noResults')}
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                <main className="settings-main min-w-0 flex-1 overflow-y-auto">
                    <div className="settings-stage flex min-h-full flex-col gap-5 pb-16">
                        <section className="rounded-[24px] border border-border/70 bg-background/94 px-6 py-6 lg:px-8">
                            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-muted-foreground/70">
                                {activeNavigationItem?.sectionLabel ?? t('nav.settings')}
                            </p>
                            <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                <div className="space-y-2">
                                    <h2 className="text-[2rem] font-black tracking-tight text-foreground">
                                        {activeNavigationItem?.label ?? t('settings.title')}
                                    </h2>
                                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground/90">
                                        {t('settings.subtitle')}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                    {filteredTabs.length} / {allTabs.length}
                                </div>
                            </div>
                        </section>

                        {renderedStatusMessage !== '' && (
                            <div className="rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-xs font-bold text-success animate-in fade-in slide-in-from-top-2">
                                {renderedStatusMessage}
                            </div>
                        )}

                        <section
                            id={`settings-panel-${activeTab}`}
                            role="tabpanel"
                            aria-labelledby={`settings-tab-${activeTab}`}
                            className={cn(
                                'rounded-[24px] border border-border/70 bg-background/94 p-4 lg:p-6',
                                (activeTab === 'models' || activeTab === 'gallery') && 'max-w-none'
                            )}
                        >
                            {isLoading && settings === null ? (
                                <div className="rounded-xl border border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
                                    {t('common.loading')}
                                </div>
                            ) : settingsUiState === 'failure' ? (
                                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
                                    {t('errors.unexpected')} ({lastErrorCode ?? settingsPageErrorCodes.saveFailed})
                                </div>
                            ) : settings === null ? (
                                <div className="rounded-xl border border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
                                    {t('settings.noResults')}
                                </div>
                            ) : (searchQuery && !isActiveTabVisible) || hasInvalidSearchQuery ? (
                                <div className="rounded-xl border border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
                                    {t('settings.noResults')}
                                </div>
                            ) : (
                                <div className="settings-section">
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
                            )}
                        </section>
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

