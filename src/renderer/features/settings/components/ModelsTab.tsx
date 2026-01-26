import React, { useMemo, useState } from 'react';

import { ModelExplorer } from '@/features/models/components/ModelExplorer';
import type { ModelInfo } from '@/features/models/utils/model-fetcher';
import { cn } from '@/lib/utils';
import { AppSettings } from '@/types/settings';

import { InstalledModelsList } from './models/InstalledModelsList';

interface ModelsTabProps {
    settings: AppSettings | null
    installedModels: ModelInfo[]
    proxyModels?: ModelInfo[]
    setSettings: (s: AppSettings) => void
    handleSave: (s?: AppSettings) => void
    onRefreshModels: () => void
    t: (key: string) => string
}

export const ModelsTab: React.FC<ModelsTabProps> = ({ settings, installedModels, proxyModels, setSettings, handleSave, onRefreshModels, t }) => {
    const [modelsTab, setModelsTab] = useState<'installed' | 'discover'>('installed');
    const [modelSearch, setModelSearch] = useState('');
    const [showHiddenModels, setShowHiddenModels] = useState(false);

    const combined = useMemo(() => {
        const map = new Map<string, { id: string; sources: string[]; details?: ModelInfo }>();
        for (const model of installedModels) {
            if (!model.id) { continue; }
            map.set(model.id, { id: model.id, sources: ['ollama'], details: model });
        }
        for (const model of (proxyModels ?? [])) {
            const id = String(model.id ?? '').trim();
            if (!id) { continue; }
            const existing = map.get(id);
            const source = model.provider ?? 'proxy';
            if (existing) { existing.sources = Array.from(new Set([...existing.sources, source])); }
            else { map.set(id, { id, sources: [source] }); }
        }
        return map;
    }, [installedModels, proxyModels]);

    const hiddenModels = useMemo(() => settings?.general.hiddenModels ?? [], [settings?.general.hiddenModels]);
    const defaultModel = settings?.general.defaultModel ?? '';

    const filtered = useMemo(() => {
        return Array.from(combined.values()).filter((m) => {
            if (!showHiddenModels && hiddenModels.includes(m.id)) { return false; }
            if (!modelSearch) { return true; }
            return m.id.toLowerCase().includes(modelSearch.toLowerCase());
        });
    }, [combined, showHiddenModels, hiddenModels, modelSearch]);

    if (!settings) { return null; }

    const updateHidden = (modelId: string, hide: boolean) => {
        const nextHidden = hide ? Array.from(new Set([...hiddenModels, modelId])) : hiddenModels.filter(m => m !== modelId);
        const updated = { ...settings, general: { ...settings.general, hiddenModels: nextHidden } };
        setSettings(updated);
        handleSave(updated);
    };

    const setDefault = (modelId: string) => {
        const updated = { ...settings, general: { ...settings.general, defaultModel: modelId } };
        setSettings(updated);
        handleSave(updated);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <button onClick={() => setModelsTab('installed')} className={cn("px-4 py-2 rounded-full text-xs font-bold border transition-colors flex items-center gap-2", modelsTab === 'installed' ? "bg-primary/20 text-primary border-primary/30" : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50")}>
                    <span>{t('projects.myModels')}</span>
                    <span className="opacity-50 text-[10px] bg-primary/10 px-1.5 py-0.5 rounded-md">{installedModels.length}</span>
                </button>
                <button onClick={() => setModelsTab('discover')} className={cn("px-4 py-2 rounded-full text-xs font-bold border transition-colors", modelsTab === 'discover' ? "bg-primary/20 text-primary border-primary/30" : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50")}>{t('projects.discover')}</button>
            </div>

            {modelsTab === 'installed' ? (
                <InstalledModelsList
                    filtered={filtered}
                    modelSearch={modelSearch}
                    setModelSearch={setModelSearch}
                    showHiddenModels={showHiddenModels}
                    setShowHiddenModels={setShowHiddenModels}
                    hiddenModels={hiddenModels}
                    defaultModel={defaultModel}
                    setDefault={setDefault}
                    updateHidden={updateHidden}
                    t={t}
                />
            ) : (
                <div className="flex-1 min-h-0">
                    <ModelExplorer onRefreshModels={onRefreshModels} installedModels={installedModels} language={settings.general.language} />
                </div>
            )}
        </div>
    );
};
