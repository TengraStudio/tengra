import { Clock, Download, Layers,RefreshCw, Search } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { DbMarketplaceModel } from '@/electron';
import { AnimatePresence } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';

import { OllamaLibraryModel } from '../types';

import { ModelDetailsPanel } from './ModelDetailsPanel';

interface MarketplaceGridProps {
    t: (key: string) => string;
}

type SortOption = 'pulls' | 'name' | 'updated' | 'tags';

/**
 * Parse pull count string to number for sorting
 * Handles formats like "1.2M", "500K", "10000"
 */
function parsePullCount(pulls: string | undefined): number {
    if (!pulls) {
        return 0;
    }
    const cleaned = pulls.replace(/[^0-9.KMB]/gi, '').toUpperCase();
    const num = parseFloat(cleaned);
    if (isNaN(num)) {
        return 0;
    }
    if (cleaned.includes('B')) {
        return num * 1_000_000_000;
    }
    if (cleaned.includes('M')) {
        return num * 1_000_000;
    }
    if (cleaned.includes('K')) {
        return num * 1_000;
    }
    return num;
}

export function MarketplaceGrid({ t }: MarketplaceGridProps): React.ReactElement {
    const [models, setModels] = useState<DbMarketplaceModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('pulls');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<DbMarketplaceModel | null>(null);
    const [detailedModel, setDetailedModel] = useState<OllamaLibraryModel | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [pullProgress, setPullProgress] = useState<Record<string, { status: string; total?: number; completed?: number }>>({});
    const [pullingModel, setPullingModel] = useState<string | null>(null);

    // Load models from database
    const loadModels = useCallback(async () => {
        setLoading(true);
        try {
            const data = await window.electron.marketplace.getModels('ollama', 500);
            setModels(data);
        } catch (err) {
            window.electron.log.error('Failed to load marketplace models:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Refresh models (scrape and store)
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const result = await window.electron.marketplace.refresh();
            if (result.success) {
                await loadModels();
            }
        } catch (err) {
            window.electron.log.error('Failed to refresh marketplace:', err);
        } finally {
            setRefreshing(false);
        }
    }, [loadModels]);

    // Search models
    const handleSearch = useCallback(async (query: string) => {
        setSearchQuery(query);
        if (!query.trim()) {
            await loadModels();
            return;
        }
        try {
            const results = await window.electron.marketplace.searchModels(query, 'ollama', 100);
            setModels(results);
        } catch (err) {
            window.electron.log.error('Failed to search marketplace:', err);
        }
    }, [loadModels]);

    // Initial load
    useEffect(() => {
        void loadModels();

        // Listen for pull progress
        const removeListener = window.electron.onPullProgress?.((progress) => {
            const { modelName, status, completed, total } = progress;
            setPullProgress(prev => ({
                ...prev,
                [modelName || '']: { status, completed, total }
            }));

            if (status === 'success' || status === 'error') {
                if (pullingModel === modelName) {
                    setPullingModel(null);
                }
            }
        });

        return () => {
            if (removeListener) {
                removeListener();
            }
        };
    }, [loadModels, pullingModel]);

    // Get unique categories
    const categories = useMemo(() => {
        const cats = new Set<string>();
        models.forEach(m => m.categories.forEach(c => cats.add(c)));
        return Array.from(cats).sort();
    }, [models]);

    // Filter and sort models
    const filteredModels = useMemo(() => {
        let result = [...models];

        // Filter by category
        if (selectedCategory) {
            result = result.filter(m => m.categories.includes(selectedCategory));
        }

        // Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case 'pulls':
                    return parsePullCount(b.pulls) - parsePullCount(a.pulls);
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'updated':
                    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
                case 'tags':
                    return (b.tagCount ?? 0) - (a.tagCount ?? 0);
                default:
                    return 0;
            }
        });

        return result;
    }, [models, selectedCategory, sortBy]);

    // Handle model select
    const handleModelSelect = useCallback(async (model: DbMarketplaceModel) => {
        setSelectedModel(model);
        setLoadingDetails(true);
        try {
            const details = await window.electron.marketplace.getModelDetails(model.name);
            if (details) {
                setDetailedModel({
                    name: details.name,
                    description: details.shortDescription || model.shortDescription || '',
                    tags: details.versions.map((v) => v.name),
                    provider: 'ollama',
                    pulls: model.pulls
                });
            }
        } catch (err) {
            window.electron.log.error('Failed to get model details:', err);
        } finally {
            setLoadingDetails(false);
        }
    }, []);

    // Handle model download/install
    const handlePullOllama = useCallback(async (modelName: string, tag: string) => {
        const fullModelName = `${modelName}:${tag}`;
        setPullingModel(fullModelName);
        try {
            await window.electron.invoke('ollama:pull', modelName);
        } catch (err) {
            window.electron.log.error('Failed to pull model:', err);
            setPullingModel(null);
        }
    }, []);

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

                {/* Sort */}
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="px-4 py-2.5 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                    <option value="pulls">{t('marketplace.sortByPulls')}</option>
                    <option value="name">{t('marketplace.sortByName')}</option>
                    <option value="updated">{t('marketplace.sortByUpdated')}</option>
                    <option value="tags">{t('marketplace.sortByTags')}</option>
                </select>

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
                        onClick={() => setSelectedCategory(null)}
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
                            onClick={() => setSelectedCategory(cat)}
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
            </div>

            {/* Models Grid */}
            <div className="flex gap-6">
                <div className={cn("flex-1 transition-all duration-300", selectedModel ? "w-1/2" : "w-full")}>
                    {filteredModels.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <p className="text-sm">{t('modelsPage.noModelsFound')}</p>
                        </div>
                    ) : (
                        <div className={cn(
                            "grid gap-4 transition-all duration-500",
                            selectedModel
                                ? "grid-cols-1 xl:grid-cols-2"
                                : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                        )}>
                            {filteredModels.map(model => (
                                <MarketplaceModelCard
                                    key={model.id}
                                    model={model}
                                    isSelected={selectedModel?.id === model.id}
                                    onSelect={() => void handleModelSelect(model)}
                                    t={t}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <AnimatePresence>
                    {selectedModel && (
                        <ModelDetailsPanel
                            selectedModel={detailedModel || ({
                                name: selectedModel.name,
                                description: selectedModel.shortDescription || '',
                                tags: [],
                                provider: 'ollama',
                                pulls: selectedModel.pulls
                            } as OllamaLibraryModel)}
                            setSelectedModel={(m) => {
                                if (!m) {
                                    setSelectedModel(null);
                                }
                            }}
                            loadingFiles={loadingDetails}
                            files={[]}
                            modelsDir=""
                            downloading={Object.entries(pullProgress).reduce((acc, [k, v]) => {
                                acc[k] = { received: v.completed || 0, total: v.total || 0 };
                                return acc;
                            }, {} as Record<string, { received: number, total: number }>)}
                            handleDownloadHF={() => { }}
                            handlePullOllama={handlePullOllama}
                            pullingOllama={pullingModel}
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
    isSelected?: boolean;
    onSelect: () => void;
    t: (key: string) => string;
}

function MarketplaceModelCard({ model, isSelected, onSelect, t }: MarketplaceModelCardProps): React.ReactElement {
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
                    <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                        {model.name}
                    </h3>
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

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {model.pulls && (
                    <div className="flex items-center gap-1" title={t('marketplace.pulls')}>
                        <Download className="w-3 h-3" />
                        <span>{model.pulls}</span>
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
            {model.categories.length > 0 && (
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

