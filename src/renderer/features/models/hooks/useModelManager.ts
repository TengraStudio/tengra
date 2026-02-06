import { fetchModels, GroupedModels, groupModels, ModelInfo } from '@renderer/features/models/utils/model-fetcher';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AppSettings } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { useModelSelection } from './useModelSelection';

export function useModelManager(
    appSettings: AppSettings | null,
    setAppSettings: (settings: AppSettings) => void
) {
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [groupedModels, setGroupedModels] = useState<GroupedModels | null>(null);
    const [proxyModels, setProxyModels] = useState<ModelInfo[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const selection = useModelSelection(appSettings, setAppSettings);

    const refreshModels = useCallback(async (bypassCache = false) => {
        setIsLoading(true);
        try {
            const fetched = await fetchModels(bypassCache);
            setModels(fetched);
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
        const hasNvidia = !!appSettings?.nvidia?.apiKey;
        const hasOpenAI = !!appSettings?.openai?.apiKey;
        const hasAnthropic = !!appSettings?.anthropic?.apiKey;
        const hasGroq = !!appSettings?.groq?.apiKey;

        if (hasNvidia || hasOpenAI || hasAnthropic || hasGroq) {
            void refreshModels(true);
        }
    }, [
        refreshModels,
        appSettings?.nvidia?.apiKey,
        appSettings?.openai?.apiKey,
        appSettings?.anthropic?.apiKey,
        appSettings?.groq?.apiKey
    ]);

    useEffect(() => {
        if (appSettings?.general.defaultModel) {
            selection.setSelectedModel(appSettings.general.defaultModel);
            selection.setSelectedProvider(appSettings.general.lastProvider ?? '');

            if (selection.selectedModels.length === 0) {
                selection.setSelectedModels([{
                    provider: appSettings.general.lastProvider ?? '',
                    model: appSettings.general.defaultModel
                }]);
            }
        }
    }, [appSettings, selection.selectedModels.length, selection]);

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
        const newFavorites = isFav
            ? currentFavorites.filter(id => id !== modelId)
            : [...currentFavorites, modelId];

        setAppSettings({
            ...appSettings,
            general: { ...appSettings.general, favoriteModels: newFavorites }
        });
    }, [appSettings, setAppSettings]);

    const isFavorite = useCallback((modelId: string) => {
        return appSettings?.general.favoriteModels?.includes(modelId) ?? false;
    }, [appSettings]);

    const getModelReasoningLevel = useCallback((modelId: string) => {
        return appSettings?.modelSettings?.[modelId]?.reasoningLevel;
    }, [appSettings]);

    const setModelReasoningLevel = useCallback((modelId: string, reasoningLevel: string) => {
        if (!appSettings) { return; }
        const modelSettings = { ...(appSettings.modelSettings ?? {}) };
        const current = modelSettings[modelId] ?? {};
        modelSettings[modelId] = { ...current, reasoningLevel };

        setAppSettings({
            ...appSettings,
            modelSettings
        });
    }, [appSettings, setAppSettings]);

    return useMemo(() => ({
        models,
        groupedModels,
        ...selection,
        proxyModels,
        isLoading,
        refreshModels,
        loadModels: refreshModels,
        persistLastSelection,
        toggleFavorite,
        isFavorite,
        getModelReasoningLevel,
        setModelReasoningLevel
    }), [
        models, groupedModels, selection, proxyModels, isLoading, refreshModels,
        persistLastSelection, toggleFavorite, isFavorite, getModelReasoningLevel, setModelReasoningLevel
    ]);
}

