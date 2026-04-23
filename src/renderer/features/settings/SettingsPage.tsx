/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useSettingsLogic } from '@renderer/features/settings/hooks/useSettingsLogic';
import { SettingsCategory, SettingsSharedProps } from '@renderer/features/settings/types';
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
import { translateErrorMessage } from '@/utils/error-handler.util';

import { ManualSessionModal, ManualSessionModalState } from './components/ManualSessionModal';
import {
    findSettingsNavigationItem,
    getSettingsNavigationItems,
    groupSettingsNavigationItems,
} from './settings-navigation';



/* Batch-02: Extracted Long Classes */
const C_SETTINGSPAGE_1 = 'animate-in fade-in slide-in-from-top-2 rounded-md border border-success/25 bg-success/10 px-3 py-2 typo-caption font-medium text-success';

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
        updateGeneral, updateEditor, updateSpeech, updateRemoteAccounts, handleSave, startOllama, checkOllama, refreshAuthStatus,
        connectGitHubProfile, connectCopilot, connectBrowserProvider, cancelAuthFlow, disconnectProvider,
        statsLoading, statsPeriod, setStatsPeriod, statsData, quotaData, copilotQuota, codexUsage, claudeQuota, setReloadTrigger,
        benchmarkResult, isBenchmarking, handleRunBenchmark,
        editingPersonaId, setEditingPersonaId, personaDraft, setPersonaDraft, handleSavePersona, handleDeletePersona,
        linkedAccounts, deviceCodeModal, closeDeviceCodeModal,
        manualSessionModal, setManualSessionModal, handleSaveClaudeSession, reloadSettings, updateWindow
    } = useSettingsLogic(onRefreshModels);

    const { t } = useTranslation(settings?.general?.language ?? 'en');

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
            general: {
                language: 'en' as const,
                theme: 'graphite',
                resolution: '1920x1080',
                fontSize: 14,
                typographyScale: 'balanced' as const,
            },
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

    const sharedProps: SettingsSharedProps = useMemo(() => ({
        settings, setSettings, isLoading, settingsUiState, lastErrorCode, statusMessage,
        setStatusMessage: (m: string) => { setStatusMessage(m); },
        authBusy, authMessage, isOllamaRunning, authStatus,
        updateGeneral, updateEditor, updateSpeech, updateRemoteAccounts, handleSave, startOllama, checkOllama, refreshAuthStatus,
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
        loadSettings: reloadSettings, setIsLoading: (_value: boolean) => { }, onReset: handleFactoryReset,
        updateWindow
    }), [
        settings, setSettings, isLoading, settingsUiState, lastErrorCode, statusMessage, setStatusMessage, authBusy, authMessage, isOllamaRunning, authStatus,
        updateGeneral, updateEditor, updateSpeech, updateRemoteAccounts, updateWindow, handleSave, startOllama, checkOllama, refreshAuthStatus,
        connectGitHubProfile, connectCopilot, connectBrowserProvider, cancelAuthFlow, disconnectProvider,
        statsLoading, statsPeriod, setStatsPeriod, statsData, quotaData, copilotQuota, codexUsage, claudeQuota, setReloadTrigger,
        benchmarkResult, isBenchmarking, handleRunBenchmark,
        editingPersonaId, setEditingPersonaId, personaDraft, setPersonaDraft, handleSavePersona, handleDeletePersona,
        linkedAccounts, deviceCodeModal, closeDeviceCodeModal,
        manualSessionModal, setManualSessionModal, handleSaveClaudeSession,
        t, onRefreshModels, reloadSettings, handleFactoryReset
    ]);

    const renderedStatusMessage = useMemo(() => {
        if (statusMessage.trim() === '') {
            return '';
        }
        if (
            statusMessage.includes('.')
            || statusMessage === statusMessage.toUpperCase()
            || statusMessage.includes(' timed out after ')
        ) {
            return translateErrorMessage(statusMessage);
        }
        return statusMessage;
    }, [statusMessage]);

    return (
        <div className="settings-container h-full overflow-hidden bg-background">
            <div className="settings-shell flex h-full min-h-0 flex-col gap-3 p-3 lg:flex-row lg:gap-6 lg:p-6">
                <aside className="settings-rail flex h-full w-full shrink-0 flex-col lg:w-72">
                    <div className="settings-shell-card flex min-h-0 flex-1 flex-col overflow-hidden bg-card/50 p-3 backdrop-blur-sm">
                        {searchQuery && (
                            <div className="settings-shell-note mb-4 px-3 py-2 text-xs font-medium text-primary/70">
                                {filteredTabs.length > 0
                                    ? t('settings.searchResults', { count: filteredTabs.length })
                                    : t('settings.noResults')}
                            </div>
                        )}

                        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pr-1" role="tablist" aria-orientation="vertical">
                            {groupedTabs.length > 0 ? groupedTabs.map(group => (
                                <div key={group.label} className="space-y-3">
                                    <p className="px-3 typo-overline font-bold uppercase tracking-widest text-muted-foreground/50">
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
                                                        'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200',
                                                        isActive
                                                            ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                                                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                                    )}
                                                >
                                                    <span className={cn(
                                                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all',
                                                        isActive
                                                            ? 'bg-primary/20 text-primary'
                                                            : 'bg-muted/30 text-muted-foreground group-hover:bg-muted/60 group-hover:text-foreground'
                                                    )}>
                                                        <Icon className="h-4 w-4" />
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className={cn(
                                                            "block truncate text-sm transition-colors",
                                                            isActive ? "font-bold" : "font-medium"
                                                        )}>
                                                            {item.label}
                                                        </span>
                                                    </span>
                                                    <ChevronRight className={cn(
                                                        'h-3.5 w-3.5 shrink-0 transition-transform duration-300',
                                                        isActive ? 'translate-x-0 opacity-100' : '-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-40'
                                                    )} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )) : (
                                <div className="rounded-xl border border-dashed border-border/50 bg-muted/5 px-4 py-8 text-center text-sm text-muted-foreground">
                                    {t('settings.noResults')}
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                <main className="settings-main min-w-0 flex-1 h-full flex flex-col overflow-hidden">
                    <div className="flex h-full min-h-0 flex-col gap-6 pb-4">
                        <section className="settings-shell-card bg-card/30 p-6 lg:p-8">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div className="space-y-2">
                                    <h2 className="text-3xl font-bold tracking-tight text-foreground">
                                        {activeNavigationItem?.label ?? t('settings.title')}
                                    </h2>
                                    <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground/70">
                                        {t('settings.subtitle')}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {renderedStatusMessage !== '' && (
                            <div className={cn(C_SETTINGSPAGE_1, "mx-1")}>
                                {renderedStatusMessage}
                            </div>
                        )}

                        <section
                            id={`settings-panel-${activeTab}`}
                            role="tabpanel"
                            aria-labelledby={`settings-tab-${activeTab}`}
                            className={cn(
                                'relative min-w-0 flex-1 min-h-0 overflow-hidden',
                                // Fade in animation
                                'animate-in fade-in slide-in-from-bottom-2 duration-500'
                            )}
                        >
                            {isLoading && settings === null ? (
                                <div className="flex h-64 items-center justify-center rounded-2xl border border-border/20 bg-card/50 p-8 backdrop-blur-sm">
                                    <div className="flex flex-col items-center gap-4 text-sm text-muted-foreground">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                        {t('common.loading')}
                                    </div>
                                </div>
                            ) : settingsUiState === 'failure' ? (
                                <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-6 text-sm text-destructive">
                                    {t('errors.unexpected')} ({lastErrorCode ?? settingsPageErrorCodes.saveFailed})
                                </div>
                            ) : settings === null || ((searchQuery && !isActiveTabVisible) || hasInvalidSearchQuery) ? (
                                <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border/20 bg-muted/5 p-8">
                                    <p className="text-sm text-muted-foreground">{t('settings.noResults')}</p>
                                </div>
                            ) : (
                                <div className="settings-section h-full overflow-y-auto pr-2">
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
