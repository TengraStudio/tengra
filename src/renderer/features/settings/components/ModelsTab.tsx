import { Button } from '@renderer/components/ui/button';
import { cn } from '@renderer/lib/utils';
import { HardDrive, History, RefreshCw } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { getSelectableProviderId } from '@/features/models/utils/model-fetcher';
import type { ModelInfo } from '@/types';
import { AppSettings } from '@/types/settings';
import { appLogger } from '@/utils/renderer-logger';

import { type DownloadHistoryItem, DownloadHistoryList } from './models/DownloadHistoryList';
import { InstalledModelsList } from './models/InstalledModelsList';
import { ModelGovernancePanel } from './models/ModelGovernancePanel';

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

    const handleDeleteModel = async (modelId: string, provider: string) => {
        // eslint-disable-next-line no-alert
        if (!window.confirm(t('modelsPage.confirmDelete'))) { return; }
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
                            {subTab === 'installed' ? t('workspaces.myModels') : t('modelsPage.downloadHistory')}
                        </h2>
                        <div className="mt-1 text-sm text-muted-foreground/70">
                            {subTab === 'installed'
                                ? `${availableModels.length} ${t('modelsPage.modelsCount')}`
                                : `${downloadHistory.length} ${t('modelsPage.historyItems')}`
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
                        <HardDrive className="h-4 w-4" />
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
                        <History className="h-4 w-4" />
                        {t('modelsPage.history')}
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
                    className="group flex h-10 items-center gap-3 rounded-2xl border-border/30 bg-background px-6 typo-body font-bold text-muted-foreground hover:bg-muted/40 hover:text-foreground shadow-sm"
                >
                    <RefreshCw className="h-4 w-4 transition-transform duration-500 group-hover:rotate-180" />
                    {t('modelsPage.refresh')}
                </Button>
            </div>

            <div className="space-y-8 min-h-[400px]">
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
                        onDelete={(id, prov) => { void handleDeleteModel(id, prov); }}
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
        </div>
    );
};
