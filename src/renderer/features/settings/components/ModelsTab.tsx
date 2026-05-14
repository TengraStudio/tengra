/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconDatabase, IconHistory, IconRefresh } from '@tabler/icons-react';
import React, { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { getSelectableProviderId } from '@/features/models/utils/model-fetcher';
import { cn } from '@/lib/utils';
import type { ModelInfo } from '@/types';
import { AppSettings } from '@/types/settings';
import { appLogger } from '@/utils/renderer-logger';

import { type DownloadHistoryItem, DownloadHistoryList } from './models/DownloadHistoryList';
import { InstalledModelsList } from './models/InstalledModelsList';
import {
    SETTINGS_SEGMENTED_CONTROL_CLASS,
    SettingsPanel,
    SettingsTabHeader,
    SettingsTabLayout,
} from './SettingsPrimitives';

/* Batch-02: Extracted Long Classes */
const C_MODELSTAB_1 = "group flex h-10 items-center gap-3 rounded-2xl border-border/30 bg-background px-6 typo-body font-bold text-muted-foreground hover:bg-muted/40 hover:text-foreground shadow-sm sm:gap-4";


interface ModelsTabProps {
    settings: AppSettings | null;
    installedModels: ModelInfo[];
    proxyModels?: ModelInfo[];
    setSettings: (s: AppSettings) => void;
    onRefreshModels: (bypassCache?: boolean) => void;
    t: (key: string) => string;
}

type SubTab = 'installed' | 'history';

export const ModelsTab: React.FC<ModelsTabProps> = ({
    settings,
    installedModels,
    proxyModels,
    setSettings,
    onRefreshModels,
    t,
}) => {
    const [subTab, setSubTab] = useState<SubTab>('installed');
    const [modelSearch, setModelSearch] = useState('');
    const [showHiddenModels, setShowHiddenModels] = useState(false);
    const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryItem[]>([]);

    // Custom modal states
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [modelToDelete, setModelToDelete] = useState<{ id: string; provider: string } | null>(null);

    const fetchHistory = React.useCallback(async () => {
        try {
            const res = await window.electron.modelDownloader.history(1000);
            if (res.success) {
                setDownloadHistory((res.items || []) as DownloadHistoryItem[]);
            }
        } catch (err) {
            appLogger.error('ModelsTab', 'Failed to fetch download history', err as Error);
        }
    }, []);

    React.useEffect(() => {
        queueMicrotask(() => {
            void fetchHistory();
        });
    }, [fetchHistory]);

    const availableModels = useMemo(() => {
        const map = new Map<
            string,
            {
                id: string;
                provider: string;
                key: string;
                sources: string[];
                details?: ModelInfo;
            }
        >();
        for (const model of installedModels) {
            const id = String(model.id ?? '').trim();
            if (!id) {
                continue;
            }
            const provider = getSelectableProviderId(model);
            const key = `${provider}:${id}`;

            const historyEntry = (downloadHistory || []).find((h: DownloadHistoryItem) =>
                h.modelRef === id
            );

            const details: ModelInfo = {
                ...model,
                installedAt: historyEntry?.endedAt || historyEntry?.startedAt
            };

            map.set(key, { id, provider, key, sources: [provider], details });
        }
        for (const model of proxyModels ?? []) {
            const id = String(model.id ?? '').trim();
            if (!id) {
                continue;
            }
            const provider = getSelectableProviderId(model);
            const key = `${provider}:${id}`;
            const existing = map.get(key);
            const source = provider;
            if (existing) {
                existing.sources = Array.from(new Set([...existing.sources, source]));
            } else {
                map.set(key, { id, provider, key, sources: [source], details: model });
            }
        }
        return Array.from(map.values());
    }, [installedModels, proxyModels, downloadHistory]);

    const hiddenModels = useMemo(
        () => settings?.general.hiddenModels ?? [],
        [settings?.general.hiddenModels]
    );
    const defaultModel = settings?.general.defaultModel ?? '';
    const defaultProvider = settings?.general.lastProvider ?? '';

    const filtered = useMemo(() => {
        return availableModels.filter(m => {
            if (!showHiddenModels && hiddenModels.includes(m.id)) {
                return false;
            }
            if (!modelSearch) {
                return true;
            }
            const query = modelSearch.toLowerCase();
            return (
                m.id.toLowerCase().includes(query) ||
                m.provider.toLowerCase().includes(query) ||
                (m.details?.name?.toLowerCase().includes(query) ?? false)
            );
        });
    }, [availableModels, showHiddenModels, hiddenModels, modelSearch]);
 
    if (!settings) {
        return null;
    }

    const updateHidden = (modelId: string, hide: boolean) => {
        const nextHidden = hide
            ? Array.from(new Set([...hiddenModels, modelId]))
            : hiddenModels.filter(m => m !== modelId);
        const updated = {
            ...settings,
            general: { ...settings.general, hiddenModels: nextHidden },
        };
        setSettings(updated);
    };

    const setDefault = (modelId: string, provider: string) => {
        const updated = {
            ...settings,
            general: {
                ...settings.general,
                defaultModel: modelId,
                lastProvider: provider,
            },
        };
        setSettings(updated);
    };

    const handleDeleteModel = (modelId: string, provider: string) => {
        setModelToDelete({ id: modelId, provider });
        setIsConfirmDeleteOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!modelToDelete) { return; }
        const { id: modelId, provider } = modelToDelete;
        setIsConfirmDeleteOpen(false);
        setModelToDelete(null);

        try {
            let res;
            if (provider === 'ollama') {
                res = await window.electron.ollama.deleteModel(modelId);
            } else if (provider === 'huggingface') {
                res = await window.electron.huggingface.deleteModel(modelId);
            }

            if (res?.success) {
                onRefreshModels(true);
            } else {
                appLogger.error('ModelsTab', `Failed to delete model ${modelId}`, new Error(res?.error || 'Unknown error'));
            }
        } catch (err) {
            appLogger.error('ModelsTab', `Error deleting model ${modelId}`, err as Error);
        }
    };

    return (
        <SettingsTabLayout>
            <SettingsTabHeader
                title={subTab === 'installed' ? t('frontend.workspaces.myModels') : t('frontend.modelsPage.downloadHistory')}
                description={
                    subTab === 'installed'
                        ? `${availableModels.length} ${t('frontend.modelsPage.modelsCount')}`
                        : `${downloadHistory.length} ${t('frontend.modelsPage.historyItems')}`
                }
                icon={subTab === 'installed' ? IconDatabase : IconHistory}
                actions={(
                    <div className="flex flex-wrap items-center gap-3">
                        <div className={SETTINGS_SEGMENTED_CONTROL_CLASS}>
                            <button
                                onClick={() => setSubTab('installed')}
                                className={cn(
                                    'flex h-10 items-center gap-3 rounded-xl px-5 text-sm font-semibold transition-all whitespace-nowrap',
                                    subTab === 'installed'
                                        ? 'border border-border/40 bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground/60 hover:text-foreground'
                                )}
                            >
                                <IconDatabase className="h-4 w-4" />
                                {t('common.installed')}
                            </button>
                            <button
                                onClick={() => setSubTab('history')}
                                className={cn(
                                    'flex h-10 items-center gap-3 rounded-xl px-5 text-sm font-semibold transition-all whitespace-nowrap',
                                    subTab === 'history'
                                        ? 'border border-border/40 bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground/60 hover:text-foreground'
                                )}
                            >
                                <IconHistory className="h-4 w-4" />
                                {t('frontend.modelsPage.history')}
                            </button>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                if (subTab === 'installed') {
                                    onRefreshModels(true);
                                } else {
                                    void fetchHistory();
                                }
                            }}
                            className={C_MODELSTAB_1}
                        >
                            <IconRefresh className="h-4 w-4 transition-transform duration-500 group-hover:rotate-180" />
                            {t('frontend.modelsPage.refresh')}
                        </Button>
                    </div>
                )}
            />

            <SettingsPanel title={t('frontend.workspaces.myModels')} icon={IconDatabase}>
                <div className="space-y-8 min-h-400 px-6 py-2">
                    {subTab === 'installed' ? (
                        <InstalledModelsList
                            filtered={filtered}
                            modelSearch={modelSearch}
                            setModelSearch={setModelSearch}
                            showHiddenModels={showHiddenModels}
                            setShowHiddenModels={setShowHiddenModels}
                            hiddenModels={hiddenModels}
                            defaultModel={defaultModel}
                            defaultProvider={defaultProvider}
                            setDefault={setDefault}
                            updateHidden={updateHidden}
                            onDelete={(id, prov) => { handleDeleteModel(id, prov); }}
                            t={t}
                        />
                    ) : (
                    <DownloadHistoryList
                        history={downloadHistory}
                        t={t}
                    />
                )}
                </div>
            </SettingsPanel>

            <ConfirmationModal
                isOpen={isConfirmDeleteOpen}
                onClose={() => setIsConfirmDeleteOpen(false)}
                onConfirm={() => { void handleConfirmDelete(); }}
                title={t('frontend.modelsPage.confirmDeleteTitle')}
                message={t('frontend.modelsPage.confirmDelete')}
                variant="danger"
            />
        </SettingsTabLayout>
    );
};

