import { Button } from '@renderer/components/ui/button';
import { RefreshCw } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { getSelectableProviderId } from '@/features/models/utils/model-fetcher';
import type { ModelInfo } from '@/types';
import { AppSettings } from '@/types/settings';

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

export const ModelsTab: React.FC<ModelsTabProps> = ({
    settings,
    installedModels,
    proxyModels,
    setSettings,
    handleSave,
    onRefreshModels,
    t,
}) => {
    const [modelSearch, setModelSearch] = useState('');
    const [showHiddenModels, setShowHiddenModels] = useState(false);

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
            map.set(key, { id, provider, key, sources: [provider], details: model });
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
    }, [installedModels, proxyModels]);

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

    return (
        <div className="mx-auto max-w-5xl space-y-10 pb-10">
            <div className="flex flex-col justify-between gap-4 px-1 md:flex-row md:items-center">
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                        <div className="text-2xl font-bold text-primary leading-none">{availableModels.length}</div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-semibold text-foreground">{t('workspaces.myModels')}</h2>
                        <div className="mt-1 text-sm text-muted-foreground/70">
                            {availableModels.length} {t('modelsPage.modelsCount')}
                        </div>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        onRefreshModels(true);
                    }}
                    className="group flex h-10 items-center gap-3 rounded-xl border-border/30 bg-background px-5 text-[10px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                >
                    <RefreshCw className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-180" />
                    {t('modelsPage.refresh')}
                </Button>
            </div>

            <div className="space-y-8">
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
                    t={t}
                />
                
                <div className="my-2 h-px bg-border/30" />
                
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
