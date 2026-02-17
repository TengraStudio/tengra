import { useCallback, useEffect, useRef, useState } from 'react';

import type { DbMarketplaceModel } from '@/electron';
import { pushNotification } from '@/store/notification-center.store';

type ProviderFilter = 'all' | 'ollama' | 'huggingface';

/**
 * Hook for loading and managing marketplace models
 */
export function useMarketplaceModels() {
    const [models, setModels] = useState<DbMarketplaceModel[]>([]);
    const [installedOllamaModels, setInstalledOllamaModels] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

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

    const handleRefresh = useCallback(async (providerFilter: ProviderFilter) => {
        setRefreshing(true);
        try {
            await loadModels(providerFilter);
        } catch (err) {
            window.electron.log.error('Failed to refresh marketplace:', err);
        } finally {
            setRefreshing(false);
        }
    }, [loadModels]);

    const handleSearch = useCallback(async (query: string, providerFilter: ProviderFilter) => {
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
    }, [loadModels]);

    return {
        models,
        installedOllamaModels,
        loading,
        error,
        setError,
        refreshing,
        loadModels,
        loadInstalledOllamaModels,
        handleRefresh,
        handleSearch,
    };
}

/**
 * Hook for managing model download progress
 */
export function useModelDownloadProgress(loadInstalledOllamaModels: () => Promise<void>) {
    const [pullProgress, setPullProgress] = useState<Record<string, { status: string; total?: number; completed?: number }>>({});
    const [pullingModel, setPullingModel] = useState<string | null>(null);
    const [hfDownloading, setHfDownloading] = useState<Record<string, { received: number; total: number }>>({});
    const [activeDownloads, setActiveDownloads] = useState<Record<string, { downloadId: string; status: string }>>({});
    const progressToastThrottleRef = useRef<Record<string, number>>({});

    useEffect(() => {
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
                        type: 'warning',
                        message: `Download cancelled: ${progress.modelRef}`,
                        durationMs: 3000,
                    });
                } else if (progress.status === 'error') {
                    pushNotification({
                        id: `download-${progress.downloadId}`,
                        type: 'error',
                        message: `Download failed: ${progress.modelRef} - ${progress.message || 'Unknown error'}`,
                        durationMs: 8000,
                    });
                }
            }
        });

        return removeListener;
    }, [loadInstalledOllamaModels]);

    return {
        pullProgress,
        pullingModel,
        hfDownloading,
        activeDownloads,
        setPullingModel,
    };
}
