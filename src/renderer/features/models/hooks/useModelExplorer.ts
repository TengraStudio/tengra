/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { HFFile, HFModel, OllamaLibraryModel, UnifiedModel } from '@/features/models/types';
import { parsePulls } from '@/features/models/utils/explorer-utils';
import type { ModelInfo } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

interface UseModelExplorerProps {
    onRefreshModels?: (bypassCache?: boolean) => void;
    installedModels: ModelInfo[];
}

interface HFInstallOptions {
    scheduleAtMs?: number;
    testAfterInstall?: boolean;
    profile?: 'balanced' | 'quality' | 'speed';
}

const getFilteredOllama = (ollamaLibrary: OllamaLibraryModel[], query: string, activeSource: string, page: number): OllamaLibraryModel[] => {
    if (activeSource === 'huggingface' || page > 0) { return []; }

    let filtered = ollamaLibrary;
    if (query) {
        const q = query.toLowerCase();
        filtered = ollamaLibrary.filter(m =>
            m.name.toLowerCase().includes(q) ||
            m.description.toLowerCase().includes(q)
        );
    }
    if (activeSource === 'all' && Array.isArray(filtered) && filtered.length > 12) {
        return [...filtered].sort((a, b) => parsePulls(b.pulls) - parsePulls(a.pulls)).slice(0, 12);
    }
    return Array.isArray(filtered) ? filtered : [];
};

const getSortedModels = (hfResults: HFModel[], filteredOllama: OllamaLibraryModel[], sortBy: string, activeSource: string): UnifiedModel[] => {
    const safeHf = Array.isArray(hfResults) ? hfResults : [];
    const safeOllama = Array.isArray(filteredOllama) ? filteredOllama : [];
    const base = [...safeHf, ...(activeSource === 'all' || activeSource === 'ollama' ? safeOllama : [])];
    return base.sort((a, b) => {
        if (sortBy === 'name') { return a.name.localeCompare(b.name); }
        if (sortBy === 'popularity') {
            const aVal = a.provider === 'huggingface' ? (a as HFModel).downloads : parsePulls((a as OllamaLibraryModel).pulls);
            const bVal = b.provider === 'huggingface' ? (b as HFModel).downloads : parsePulls((b as OllamaLibraryModel).pulls);
            return bVal - aVal;
        }
        if (a.provider === 'huggingface' && b.provider === 'huggingface') {
            return new Date((b as HFModel).lastModified).getTime() - new Date((a as HFModel).lastModified).getTime();
        }
        return 0;
    });
};

