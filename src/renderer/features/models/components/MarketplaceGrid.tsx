import { ChevronLeft, ChevronRight, Clock, Download, Layers, LayoutGrid, List, RefreshCw, Search } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import type { DbMarketplaceModel } from '@/electron';
import { AnimatePresence } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

import { HFFile, UnifiedModel } from '../types';

import { ModelDetailsPanel } from './ModelDetailsPanel';
import { useMarketplaceModels, useModelDownloadProgress } from './useMarketplaceModels';
import { useModelFiltering, usePagination } from './useModelFiltering';
import { useModelOperations } from './useModelOperations';

interface MarketplaceGridProps {
    t: (key: string) => string;
}

type SortOption = 'pulls' | 'name' | 'updated' | 'tags';
type ProviderFilter = 'all' | 'ollama' | 'huggingface';
type ViewMode = 'compact' | 'comfortable' | 'list';

function formatCompactNumber(value: number): string {
    if (!Number.isFinite(value)) {
        return '0';
    }
    return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function MarketplaceGrid({ t }: MarketplaceGridProps): React.ReactElement {
    const MODELS_PER_PAGE = 48;
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('pulls');
    const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [viewMode, setViewMode] = useState<ViewMode>('comfortable');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [modelsDir, setModelsDir] = useState<string>('');

    // Custom hooks
    const {
        models,
        installedOllamaModels,
        loading,
        error,
        setError,
        refreshing,
        loadModels,
        loadInstalledOllamaModels,
        handleRefresh: refreshModels,
        handleSearch: searchModels,
    } = useMarketplaceModels();

    const {
        pullProgress,
        pullingModel,
        hfDownloading,
        activeDownloads,
        setPullingModel,
    } = useModelDownloadProgress(loadInstalledOllamaModels);

    const {
        selectedModel,
        detailedModel,
        selectedHfModelId,
        hfFiles,
        loadingDetails,
        handleModelSelect,
        handlePullOllama: pullOllama,
        handleRemoveOllama,
        handleDownloadHF: downloadHF,
        handleCancelDownload: cancelDownload,
        handleCloseDetails,
    } = useModelOperations(loadInstalledOllamaModels);

    const { categories, filteredModels } = useModelFiltering(models, selectedCategory, sortBy);
    const { totalPages, safePage, pagedModels } = usePagination(filteredModels, MODELS_PER_PAGE, currentPage);

    const handleRefresh = useCallback(async () => {
        await refreshModels(providerFilter);
    }, [refreshModels, providerFilter]);

    const handleSearch = useCallback(async (query: string) => {
        setSearchQuery(query);
        setCurrentPage(1);
        await searchModels(query, providerFilter);
    }, [searchModels, providerFilter]);

    const handlePullOllama = useCallback(async (modelName: string, tag: string) => {
        const fullModelName = await pullOllama(modelName, tag);
        if (fullModelName) {
            setPullingModel(fullModelName);
        }
    }, [pullOllama, setPullingModel]);

    const handleDownloadHF = useCallback(async (file: HFFile) => {
        if (selectedHfModelId) {
            await downloadHF(file, selectedHfModelId);
        }
    }, [downloadHF, selectedHfModelId]);

    const handlePauseDownload = useCallback(async (modelRef: string) => {
        const active = activeDownloads[modelRef];
        if (!active) {
            return;
        }
        try {
            await window.electron.invoke('model-downloader:pause', active.downloadId);
        } catch (err) {
            window.electron.log.error('Failed to pause download:', err);
        }
    }, [activeDownloads]);

    const handleCancelDownloadByRef = useCallback(async (modelRef: string) => {
        const active = activeDownloads[modelRef];
        if (active) {
            await cancelDownload(active.downloadId);
        }
    }, [activeDownloads, cancelDownload]);

    const handleResumeDownload = useCallback(async (modelRef: string) => {
        const active = activeDownloads[modelRef];
        if (!active) {
            return;
        }
        try {
            await window.electron.invoke('model-downloader:resume', active.downloadId);
        } catch (err) {
            window.electron.log.error('Failed to resume download:', err);
        }
    }, [activeDownloads]);

    const isMarketplaceModelInstalled = useCallback((marketplaceName: string): boolean => {
        const normalized = marketplaceName.toLowerCase();
        for (const installed of installedOllamaModels) {
            if (installed === normalized || installed.startsWith(`${normalized}:`)) {
                return true;
            }
        }
        return false;
    }, [installedOllamaModels]);

    // Initial load
    useEffect(() => {
        void loadModels('all');
        void loadInstalledOllamaModels();
        void window.electron.llama.getModelsDir().then(setModelsDir).catch(() => setModelsDir(''));
    }, [loadModels, loadInstalledOllamaModels]);

    useEffect(() => {
        void loadModels(providerFilter);
    }, [loadModels, providerFilter]);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span className="text-sm">{t('modelsPage.loadingModels')}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Error Message */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-center justify-between">
                    <span className="text-sm font-medium">{error}</span>
                    <button
                        onClick={() => { setError(null); void loadModels(); }}
                        className="text-xs hover:underline"
                    >
                        {t('common.retry') || 'Retry'}
                    </button>
                </div>
            )}

            {/* Search and Controls */}
            <div className="flex items-center gap-4">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => void handleSearch(e.target.value)}
                        placeholder={t('modelsPage.searchPlaceholder')}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                    />
                </div>

                {/* Provider Filter */}
                <select
                    value={providerFilter}
                    onChange={(e) => {
                        setProviderFilter(e.target.value as ProviderFilter);
                        setCurrentPage(1);
                    }}
                    className="px-4 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                    <option value="all">All Providers</option>
                    <option value="ollama">Ollama</option>
                    <option value="huggingface">HuggingFace</option>
                </select>

                {/* Sort */}
                <select
                    value={sortBy}
                    onChange={(e) => {
                        setSortBy(e.target.value as SortOption);
                        setCurrentPage(1);
                    }}
                    className="px-4 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                    <option value="pulls">{t('marketplace.sortByPulls')}</option>
                    <option value="name">{t('marketplace.sortByName')}</option>
                    <option value="updated">{t('marketplace.sortByUpdated')}</option>
                    <option value="tags">{t('marketplace.sortByTags')}</option>
                </select>

                <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/30 border border-border/50">
                    <button
                        onClick={() => setViewMode('compact')}
                        className={cn(
                            'p-2 rounded-md transition-colors',
                            viewMode === 'compact' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted/50'
                        )}
                        title="Compact Grid"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('comfortable')}
                        className={cn(
                            'p-2 rounded-md transition-colors',
                            viewMode === 'comfortable' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted/50'
                        )}
                        title="Comfortable Grid"
                    >
                        <Layers className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={cn(
                            'p-2 rounded-md transition-colors',
                            viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted/50'
                        )}
                        title="List"
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>

                {/* Refresh */}
                <button
                    onClick={() => void handleRefresh()}
                    disabled={refreshing}
                    className={cn(
                        "px-4 py-2.5 rounded-lg border text-sm font-medium transition-all flex items-center gap-2",
                        refreshing
                            ? "bg-muted/30 text-muted-foreground border-border/30 cursor-not-allowed"
                            : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                    )}
                >
                    <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                    {t('modelsPage.refresh')}
                </button>
            </div>

            {/* Categories */}
            {categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => {
                            setSelectedCategory(null);
                            setCurrentPage(1);
                        }}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                            selectedCategory === null
                                ? "bg-primary/20 text-primary border-primary/30"
                                : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50"
                        )}
                    >
                        {t('marketplace.allCategories')}
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => {
                                setSelectedCategory(cat);
                                setCurrentPage(1);
                            }}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                                selectedCategory === cat
                                    ? "bg-primary/20 text-primary border-primary/30"
                                    : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{filteredModels.length} {t('modelsPage.modelsAvailable')}</span>
                {filteredModels.length > 0 && (
                    <span>
                        Page {safePage}/{totalPages}
                    </span>
                )}
            </div>

            {/* Models Grid */}
            <div className="flex gap-6">
                <div className={cn("flex-1 transition-all duration-300", selectedModel ? "w-1/2" : "w-full")}>
                    {filteredModels.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <p className="text-sm">{t('modelsPage.noModelsFound')}</p>
                        </div>
                    ) : (
                        <>
                            <div className={cn(
                                "grid gap-4 transition-all duration-500",
                                viewMode === 'list'
                                    ? 'grid-cols-1'
                                    : selectedModel
                                        ? (viewMode === 'compact' ? 'grid-cols-1 xl:grid-cols-3' : 'grid-cols-1 xl:grid-cols-2')
                                        : (viewMode === 'compact' ? 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')
                            )}>
                                {pagedModels.map(model => (
                                    <MarketplaceModelCard
                                        key={model.id}
                                        model={model}
                                        isInstalled={model.provider === 'ollama' && isMarketplaceModelInstalled(model.name)}
                                        isSelected={selectedModel?.id === model.id}
                                        onSelect={() => void handleModelSelect(model)}
                                        t={t}
                                    />
                                ))}
                            </div>
                            {totalPages > 1 && (
                                <div className="mt-4 flex items-center justify-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={safePage <= 1}
                                        className="px-3 py-1.5 rounded-lg border border-border/50 bg-muted/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs text-muted-foreground px-2">Page {safePage} / {totalPages}</span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={safePage >= totalPages}
                                        className="px-3 py-1.5 rounded-lg border border-border/50 bg-muted/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <AnimatePresence>
                    {selectedModel && (
                        <ModelDetailsPanel
                            selectedModel={detailedModel || ({
                                name: selectedModel.name,
                                description: selectedModel.shortDescription || '',
                                tags: [],
                                provider: selectedModel.provider,
                                pulls: selectedModel.pulls,
                                id: selectedModel.name,
                                author: selectedModel.author || 'unknown',
                                downloads: selectedModel.downloads || 0,
                                likes: selectedModel.likes || 0,
                                lastModified: selectedModel.lastUpdated || new Date(selectedModel.updatedAt).toISOString(),
                            } as UnifiedModel)}
                            setSelectedModel={(m) => {
                                if (!m) {
                                    handleCloseDetails();
                                }
                            }}
                            loadingFiles={loadingDetails}
                            files={hfFiles}
                            modelsDir={modelsDir}
                            downloading={{
                                ...Object.entries(pullProgress).reduce((acc, [k, v]) => {
                                    acc[k] = { received: v.completed || 0, total: v.total || 0 };
                                    return acc;
                                }, {} as Record<string, { received: number; total: number }>),
                                ...hfDownloading
                            }}
                            handleDownloadHF={handleDownloadHF}
                            handlePullOllama={handlePullOllama}
                            handleRemoveOllama={handleRemoveOllama}
                            pullingOllama={pullingModel}
                            activeDownloads={activeDownloads}
                            onPauseDownload={handlePauseDownload}
                            onCancelDownload={handleCancelDownloadByRef}
                            onResumeDownload={handleResumeDownload}
                            installedOllamaModels={installedOllamaModels}
                            t={t}
                        />
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

interface MarketplaceModelCardProps {
    model: DbMarketplaceModel;
    isInstalled?: boolean;
    isSelected?: boolean;
    onSelect: () => void;
    t: (key: string) => string;
}

function MarketplaceModelCard({ model, isInstalled = false, isSelected, onSelect, t }: MarketplaceModelCardProps): React.ReactElement {
    return (
        <div
            onClick={onSelect}
            className={cn(
                "group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer",
                isSelected
                    ? "bg-primary/10 border-primary shadow-lg"
                    : "border-border/50 bg-card/50 hover:bg-card hover:border-border hover:shadow-lg"
            )}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                            {model.name}
                        </h3>
                        {isInstalled && (
                            <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                                Installed
                            </span>
                        )}
                    </div>
                    {model.shortDescription && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {model.shortDescription}
                        </p>
                    )}
                </div>
                <button
                    className={cn(
                        "p-2 rounded-lg transition-all shrink-0",
                        "bg-muted/50 text-muted-foreground hover:bg-primary/20 hover:text-primary"
                    )}
                    title={t('marketplace.details')}
                >
                    <Layers className="w-4 h-4" />
                </button>
            </div>

            <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-2">
                {model.provider}
            </div>

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {model.pulls && (
                    <div className="flex items-center gap-1" title={t('marketplace.pulls')}>
                        <Download className="w-3 h-3" />
                        <span>{model.pulls}</span>
                    </div>
                )}
                {model.provider === 'huggingface' && (model.downloads ?? 0) > 0 && (
                    <div className="flex items-center gap-1" title="Downloads">
                        <Download className="w-3 h-3" />
                        <span>{formatCompactNumber(model.downloads ?? 0)}</span>
                    </div>
                )}
                {model.tagCount > 0 && (
                    <div className="flex items-center gap-1" title={t('marketplace.tags')}>
                        <Layers className="w-3 h-3" />
                        <span>{model.tagCount}</span>
                    </div>
                )}
                {model.lastUpdated && (
                    <div className="flex items-center gap-1" title={t('marketplace.lastUpdated')}>
                        <Clock className="w-3 h-3" />
                        <span>{model.lastUpdated}</span>
                    </div>
                )}
            </div>

            {/* Categories */}
            {model.categories && model.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                    {model.categories.slice(0, 3).map(cat => (
                        <span
                            key={cat}
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/50 text-muted-foreground border border-border/30"
                        >
                            {cat}
                        </span>
                    ))}
                    {model.categories.length > 3 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/50 text-muted-foreground">
                            +{model.categories.length - 3}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

