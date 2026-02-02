import { fetchModels, GroupedModels, groupModels, ModelInfo } from '@renderer/features/models/utils/model-fetcher';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { appLogger } from '@main/logging/logger';
import { AppSettings } from '@/types';

export function useModelManager(
    appSettings: AppSettings | null,
    setAppSettings: (settings: AppSettings) => void
) {
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [groupedModels, setGroupedModels] = useState<GroupedModels | null>(null);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [selectedProvider, setSelectedProvider] = useState<string>('');
    const [selectedModels, setSelectedModels] = useState<Array<{ provider: string; model: string }>>([]);
    const [proxyModels, setProxyModels] = useState<ModelInfo[]>([]);
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // PERF-005-1: Cache model fetches to prevent redundant API calls
    const refreshModels = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetched = await fetchModels();
            setModels(fetched);
            // Proxy models are those that are NOT local (ollama) or copilot (usually treated separately but can be considered proxy-like here depending on UI needs)
            // For now, let's include everything that isn't 'ollama' or 'local'
            setProxyModels(fetched.filter(m => m.provider !== 'ollama' && m.provider !== 'local-ai'));
            setGroupedModels(groupModels(fetched));
        } catch (error) {
            appLogger.error('ModelManager', 'Failed to refresh models', error as Error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refreshModels();
    }, [refreshModels]);

    useEffect(() => {
        if (appSettings?.general.defaultModel) {
            setSelectedModel(appSettings.general.defaultModel);
            setSelectedProvider(appSettings.general.lastProvider ?? '');
            
            // Initialize selectedModels with the default model if not already set
            if (selectedModels.length === 0) {
                setSelectedModels([{
                    provider: appSettings.general.lastProvider ?? '',
                    model: appSettings.general.defaultModel
                }]);
            }
        }
    }, [appSettings, selectedModels.length]);

    const handleSelectModel = useCallback((provider: string, model: string, isMultiSelect = false) => {
        if (!appSettings) { return; }
        
        if (isMultiSelect) {
            setSelectedModels(prev => {
                // Check if already selected
                const exists = prev.some(m => m.provider === provider && m.model === model);
                if (exists) {
                    return prev; // Prevent duplicates
                }
                
                // Enforce max 4 models
                if (prev.length >= 4) {
                    return prev;
                }
                
                return [...prev, { provider, model }];
            });
        } else {
            // Single selection - replace all
            setSelectedModel(model);
            setSelectedProvider(provider);
            setSelectedModels([{ provider, model }]);
            setAppSettings({
                ...appSettings,
                general: {
                    ...appSettings.general,
                    defaultModel: model,
                    lastProvider: provider
                }
            });
            setIsModelMenuOpen(false);
        }
    }, [appSettings, setAppSettings]);
    
    const removeSelectedModel = useCallback((provider: string, model: string) => {
        setSelectedModels(prev => {
            const filtered = prev.filter(m => !(m.provider === provider && m.model === model));
            // If we removed the last one, keep at least one selected
            if (filtered.length === 0 && prev.length > 0) {
                return prev;
            }
            // Update primary selection to the first remaining model
            if (filtered.length > 0) {
                setSelectedModel(filtered[0].model);
                setSelectedProvider(filtered[0].provider);
            }
            return filtered;
        });
    }, []);
    
    const clearMultiSelection = useCallback(() => {
        if (selectedModels.length > 0) {
            const first = selectedModels[0];
            setSelectedModels([first]);
            setSelectedModel(first.model);
            setSelectedProvider(first.provider);
        }
    }, [selectedModels]);

    const persistLastSelection = useCallback((provider: string, model: string) => {
        if (!appSettings) { return; }
        setAppSettings({
            ...appSettings,
            general: {
                ...appSettings.general,
                defaultModel: model,
                lastProvider: provider
            }
        });
    }, [appSettings, setAppSettings]);

    const toggleFavorite = useCallback((modelId: string) => {
        if (!appSettings) { return; }
        const currentFavorites = appSettings.general.favoriteModels ?? [];
        const isFav = currentFavorites.includes(modelId);

        let newFavorites: string[];
        if (isFav) {
            newFavorites = currentFavorites.filter(id => id !== modelId);
        } else {
            newFavorites = [...currentFavorites, modelId];
        }

        setAppSettings({
            ...appSettings,
            general: {
                ...appSettings.general,
                favoriteModels: newFavorites
            }
        });
    }, [appSettings, setAppSettings]);

    const isFavorite = useCallback((modelId: string) => {
        return appSettings?.general.favoriteModels?.includes(modelId) ?? false;
    }, [appSettings]);

    return useMemo(() => ({
        models,
        groupedModels,
        selectedModel,
        setSelectedModel,
        selectedProvider,
        setSelectedProvider,
        selectedModels,
        setSelectedModels,
        removeSelectedModel,
        clearMultiSelection,
        proxyModels,
        isModelMenuOpen,
        setIsModelMenuOpen,
        isLoading,
        refreshModels,
        loadModels: refreshModels,
        handleSelectModel,
        persistLastSelection,
        toggleFavorite,
        isFavorite
    }), [
        models, groupedModels, selectedModel, selectedProvider, selectedModels,
        proxyModels, isModelMenuOpen, isLoading, refreshModels, handleSelectModel,
        persistLastSelection, toggleFavorite, isFavorite, removeSelectedModel, clearMultiSelection
    ]);
}
