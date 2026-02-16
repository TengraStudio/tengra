import { ChevronLeft, ChevronRight, Clock, Download, Layers, LayoutGrid, List, RefreshCw, Search } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { DbMarketplaceModel } from '@/electron';
import { AnimatePresence } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { dismissNotification, pushNotification } from '@/store/notification-center.store';

import { HFFile, HFModel, UnifiedModel } from '../types';

import { ModelDetailsPanel } from './ModelDetailsPanel';

interface MarketplaceGridProps {
    t: (key: string) => string;
}

type SortOption = 'pulls' | 'name' | 'updated' | 'tags';
type ProviderFilter = 'all' | 'ollama' | 'huggingface';
type ViewMode = 'compact' | 'comfortable' | 'list';

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

function formatCompactNumber(value: number): string {
    if (!Number.isFinite(value)) {
        return '0';
    }
    return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function normalizeCategory(value: string): string {
    return value.trim().toLowerCase();
}

export function MarketplaceGrid({ t }: MarketplaceGridProps): React.ReactElement {
    const MODELS_PER_PAGE = 48;
    const [models, setModels] = useState<DbMarketplaceModel[]>([]);
    const [installedOllamaModels, setInstalledOllamaModels] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('pulls');
    const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [viewMode, setViewMode] = useState<ViewMode>('comfortable');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<DbMarketplaceModel | null>(null);
    const [detailedModel, setDetailedModel] = useState<UnifiedModel | null>(null);
    const [selectedHfModelId, setSelectedHfModelId] = useState<string | null>(null);
    const [hfFiles, setHfFiles] = useState<HFFile[]>([]);
    const [modelsDir, setModelsDir] = useState<string>('');
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [pullProgress, setPullProgress] = useState<Record<string, { status: string; total?: number; completed?: number }>>({});
    const [pullingModel, setPullingModel] = useState<string | null>(null);
    const [hfDownloading, setHfDownloading] = useState<Record<string, { received: number; total: number }>>({});
    const [activeDownloads, setActiveDownloads] = useState<Record<string, { downloadId: string; status: string }>>({});
    const progressToastThrottleRef = useRef<Record<string, number>>({});

    const formatBytes = (bytes: number): string => {
        if (!Number.isFinite(bytes) || bytes <= 0) {
            return '0 B';
        }
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let val = bytes;
        let idx = 0;
        while (val >= 1024 && idx < units.length - 1) {
            val /= 1024;
            idx += 1;
        }
        return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
    };

    // Load models from database
    const loadModels = useCallback(async (provider: ProviderFilter = 'all') => {
        setLoading(true);
        try {
            const pageSize = 1000;
            const maxPages = 10;
            const merged: DbMarketplaceModel[] = [];
            for (let page = 0; page < maxPages; page += 1) {
                const chunk = await window.electron.marketplace.getModels(
                    provider === 'all' ? undefined : provider,
                    pageSize,
                    page * pageSize
                );
                merged.push(...chunk);
                if (chunk.length < pageSize) {
                    break;
                }
            }
            const deduped = Array.from(new Map(merged.map(item => [item.id, item])).values());
            setModels(deduped);
        } catch (err) {
            window.electron.log.error('Failed to load marketplace models:', err);
            setError('Failed to load models. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadInstalledOllamaModels = useCallback(async () => {
        try {
            const allModels = await window.electron.modelRegistry.getAllModels();
            const installed = allModels
                .filter(m => m.provider === 'ollama')
                .map(m => (m.id || m.name || '').replace(/^ollama\//i, '').trim().toLowerCase())
                .filter(Boolean);
            setInstalledOllamaModels(new Set(installed));
        } catch (err) {
            window.electron.log.error('Failed to load installed Ollama models:', err);
        }
    }, []);

    // Refresh models from database
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await loadModels(providerFilter);
        } catch (err) {
            window.electron.log.error('Failed to refresh marketplace:', err);
        } finally {
            setRefreshing(false);
        }
    }, [loadModels, providerFilter]);

    // Search models
    const handleSearch = useCallback(async (query: string) => {
        setSearchQuery(query);
        setCurrentPage(1);
        if (!query.trim()) {
            await loadModels(providerFilter);
            return;
        }
        try {
            const results = await window.electron.marketplace.searchModels(
                query,
                providerFilter === 'all' ? undefined : providerFilter,
                100
            );
            setModels(results);
        } catch (err) {
            window.electron.log.error('Failed to search marketplace:', err);
        }
    }, [loadModels, providerFilter]);

    // Initial load
    useEffect(() => {
        void loadModels('all');
        void loadInstalledOllamaModels();
        void window.electron.llama.getModelsDir().then(setModelsDir).catch(() => setModelsDir(''));

        const removeListener = window.electron.ipcRenderer.on('model-downloader:progress', (_event, payload) => {
            const progress = payload as {
                downloadId: string;
                provider: 'ollama' | 'huggingface';
                status: 'queued' | 'starting' | 'downloading' | 'installing' | 'paused' | 'cancelled' | 'completed' | 'error';
                modelRef: string;
                received?: number;
                total?: number;
                outputPath?: string;
                message?: string;
            };

            setActiveDownloads(prev => {
                if (progress.status === 'completed' || progress.status === 'error' || progress.status === 'cancelled') {
                    const next = { ...prev };
                    delete next[progress.modelRef];
                    return next;
                }
                return {
                    ...prev,
                    [progress.modelRef]: { downloadId: progress.downloadId, status: progress.status }
                };
            });

            if (progress.provider === 'ollama') {
                setPullProgress(prev => ({
                    ...prev,
                    [progress.modelRef]: {
                        status: progress.status,
                        total: progress.total,
                        completed: progress.received,
                    }
                }));
                if (progress.status === 'completed') {
                    setPullingModel(prev => (prev === progress.modelRef ? null : prev));
                    void loadInstalledOllamaModels();
                } else if (progress.status === 'error' || progress.status === 'cancelled') {
                    setPullingModel(prev => (prev === progress.modelRef ? null : prev));
                }
            } else if (
                progress.modelRef
                && typeof progress.total === 'number'
                && typeof progress.received === 'number'
            ) {
                setHfDownloading(prev => ({
                    ...prev,
                    [progress.modelRef]: {
                        received: progress.received as number,
                        total: progress.total as number,
                    }
                }));
            }

            const now = Date.now();
            const last = progressToastThrottleRef.current[progress.downloadId] || 0;
            const shouldRenderProgressToast = now - last > 800 || progress.status === 'completed' || progress.status === 'error';
            if (shouldRenderProgressToast) {
                progressToastThrottleRef.current[progress.downloadId] = now;

                if (progress.status === 'completed') {
                    pushNotification({
                        id: `download-${progress.downloadId}`,
                        type: 'success',
                        message: `${progress.provider.toUpperCase()} download completed: ${progress.modelRef}`,
                        durationMs: 5000,
                    });
                    if (progress.provider === 'huggingface') {
                        setHfDownloading(prev => {
                            const next = { ...prev };
                            delete next[progress.modelRef];
                            return next;
                        });
                    }
                } else if (progress.status === 'cancelled') {
                    pushNotification({
                        id: `download-${progress.downloadId}`,
                        type: 'info',
                        message: `${progress.provider.toUpperCase()} download cancelled: ${progress.modelRef}`,
                        durationMs: 5000,
                    });
                    if (progress.provider === 'huggingface') {
                        setHfDownloading(prev => {
                            const next = { ...prev };
                            delete next[progress.modelRef];
                            return next;
                        });
                    }
                } else if (progress.status === 'error') {
                    pushNotification({
                        id: `download-${progress.downloadId}`,
                        type: 'error',
                        message: progress.message || `${progress.provider.toUpperCase()} download failed`,
                        durationMs: 7000,
                    });
                } else {
                    const remaining = progress.total && progress.received !== undefined
                        ? Math.max(0, progress.total - progress.received)
                        : undefined;
                    pushNotification({
                        id: `download-${progress.downloadId}`,
                        type: 'info',
                        message: remaining !== undefined
                            ? `${progress.provider.toUpperCase()} downloading: ${formatBytes(remaining)} remaining`
                            : `${progress.provider.toUpperCase()} ${progress.status}...`,
                        durationMs: null,
                    });
                }
            }
            if (progress.status === 'completed' || progress.status === 'error' || progress.status === 'cancelled') {
                setTimeout(() => dismissNotification(`download-${progress.downloadId}`), 1000);
            }
        });

        return () => {
            if (removeListener) {
                removeListener();
            }
        };
     
    }, [loadInstalledOllamaModels, loadModels]);

    useEffect(() => {
        void loadModels(providerFilter);
    }, [loadModels, providerFilter]);

    const isMarketplaceModelInstalled = useCallback((marketplaceName: string): boolean => {
        const normalized = marketplaceName.toLowerCase();
        for (const installed of installedOllamaModels) {
            if (installed === normalized || installed.startsWith(`${normalized}:`)) {
                return true;
            }
        }
        return false;
    }, [installedOllamaModels]);

    // Get unique categories
    const categories = useMemo(() => {
        const cats = new Set<string>();
        if (Array.isArray(models)) {
            models.forEach(m => {
                if (Array.isArray(m.categories)) {
                    m.categories.forEach(c => cats.add(normalizeCategory(c)));
                }
            });
        }
        return Array.from(cats).sort();
    }, [models]);

    // Filter and sort models
    const filteredModels = useMemo(() => {
        if (!Array.isArray(models)) {
            return [];
        }
        let result = [...models];

        // Filter by category
        if (selectedCategory) {
            const selected = normalizeCategory(selectedCategory);
            result = result.filter(m => (m.categories || []).some(c => normalizeCategory(c) === selected));
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

    const totalPages = Math.max(1, Math.ceil(filteredModels.length / MODELS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const pagedModels = useMemo(() => {
        const start = (safePage - 1) * MODELS_PER_PAGE;
        return filteredModels.slice(start, start + MODELS_PER_PAGE);
    }, [filteredModels, safePage]);

    useEffect(() => {
        if (currentPage !== safePage) {
            setCurrentPage(safePage);
        }
    }, [currentPage, safePage]);

    // Handle model select
    const handleModelSelect = useCallback(async (model: DbMarketplaceModel) => {
        setSelectedModel(model);
        setLoadingDetails(true);
        setHfFiles([]);
        setSelectedHfModelId(null);
        try {
            const details = await window.electron.marketplace.getModelDetails(model.name, model.provider);
            const isOllamaDetails = details !== null && 'versions' in details;
            if (model.provider === 'huggingface') {
                const [author, ...rest] = model.name.split('/');
                const hfName = rest.length > 0 ? rest.join('/') : model.name;
                const files = await window.electron.huggingface.getFiles(model.name);
                setSelectedHfModelId(model.name);
                setHfFiles(files);
                setDetailedModel({
                    id: model.name,
                    name: hfName,
                    author: model.author || author || 'unknown',
                    description: details?.shortDescription || model.shortDescription || '',
                    downloads: model.downloads || 0,
                    likes: model.likes || 0,
                    tags: model.categories || [],
                    lastModified: model.lastUpdated || new Date(model.updatedAt).toISOString(),
                    longDescriptionMarkdown: details && !isOllamaDetails && 'longDescriptionMarkdown' in details
                        ? details.longDescriptionMarkdown
                        : '',
                    provider: 'huggingface',
                } as HFModel);
            } else {
                setDetailedModel({
                    name: model.name,
                    description: details?.shortDescription || model.shortDescription || '',
                    tags: isOllamaDetails ? details.versions.map(v => v.version) : [],
                    provider: 'ollama',
                    pulls: model.pulls,
                    lastUpdated: model.lastUpdated,
                    longDescriptionHtml: isOllamaDetails ? details.longDescriptionHtml : '',
                    versions: isOllamaDetails ? details.versions : []
                });
            }
        } finally {
            setLoadingDetails(false);
        }
    }, []);

    // Handle model download/install
    const handlePullOllama = useCallback(async (modelName: string, tag: string) => {
        const fullModelName = `${modelName}:${tag}`;
        setPullingModel(fullModelName);
        try {
            await window.electron.invoke('model-downloader:start', {
                provider: 'ollama',
                modelName,
                tag,
            });
        } catch (err) {
            window.electron.log.error('Failed to pull model:', err);
            setPullingModel(null);
        }
    }, []);

    const handleRemoveOllama = useCallback(async (fullModelName: string) => {
        try {
            const result = await window.electron.deleteOllamaModel(fullModelName);
            if (!result?.success) {
                window.electron.log.error('Failed to remove Ollama model:', result?.error);
            } else {
                void loadInstalledOllamaModels();
            }
        } catch (err) {
            window.electron.log.error('Failed to remove Ollama model:', err);
        }
    }, [loadInstalledOllamaModels]);

    const handleDownloadHF = useCallback(async (file: HFFile) => {
        if (!selectedHfModelId) {
            return;
        }
        try {
            await window.electron.invoke('model-downloader:start', {
                provider: 'huggingface',
                modelId: selectedHfModelId,
                file,
            });
        } catch (err) {
            window.electron.log.error('Failed to download HuggingFace model:', err);
        }
    }, [selectedHfModelId]);

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

    const handleCancelDownload = useCallback(async (modelRef: string) => {
        const active = activeDownloads[modelRef];
        if (!active) {
            return;
        }
        try {
            await window.electron.invoke('model-downloader:cancel', active.downloadId);
        } catch (err) {
            window.electron.log.error('Failed to cancel download:', err);
        }
    }, [activeDownloads]);

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
                                    setSelectedModel(null);
                                }
                            }}
                            loadingFiles={loadingDetails}
                            files={hfFiles}
                            modelsDir={modelsDir}
                            downloading={{
                                ...Object.entries(pullProgress).reduce((acc, [k, v]) => {
                                acc[k] = { received: v.completed || 0, total: v.total || 0 };
                                return acc;
                                }, {} as Record<string, { received: number, total: number }>),
                                ...hfDownloading
                            }}
                            handleDownloadHF={handleDownloadHF}
                            handlePullOllama={handlePullOllama}
                            handleRemoveOllama={handleRemoveOllama}
                            pullingOllama={pullingModel}
                            activeDownloads={activeDownloads}
                            onPauseDownload={handlePauseDownload}
                            onCancelDownload={handleCancelDownload}
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

