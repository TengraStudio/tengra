/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconBox, IconChevronLeft, IconChevronRight, IconDatabase, IconLoader2, IconSearch, IconX } from '@tabler/icons-react';
import React from 'react';

import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { ModelCard } from '@/features/models/components/ModelCard';
import { ModelDetailsPanel } from '@/features/models/components/ModelDetailsPanel';
import { useModelExplorer } from '@/features/models/hooks/useModelExplorer';
import { HFModel, OllamaLibraryModel } from '@/features/models/types';
import type { Language } from '@/i18n';
import { useTranslation } from '@/i18n';
import { AnimatePresence } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import type { ModelInfo } from '@/types';

/* Batch-02: Extracted Long Classes */
const C_MODELEXPLORER_1 = "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors";
const C_MODELEXPLORER_2 = "w-full bg-muted/30 border border-border/30 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-muted-foreground/50 shadow-inner";


interface ModelExplorerProps {
    onClose?: () => void
    onRefreshModels?: (bypassCache?: boolean) => void
    installedModels?: ModelInfo[]
    language?: Language
}

interface ExplorerHeaderProps {
    query: string;
    totalHf: number;
    onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClose?: () => void;
    t: (key: string) => string;
}

interface ExplorerActionsProps {
    activeSource: string;
    setActiveSource: (source: 'all' | 'ollama' | 'huggingface') => void;
    sortBy: string;
    setSortBy: (sort: 'name' | 'popularity' | 'updated') => void;
    page: number;
    setPage: React.Dispatch<React.SetStateAction<number>>;
    t: (key: string) => string;
}

const ExplorerHeader: React.FC<ExplorerHeaderProps> = ({ query, totalHf, onSearchChange, onClose, t }) => (
    <div className="space-y-6">
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">{t('frontend.modelExplorer.title')}</h1>
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">{t('frontend.modelExplorer.subtitle')}</p>
                <div className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 flex items-center gap-1.5">
                    <IconBox className="w-3 h-3 text-primary" />
                    <span className="text-sm font-bold text-primary">
                        {totalHf > 0 ? `${totalHf.toLocaleString()} ` : ''}{t('frontend.modelExplorer.ggufCompatible')}
                    </span>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-6">
            <div className="flex-1 relative group">
                <IconSearch className={C_MODELEXPLORER_1} />
                <input
                    className={C_MODELEXPLORER_2}
                    placeholder={t('frontend.modelExplorer.searchPlaceholder')}
                    value={query}
                    onChange={onSearchChange}
                />
            </div>
            {onClose && (
                <button onClick={onClose} className="p-3 hover:bg-muted/50 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-border/50">
                    <IconX className="w-5 h-5" />
                </button>
            )}
        </div>
    </div>
);

const ExplorerActions: React.FC<ExplorerActionsProps> = ({ activeSource, setActiveSource, sortBy, setSortBy, page, setPage, t }) => (
    <div className="flex items-center justify-between">
        <div className="flex gap-3">
            <button onClick={() => setActiveSource('all')} className={cn("px-6 py-2.5 rounded-xl typo-caption font-bold transition-all border", activeSource === 'all' ? "bg-primary text-primary-foreground border-primary" : "bg-muted/20 border-border/50 hover:bg-muted/40")}>{t('frontend.modelExplorer.allSources')}</button>
            <button onClick={() => setActiveSource('ollama')} className={cn("px-6 py-2.5 rounded-xl typo-caption font-bold transition-all border flex items-center gap-2", activeSource === 'ollama' ? "bg-warning/10 text-warning border-warning/40" : "bg-muted/20 border-border/50 hover:bg-muted/40")}>
                <IconDatabase className="w-3.5 h-3.5" />
                <span>{t('frontend.modelExplorer.sourceOllama')}</span>
            </button>
            <button onClick={() => setActiveSource('huggingface')} className={cn("px-6 py-2.5 rounded-xl typo-caption font-bold transition-all border flex items-center gap-2", activeSource === 'huggingface' ? "bg-warning/10 text-warning-600 border-warning/30 dark:text-warning" : "bg-muted/20 border-border/50 hover:bg-muted/40")}>
                <IconBox className="w-3.5 h-3.5" />
                <span>{t('frontend.modelExplorer.sourceHuggingFace')}</span>
            </button>
        </div>

        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-muted/10 px-3 py-1 rounded-xl border border-border/30">
                <span className="text-sm font-bold text-muted-foreground/50 whitespace-nowrap">{t('frontend.modelExplorer.sort')}</span>
                <SelectDropdown
                    value={sortBy}
                    options={[
                        { value: 'popularity', label: t('frontend.modelExplorer.popularity') },
                        { value: 'name', label: t('frontend.modelExplorer.name') },
                        { value: 'updated', label: t('frontend.modelExplorer.newest') }
                    ]}
                    onChange={(val) => setSortBy(val as 'name' | 'popularity' | 'updated')}
                    className="min-w-32"
                />
            </div>

            <div className="flex items-center bg-muted/20 rounded-xl p-1 border border-border/50">
                <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} className="p-2 rounded-lg hover:bg-muted transition-all disabled:opacity-30"><IconChevronLeft className="w-4 h-4" /></button>
                <span className="px-4 text-sm font-bold text-muted-foreground border-x border-border/30">{t('frontend.modelExplorer.page')} {page + 1}</span>
                <button onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg hover:bg-muted transition-all"><IconChevronRight className="w-4 h-4" /></button>
            </div>
        </div>
    </div>
);