export function useModelExplorer({ onRefreshModels, installedModels }: UseModelExplorerProps) {
    const [query, setQuery] = useState('');
    const [activeSource, setActiveSource] = useState<'all' | 'ollama' | 'huggingface'>('all');
    const [sortBy, setSortBy] = useState<'name' | 'popularity' | 'updated'>('popularity');
    const [page, setPage] = useState(0);

    const [ollamaLibrary, setOllamaLibrary] = useState<OllamaLibraryModel[]>([]);
    const [hfResults, setHfResults] = useState<HFModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalHf, setTotalHf] = useState(0);
    const [recommendedIds, setRecommendedIds] = useState<Set<string>>(new Set());
    const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
    const [modelPreview, setModelPreview] = useState<RendererDataValue>(null);
    const [comparisonIds, setComparisonIds] = useState<string[]>([]);
    const [comparisonResult, setComparisonResult] = useState<RendererDataValue>(null);
    const [comparisonLoading, setComparisonLoading] = useState(false);
    const [lastInstallConfig, setLastInstallConfig] = useState<Record<string, HFInstallOptions>>({});
    const [installTests] = useState<Record<string, { success: boolean; message: string }>>({});

    const isInstalled = useMemo(() => {
        const ids = new Set(installedModels.map(m => m.id));
        return (id: string) => ids.has(id);
    }, [installedModels]);

    const [selectedModel, setSelectedModel] = useState<UnifiedModel | null>(null);
    const [files, setFiles] = useState<HFFile[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [downloading, setDownloading] = useState<{ [key: string]: { received: number, total: number } }>({});
    const [modelsDir, setModelsDir] = useState<string>('');
    const [pullingOllama, setPullingOllama] = useState<string | null>(null);

    useEffect(() => {
        void window.electron.ollama.getLibraryModels().then((libs) => {
            const typedLibs = libs.map(l => ({ ...l, provider: 'ollama' as const, pulls: undefined }));
            setOllamaLibrary(typedLibs);
        }).catch(error => {
            appLogger.error('useModelExplorer', 'Failed to load model library', error as Error);
        });
        void window.electron.llama.getModelsDir().then(setModelsDir).catch(error => {
            appLogger.error('useModelExplorer', 'Failed to load models directory', error as Error);
        });

        window.electron.huggingface.onDownloadProgress((p) => {
            setDownloading(prev => ({ ...prev, [p.filename]: { received: p.received, total: p.total } }));
        });
        void window.electron.huggingface.getWatchlist().then((ids) => setWatchlist(new Set(ids))).catch(error => {
            appLogger.error('useModelExplorer', 'Failed to load Hugging Face watchlist', error as Error);
        });

        window.electron.ollama.onPullProgress((progress) => {
            if (progress.status === 'success') {
                setPullingOllama(null);
                onRefreshModels?.(true);
            }
        });

        return () => {
            window.electron.ollama.removePullProgressListener();
        };
    }, [onRefreshModels]);

    const fetchModels = useCallback(async () => {
        setLoading(true);
        try {
            if (activeSource !== 'ollama') {
                const hfSort = sortBy === 'popularity' ? 'downloads' : (sortBy === 'updated' ? 'updated' : 'name');
                const result = await window.electron.huggingface.searchModels(query, 40, page, hfSort);
                setHfResults(result.models.map((r) => ({ ...r, provider: 'huggingface' as const })));
                setTotalHf(result.total);
                if (!query.trim() && page === 0) {
                    const rec = await window.electron.huggingface.getRecommendations(12, '');
                    setRecommendedIds(new Set(rec.map(m => m.id)));
                } else {
                    setRecommendedIds(new Set());
                }
            } else {
                setHfResults([]);
                setTotalHf(0);
                setRecommendedIds(new Set());
            }
        } catch (e) {
            appLogger.error('useModelExplorer', 'Failed to fetch HuggingFace models', e as Error);
            setHfResults([]);
            setRecommendedIds(new Set());
        } finally {
            setLoading(false);
        }
    }, [activeSource, query, page, sortBy]);

    useEffect(() => {
        if (!query && hfResults.length === 0) {
            const timer = setTimeout(() => {
                void fetchModels();
            }, 0);
            return () => clearTimeout(timer);
        }
        const timer = setTimeout(() => { void fetchModels(); }, 500);
        return () => clearTimeout(timer);
    }, [query, hfResults.length, fetchModels]);

    const filteredOllama = useMemo(() => getFilteredOllama(ollamaLibrary, query, activeSource, page), [ollamaLibrary, query, activeSource, page]);
    const displayModels = useMemo(() => getSortedModels(hfResults, filteredOllama, sortBy, activeSource), [hfResults, filteredOllama, sortBy, activeSource]);

    const handleModelSelect = async (model: UnifiedModel) => {
        setSelectedModel(model);
        setModelPreview(null);
        setFiles([]);
        if (model.provider === 'huggingface') {
            setLoadingFiles(true);
            try {
                const fileList = await window.electron.huggingface.getFiles(model.id);
                const filesWithCompatibility = await Promise.all(
                    fileList.map(async (file) => {
                        try {
                            const compatibility = await window.electron.huggingface.validateCompatibility(file);
                            return { ...file, compatibility };
                        } catch {
                            return file;
                        }
                    })
                );
                setFiles(filesWithCompatibility.sort((a, b) => a.size - b.size));
                const preview = await window.electron.huggingface.getModelPreview(model.id);
                setModelPreview(preview);
            } catch (e) { appLogger.error('useModelExplorer', 'Failed to load HuggingFace model files', e as Error); } finally { setLoadingFiles(false); }
        }
    };

    const handlePullOllama = async (modelName: string, tag: string) => {
        const fullModelName = `${modelName}:${tag}`;
        setPullingOllama(fullModelName);
        try {
            await window.electron.ollama.pullModel(fullModelName);
            onRefreshModels?.(true);
        } catch (e) { appLogger.error('useModelExplorer', `Failed to pull Ollama model: ${fullModelName}`, e as Error); } finally { setPullingOllama(null); }
    };

    const handleDownloadHF = async (file: HFFile, options: HFInstallOptions = {}) => {
        if (selectedModel?.provider !== 'huggingface') { return; }
        const downloadKey = `${selectedModel.id}/${file.path}`;

        try {
            setDownloading(prev => ({ ...prev, [downloadKey]: { received: 0, total: file.size } }));
            const res = await window.electron.modelDownloader.start({
                provider: 'huggingface',
                modelId: selectedModel.id,
                file,
                scheduleAtMs: options.scheduleAtMs,
            });

            if (res.success) {
                setLastInstallConfig(prev => ({ ...prev, [selectedModel.id]: options }));
                onRefreshModels?.(true);
            } else {
                setDownloading(prev => {
                    const next = { ...prev };
                    delete next[downloadKey];
                    return next;
                });
            }
        } catch (e) { appLogger.error('useModelExplorer', `Failed to download HuggingFace file: ${file.path}`, e as Error); }
    };

    const toggleComparison = (modelId: string) => {
        setComparisonResult(null);
        setComparisonIds(prev => {
            if (prev.includes(modelId)) {
                return prev.filter(id => id !== modelId);
            }
            if (prev.length >= 4) {
                return [...prev.slice(1), modelId];
            }
            return [...prev, modelId];
        });
    };

    const runComparison = async () => {
        if (comparisonIds.length < 2) {
            return;
        }
        setComparisonLoading(true);
        try {
            const result = await window.electron.huggingface.compareModels(comparisonIds);
            setComparisonResult(result);
        } catch (error) {
            appLogger.error('useModelExplorer', 'Failed to compare HuggingFace models', error as Error);
            setComparisonResult(null);
        } finally {
            setComparisonLoading(false);
        }
    };

    const clearComparison = () => {
        setComparisonIds([]);
        setComparisonResult(null);
    };

    const toggleWatchlist = async (modelId: string) => {
        if (watchlist.has(modelId)) {
            const res = await window.electron.huggingface.removeFromWatchlist(modelId);
            if (res.success) {
                setWatchlist(prev => {
                    const next = new Set(prev);
                    next.delete(modelId);
                    return next;
                });
            }
            return;
        }
        const res = await window.electron.huggingface.addToWatchlist(modelId);
        if (res.success) {
            setWatchlist(prev => new Set(prev).add(modelId));
        }
    };

    return {
        query, setQuery,
        activeSource, setActiveSource,
        sortBy, setSortBy,
        page, setPage,
        loading, hfResults, totalHf, displayModels,
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
        handleModelSelect,
        handlePullOllama,
        handleDownloadHF,
        toggleWatchlist,
        toggleComparison,
        runComparison,
        clearComparison
    };
}

