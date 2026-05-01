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
import { ModelGovernancePanel } from './models/ModelGovernancePanel';

/* Batch-02: Extracted Long Classes */
const C_MODELSTAB_1 = "group flex h-10 items-center gap-3 rounded-2xl border-border/30 bg-background px-6 typo-body font-bold text-muted-foreground hover:bg-muted/40 hover:text-foreground shadow-sm sm:gap-4";


interface ModelsTabProps {
    settings: AppSettings | null;
    installedModels: ModelInfo[];
    proxyModels?: ModelInfo[];
    setSettings: (s: AppSettings) => void;
    handleSave: (s?: AppSettings) => void;
    onRefreshModels: (bypassCache?: boolean) => void;
    t: (key: string) => string;
}

type SubTab = 'installed' | 'history';

export const ModelsTab: React.FC<ModelsTabProps> = ({
    settings,
    installedModels,
    proxyModels,
    setSettings,
    handleSave,
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
            const res = await window.electron.invoke('model-downloader:history', 1000);
            if (res.success) {
                setDownloadHistory((res.items || []) as DownloadHistoryItem[]);
            }
        } catch (err) {
            appLogger.error('ModelsTab', 'Failed to fetch download history', err as Error);
        }
    }, []);

    React.useEffect(() => {
        void fetchHistory();
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

    const allModelIds = useMemo(
        () => Array.from(new Set(availableModels.map(model => model.id))),
        [availableModels]
    );

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
        handleSave(updated);
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
        handleSave(updated);
    };

    const handleDeleteModel = (modelId: string, provider: string) => {
        setModelToDelete({ id: modelId, provider });
        setIsConfirmDeleteOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!modelToDelete) {return;}
        const { id: modelId, provider } = modelToDelete;
        setIsConfirmDeleteOpen(false);
        setModelToDelete(null);

        try {
            let res;
            if (provider === 'ollama') {
                res = await window.electron.invoke('ollama:deleteModel', modelId);
            } else if (provider === 'huggingface') {
                res = await window.electron.invoke('hf:delete-model', modelId);
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
        <div className="mx-auto max-w-5xl space-y-10 pb-10">
            <div className="flex flex-col justify-between gap-6 px-1 md:flex-row md:items-start">
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                        <div className="text-2xl font-bold text-primary leading-none">
                            {subTab === 'installed' ? availableModels.length : downloadHistory.length}
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-semibold text-foreground">
                            {subTab === 'installed' ? t('frontend.workspaces.myModels') : t('frontend.modelsPage.downloadHistory')}
                        </h2>
                        <div className="mt-1 text-sm text-muted-foreground/70">
                            {subTab === 'installed'
                                ? `${availableModels.length} ${t('frontend.modelsPage.modelsCount')}`
                                : `${downloadHistory.length} ${t('frontend.modelsPage.historyItems')}`
                            }
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-muted/20 p-1.5 rounded-2xl border border-border/20">
                    <button
                        onClick={() => setSubTab('installed')}
                        className={cn(
                            "flex h-10 items-center gap-3 rounded-xl px-5 typo-body font-bold transition-all whitespace-nowrap",
                            subTab === 'installed'
                                ? "bg-background text-foreground shadow-sm border border-border/40"
                                : "text-muted-foreground/60 hover:text-foreground"
                        )}
                    >
                        <IconDatabase className="h-4 w-4" />
                        {t('common.installed')}
                    </button>
                    <button
                        onClick={() => setSubTab('history')}
                        className={cn(
                            "flex h-10 items-center gap-3 rounded-xl px-5 typo-body font-bold transition-all whitespace-nowrap",
                            subTab === 'history'
                                ? "bg-background text-foreground shadow-sm border border-border/40"
                                : "text-muted-foreground/60 hover:text-foreground"
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

            <div className="space-y-8 min-h-400">
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

                <div className="my-2 h-px bg-border/20" />

                <ModelGovernancePanel
                    settings={settings}
                    allModelIds={allModelIds}
                    setSettings={setSettings}
                    handleSave={handleSave}
                    t={t}
                />
            </div>

            <ConfirmationModal
                isOpen={isConfirmDeleteOpen}
                onClose={() => setIsConfirmDeleteOpen(false)}
                onConfirm={handleConfirmDelete}
                title={t('frontend.modelsPage.confirmDeleteTitle')}
                message={t('frontend.modelsPage.confirmDelete')}
                variant="danger"
            />
        </div>
    );
};