export function ModelExplorer({ onClose, onRefreshModels, installedModels = [], language = 'en' }: ModelExplorerProps) {
    const { t } = useTranslation(language);

    const {
        query, setQuery,
        activeSource, setActiveSource,
        sortBy, setSortBy,
        page, setPage,
        loading, totalHf, displayModels,
        selectedModel, setSelectedModel,
        files, loadingFiles,
        downloading, modelsDir,
        pullingOllama,
        recommendedIds,
        watchlist,
        modelPreview,
        comparisonIds,
        comparisonResult,
        comparisonLoading,
        lastInstallConfig,
        installTests,
        isInstalled,
        handleModelSelect, handlePullOllama, handleDownloadHF, toggleWatchlist, toggleComparison, runComparison, clearComparison
    } = useModelExplorer({ onRefreshModels, installedModels });

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        setPage(0);
    };

    return (
        <div className="h-full flex flex-col bg-background text-foreground">
            <div className="p-8 border-b border-border/50 space-y-6 bg-background/50 backdrop-blur-xl sticky top-0 z-30">
                <ExplorerHeader query={query} totalHf={totalHf} onSearchChange={handleSearchChange} onClose={onClose} t={t} />
                <ExplorerActions activeSource={activeSource} setActiveSource={setActiveSource} sortBy={sortBy} setSortBy={setSortBy} page={page} setPage={setPage} t={t} />
                {comparisonIds.length > 0 && (
                    <div className="rounded-xl border border-info/30 bg-info/5 px-4 py-3 flex items-center justify-between">
                        <div className="typo-caption text-info font-semibold">
                            {t('frontend.modelExplorer.compareQueue', { count: comparisonIds.length, max: 4 })}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => void runComparison()}
                                disabled={comparisonIds.length < 2 || comparisonLoading}
                                className={cn(
                                    'px-3 py-1.5 rounded-md typo-caption font-bold border',
                                    comparisonIds.length < 2 || comparisonLoading
                                        ? 'opacity-50 cursor-not-allowed border-border/30'
                                        : 'border-info/40 bg-info/10 text-info'
                                )}
                            >
                                {comparisonLoading ? t('frontend.modelExplorer.comparing') : t('frontend.modelExplorer.runComparison')}
                            </button>
                            <button
                                onClick={clearComparison}
                                className="px-3 py-1.5 rounded-md typo-caption font-bold border border-border/40"
                            >
                                {t('common.clear')}
                            </button>
                        </div>
                    </div>
                )}
                {Boolean(comparisonResult) && (
                    <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3 typo-caption">
                        <div className="font-semibold mb-2">{t('frontend.modelExplorer.comparisonResult')}</div>
                        <pre className="whitespace-pre-wrap break-words text-muted-foreground">
                            {JSON.stringify(comparisonResult, null, 2)}
                        </pre>
                    </div>
                )}
            </div>

            <div className="flex-1 flex overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
                <div className={cn("flex-1 overflow-y-auto p-8 pt-4 transition-all duration-500 ease-in-out", selectedModel ? "w-1/2 pr-4" : "w-full")}>
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-10 space-y-4">
                            <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-muted-foreground typo-caption animate-pulse">{t('frontend.modelExplorer.searching')}</p>
                        </div>
                    )}

                    {!loading && displayModels.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <IconSearch className="w-12 h-12 mb-4 opacity-20" />
                            <p>{t('frontend.modelExplorer.noModels')}</p>
                        </div>
                    )}

                    <div className={cn("grid gap-8 pb-12 transition-all duration-700", selectedModel ? "grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6")}>
                        {displayModels.map(m => (
                            <ModelCard
                                key={`${m.provider}-${m.provider === 'ollama' ? (m as OllamaLibraryModel).name : (m as HFModel).id}`}
                                model={m}
                                isSelected={selectedModel !== null && selectedModel.provider === m.provider && (m.provider === 'ollama' ? (m as OllamaLibraryModel).name === (selectedModel as OllamaLibraryModel).name : (m as HFModel).id === (selectedModel as HFModel).id)}
                                isInstalled={isInstalled(m.provider === 'ollama' ? (m as OllamaLibraryModel).name : (m as HFModel).id)}
                                isRecommended={m.provider === 'huggingface' && recommendedIds.has((m as HFModel).id)}
                                isWatchlisted={m.provider === 'huggingface' && watchlist.has((m as HFModel).id)}
                                onSelect={handleModelSelect}
                                t={t}
                            />
                        ))}
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {selectedModel && (
                        <ModelDetailsPanel
                            selectedModel={selectedModel}
                            setSelectedModel={setSelectedModel}
                            loadingFiles={loadingFiles}
                            files={files}
                            modelsDir={modelsDir}
                            downloading={downloading}
                            handleDownloadHF={handleDownloadHF}
                            handlePullOllama={handlePullOllama}
                            pullingOllama={pullingOllama}
                            modelPreview={modelPreview}
                            isWatchlisted={selectedModel.provider === 'huggingface' && watchlist.has((selectedModel as HFModel).id)}
                            toggleWatchlist={toggleWatchlist}
                            toggleComparison={toggleComparison}
                            isInComparison={selectedModel.provider === 'huggingface' && comparisonIds.includes((selectedModel as HFModel).id)}
                            comparisonCount={comparisonIds.length}
                            installTests={installTests}
                            lastInstallConfig={lastInstallConfig}
                            t={t}
                        />
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

