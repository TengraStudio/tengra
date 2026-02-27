import React from 'react';

import type { ModelInfo } from '@/types';

interface InstalledModelsListProps {
    filtered: Array<{ id: string; sources: string[]; details?: ModelInfo }>
    modelSearch: string
    setModelSearch: (s: string) => void
    showHiddenModels: boolean
    setShowHiddenModels: (b: boolean | ((prev: boolean) => boolean)) => void
    hiddenModels: string[]
    defaultModel: string
    setDefault: (id: string) => void
    updateHidden: (id: string, hide: boolean) => void
    t: (key: string) => string
}

export const InstalledModelsList: React.FC<InstalledModelsListProps> = ({
    filtered, modelSearch, setModelSearch, showHiddenModels, setShowHiddenModels,
    hiddenModels, defaultModel, setDefault, updateHidden, t
}) => {
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <input
                    type="text"
                    value={modelSearch}
                    onChange={e => setModelSearch(e.target.value)}
                    placeholder={t('projects.searchModels')}
                    className="h-10 w-64 max-w-full bg-muted/20 border border-border/50 rounded-xl px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <button
                    onClick={() => setShowHiddenModels(prev => !prev)}
                    className="px-3 py-2 rounded-lg text-xs font-bold bg-accent/20 text-muted-foreground border border-border/50"
                >
                    {showHiddenModels ? t('projects.hideHidden') : t('projects.showHidden')}
                </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
                {filtered.map((model) => (
                    <div key={model.id} className="bg-card p-4 rounded-xl border border-border flex items-center justify-between gap-4">
                        <div>
                            <div className="text-sm font-bold text-foreground">{model.id}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                                {(model.sources).map((s: string) => (
                                    <span key={s} className="mr-2 uppercase tracking-wider">{s}</span>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {defaultModel === model.id ? (
                                <span className="text-xs font-bold uppercase text-success">{t('projects.default')}</span>
                            ) : (
                                <button
                                    onClick={() => setDefault(model.id)}
                                    className="px-2.5 py-1 rounded-md text-xs font-bold bg-primary/20 text-primary border border-border/50"
                                >
                                    {t('projects.makeDefault')}
                                </button>
                            )}
                            <button
                                onClick={() => updateHidden(model.id, !hiddenModels.includes(model.id))}
                                className="px-2.5 py-1 rounded-md text-xs font-bold bg-accent/20 text-muted-foreground border border-border/50"
                            >
                                {hiddenModels.includes(model.id) ? t('projects.show') : t('projects.hide')}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
